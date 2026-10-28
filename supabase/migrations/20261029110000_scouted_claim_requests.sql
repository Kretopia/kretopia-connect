-- A scouted gig or event link starts a REQUEST to claim. It never makes anyone the owner.
--
-- PROBLEM (read from 20261009100000_opportunity_claim_by_token.sql and 20261009090300_scouted_event_claim_rpc.sql)
--   claim_scouted_opportunity(token) and claim_scouted_event(token) set created_by = auth.uid() and claim_status =
--   'claimed' for ANY signed-in caller who holds the token. The token is a share link: the scout hands it to the
--   publisher (get_or_create_opportunity_claim_token), so a link that is forwarded, pasted in a chat, screenshotted or
--   read from a log makes whoever opens it the owner: edit rights, applicants, the "claimed" trust label. Possession of
--   a link is not proof that someone publishes the gig or hosts the event. The external discovery loop already works the
--   other way (a link is an invitation to verify; ownership needs proof or a curator's decision).
--
-- FIX (this file is ADDITIVE and safe to apply before the frontend that uses it)
--   * scouted_claim_requests: one row per person asking to claim a gig or an event. Service role and the functions
--     below only (RLS on, no policy, no client grant).
--   * request_scouted_claim(kind, token): any signed-in person with a valid token for an UNCLAIMED target opens a
--     pending request. Nothing is claimed, no created_by changes. One open request per person and target, and at most
--     five open requests per person.
--   * list_scouted_claim_requests() and decide_scouted_claim(request, decision): admins only (external_is_admin, from
--     20261029100000). Approving is the ONLY path that sets created_by / claim_status = 'claimed', as a compare-and-swap
--     on "still unclaimed", and closes the other open requests for the same target.
--
-- The old functions keep working until 20261029110100 (apply it only after the frontend is published).
-- Rollback: DROP FUNCTION decide_scouted_claim(uuid, text), list_scouted_claim_requests(), request_scouted_claim(text, text);
--           DROP TABLE scouted_claim_requests.

CREATE TABLE IF NOT EXISTS public.scouted_claim_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('gig', 'event')),
  target_id uuid NOT NULL,
  claimant_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS scouted_claim_requests_one_open
  ON public.scouted_claim_requests (kind, target_id, claimant_user_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS scouted_claim_requests_open_by_claimant
  ON public.scouted_claim_requests (claimant_user_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS scouted_claim_requests_open_by_age
  ON public.scouted_claim_requests (created_at) WHERE status = 'pending';

ALTER TABLE public.scouted_claim_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.scouted_claim_requests FROM PUBLIC, anon, authenticated;

-- ── a person asks to claim ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.request_scouted_claim(p_kind text, p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_target uuid;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to ask to claim this' USING ERRCODE = '42501';
  END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('gig', 'event') THEN
    RETURN jsonb_build_object('requested', false, 'reason', 'invalid_kind');
  END IF;
  IF p_token IS NULL OR length(p_token) < 12 THEN
    RETURN jsonb_build_object('requested', false, 'reason', 'invalid_token');
  END IF;

  IF p_kind = 'gig' THEN
    SELECT o.id INTO v_target FROM public.opportunities o
     WHERE o.claim_token = p_token AND coalesce(o.claim_status, 'unclaimed') = 'unclaimed' LIMIT 1;
  ELSE
    SELECT j.id INTO v_target FROM public.creative_jams j
     WHERE j.claim_token = p_token AND j.claim_status = 'unclaimed' LIMIT 1;
  END IF;
  IF v_target IS NULL THEN
    -- an unknown token and an already claimed target answer the same way
    RETURN jsonb_build_object('requested', false, 'reason', 'not_available');
  END IF;

  SELECT r.id INTO v_id FROM public.scouted_claim_requests r
   WHERE r.kind = p_kind AND r.target_id = v_target AND r.claimant_user_id = v_uid AND r.status = 'pending';
  IF v_id IS NULL THEN
    IF (SELECT count(*) FROM public.scouted_claim_requests r WHERE r.claimant_user_id = v_uid AND r.status = 'pending') >= 5 THEN
      RETURN jsonb_build_object('requested', false, 'reason', 'too_many_open');
    END IF;
    INSERT INTO public.scouted_claim_requests (kind, target_id, claimant_user_id)
    VALUES (p_kind, v_target, v_uid)
    ON CONFLICT (kind, target_id, claimant_user_id) WHERE status = 'pending' DO NOTHING
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN
      SELECT r.id INTO v_id FROM public.scouted_claim_requests r
       WHERE r.kind = p_kind AND r.target_id = v_target AND r.claimant_user_id = v_uid AND r.status = 'pending';
    END IF;
  END IF;

  -- A request is not ownership, and the answer says so.
  RETURN jsonb_build_object('requested', true, 'verified', false, 'request_id', v_id, 'status', 'pending');
END;
$$;

-- ── a curator reads the open requests ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.list_scouted_claim_requests()
RETURNS TABLE(id uuid, kind text, target_id uuid, title text, claimant_user_id uuid, claimant_name text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.external_is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT r.id, r.kind, r.target_id,
           CASE WHEN r.kind = 'gig' THEN (SELECT o.title FROM public.opportunities o WHERE o.id = r.target_id)
                ELSE (SELECT j.title FROM public.creative_jams j WHERE j.id = r.target_id) END,
           r.claimant_user_id,
           (SELECT p.full_name FROM public.profiles p WHERE p.user_id = r.claimant_user_id LIMIT 1),
           r.created_at
      FROM public.scouted_claim_requests r
     WHERE r.status = 'pending'
     ORDER BY r.created_at
     LIMIT 200;
END;
$$;

-- ── a curator decides ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.decide_scouted_claim(p_request uuid, p_decision text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_admin uuid := auth.uid();
  r public.scouted_claim_requests%ROWTYPE;
  v_done uuid;
BEGIN
  IF NOT public.external_is_admin(v_admin) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('approve', 'reject') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bad_decision');
  END IF;

  -- Lock order is always TARGET first, then the request, so curators deciding on the same target queue up in one order.
  -- (A precaution: a deadlock with the other order was suspected but could not be reproduced.) Read without a lock to find the target.
  SELECT * INTO r FROM public.scouted_claim_requests WHERE id = p_request;
  IF NOT FOUND OR r.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_pending');
  END IF;

  IF p_decision = 'reject' THEN
    UPDATE public.scouted_claim_requests SET status = 'rejected', decided_by = v_admin, decided_at = now()
     WHERE id = r.id AND status = 'pending' RETURNING id INTO v_done;
    IF v_done IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_pending'); END IF;
    RETURN jsonb_build_object('ok', true, 'status', 'rejected');
  END IF;

  IF r.kind = 'gig' THEN
    PERFORM 1 FROM public.opportunities WHERE id = r.target_id FOR UPDATE;
  ELSE
    PERFORM 1 FROM public.creative_jams WHERE id = r.target_id FOR UPDATE;
  END IF;
  SELECT * INTO r FROM public.scouted_claim_requests WHERE id = p_request FOR UPDATE;
  IF r.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_pending'); -- decided while this call waited for the target
  END IF;

  -- The only place a scouted target changes hands: still unclaimed at this very moment, or nothing changes.
  IF r.kind = 'gig' THEN
    UPDATE public.opportunities SET created_by = r.claimant_user_id, claim_status = 'claimed'
     WHERE id = r.target_id AND coalesce(claim_status, 'unclaimed') = 'unclaimed'
    RETURNING id INTO v_done;
  ELSE
    UPDATE public.creative_jams SET created_by = r.claimant_user_id, claim_status = 'claimed'
     WHERE id = r.target_id AND claim_status = 'unclaimed'
    RETURNING id INTO v_done;
  END IF;
  IF v_done IS NULL THEN
    UPDATE public.scouted_claim_requests SET status = 'rejected', decided_by = v_admin, decided_at = now() WHERE id = r.id;
    RETURN jsonb_build_object('ok', false, 'reason', 'not_available');
  END IF;

  UPDATE public.scouted_claim_requests SET status = 'approved', decided_by = v_admin, decided_at = now() WHERE id = r.id;
  UPDATE public.scouted_claim_requests SET status = 'rejected', decided_by = v_admin, decided_at = now()
   WHERE kind = r.kind AND target_id = r.target_id AND status = 'pending' AND id <> r.id;
  RETURN jsonb_build_object('ok', true, 'status', 'approved', 'kind', r.kind, 'target_id', r.target_id);
END;
$$;

REVOKE ALL ON FUNCTION public.request_scouted_claim(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_scouted_claim(text, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.list_scouted_claim_requests() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_scouted_claim_requests() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.decide_scouted_claim(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decide_scouted_claim(uuid, text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
