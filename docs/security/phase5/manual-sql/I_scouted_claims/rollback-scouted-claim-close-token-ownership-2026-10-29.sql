-- ROLLBACK (2 of 2): put the two OLD claim function bodies back (claim_scouted_opportunity, claim_scouted_event), exactly as
-- supabase/migrations/20261009100000_opportunity_claim_by_token.sql and 20261009090300_scouted_event_claim_rpc.sql created them.
-- WARNING: this RE-OPENS the hole it was written to close: any signed-in person who holds a claim link becomes the owner of that gig or
-- event again. Use it only if the new claim pages cannot be used, and prefer fixing them. Name, signature and grants are untouched.
-- Paste into the SQL editor of the production database and run once. Nothing else is changed (migration 1 stays in place).

DO $$
BEGIN
  IF to_regprocedure('public.claim_scouted_opportunity(text)') IS NULL OR to_regprocedure('public.claim_scouted_event(text)') IS NULL THEN
    RAISE EXCEPTION 'ROLLBACK STOPPED: an old claim function is missing; nothing was changed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid IN ('public.claim_scouted_opportunity(text)'::regprocedure, 'public.claim_scouted_event(text)'::regprocedure) AND prosrc LIKE '%verification_required%') THEN
    RAISE NOTICE 'nothing to restore: neither function is closed (the second migration is not applied)';
  END IF;
END
$$;

BEGIN;

CREATE OR REPLACE FUNCTION public.claim_scouted_opportunity(p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to claim this gig' USING ERRCODE = '42501';
  END IF;
  IF p_token IS NULL OR length(p_token) < 12 THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'invalid_token');
  END IF;

  UPDATE public.opportunities
     SET created_by = v_uid, claim_status = 'claimed'
   WHERE claim_token = p_token
     AND coalesce(claim_status, 'unclaimed') = 'unclaimed'
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'not_available');
  END IF;
  RETURN jsonb_build_object('claimed', true, 'opportunity_id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_scouted_event(p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to claim this event' USING ERRCODE = '42501';
  END IF;
  IF p_token IS NULL OR length(p_token) < 12 THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'invalid_token');
  END IF;

  UPDATE public.creative_jams
     SET created_by = v_uid, claim_status = 'claimed'
   WHERE claim_token = p_token
     AND claim_status = 'unclaimed'
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'not_available');
  END IF;
  RETURN jsonb_build_object('claimed', true, 'event_id', v_id);
END;
$$;

COMMIT;

-- Check (read-only): expect true, true, true. restored = the function body is byte-identical to the repo's original.
SELECT
  (SELECT md5(prosrc) = '1c80d25b37710ae962c2e83088d9b1b5' FROM pg_proc WHERE oid = 'public.claim_scouted_opportunity(text)'::regprocedure) AS gig_function_restored,
  (SELECT md5(prosrc) = '8edd9ae1f53c9055a84738ff38ecc641' FROM pg_proc WHERE oid = 'public.claim_scouted_event(text)'::regprocedure) AS event_function_restored,
  NOT (has_function_privilege('anon', 'public.claim_scouted_opportunity(text)', 'EXECUTE') OR has_function_privilege('anon', 'public.claim_scouted_event(text)', 'EXECUTE')) AS anon_still_cannot_execute;
