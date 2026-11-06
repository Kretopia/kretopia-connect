-- Repair for 20261106100000_cosign_recipient_authority.sql, if it was applied BEFORE its same-day correction.
--
-- That first version re-declared submit_credit_endorsement_by_token without authorizing it to the credits guard
-- (guard_credit_verification_escalation refuses 'peer' / 'verified' unless the function sets app.credit_verification_authorized).
-- With it in place every ACCEPTED co-sign fails with "verification_status cannot be escalated to peer directly", for guests and
-- members alike; declines still work. Until this file is applied, accepted co-signs do not save.
--
-- Safe to apply whatever the state: it only re-declares the one function (CREATE OR REPLACE), identical to the corrected version of
-- 20261106100000. If you applied the corrected 20261106100000, this is a no-op. No data change.
-- Check afterwards with docs/security/VERIFY_PENDING_MIGRATIONS_20261106.sql: the Co-Sign guard line must read OK.

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
