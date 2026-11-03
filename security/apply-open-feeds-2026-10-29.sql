-- APPLY: open the other public job feeds (Remote OK, We Work Remotely, Arbeitnow) next to Jobicy, at ZERO cost, one fetch each per run.
-- Paste the whole file into the SQL editor of the production database (kwmcocsitwssrtzkdojh) and run it once.
-- Run it AFTER apply-discovery-on-2026-10-29.sql (it refuses otherwise): the kill switch is on and Jobicy is the only source enabled.
--
-- What it does (one write, nothing else): in discovery_sources, one row per source below, enabled, cost_per_call_cents = 0,
-- daily_budget_cents = 0, max_fetches_per_run = 1. Jobicy is not touched.
--   remoteok        https://remoteok.com/api                                              (about 100 postings, mixed: mostly not creative)
--   weworkremotely  https://weworkremotely.com/categories/remote-design-jobs.rss          (about 25 postings, design only)
--   arbeitnow       https://www.arbeitnow.com/api/job-board-api                           (the 100 newest of about 300, mostly German, few creative)
-- DELETE A LINE of the list in step 0 to leave that source off; the checks adapt to the list.
--
-- What it allows and does not allow:
--   * It allows an ADMIN (or, later, the cron secret) to call external-discovery-run, which fetches each enabled source once. Nothing runs
--     by itself: this script creates NO schedule. Each posting becomes a PRIVATE draft that only the admin page can see. Nothing is
--     published, nothing is sent to anyone.
--   * It allows NO spending: both ceilings stay 0, so a cent is refused, and automatic reading by an AI model has no source row.
--   * Terms, as read on 2026-10-29: Remote OK (its own API notice) asks for a link back WITH follow and its name; the listing pages now
--     do that. Arbeitnow (terms of service, section 11) asks for a link back to Arbeitnow.com; its section 2 forbids "public display" of
--     "materials on the website" and does not say whether API data is covered. We Work Remotely: its terms page could not be read
--     (it sits behind a bot challenge). Fetching into private drafts only is what Scout already does with these feeds; PUBLISHING a draft
--     is a separate, explicit decision, made per listing.
--
-- Safety: ONE transaction. The preflight (1) refuses unless the kill switch is ON, both ceilings are 0, Jobicy is the only enabled source and
-- the list holds only the four approved source ids; the smoke test (3) raises on any surprise; either rolls the whole script back.
-- Needs no secret. Undo: security/rollback-open-feeds-2026-10-29.sql (the kill switch alone also stops everything).

BEGIN;

-- 0. THE SOURCES THIS SCRIPT OPENS: (id, feeds read per run). Delete a line to leave that source as it is.
CREATE TEMP TABLE open_sources (id text PRIMARY KEY, fetches integer NOT NULL CHECK (fetches = 1));
INSERT INTO open_sources (id, fetches) VALUES
  ('remoteok', 1),
  ('weworkremotely', 1),
  ('arbeitnow', 1);

-- 1. PREFLIGHT (read-only, apart from session-only temp tables).
CREATE TEMP TABLE open_feeds_before (listings bigint, feed_drafts bigint, spend_rows bigint, jobicy_last_run timestamptz, jobicy_fetches integer);

DO $$
DECLARE
  s public.discovery_settings%ROWTYPE;
  t text;
  missing text;
  stray text;
  unknown_ids text;
  j public.discovery_sources%ROWTYPE;
