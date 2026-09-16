-- Security: the self-confirmation fix applied to credit_endorsements
-- (20260806054700_prevent_self_cosign.sql) was never propagated to the two
-- sibling systems that write into the same shared credits.verification_status
-- / credits.endorsement_count columns:
--
-- 1. credit_vouches / vouch_on_credit -- the system actually wired to
--    NotificationCenter.tsx's "Yes, I worked on this" flow. A credit owner
--    can add themselves to their own credits.collaborator_user_ids (that
--    column has no server-side restriction) and then vouch for themselves,
--    passing both the RLS INSERT policy and the RPC's own membership check.
--
-- 2. increment_endorsement_count -- called from CreditVerificationPanel.tsx.
--    Its "tagged collaborator" authorization branch has the identical gap,
--    AND separately has no replay protection at all: an authorized caller
--    (including a self-tagged owner) can call it repeatedly, each call
--    unconditionally incrementing endorsement_count and re-evaluating the
--    ">=2 -> verified" threshold -- two calls from one session is enough to
--    force 'verified' with a single real (or zero real) endorsers.
--
-- Both fixes below are additive and reversible via a follow-up migration.
-- No bypass/exception added, since no legitimate product flow requires a
-- user to self-vouch or to be counted twice for the same credit.

-- ============================================================
-- Fix 1: credit_vouches / vouch_on_credit -- close the self-vouch gap
-- ============================================================

-- RLS layer: a direct table INSERT can never self-vouch, even if some
-- future code path bypasses the RPC (defense in depth, same pattern as
-- the credit_endorsements fix).
DROP POLICY IF EXISTS "Tagged collaborators can vouch" ON public.credit_vouches;
CREATE POLICY "Tagged collaborators can vouch"
  ON public.credit_vouches FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = voucher_id
    AND EXISTS (
      SELECT 1 FROM public.credits c
      WHERE c.id = credit_id
        AND auth.uid() = ANY(c.collaborator_user_ids)
        AND c.user_id <> auth.uid()
    )
  );

