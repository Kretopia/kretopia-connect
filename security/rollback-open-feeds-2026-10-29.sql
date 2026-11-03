-- ROLLBACK of apply-open-feeds-2026-10-29.sql: close Remote OK, We Work Remotely and Arbeitnow again. Jobicy and the kill switch are not touched.
-- Paste the whole file into the SQL editor of the production database and run it once. Safe to run twice.
--
-- What it does: sets enabled = false on the three source rows (the rows stay, with their run history; nothing is deleted).
-- What stays exactly as it is: the kill switch, both ceilings, Jobicy, every listing (the private drafts the opened sources already
-- imported are kept: reject or remove them from /admin/external if you do not want them), every table of the app.
-- To stop EVERYTHING instead (Jobicy included), use security/rollback-discovery-on-2026-10-29.sql.

BEGIN;

CREATE TEMP TABLE closing_sources (id text PRIMARY KEY);
INSERT INTO closing_sources (id) VALUES ('remoteok'), ('weworkremotely'), ('arbeitnow');

CREATE TEMP TABLE close_feeds_before (listings bigint, kill_switch boolean, jobicy_enabled boolean, jobicy_fetches integer, opened_enabled bigint);
DO $$
BEGIN
  IF to_regclass('public.discovery_sources') IS NULL OR to_regclass('public.discovery_settings') IS NULL THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: the discovery tables are missing; nothing was changed';
  END IF;
  INSERT INTO close_feeds_before
    SELECT (SELECT count(*) FROM public.external_listings),
           (SELECT enabled FROM public.discovery_settings WHERE id),
           coalesce((SELECT enabled FROM public.discovery_sources WHERE id = 'jobicy'), false),
           (SELECT max_fetches_per_run FROM public.discovery_sources WHERE id = 'jobicy'),
           (SELECT count(*) FROM public.discovery_sources WHERE enabled AND id IN (SELECT id FROM closing_sources));
  RAISE NOTICE 'closing % enabled source(s) of remoteok / weworkremotely / arbeitnow; jobicy and the kill switch stay as they are', (SELECT opened_enabled FROM close_feeds_before);
END
$$;

UPDATE public.discovery_sources SET enabled = false, run_lock_until = NULL WHERE id IN (SELECT id FROM closing_sources);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.discovery_sources WHERE enabled AND id IN (SELECT id FROM closing_sources)) THEN
    RAISE EXCEPTION 'ROLLBACK CHECK FAILED: a closed source is still enabled';
  END IF;
  IF (SELECT enabled FROM public.discovery_settings WHERE id) IS DISTINCT FROM (SELECT kill_switch FROM close_feeds_before)
     OR coalesce((SELECT enabled FROM public.discovery_sources WHERE id = 'jobicy'), false) IS DISTINCT FROM (SELECT jobicy_enabled FROM close_feeds_before)
     OR (SELECT max_fetches_per_run FROM public.discovery_sources WHERE id = 'jobicy') IS DISTINCT FROM (SELECT jobicy_fetches FROM close_feeds_before)
     OR (SELECT count(*) FROM public.external_listings) <> (SELECT listings FROM close_feeds_before) THEN
    RAISE EXCEPTION 'ROLLBACK CHECK FAILED: something other than the three sources changed';
  END IF;
END
$$;

COMMIT;

-- RESULT (read-only). Expect one row: all three true; feed_drafts_kept is how many private feed drafts exist (they are not deleted).
SELECT
  NOT EXISTS (SELECT 1 FROM public.discovery_sources WHERE enabled AND id IN (SELECT id FROM closing_sources))              AS the_three_are_closed,
  (SELECT enabled FROM public.discovery_settings WHERE id) = (SELECT kill_switch FROM close_feeds_before)                    AS kill_switch_untouched,
  coalesce((SELECT enabled FROM public.discovery_sources WHERE id = 'jobicy'), false) = (SELECT jobicy_enabled FROM close_feeds_before) AS jobicy_untouched,
  (SELECT count(*) FROM public.external_listings WHERE status = 'draft' AND created_by IS NULL)                              AS feed_drafts_kept;
