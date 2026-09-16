
-- ============================================================
-- Credit Vouches Table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.credit_vouches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  credit_id UUID NOT NULL REFERENCES public.credits(id) ON DELETE CASCADE,
  voucher_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('vouched', 'rejected')),
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (credit_id, voucher_id)
);

CREATE INDEX IF NOT EXISTS idx_credit_vouches_credit ON public.credit_vouches(credit_id);
CREATE INDEX IF NOT EXISTS idx_credit_vouches_voucher ON public.credit_vouches(voucher_id);

ALTER TABLE public.credit_vouches ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read vouches (they're public trust signals)
CREATE POLICY "Vouches are viewable by authenticated users"
  ON public.credit_vouches FOR SELECT
  TO authenticated
  USING (true);

-- A user can only insert a vouch as themselves AND must be in collaborator_user_ids
CREATE POLICY "Tagged collaborators can vouch"
  ON public.credit_vouches FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = voucher_id
    AND EXISTS (
      SELECT 1 FROM public.credits c
      WHERE c.id = credit_id
        AND auth.uid() = ANY(c.collaborator_user_ids)
    )
  );

CREATE POLICY "Users can update their own vouch"
  ON public.credit_vouches FOR UPDATE
  TO authenticated
  USING (auth.uid() = voucher_id);

CREATE POLICY "Users can delete their own vouch"
  ON public.credit_vouches FOR DELETE
  TO authenticated
  USING (auth.uid() = voucher_id);

-- Trigger to keep updated_at fresh
CREATE TRIGGER update_credit_vouches_updated_at
  BEFORE UPDATE ON public.credit_vouches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- One-tap vouch RPC (security definer, validates collaborator membership)
-- ============================================================
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

  -- Load credit and verify the caller is a tagged collaborator
  SELECT id, user_id, project_name, collaborator_user_ids
  INTO _credit
  FROM public.credits
  WHERE id = _credit_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Credit not found');
  END IF;

  IF _credit.collaborator_user_ids IS NULL OR NOT (_voucher_id = ANY(_credit.collaborator_user_ids)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You were not tagged on this credit');
  END IF;

  -- Capture previous action (so we don't double-bump endorsement_count)
  SELECT action INTO _existing_action
  FROM public.credit_vouches
  WHERE credit_id = _credit_id AND voucher_id = _voucher_id;

  -- Upsert the vouch
  INSERT INTO public.credit_vouches (credit_id, voucher_id, action, note)
  VALUES (_credit_id, _voucher_id, _action, _note)
  ON CONFLICT (credit_id, voucher_id)
  DO UPDATE SET action = EXCLUDED.action, note = EXCLUDED.note, updated_at = now();

  -- Maintain endorsement_count on credits
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

  -- Get voucher name for the notification
  SELECT COALESCE(full_name, username, 'Someone') INTO _voucher_name
  FROM public.profiles WHERE id = _voucher_id;

  -- Notify the credit owner (skip self-vouches)
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
-- Trigger: notify tagged collaborators when a credit is created
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_collaborators_on_credit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _collab_id UUID;
  _owner_name TEXT;
BEGIN
  IF NEW.collaborator_user_ids IS NULL OR array_length(NEW.collaborator_user_ids, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(full_name, username, 'Someone') INTO _owner_name
  FROM public.profiles WHERE id = NEW.user_id;

  FOREACH _collab_id IN ARRAY NEW.collaborator_user_ids LOOP
    -- Don't notify the owner about themselves
    IF _collab_id IS NOT NULL AND _collab_id <> NEW.user_id THEN
      INSERT INTO public.notifications (
        user_id, type, title, message, link, action_url, action_text, priority, category
      )
      VALUES (
        _collab_id,
        'vouch_request',
        _owner_name || ' tagged you on a credit',
        'Confirm you worked on "' || COALESCE(NEW.project_name, 'this project') || '"',
        '/profile/' || NEW.user_id::text,
        '/profile?credit=' || NEW.id::text,
        'Review credit',
        'high',
        'vouch_request'
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_collaborators ON public.credits;
CREATE TRIGGER trg_notify_collaborators
  AFTER INSERT ON public.credits
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_collaborators_on_credit();

-- ============================================================
-- Backfill RPC: send vouch requests for existing credits
-- (caller must be admin or service_role; we keep this safe via simple guard)
-- ============================================================
CREATE OR REPLACE FUNCTION public.backfill_vouch_requests()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _credit RECORD;
  _collab_id UUID;
  _owner_name TEXT;
  _count INT := 0;
BEGIN
  -- Only allow admins to run this
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admin only');
  END IF;

  FOR _credit IN
    SELECT c.id, c.user_id, c.project_name, c.collaborator_user_ids
    FROM public.credits c
    WHERE c.collaborator_user_ids IS NOT NULL
      AND array_length(c.collaborator_user_ids, 1) > 0
  LOOP
    SELECT COALESCE(full_name, username, 'Someone') INTO _owner_name
    FROM public.profiles WHERE id = _credit.user_id;

    FOREACH _collab_id IN ARRAY _credit.collaborator_user_ids LOOP
      IF _collab_id IS NOT NULL AND _collab_id <> _credit.user_id THEN
        -- Skip if this collaborator already has a vouch_request notification for this credit
        IF NOT EXISTS (
          SELECT 1 FROM public.notifications
          WHERE user_id = _collab_id
            AND category = 'vouch_request'
            AND action_url = '/profile?credit=' || _credit.id::text
        ) AND NOT EXISTS (
          SELECT 1 FROM public.credit_vouches
          WHERE credit_id = _credit.id AND voucher_id = _collab_id
        ) THEN
          INSERT INTO public.notifications (
            user_id, type, title, message, link, action_url, action_text, priority, category
          )
          VALUES (
            _collab_id,
            'vouch_request',
            COALESCE(_owner_name, 'Someone') || ' tagged you on a credit',
            'Confirm you worked on "' || COALESCE(_credit.project_name, 'this project') || '"',
            '/profile/' || _credit.user_id::text,
            '/profile?credit=' || _credit.id::text,
            'Review credit',
            'high',
            'vouch_request'
          );
          _count := _count + 1;
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'notifications_sent', _count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.backfill_vouch_requests() TO authenticated;
