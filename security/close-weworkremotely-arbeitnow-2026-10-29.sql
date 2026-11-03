-- OPTIONAL: close We Work Remotely and Arbeitnow (stop reading them) until you have their written permission. Every other source stays as it is.
-- Paste the whole file into the SQL editor of the kretopia-app project (the one that reaches the production database kwmcocsitwssrtzkdojh;
-- NOT Kretopia Connect) and run it once. Safe to run twice.
--
-- Why you may want it (terms read 2026-10-29, not legal advice):
--   * Arbeitnow: its terms of service, section 2.1, forbid using "the materials" for "any public display (commercial or non-commercial)" and
--     to "mirror" them; section 11 (API) only asks for a link back and reserves the right to revoke the permission at any time. Nothing says
--     the API is exempt from section 2.
--   * We Work Remotely: the RSS page says the feed is open to anyone who credits We Work Remotely, but its separate "Terms & Guidelines" page
--     (https://weworkremotely.com/api-terms-and-guidelines, read through a search summary of the official page, the page itself sits behind a
--     bot challenge) says applying must be routed through weworkremotely.com, bars a "job advertising or job search service" and bars
--     scraping, copying, saving or storing its data. It is not clear whether that page covers the RSS feeds; the contact it names is
--     hello@weworkremotely.com.
--   Nothing from either source is public today (all of their listings are private drafts). Closing the sources stops new drafts from being stored.
--
-- What it does (one write): discovery_sources.enabled = false for the ids in the list below. The rows stay with their history. Delete a line to
-- keep that source open. It does NOT delete the private drafts already imported (123 on 2026-10-29): reject them from /admin/external if you want
-- them gone. To open a source again later: UPDATE public.discovery_sources SET enabled = true WHERE id = '<id>';
-- Every other source row, the kill switch, both ceilings and every listing are checked unchanged; any surprise rolls the whole script back.

BEGIN;

CREATE TEMP TABLE closing_sources (id text PRIMARY KEY);
INSERT INTO closing_sources (id) VALUES ('weworkremotely'), ('arbeitnow');

CREATE TEMP TABLE close_two_before (listings bigint, kill_switch boolean, others_hash text, opened_enabled bigint);
DO $$
DECLARE unknown_ids text;
BEGIN
  IF to_regclass('public.discovery_sources') IS NULL OR to_regclass('public.discovery_settings') IS NULL THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: the discovery tables are missing; nothing was changed';
  END IF;
  SELECT string_agg(id, ', ') INTO unknown_ids FROM closing_sources WHERE id NOT IN ('weworkremotely', 'arbeitnow');
  IF unknown_ids IS NOT NULL THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: % is not one of the two sources this script closes; nothing was changed', unknown_ids;
  END IF;
  INSERT INTO close_two_before
    SELECT (SELECT count(*) FROM public.external_listings),
           (SELECT enabled FROM public.discovery_settings WHERE id),
           coalesce((SELECT md5(string_agg(x::text, '|' ORDER BY x.id)) FROM public.discovery_sources x WHERE x.id NOT IN (SELECT id FROM closing_sources)), ''),
           (SELECT count(*) FROM public.discovery_sources WHERE enabled AND id IN (SELECT id FROM closing_sources));
  RAISE NOTICE 'closing % enabled source(s) among weworkremotely / arbeitnow; every other source and the kill switch stay as they are', (SELECT opened_enabled FROM close_two_before);
END
$$;

UPDATE public.discovery_sources SET enabled = false, run_lock_until = NULL WHERE id IN (SELECT id FROM closing_sources);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.discovery_sources WHERE enabled AND id IN (SELECT id FROM closing_sources)) THEN
    RAISE EXCEPTION 'CHECK FAILED: a source of the list is still enabled';
  END IF;
  IF (SELECT enabled FROM public.discovery_settings WHERE id) IS DISTINCT FROM (SELECT kill_switch FROM close_two_before)
     OR coalesce((SELECT md5(string_agg(x::text, '|' ORDER BY x.id)) FROM public.discovery_sources x WHERE x.id NOT IN (SELECT id FROM closing_sources)), '') IS DISTINCT FROM (SELECT others_hash FROM close_two_before)
     OR (SELECT count(*) FROM public.external_listings) <> (SELECT listings FROM close_two_before) THEN
    RAISE EXCEPTION 'CHECK FAILED: something other than the listed sources changed';
  END IF;
END
$$;

COMMIT;

-- RESULT (read-only). Expect one row: three true; the number is how many private drafts exist (none is deleted).
SELECT
  NOT EXISTS (SELECT 1 FROM public.discovery_sources WHERE enabled AND id IN (SELECT id FROM closing_sources))              AS listed_sources_closed,
  (SELECT enabled FROM public.discovery_settings WHERE id) = (SELECT kill_switch FROM close_two_before)                       AS kill_switch_untouched,
  coalesce((SELECT md5(string_agg(x::text, '|' ORDER BY x.id)) FROM public.discovery_sources x WHERE x.id NOT IN (SELECT id FROM closing_sources)), '')
    = (SELECT others_hash FROM close_two_before)                                                                               AS other_sources_untouched,
  (SELECT count(*) FROM public.external_listings WHERE status = 'draft' AND created_by IS NULL)                               AS feed_drafts_kept;
