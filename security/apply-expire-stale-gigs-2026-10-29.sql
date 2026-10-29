-- APPLY: a gig found outside Kretopia stops being public 30 days after the date its source published it.
-- Paste the whole file into the SQL editor of the production database (kwmcocsitwssrtzkdojh) and run it once. Safe to run twice.
-- Run it AFTER apply-close-view-writes-2026-10-29.sql (it refuses otherwise): it replaces the public view, and a client must not be able
-- to write through the view it leaves behind.
--
-- THE RULE (decided 2026-10-29: "expire each listing 30 days after its publication date at the source"):
--   public_external_listings hides a listing of kind 'gig' that is not claimed when coalesce(source_published_at, created_at) is 30 days old
--   or older. source_published_at is the date the source states; created_at (the day Kretopia first saw it) only stands in when the source
--   stated none. Events and talent keep their own dates; a claimed listing is managed by its owner. The existing deadline rule is unchanged.
--
-- WHAT IT DOES (one transaction, no data touched, nothing deleted or re-labelled: status stays 'published'):
--   CREATE OR REPLACE VIEW public.public_external_listings with the extra condition, security_barrier on, and the grants of the previous fix
--   re-asserted (clients SELECT only, service_role all). Every public reader (the listing page, the Sourced lane, the Match deck, the sitemap)
--   goes through this one view, so the rule applies everywhere at once, with no schedule.
--   Today's effect is printed by the preflight: how many public gigs the rule hides at once.
--
-- SAFETY: the preflight refuses if the view is missing or a client can still write to it. The smoke test (3) inserts synthetic listings inside
-- a sub-transaction (rolled back) to prove each case of the rule: 10 days old visible, 31 days hidden, exactly 30 days hidden, undated and new
-- visible, undated and 40 days old hidden, claimed visible however old, an old event visible, flagged and past-deadline still hidden; and that
-- the number of rows the rule hides equals the number the preflight announced. Any failed expectation rolls everything back.
-- Undo: security/rollback-expire-stale-gigs-2026-10-29.sql (brings back the previous view; it does not touch the grants).

BEGIN;

-- 1. PREFLIGHT (read-only, apart from a session-only temp table).
CREATE TEMP TABLE expire_before (listings bigint, public_rows bigint, will_hide bigint);

DO $$
DECLARE
  v_kind "char";
  p text;
  r text;
BEGIN
  SELECT relkind INTO v_kind FROM pg_class WHERE oid = to_regclass('public.public_external_listings');
  IF v_kind IS DISTINCT FROM 'v' THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: public.public_external_listings is not a view here; nothing was changed';
  END IF;
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    FOREACH p IN ARRAY ARRAY['INSERT', 'UPDATE', 'DELETE'] LOOP
      IF has_table_privilege(r, 'public.public_external_listings'::regclass, p) THEN
        RAISE EXCEPTION 'PREFLIGHT FAILED: % can still % through the public view; run apply-close-view-writes-2026-10-29.sql first; nothing was changed', r, p;
      END IF;
    END LOOP;
  END LOOP;
  INSERT INTO expire_before
    SELECT (SELECT count(*) FROM public.external_listings),
           (SELECT count(*) FROM public.public_external_listings),
           (SELECT count(*) FROM public.public_external_listings v JOIN public.external_listings l ON l.id = v.id
             WHERE l.kind = 'gig' AND l.status <> 'claimed' AND coalesce(l.source_published_at, l.created_at) <= now() - interval '30 days');
  RAISE NOTICE 'preflight ok: % listing(s), % public now; the rule hides % of them at once', (SELECT listings FROM expire_before), (SELECT public_rows FROM expire_before), (SELECT will_hide FROM expire_before);
END
$$;

