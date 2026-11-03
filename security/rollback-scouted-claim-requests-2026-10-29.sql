-- ROLLBACK: scouted gig/event claim requests (PR #278, migration 1). Removes ONLY what supabase/migrations/20261029110000_scouted_claim_requests.sql
-- created (1 table, 3 functions). Nothing that existed before is touched, and no gig or event changes hands. Paste into the SQL
-- editor of the production database and run once.
-- WARNING 1: it deletes every claim request created since the apply (the counts are shown first). Requests that were already
-- APPROVED stay approved on the gig or event itself (created_by was set on that row); only the request history goes.
-- WARNING 2: if the SECOND migration (20261029110100) was applied, restore the old claim function bodies first
-- (20261009100000 and 20261009090300), or claim links will have no working path. If the new frontend is published, republish the
-- previous version, or /claim-gig and /claim-event will answer "Request failed".

DO $$
BEGIN
  IF to_regclass('public.scouted_claim_requests') IS NOT NULL THEN
    RAISE NOTICE 'about to delete % request(s), % of them still open',
      (SELECT count(*) FROM public.scouted_claim_requests), (SELECT count(*) FROM public.scouted_claim_requests WHERE status = 'pending');
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname IN ('claim_scouted_opportunity', 'claim_scouted_event') AND p.prosrc LIKE '%verification_required%') THEN
    RAISE NOTICE 'WARNING: the second migration is applied (the old claim functions answer verification_required): restore their old bodies before relying on claim links';
  END IF;
END
$$;

BEGIN;

DROP FUNCTION IF EXISTS public.decide_scouted_claim(uuid, text), public.list_scouted_claim_requests(), public.request_scouted_claim(text, text);
DROP TABLE IF EXISTS public.scouted_claim_requests;

COMMIT;

-- Check (read-only): expect 0 for both.
SELECT
  (SELECT count(*) FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relname = 'scouted_claim_requests') AS table_left,
  (SELECT count(*) FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname IN ('request_scouted_claim', 'list_scouted_claim_requests', 'decide_scouted_claim')) AS functions_left;