-- RPC layer: same guard, checked before any write.
CREATE OR REPLACE FUNCTION public.vouch_on_credit(
  _credit_id UUID,
  _action TEXT,
  _note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _voucher_id UUID := auth.uid();
  _credit RECORD;
  _voucher_name TEXT;
  _existing_action TEXT;
BEGIN
  IF _voucher_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF _action NOT IN ('vouched', 'rejected') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid action');
  END IF;

  SELECT id, user_id, project_name, collaborator_user_ids
  INTO _credit
  FROM public.credits
  WHERE id = _credit_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Credit not found');
  END IF;

  IF _credit.user_id = _voucher_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'You cannot vouch for your own credit');
  END IF;

  IF _credit.collaborator_user_ids IS NULL OR NOT (_voucher_id = ANY(_credit.collaborator_user_ids)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You were not tagged on this credit');
  END IF;

  SELECT action INTO _existing_action
  FROM public.credit_vouches
  WHERE credit_id = _credit_id AND voucher_id = _voucher_id;

  INSERT INTO public.credit_vouches (credit_id, voucher_id, action, note)
  VALUES (_credit_id, _voucher_id, _action, _note)
  ON CONFLICT (credit_id, voucher_id)
  DO UPDATE SET action = EXCLUDED.action, note = EXCLUDED.note, updated_at = now();

  IF _existing_action IS NULL AND _action = 'vouched' THEN
    UPDATE public.credits SET endorsement_count = COALESCE(endorsement_count, 0) + 1
    WHERE id = _credit_id;
  ELSIF _existing_action = 'vouched' AND _action = 'rejected' THEN
    UPDATE public.credits SET endorsement_count = GREATEST(COALESCE(endorsement_count, 0) - 1, 0)
    WHERE id = _credit_id;
  ELSIF _existing_action = 'rejected' AND _action = 'vouched' THEN
    UPDATE public.credits SET endorsement_count = COALESCE(endorsement_count, 0) + 1
    WHERE id = _credit_id;
  END IF;

  SELECT COALESCE(full_name, username, 'Someone') INTO _voucher_name
  FROM public.profiles WHERE id = _voucher_id;

  IF _credit.user_id IS NOT NULL AND _credit.user_id <> _voucher_id THEN
    INSERT INTO public.notifications (user_id, type, title, message, link, action_url, action_text, priority, category)
    VALUES (
      _credit.user_id,
      CASE WHEN _action = 'vouched' THEN 'vouch_received' ELSE 'vouch_rejected' END,
      CASE WHEN _action = 'vouched'
        THEN _voucher_name || ' vouched for your credit'
        ELSE _voucher_name || ' said they didn''t work on this'
      END,
      _voucher_name || ' responded to "' || COALESCE(_credit.project_name, 'your credit') || '"',
      '/profile',
      '/profile?credit=' || _credit_id::text,
      'View credit',
      CASE WHEN _action = 'vouched' THEN 'normal' ELSE 'high' END,
      'vouch'
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'action', _action);
END;
$$;

GRANT EXECUTE ON FUNCTION public.vouch_on_credit(UUID, TEXT, TEXT) TO authenticated;

-- ============================================================
-- Fix 2: increment_endorsement_count -- close the self-authorization gap
-- AND the replay gap
-- ============================================================

-- Tracks "this specific person has already caused one increment for this
-- credit via increment_endorsement_count" -- the table this RPC was
-- missing. credit_vouches and credit_endorsements each have their own
-- UNIQUE(credit_id, <actor>) constraint serving the identical purpose for
-- their own systems; this RPC had nothing equivalent.
CREATE TABLE IF NOT EXISTS public.credit_endorsement_count_grants (
  credit_id UUID NOT NULL REFERENCES public.credits(id) ON DELETE CASCADE,
  granted_to UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (credit_id, granted_to)
);

ALTER TABLE public.credit_endorsement_count_grants ENABLE ROW LEVEL SECURITY;

-- Read-only for clients (own rows only); all writes happen inside the
-- SECURITY DEFINER function below, never directly.
CREATE POLICY "Users can view their own count grants"
  ON public.credit_endorsement_count_grants FOR SELECT
  TO authenticated
  USING (auth.uid() = granted_to);

CREATE OR REPLACE FUNCTION public.increment_endorsement_count(credit_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_authorized boolean;
  v_insert_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.credit_endorsements
    WHERE credit_id = credit_id_param
      AND endorser_id = auth.uid()
      AND status = 'accepted'
  ) OR EXISTS (
    SELECT 1 FROM public.credits
    WHERE id = credit_id_param
      AND auth.uid() = ANY(COALESCE(collaborator_user_ids, ARRAY[]::uuid[]))
      AND user_id <> auth.uid()
  ) INTO v_authorized;

  IF NOT v_authorized THEN
    RAISE EXCEPTION 'You are not authorized to endorse this credit';
  END IF;

  -- Idempotency: only the first authorized call from a given caller for a
  -- given credit actually increments. ON CONFLICT DO NOTHING makes this
  -- safe under a race (two concurrent calls from the same caller) as well
  -- as a simple repeated call.
  INSERT INTO public.credit_endorsement_count_grants (credit_id, granted_to)
  VALUES (credit_id_param, auth.uid())
  ON CONFLICT (credit_id, granted_to) DO NOTHING;

  GET DIAGNOSTICS v_insert_count = ROW_COUNT;
  IF v_insert_count = 0 THEN
    -- Row already existed from a prior call -- nothing new to count.
    RETURN;
  END IF;

  PERFORM set_config('app.credit_verification_authorized', 'true', true);

  UPDATE credits
  SET endorsement_count = COALESCE(endorsement_count, 0) + 1,
      verification_status = CASE
        WHEN COALESCE(endorsement_count, 0) + 1 >= 2 THEN 'verified'
        WHEN COALESCE(endorsement_count, 0) + 1 >= 1 THEN 'pending'
        ELSE verification_status
      END
  WHERE id = credit_id_param;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_endorsement_count(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.increment_endorsement_count(uuid) TO authenticated;
