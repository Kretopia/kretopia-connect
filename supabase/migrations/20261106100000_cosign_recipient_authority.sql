-- Co-Sign: only the member a request was sent to can answer it.
--
-- PREPARED FOR REVIEW, NOT APPLIED. Production still runs the legacy backend, which cannot receive migrations from this repo.
-- Apply it in the Lovable Cloud / legacy SQL editor after running the preflight below.
--
-- The gap: a request created from the member picker carries endorser_id = the member it was sent to. The old
-- submit_credit_endorsement_by_token() only refused the credit owner and already-answered requests, so any other
-- account, or an anonymous caller, who held the token could accept or decline it. The token of such a request is also
-- readable by any signed-in account through the "Anyone can view endorsements" SELECT policy, which is why the check
-- has to live in the function and not in the link being hard to find.
--
-- What changes (signatures and grants are kept so old browser tabs keep working):
--   submit_credit_endorsement_by_token
--     * targeted request (endorser_id set): caller must be signed in AND be that member, otherwise nothing is written;
--     * guest request (endorser_id null): unchanged, the link is the bearer secret and a signed-in caller is recorded;
--     * the request row is locked FOR UPDATE, so two taps cannot both count towards endorsement_count;
--     * expired requests get their own message.
--   get_credit_endorsement_by_token
--     * adds addressed_to_member and can_respond so the page can say "this request is for another account" before the
--       person fills anything in. They are hints for the UI; the submit function above is the enforcement.
--
-- CORRECTION (2026-11-06, same day): the first committed version of this file re-declared submit_credit_endorsement_by_token
-- without the line that authorizes it to the credits guard (see the comment inside the function), so after it every ACCEPTED answer
-- failed with "verification_status cannot be escalated". Declines and refusals were unaffected. This file is the corrected one. If
-- the earlier version was already applied, apply 20261106130000_cosign_submit_raises_guard_flag.sql at once: until then accepted
-- co-signs fail. Found by running the migration on a real PostgreSQL engine on top of the guards that are in force.
--
-- Preflight (read-only):
--   SELECT count(*) FILTER (WHERE endorser_id IS NOT NULL AND status = 'pending') AS pending_targeted,
--          count(*) FILTER (WHERE endorser_id IS NULL     AND status = 'pending') AS pending_guest
--   FROM public.credit_endorsements;
--
-- Rollback: re-run the function bodies from 20260806054700_prevent_self_cosign.sql and 20260503031048_*.sql.
-- No data change.

DROP FUNCTION IF EXISTS public.get_credit_endorsement_by_token(TEXT);

CREATE FUNCTION public.get_credit_endorsement_by_token(_token TEXT)
RETURNS TABLE (
  id UUID,
  credit_id UUID,
  status TEXT,
  relationship TEXT,
  endorser_name TEXT,
  requested_at TIMESTAMPTZ,
  project_name TEXT,
  role TEXT,
  year INTEGER,
  requested_by UUID,
  requester_name TEXT,
  requester_avatar_url TEXT,
  addressed_to_member BOOLEAN,
  can_respond BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ce.id,
    ce.credit_id,
    ce.status,
    ce.relationship,
    ce.endorser_name,
    ce.requested_at,
    c.project_name,
    c.role,
    c.year,
    ce.requested_by,
    p.full_name AS requester_name,
    p.avatar_url AS requester_avatar_url,
    (ce.endorser_id IS NOT NULL) AS addressed_to_member,
    (
      auth.uid() IS DISTINCT FROM ce.requested_by
      AND (ce.endorser_id IS NULL OR ce.endorser_id = auth.uid())
    ) AS can_respond
  FROM public.credit_endorsements ce
  JOIN public.credits c ON c.id = ce.credit_id
  LEFT JOIN public.profiles p ON p.user_id = ce.requested_by
  WHERE ce.token = _token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_credit_endorsement_by_token(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_credit_endorsement_by_token(
  _token TEXT,
  _accepted BOOLEAN,
  _endorser_name TEXT DEFAULT NULL,
  _relationship TEXT DEFAULT NULL,
  _testimonial TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _endorsement RECORD;
  _new_count INTEGER;
  _caller UUID := auth.uid();
BEGIN
  SELECT ce.id, ce.credit_id, ce.status, ce.requested_by, ce.endorser_id
  INTO _endorsement
  FROM public.credit_endorsements ce
  WHERE ce.token = _token
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Verification link not found');
  END IF;

  -- Authority first, so a third account learns nothing about whether the request was already answered.
  IF _endorsement.endorser_id IS NOT NULL AND _caller IS DISTINCT FROM _endorsement.endorser_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', CASE
        WHEN _caller IS NULL THEN 'Sign in with the account this request was sent to'
        ELSE 'This request was sent to a different account'
      END,
      'code', CASE WHEN _caller IS NULL THEN 'sign_in_required' ELSE 'not_recipient' END
    );
  END IF;

  IF _caller IS NOT NULL AND _caller = _endorsement.requested_by THEN
    RETURN jsonb_build_object('success', false, 'error', 'You cannot co-sign your own credit', 'code', 'self_cosign');
  END IF;

  IF _endorsement.status = 'expired' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This request has expired. Ask for a new one.', 'status', 'expired', 'code', 'expired');
  END IF;

  IF _endorsement.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This request has already been answered', 'status', _endorsement.status, 'code', 'already_answered');
  END IF;

  UPDATE public.credit_endorsements
  SET
    status = CASE WHEN _accepted THEN 'accepted' ELSE 'declined' END,
    endorser_name = COALESCE(NULLIF(_endorser_name, ''), endorser_name),
    relationship = COALESCE(NULLIF(_relationship, ''), relationship),
    testimonial = CASE WHEN _accepted THEN NULLIF(_testimonial, '') ELSE NULL END,
    endorser_id = COALESCE(endorser_id, _caller),
    responded_at = now()
  WHERE id = _endorsement.id;

  IF _accepted THEN
    -- The credits table refuses any write of 'peer' or 'verified' that does not come from an authorized function
    -- (guard_credit_verification_escalation, 20260812071205 and 20261028130000). This flag, local to the transaction, is how this
    -- function is authorized. Without it every accepted answer fails, whoever gives it.
    PERFORM set_config('app.credit_verification_authorized', 'true', true);

    UPDATE public.credits
    SET
      endorsement_count = COALESCE(endorsement_count, 0) + 1,
      verification_status = CASE
        WHEN COALESCE(endorsement_count, 0) + 1 >= 2 THEN 'verified'
        ELSE 'peer'
      END
    WHERE id = _endorsement.credit_id
    RETURNING endorsement_count INTO _new_count;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'status', CASE WHEN _accepted THEN 'accepted' ELSE 'declined' END,
    'endorsement_count', COALESCE(_new_count, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_credit_endorsement_by_token(TEXT, BOOLEAN, TEXT, TEXT, TEXT) TO anon, authenticated;
