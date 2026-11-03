-- ROLLBACK: external discovery. Removes ONLY what supabase/migrations/20261029100000_external_discovery.sql created (8 tables,
-- 1 view, 17 functions). Nothing that existed before is touched. Paste into the SQL editor of the production database and
-- run once. WARNING: it deletes every discovered listing, claim, claim link, audit event and spend record created since the
-- apply; the counts are shown first. Turning the kill switch off or disabling a source stops automation without any deletion.

DO $$
BEGIN
  IF to_regclass('public.external_listings') IS NOT NULL THEN
    RAISE NOTICE 'about to delete % listing(s), % claim(s), % audit event(s)',
      (SELECT count(*) FROM public.external_listings), (SELECT count(*) FROM public.external_listing_claims), (SELECT count(*) FROM public.external_listing_events);
  END IF;
END
$$;

BEGIN;

  DROP VIEW IF EXISTS public.public_external_listings;
  DROP TABLE IF EXISTS public.external_listing_events, public.external_listing_claims, public.external_listing_claim_tokens,
    public.external_listings, public.discovery_spend_ledger, public.discovery_spend_counters, public.discovery_sources,
    public.discovery_settings CASCADE;
  DROP FUNCTION IF EXISTS public.external_is_admin(uuid), public.external_log(uuid, uuid, text, jsonb),
    public.import_external_listing(uuid, jsonb), public.review_external_listing(uuid, uuid, text, text),
    public.register_claim_token(uuid, uuid, text, timestamptz), public.redeem_claim_token(text, uuid, uuid),
    public.verify_external_claim(uuid, uuid, text, text, uuid), public.owner_update_external_listing(uuid, uuid, jsonb),
    public.set_external_applications(uuid, uuid, boolean), public.dispute_external_listing(uuid, uuid, text),
    public.reserve_discovery_spend(text, text, uuid, integer, integer), public.settle_discovery_spend(text, integer),
    public.expire_discovery_spend(), public.acquire_discovery_run(text, integer), public.release_discovery_run(text),
    public.record_discovery_run(text, boolean, text), public.reject_external_claim(uuid, uuid);

COMMIT;

-- Check (read-only): expect 0 for both.
SELECT
  (SELECT count(*) FROM unnest(ARRAY['discovery_settings', 'discovery_sources', 'external_listings', 'external_listing_claim_tokens', 'external_listing_claims', 'external_listing_events', 'discovery_spend_counters', 'discovery_spend_ledger']) t WHERE to_regclass('public.' || t) IS NOT NULL) AS tables_left,
  (SELECT count(*) FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname IN ('external_is_admin', 'external_log', 'import_external_listing', 'review_external_listing', 'register_claim_token', 'redeem_claim_token', 'verify_external_claim', 'reject_external_claim', 'owner_update_external_listing', 'set_external_applications', 'dispute_external_listing', 'reserve_discovery_spend', 'settle_discovery_spend', 'expire_discovery_spend', 'acquire_discovery_run', 'release_discovery_run', 'record_discovery_run')) AS functions_left;