BEGIN
  FOREACH t IN ARRAY ARRAY['discovery_settings', 'discovery_sources', 'external_listings', 'discovery_spend_counters', 'discovery_spend_ledger'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE EXCEPTION 'PREFLIGHT FAILED: the table % is missing (is the external discovery migration applied?); nothing was changed', t;
    END IF;
  END LOOP;
  SELECT string_agg(f, ', ') INTO missing FROM unnest(ARRAY['reserve_discovery_spend', 'settle_discovery_spend', 'expire_discovery_spend', 'acquire_discovery_run', 'release_discovery_run', 'record_discovery_run', 'import_external_listing']) AS f
   WHERE NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = f);
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: functions missing: %; nothing was changed', missing;
  END IF;

  SELECT string_agg(id, ', ') INTO unknown_ids FROM open_sources WHERE id NOT IN ('remoteok', 'weworkremotely', 'jobicy', 'arbeitnow');
  IF unknown_ids IS NOT NULL THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: % is not one of the approved sources (remoteok, weworkremotely, jobicy, arbeitnow); nothing was changed', unknown_ids;
  END IF;
  IF EXISTS (SELECT 1 FROM open_sources WHERE id = 'jobicy') THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: jobicy is already open and this script does not touch it; remove it from the list; nothing was changed';
  END IF;

  SELECT * INTO s FROM public.discovery_settings WHERE id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: discovery_settings has no row; nothing was changed';
  END IF;
  IF NOT s.enabled THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: the kill switch is OFF; run apply-discovery-on-2026-10-29.sql first; nothing was changed';
  END IF;
  IF s.daily_ceiling_cents <> 0 OR s.per_user_daily_cents <> 0 THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: a spending ceiling is not zero (daily %, per user %); this script keeps every ceiling at zero and does not guess; nothing was changed', s.daily_ceiling_cents, s.per_user_daily_cents;
  END IF;

  SELECT * INTO j FROM public.discovery_sources WHERE id = 'jobicy';
  IF NOT FOUND OR NOT j.enabled OR j.cost_per_call_cents IS DISTINCT FROM 0 OR j.daily_budget_cents <> 0 THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: jobicy is not an enabled free source (the state apply-discovery-on leaves); nothing was changed';
  END IF;
  SELECT string_agg(id, ', ') INTO stray FROM public.discovery_sources WHERE enabled AND id <> 'jobicy' AND id NOT IN (SELECT id FROM open_sources);
  IF stray IS NOT NULL THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: source(s) already enabled that this script does not know about: %; nothing was changed', stray;
  END IF;

  INSERT INTO open_feeds_before
    SELECT (SELECT count(*) FROM public.external_listings),
           (SELECT count(*) FROM public.external_listings WHERE status = 'draft' AND created_by IS NULL),
           (SELECT count(*) FROM public.discovery_spend_ledger) + (SELECT count(*) FROM public.discovery_spend_counters),
           j.last_run_at, j.max_fetches_per_run;
  RAISE NOTICE 'preflight ok: kill switch ON, both ceilings 0, jobicy the only source enabled; % listing(s), % feed draft(s) so far; opening % source(s)',
    (SELECT listings FROM open_feeds_before), (SELECT feed_drafts FROM open_feeds_before), (SELECT count(*) FROM open_sources);
END
$$;

-- 2. THE CHANGE (one statement).
INSERT INTO public.discovery_sources (id, enabled, cost_per_call_cents, daily_budget_cents, max_fetches_per_run)
SELECT id, true, 0, 0, fetches FROM open_sources
ON CONFLICT (id) DO UPDATE
   SET enabled = true, cost_per_call_cents = 0, daily_budget_cents = 0, max_fetches_per_run = EXCLUDED.max_fetches_per_run,
       consecutive_failures = 0, last_error = NULL, dead_lettered_at = NULL, run_lock_until = NULL;

-- 3. SMOKE TEST inside the same transaction. Everything it writes is rolled back by its own sub-transaction; any failed expectation
--    raises and rolls the WHOLE script back, the change above included. It exercises what a run does, at zero cost, per opened source.
DO $$
DECLARE
  v_key text := 'smoke-open-' || gen_random_uuid()::text;
  r record;
  a jsonb; b jsonb; c jsonb; d jsonb; e jsonb; f jsonb;
  v_id uuid;
  s public.discovery_settings%ROWTYPE;
