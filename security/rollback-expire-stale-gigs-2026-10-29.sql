-- ROLLBACK of apply-expire-stale-gigs-2026-10-29.sql: bring back the public view WITHOUT the 30-day rule (it keeps security_barrier on and the
-- closed grants of apply-close-view-writes-2026-10-29.sql; it does NOT reopen write access).
-- Paste the whole file into the SQL editor of the production database and run it once. Safe to run twice.
-- What changes: gigs older than 30 days (by their source date) become public again. Nothing else; no data is touched.

BEGIN;

CREATE TEMP TABLE unexpire_before (listings bigint, public_rows bigint);
DO $$
BEGIN
  IF to_regclass('public.public_external_listings') IS NULL THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: the public view is missing; nothing was changed';
  END IF;
  INSERT INTO unexpire_before SELECT (SELECT count(*) FROM public.external_listings), (SELECT count(*) FROM public.public_external_listings);
  RAISE NOTICE 'preflight ok: % public listing(s) now', (SELECT public_rows FROM unexpire_before);
END
$$;

CREATE OR REPLACE VIEW public.public_external_listings WITH (security_barrier = true) AS
  SELECT id, kind, status, title, original_publisher, location, remote_scope, source_published_at, deadline_at, deadline_tz,
         budget, apply_url, excerpt, description_full, starts_at, ends_at, roles, verification_status, last_checked_at,
         source_provider, source_url, applications_enabled, (status = 'claimed') AS claimed
  FROM public.external_listings
  WHERE status IN ('published', 'claimed') AND visibility = 'public' AND NOT flagged_instructions
    AND (deadline_at IS NULL OR deadline_at > now());

REVOKE ALL ON public.public_external_listings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.public_external_listings TO anon, authenticated;
GRANT ALL ON public.public_external_listings TO service_role;

DO $$
BEGIN
  IF position('30 days' in pg_get_viewdef('public.public_external_listings'::regclass)) > 0 THEN RAISE EXCEPTION 'ROLLBACK CHECK FAILED: the age rule is still in the view'; END IF;
  IF has_table_privilege('anon', 'public.public_external_listings', 'UPDATE') OR has_table_privilege('authenticated', 'public.public_external_listings', 'UPDATE')
     OR NOT has_table_privilege('anon', 'public.public_external_listings', 'SELECT') THEN
    RAISE EXCEPTION 'ROLLBACK CHECK FAILED: the view grants are not "clients read only"';
  END IF;
  IF (SELECT count(*) FROM public.external_listings) <> (SELECT listings FROM unexpire_before) THEN RAISE EXCEPTION 'ROLLBACK CHECK FAILED: a listing count changed'; END IF;
END
$$;

COMMIT;

-- RESULT (read-only). Expect one row: three true; public_rows_now is at least the number before (listings the rule had hidden come back).
SELECT
  position('30 days' in pg_get_viewdef('public.public_external_listings'::regclass)) = 0                                         AS age_rule_removed,
  NOT (has_table_privilege('anon', 'public.public_external_listings', 'UPDATE') OR has_table_privilege('authenticated', 'public.public_external_listings', 'UPDATE')) AS clients_still_cannot_write,
  (SELECT count(*) FROM public.external_listings) = (SELECT listings FROM unexpire_before)                                       AS no_listing_changed,
  (SELECT public_rows FROM unexpire_before)                                                                                      AS public_rows_before,
  (SELECT count(*) FROM public.public_external_listings)                                                                         AS public_rows_now;
