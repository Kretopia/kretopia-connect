-- Security: prevent a credit owner from co-signing (endorsing) their own
-- credit-verification request. Two independent code paths can respond to
-- an endorsement, so both are closed:
--
-- 1. submit_credit_endorsement_by_token (anonymous/token flow, for external
--    collaborators without an account) -- SECURITY DEFINER, granted to
--    `anon` on purpose. We can't require auth.uid() to be present, but
--    when the caller *does* have a session and it matches requested_by,
--    that's the credit owner responding to their own invite -- reject it.
--
-- 2. Direct client UPDATE from CreditVerificationPanel.tsx (in-app flow,
--    for a collaborator who already has a Kretopia account) -- this path
--    never went through the RPC at all and relied entirely on the
--    "Endorsers can respond" RLS policy, which had no self-endorsement
--    check. Tightened at the RLS layer so it's enforced regardless of
--    which client code calls it (defense in depth).
--
-- Both changes are additive and reversible via a follow-up migration.
-- No bypass/exception added, since no legitimate product flow requires a
-- user to self-approve their own credit.

-- Fix 1: tighten RLS so a direct table UPDATE can never self-approve,
-- even if some future code path also bypasses the RPC.
DROP POLICY IF EXISTS "Endorsers can respond" ON public.credit_endorsements;
CREATE POLICY "Endorsers can respond" ON public.credit_endorsements
  FOR UPDATE TO authenticated
  USING (endorser_id = auth.uid() AND requested_by <> auth.uid());

-- Fix 2: same guard in the token/anon RPC.
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
  SELECT ce.id, ce.credit_id, ce.status, ce.requested_by
  INTO _endorsement
  FROM public.credit_endorsements ce
  WHERE ce.token = _token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Verification link not found');
  END IF;

  IF _endorsement.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This request has already been answered', 'status', _endorsement.status);
  END IF;

  -- Self-endorsement guard: only meaningful when the caller is authenticated.
  -- Anonymous responders (the normal, expected path for an external
  -- collaborator without an account) are unaffected.
  IF _caller IS NOT NULL AND _caller = _endorsement.requested_by THEN
    RETURN jsonb_build_object('success', false, 'error', 'You cannot co-sign your own credit');
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