BEGIN
  BEGIN
    FOR r IN SELECT id FROM open_sources ORDER BY id LOOP
      -- the lock a run takes: one at a time
      IF NOT public.acquire_discovery_run(r.id, 5) THEN RAISE EXCEPTION 'SMOKE FAILED: the run lock for % could not be taken', r.id; END IF;
      IF public.acquire_discovery_run(r.id, 5) THEN RAISE EXCEPTION 'SMOKE FAILED: two runs of % could hold the lock at once', r.id; END IF;

      -- the reservation a run makes BEFORE it fetches, at zero cents, and its settlement
      a := public.reserve_discovery_spend(v_key || '-' || r.id, r.id, NULL, 0);
      IF NOT coalesce((a->>'ok')::boolean, false) THEN RAISE EXCEPTION 'SMOKE FAILED: a zero-cost reservation for % was refused: %', r.id, a; END IF;
      e := public.settle_discovery_spend(v_key || '-' || r.id, 0);
      IF NOT coalesce((e->>'ok')::boolean, false) THEN RAISE EXCEPTION 'SMOKE FAILED: the zero-cost reservation for % could not be settled: %', r.id, e; END IF;

      -- nothing that costs money can be reserved for it
      b := public.reserve_discovery_spend(v_key || '-1c-' || r.id, r.id, NULL, 1);
      IF coalesce((b->>'ok')::boolean, true) OR coalesce(b->>'reason', '') NOT LIKE 'cap_reached%' THEN RAISE EXCEPTION 'SMOKE FAILED: one cent was reservable for %: %', r.id, b; END IF;
      PERFORM public.release_discovery_run(r.id);
    END LOOP;

    -- automatic reading by a model has no source row, and a source nobody opened is refused
    c := public.reserve_discovery_spend(v_key || '-ai', 'manual-ai', NULL, 2);
    IF coalesce((c->>'ok')::boolean, true) OR (c->>'reason') IS DISTINCT FROM 'source_disabled' THEN RAISE EXCEPTION 'SMOKE FAILED: automatic reading by a model was reservable: %', c; END IF;
    d := public.reserve_discovery_spend(v_key || '-other', 'web-search', NULL, 0);
    IF coalesce((d->>'ok')::boolean, true) OR (d->>'reason') IS DISTINCT FROM 'source_disabled' THEN RAISE EXCEPTION 'SMOKE FAILED: a source nobody opened could run: %', d; END IF;

    -- what a run imports: a draft nobody owns, private, never in the public view
    f := public.import_external_listing(NULL, jsonb_build_object('kind', 'gig', 'source_type', 'feed', 'source_provider', 'remoteok', 'identity_key', 'smoke-open:1',
           'title', 'Smoke feed posting', 'original_publisher', 'Smoke', 'apply_url', 'https://remoteok.com/remote-jobs/0-smoke'));
    IF NOT coalesce((f->>'created')::boolean, false) THEN RAISE EXCEPTION 'SMOKE FAILED: a feed import did not create a draft: %', f; END IF;
    v_id := (f->>'listing_id')::uuid;
    IF (SELECT count(*) FROM public.external_listings WHERE id = v_id AND status = 'draft' AND visibility = 'private' AND created_by IS NULL) <> 1 THEN
      RAISE EXCEPTION 'SMOKE FAILED: the feed draft is not a private draft with no owner';
    END IF;
    IF (SELECT count(*) FROM public.public_external_listings WHERE id = v_id) <> 0 THEN RAISE EXCEPTION 'SMOKE FAILED: a feed draft is in the public view'; END IF;

    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SMOKE_ROLLBACK';   -- undoes every test row written above
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM <> 'SMOKE_ROLLBACK' THEN RAISE; END IF;
  END;

  -- afterwards: exactly the intended state, and no trace of the test
  SELECT * INTO s FROM public.discovery_settings WHERE id;
  IF NOT s.enabled THEN RAISE EXCEPTION 'SMOKE FAILED: the kill switch is not on'; END IF;
  IF s.daily_ceiling_cents <> 0 OR s.per_user_daily_cents <> 0 THEN RAISE EXCEPTION 'SMOKE FAILED: a spending ceiling is not zero'; END IF;
  IF (SELECT count(*) FROM public.discovery_sources WHERE enabled) <> (SELECT count(*) FROM open_sources) + 1
     OR EXISTS (SELECT 1 FROM public.discovery_sources WHERE enabled AND id <> 'jobicy' AND id NOT IN (SELECT id FROM open_sources))
     OR EXISTS (SELECT 1 FROM open_sources o WHERE NOT EXISTS (SELECT 1 FROM public.discovery_sources x WHERE x.id = o.id AND x.enabled AND x.cost_per_call_cents = 0
                  AND x.daily_budget_cents = 0 AND x.max_fetches_per_run = o.fetches AND x.run_lock_until IS NULL AND x.consecutive_failures = 0 AND x.dead_lettered_at IS NULL)) THEN
    RAISE EXCEPTION 'SMOKE FAILED: the sources are not exactly jobicy plus the listed free sources with one fetch per run';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.discovery_sources x, open_feeds_before b WHERE x.id = 'jobicy' AND x.enabled AND x.cost_per_call_cents = 0 AND x.daily_budget_cents = 0
                  AND x.max_fetches_per_run = b.jobicy_fetches AND x.last_run_at IS NOT DISTINCT FROM b.jobicy_last_run) THEN
    RAISE EXCEPTION 'SMOKE FAILED: jobicy was changed';
  END IF;
  IF (SELECT count(*) FROM public.external_listings) <> (SELECT listings FROM open_feeds_before)
     OR (SELECT count(*) FROM public.discovery_spend_ledger) + (SELECT count(*) FROM public.discovery_spend_counters) <> (SELECT spend_rows FROM open_feeds_before) THEN
    RAISE EXCEPTION 'SMOKE FAILED: test rows were left behind';
  END IF;
  RAISE NOTICE 'smoke test ok: per opened source a lock, a zero-cost reservation and settlement, one cent refused; AI reading and an unopened source refused; a feed import is a private draft; test rows rolled back';
