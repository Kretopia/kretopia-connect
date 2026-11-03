-- ROLLBACK: turn the external discovery automation OFF again (the kill switch, and every source). Paste into the SQL editor of the
-- production database and run once.
--
-- What it does: discovery_settings.enabled = false and discovery_sources.enabled = false for every source (and any run lock released).
-- What it does NOT do: it deletes nothing. The 'jobicy' row stays (disabled), and the feed drafts already imported stay as private drafts:
-- reject them from /admin/external (a rejected posting is not brought back by a later run) or leave them. Turning it back on is the
-- apply script. The kill switch alone already stops every run, manual or scheduled.

DO $$
BEGIN
  RAISE NOTICE 'turning off: kill switch is %, % source(s) enabled, % feed draft(s) stay as they are',
    (SELECT enabled FROM public.discovery_settings WHERE id), (SELECT count(*) FROM public.discovery_sources WHERE enabled),
    (SELECT count(*) FROM public.external_listings WHERE status = 'draft' AND created_by IS NULL);
END
$$;

BEGIN;

UPDATE public.discovery_settings SET enabled = false, updated_at = now() WHERE id;
UPDATE public.discovery_sources SET enabled = false, run_lock_until = NULL WHERE enabled OR run_lock_until IS NOT NULL;

COMMIT;

-- Check (read-only): expect true, true. feed_drafts_kept is how many private feed drafts remain.
SELECT
  NOT (SELECT enabled FROM public.discovery_settings WHERE id)                  AS kill_switch_off,
  NOT EXISTS (SELECT 1 FROM public.discovery_sources WHERE enabled)             AS no_source_enabled,
  (SELECT count(*) FROM public.external_listings WHERE status = 'draft' AND created_by IS NULL) AS feed_drafts_kept;
