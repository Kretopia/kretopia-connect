-- Closes the old "the token is the owner" path for scouted gigs and events.
--
-- APPLY ONLY AFTER 20261029110000 IS APPLIED *AND* THE FRONTEND THAT CALLS request_scouted_claim IS PUBLISHED
-- (www.kretopia.com/version.json changed; /claim-gig/<token> and /claim-event/<token> show "Request sent").
-- Applying it earlier makes the OLD claim pages say "Couldn't claim" for everyone.
--
-- claim_scouted_opportunity(token) and claim_scouted_event(token) used to set created_by = auth.uid() for any signed-in
-- caller holding the token. They keep their name, signature and grants (so an old browser tab gets an answer, not a 404)
-- but no longer change anything: ownership now only moves through decide_scouted_claim, which needs an admin.
--
-- No data change. Rollback: re-run the two function bodies from 20261009100000 and 20261009090300.

CREATE OR REPLACE FUNCTION public.claim_scouted_opportunity(p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to claim this gig' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object('claimed', false, 'reason', 'verification_required');
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_scouted_event(p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to claim this event' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object('claimed', false, 'reason', 'verification_required');
END;
$$;

NOTIFY pgrst, 'reload schema';