END
$$;

COMMIT;

-- 4. RESULT (after COMMIT, read-only). Expect one row: every column true; feed_drafts_now equal to the number before (a run has not happened yet).
SELECT
  (SELECT enabled FROM public.discovery_settings WHERE id)                                                                  AS kill_switch_still_on,
  (SELECT count(*) FROM public.discovery_sources WHERE enabled) = (SELECT count(*) FROM open_sources) + 1
    AND NOT EXISTS (SELECT 1 FROM public.discovery_sources WHERE enabled AND (cost_per_call_cents <> 0 OR daily_budget_cents <> 0 OR max_fetches_per_run <> 1))
                                                                                                                            AS listed_sources_open_free_one_fetch,
  EXISTS (SELECT 1 FROM public.discovery_sources x, open_feeds_before b WHERE x.id = 'jobicy' AND x.enabled
            AND x.max_fetches_per_run = b.jobicy_fetches AND x.last_run_at IS NOT DISTINCT FROM b.jobicy_last_run)         AS jobicy_untouched,
  (SELECT daily_ceiling_cents = 0 AND per_user_daily_cents = 0 FROM public.discovery_settings WHERE id)                     AS ceilings_zero,
  NOT EXISTS (SELECT 1 FROM public.discovery_sources WHERE id = 'manual-ai')                                                AS ai_reading_has_no_source,
  (SELECT count(*) FROM public.discovery_spend_ledger) + (SELECT count(*) FROM public.discovery_spend_counters)
    = (SELECT spend_rows FROM open_feeds_before)                                                                            AS no_spend_rows_left,
  (SELECT count(*) FROM public.external_listings) = (SELECT listings FROM open_feeds_before)                                AS no_listing_changed,
  NOT (has_table_privilege('anon', 'public.discovery_settings', 'SELECT') OR has_table_privilege('authenticated', 'public.discovery_settings', 'SELECT')
       OR has_table_privilege('anon', 'public.discovery_sources', 'SELECT') OR has_table_privilege('authenticated', 'public.discovery_sources', 'SELECT')) AS clients_cannot_read_settings,
  (SELECT count(*) FROM public.external_listings WHERE status = 'draft' AND created_by IS NULL)                             AS feed_drafts_now;