-- 2. THE CHANGE (the migration's statements, verbatim).
CREATE OR REPLACE VIEW public.public_external_listings WITH (security_barrier = true) AS
  SELECT id, kind, status, title, original_publisher, location, remote_scope, source_published_at, deadline_at, deadline_tz,
         budget, apply_url, excerpt, description_full, starts_at, ends_at, roles, verification_status, last_checked_at,
         source_provider, source_url, applications_enabled, (status = 'claimed') AS claimed
  FROM public.external_listings
  WHERE status IN ('published', 'claimed') AND visibility = 'public' AND NOT flagged_instructions
    AND (deadline_at IS NULL OR deadline_at > now())
    AND (kind <> 'gig' OR status = 'claimed' OR coalesce(source_published_at, created_at) > now() - interval '30 days');

REVOKE ALL ON public.public_external_listings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.public_external_listings TO anon, authenticated;
GRANT ALL ON public.public_external_listings TO service_role;

-- 3. SMOKE TEST inside the same transaction. The synthetic rows are rolled back by their own sub-transaction; any failed expectation
--    raises and rolls the WHOLE script back, the change above included.
DO $$
DECLARE
  v_oid oid := 'public.public_external_listings'::regclass;
  r text;
  p text;
  n bigint;
  seen text;
  base text := 'smoke-expire-';
BEGIN
  -- the grants and options survive the replacement
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF NOT has_table_privilege(r, v_oid, 'SELECT') THEN RAISE EXCEPTION 'SMOKE FAILED: % can no longer read the public view', r; END IF;
    FOREACH p IN ARRAY ARRAY['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'] LOOP
      IF has_table_privilege(r, v_oid, p) THEN RAISE EXCEPTION 'SMOKE FAILED: % holds % on the public view', r, p; END IF;
    END LOOP;
  END LOOP;
  IF NOT (has_table_privilege('service_role', v_oid, 'SELECT') AND has_table_privilege('service_role', v_oid, 'UPDATE')) THEN
    RAISE EXCEPTION 'SMOKE FAILED: service_role lost access to the public view';
  END IF;
  IF NOT coalesce((SELECT 'security_barrier=true' = ANY (reloptions) FROM pg_class WHERE oid = v_oid), false) THEN
    RAISE EXCEPTION 'SMOKE FAILED: security_barrier is not on';
  END IF;

  -- the rule, case by case
  BEGIN
    INSERT INTO public.external_listings (id, kind, status, visibility, title, source_type, source_provider, identity_key, canonical_url, source_url, apply_url, original_publisher, source_published_at, created_at, flagged_instructions, deadline_at, starts_at, ends_at)
    VALUES
      ('aaaaaaa1-0000-4000-8000-000000000001', 'gig',   'published', 'public', 'recent 10d',        'feed', 'jobicy', base || '1', 'https://jobicy.com/jobs/s1', 'https://jobicy.com/jobs/s1', 'https://jobicy.com/jobs/s1', 'Smoke', now() - interval '10 days', now(), false, NULL, NULL, NULL),
      ('aaaaaaa1-0000-4000-8000-000000000002', 'gig',   'published', 'public', 'old 31d',           'feed', 'jobicy', base || '2', 'https://jobicy.com/jobs/s2', 'https://jobicy.com/jobs/s2', 'https://jobicy.com/jobs/s2', 'Smoke', now() - interval '31 days', now(), false, NULL, NULL, NULL),
      ('aaaaaaa1-0000-4000-8000-000000000003', 'gig',   'published', 'public', 'exactly 30d',       'feed', 'jobicy', base || '3', 'https://jobicy.com/jobs/s3', 'https://jobicy.com/jobs/s3', 'https://jobicy.com/jobs/s3', 'Smoke', now() - interval '30 days', now(), false, NULL, NULL, NULL),
      ('aaaaaaa1-0000-4000-8000-000000000004', 'gig',   'published', 'public', 'undated new',       'feed', 'jobicy', base || '4', 'https://jobicy.com/jobs/s4', 'https://jobicy.com/jobs/s4', 'https://jobicy.com/jobs/s4', 'Smoke', NULL, now(), false, NULL, NULL, NULL),
      ('aaaaaaa1-0000-4000-8000-000000000005', 'gig',   'published', 'public', 'undated 40d seen',  'feed', 'jobicy', base || '5', 'https://jobicy.com/jobs/s5', 'https://jobicy.com/jobs/s5', 'https://jobicy.com/jobs/s5', 'Smoke', NULL, now() - interval '40 days', false, NULL, NULL, NULL),
      ('aaaaaaa1-0000-4000-8000-000000000006', 'gig',   'claimed',   'public', 'claimed 90d',       'url',  'remoteok', base || '6', 'https://remoteok.com/remote-jobs/s6', 'https://remoteok.com/remote-jobs/s6', 'https://remoteok.com/remote-jobs/s6', 'Smoke', now() - interval '90 days', now(), false, NULL, NULL, NULL),
      ('aaaaaaa1-0000-4000-8000-000000000007', 'event', 'published', 'public', 'old event, upcoming','url',  'jobicy', base || '7', 'https://jobicy.com/jobs/s7', 'https://jobicy.com/jobs/s7', 'https://jobicy.com/jobs/s7', 'Smoke', now() - interval '90 days', now(), false, NULL, now() + interval '10 days', now() + interval '11 days'),
      ('aaaaaaa1-0000-4000-8000-000000000008', 'gig',   'published', 'public', 'flagged',           'feed', 'jobicy', base || '8', 'https://jobicy.com/jobs/s8', 'https://jobicy.com/jobs/s8', 'https://jobicy.com/jobs/s8', 'Smoke', now() - interval '1 day', now(), true, NULL, NULL, NULL),
      ('aaaaaaa1-0000-4000-8000-000000000009', 'gig',   'published', 'public', 'deadline passed',   'feed', 'jobicy', base || '9', 'https://jobicy.com/jobs/s9', 'https://jobicy.com/jobs/s9', 'https://jobicy.com/jobs/s9', 'Smoke', now() - interval '1 day', now(), false, now() - interval '1 hour', NULL, NULL);

    SELECT string_agg(title, ' | ' ORDER BY title) INTO seen FROM public.public_external_listings WHERE id::text LIKE 'aaaaaaa1-0000-4000-8000-0000000000%';
    IF seen IS DISTINCT FROM 'claimed 90d | old event, upcoming | recent 10d | undated new' THEN
      RAISE EXCEPTION 'SMOKE FAILED: the age rule shows (%), expected (claimed 90d | old event, upcoming | recent 10d | undated new)', seen;
    END IF;

    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SMOKE_ROLLBACK';   -- undoes every synthetic row
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM <> 'SMOKE_ROLLBACK' THEN RAISE; END IF;
  END;
END
$$;

DO $$
BEGIN
  IF (SELECT count(*) FROM public.external_listings) <> (SELECT listings FROM expire_before) THEN RAISE EXCEPTION 'SMOKE FAILED: test rows were left behind'; END IF;
  IF (SELECT public_rows FROM expire_before) - (SELECT count(*) FROM public.public_external_listings) <> (SELECT will_hide FROM expire_before) THEN
    RAISE EXCEPTION 'SMOKE FAILED: the rule hides % row(s), the preflight announced %', (SELECT public_rows FROM expire_before) - (SELECT count(*) FROM public.public_external_listings), (SELECT will_hide FROM expire_before);
  END IF;
  RAISE NOTICE 'smoke test ok: every case of the rule, the grants and the barrier are as intended, and exactly the announced number of listings is hidden';
END
$$;

COMMIT;

-- 4. RESULT (after COMMIT, read-only). Expect one row: every boolean true; hidden_now equals the number the preflight announced.
SELECT
  position('30 days' in pg_get_viewdef('public.public_external_listings'::regclass)) > 0                                         AS age_rule_in_the_view,
  has_table_privilege('anon', 'public.public_external_listings', 'SELECT')
    AND has_table_privilege('authenticated', 'public.public_external_listings', 'SELECT')                                       AS clients_can_read_the_view,
  NOT (has_table_privilege('anon', 'public.public_external_listings', 'INSERT') OR has_table_privilege('anon', 'public.public_external_listings', 'UPDATE')
       OR has_table_privilege('anon', 'public.public_external_listings', 'DELETE') OR has_table_privilege('authenticated', 'public.public_external_listings', 'INSERT')
       OR has_table_privilege('authenticated', 'public.public_external_listings', 'UPDATE') OR has_table_privilege('authenticated', 'public.public_external_listings', 'DELETE')) AS clients_cannot_write_the_view,
  coalesce((SELECT 'security_barrier=true' = ANY (reloptions) FROM pg_class WHERE oid = 'public.public_external_listings'::regclass), false) AS security_barrier_on,
  (SELECT count(*) FROM public.external_listings) = (SELECT listings FROM expire_before)                                        AS no_listing_changed,
  (SELECT public_rows FROM expire_before) - (SELECT count(*) FROM public.public_external_listings) = (SELECT will_hide FROM expire_before) AS hidden_equals_announced,
  (SELECT count(*) FROM public.public_external_listings)                                                                        AS public_rows_now,
  (SELECT will_hide FROM expire_before)                                                                                         AS hidden_now;
