-- ROLLBACK of apply-open-himalayas-2026-10-29.sql: close Himalayas again. Every other source and the kill switch are not touched.
-- Paste the whole file into the SQL editor of the kretopia-app project (the one that reaches the production database kwmcocsitwssrtzkdojh;
-- NOT Kretopia Connect) and run it once. Safe to run twice.
--
-- What it does: sets enabled = false on the himalayas source row (the row stays, with its run history; nothing is deleted).
-- What stays exactly as it is: the kill switch, both ceilings, every other source, every listing (the private drafts Himalayas already
-- imported are kept, and so are any that a curator published: remove them from /admin/external if you do not want them), every table of the app.
-- To stop EVERYTHING instead, use security/rollback-discovery-on-2026-10-29.sql.

BEGIN;

CREATE TEMP TABLE closing_sources (id text PRIMARY KEY);
INSERT INTO closing_sources (id) VALUES ('himalayas');

CREATE TEMP TABLE close_himalayas_before (listings bigint, kill_switch boolean, others_hash text, opened_enabled bigint);
DO $$
BEGIN
  IF to_regclass('public.discovery_sources') IS NULL OR to_regclass('public.discovery_settings') IS NULL THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: the discovery tables are missing; nothing was changed';
  END IF;
  INSERT INTO close_himalayas_before
    SELECT (SELECT count(*) FROM public.external_listings),
           (SELECT enabled FROM public.discovery_settings WHERE id),
           coalesce((SELECT md5(string_agg(x::text, '|' ORDER BY x.id)) FROM public.discovery_sources x WHERE x.id NOT IN (SELECT id FROM closing_sources)), ''),
           (SELECT count(*) FROM public.discovery_sources WHERE enabled AND id IN (SELECT id FROM closing_sources));
  RAISE NOTICE 'closing himalayas (% enabled row(s)); every other source and the kill switch stay as they are', (SELECT opened_enabled FROM close_himalayas_before);
END
$$;

UPDATE public.discovery_sources SET enabled = false, run_lock_until = NULL WHERE id IN (SELECT id FROM closing_sources);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.discovery_sources WHERE enabled AND id IN (SELECT id FROM closing_sources)) THEN
    RAISE EXCEPTION 'ROLLBACK CHECK FAILED: himalayas is still enabled';
  END IF;
  IF (SELECT enabled FROM public.discovery_settings WHERE id) IS DISTINCT FROM (SELECT kill_switch FROM close_himalayas_before)
     OR coalesce((SELECT md5(string_agg(x::text, '|' ORDER BY x.id)) FROM public.discovery_sources x WHERE x.id NOT IN (SELECT id FROM closing_sources)), '') IS DISTINCT FROM (SELECT others_hash FROM close_himalayas_before)
     OR (SELECT count(*) FROM public.external_listings) <> (SELECT listings FROM close_himalayas_before) THEN
    RAISE EXCEPTION 'ROLLBACK CHECK FAILED: something other than the himalayas source changed';
  END IF;
END
$$;

COMMIT;

-- RESULT (read-only). Expect one row: all three true; feed_drafts_kept is how many private feed drafts exist (they are not deleted).
SELECT
  NOT EXISTS (SELECT 1 FROM public.discovery_sources WHERE enabled AND id IN (SELECT id FROM closing_sources))              AS himalayas_is_closed,
  (SELECT enabled FROM public.discovery_settings WHERE id) = (SELECT kill_switch FROM close_himalayas_before)                AS kill_switch_untouched,
  coalesce((SELECT md5(string_agg(x::text, '|' ORDER BY x.id)) FROM public.discovery_sources x WHERE x.id NOT IN (SELECT id FROM closing_sources)), '')
    = (SELECT others_hash FROM close_himalayas_before)                                                                       AS other_sources_untouched,
  (SELECT count(*) FROM public.external_listings WHERE status = 'draft' AND created_by IS NULL)                              AS feed_drafts_kept;
