-- APPLY: turn the external discovery automation ON, at ZERO cost, for ONE source (Jobicy, design-multimedia feed).
-- Paste the whole file into the SQL editor of the production database (kwmcocsitwssrtzkdojh) and run it once.
--
-- What it does (two writes, nothing else):
--   1. discovery_settings.enabled = true  (the kill switch; it was off).
--   2. discovery_sources: ONE row, id 'jobicy', enabled, cost_per_call_cents = 0, daily_budget_cents = 0, max_fetches_per_run = 1.
-- What stays exactly as it is: both spending ceilings (0), every other source (none is enabled), every listing, every table of the app.
--
-- What turning it on does and does not allow:
--   * It allows an ADMIN (or, later, the cron secret) to call the external-discovery-run function. Nothing runs by itself: this script
--     creates NO schedule. The first run is a manual call: ONE fetch of Jobicy's public API (the design-multimedia feed, about 45
--     postings), each becoming a PRIVATE draft that nobody outside the admin page can see. Nothing is published, nothing is sent.
--   * It allows NO spending: every ceiling is 0, so a reservation of even one cent is refused, and automatic reading by an AI model
--     (2 cents per reading) has no source row and is refused. No Lovable AI credit and no other provider is used.
--   * Jobicy's terms (re-read 2026-10-29, jobicy.com/jobs-rss-feed): listings may be used with a clear credit to Jobicy and links that
--     lead to the original Jobicy job page (this is what the listings do), and polling must not exceed once per hour.
--
-- Safety: ONE transaction. The preflight (1) refuses unless the kill switch is OFF, both ceilings are 0 and no source is enabled; the
-- smoke test (3) raises on any surprise (a cent reservable, AI reading reservable, a second source enabled, a ceiling changed, a
-- feed draft that is public); either rolls the whole script back. Needs no secret.
-- Turn it off again at any time: security/rollback-discovery-on-2026-10-29.sql (the kill switch alone stops everything).

BEGIN;

-- 1. PREFLIGHT (read-only, apart from a session-only temp table).
CREATE TEMP TABLE discovery_on_before (listings bigint, feed_drafts bigint, spend_rows bigint);

DO $$
DECLARE
  s public.discovery_settings%ROWTYPE;
  t text;
  missing text;
  n_enabled integer;
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
  SELECT * INTO s FROM public.discovery_settings WHERE id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: discovery_settings has no row; nothing was changed';
  END IF;
  IF s.enabled THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: the kill switch is already ON; this script turns it on from OFF; nothing was changed';
  END IF;
  IF s.daily_ceiling_cents <> 0 OR s.per_user_daily_cents <> 0 THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: a spending ceiling is not zero (daily %, per user %); this script keeps every ceiling at zero and does not guess; nothing was changed', s.daily_ceiling_cents, s.per_user_daily_cents;
  END IF;
  SELECT count(*) INTO n_enabled FROM public.discovery_sources WHERE enabled;
  IF n_enabled <> 0 THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: % source(s) are already enabled; nothing was changed', n_enabled;
  END IF;
  INSERT INTO discovery_on_before
    SELECT (SELECT count(*) FROM public.external_listings),
           (SELECT count(*) FROM public.external_listings WHERE status = 'draft' AND created_by IS NULL),
           (SELECT count(*) FROM public.discovery_spend_ledger) + (SELECT count(*) FROM public.discovery_spend_counters);
  RAISE NOTICE 'preflight ok: kill switch OFF, both ceilings 0, no source enabled; % listing(s), % feed draft(s) so far', (SELECT listings FROM discovery_on_before), (SELECT feed_drafts FROM discovery_on_before);
END
$$;

-- 2. THE CHANGE (two statements).
UPDATE public.discovery_settings SET enabled = true, updated_at = now() WHERE id;

INSERT INTO public.discovery_sources (id, enabled, cost_per_call_cents, daily_budget_cents, max_fetches_per_run)
VALUES ('jobicy', true, 0, 0, 1)
ON CONFLICT (id) DO UPDATE
   SET enabled = true, cost_per_call_cents = 0, daily_budget_cents = 0, max_fetches_per_run = 1,
       consecutive_failures = 0, last_error = NULL, dead_lettered_at = NULL, run_lock_until = NULL;

-- 3. SMOKE TEST inside the same transaction. Everything it writes is rolled back by its own sub-transaction; any failed expectation
--    raises and rolls the WHOLE script back, the change above included. It exercises what a run does, at zero cost.
DO $$
DECLARE
  v_key text := 'smoke-on-' || gen_random_uuid()::text;
  a jsonb; b jsonb; c jsonb; d jsonb; e jsonb; f jsonb;
  v_id uuid;
  s public.discovery_settings%ROWTYPE;
BEGIN
  BEGIN
    -- the lock a run takes: one at a time
    IF NOT public.acquire_discovery_run('jobicy', 5) THEN RAISE EXCEPTION 'SMOKE FAILED: the run lock could not be taken'; END IF;
    IF public.acquire_discovery_run('jobicy', 5) THEN RAISE EXCEPTION 'SMOKE FAILED: two runs could hold the lock at once'; END IF;

    -- the reservation a run makes BEFORE it fetches, at zero cents, and its settlement
    a := public.reserve_discovery_spend(v_key, 'jobicy', NULL, 0);
    IF NOT coalesce((a->>'ok')::boolean, false) THEN RAISE EXCEPTION 'SMOKE FAILED: a zero-cost reservation for jobicy was refused: %', a; END IF;
    e := public.settle_discovery_spend(v_key, 0);
    IF NOT coalesce((e->>'ok')::boolean, false) THEN RAISE EXCEPTION 'SMOKE FAILED: the zero-cost reservation could not be settled: %', e; END IF;

    -- nothing that costs money can be reserved: one cent, automatic reading by a model, and a source nobody enabled
    b := public.reserve_discovery_spend(v_key || '-1c', 'jobicy', NULL, 1);
    IF coalesce((b->>'ok')::boolean, true) OR coalesce(b->>'reason', '') NOT LIKE 'cap_reached%' THEN RAISE EXCEPTION 'SMOKE FAILED: one cent was reservable: %', b; END IF;
    c := public.reserve_discovery_spend(v_key || '-ai', 'manual-ai', NULL, 2);
    IF coalesce((c->>'ok')::boolean, true) OR (c->>'reason') IS DISTINCT FROM 'source_disabled' THEN RAISE EXCEPTION 'SMOKE FAILED: automatic reading by a model was reservable: %', c; END IF;
    d := public.reserve_discovery_spend(v_key || '-other', 'remoteok', NULL, 0);
    IF coalesce((d->>'ok')::boolean, true) OR (d->>'reason') IS DISTINCT FROM 'source_disabled' THEN RAISE EXCEPTION 'SMOKE FAILED: a source nobody enabled could run: %', d; END IF;
    PERFORM public.release_discovery_run('jobicy');

    -- what a run imports: a draft nobody owns, private, never in the public view
    f := public.import_external_listing(NULL, jsonb_build_object('kind', 'gig', 'source_type', 'feed', 'source_provider', 'jobicy', 'identity_key', 'smoke-on:1',
           'title', 'Smoke feed posting', 'original_publisher', 'Smoke', 'apply_url', 'https://jobicy.com/jobs/0-smoke'));
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
  IF (SELECT count(*) FROM public.discovery_sources WHERE enabled) <> 1
     OR NOT EXISTS (SELECT 1 FROM public.discovery_sources WHERE id = 'jobicy' AND enabled AND cost_per_call_cents = 0 AND daily_budget_cents = 0 AND max_fetches_per_run = 1 AND run_lock_until IS NULL) THEN
    RAISE EXCEPTION 'SMOKE FAILED: the sources are not exactly one enabled free source with one fetch per run';
  END IF;
  IF (SELECT count(*) FROM public.external_listings) <> (SELECT listings FROM discovery_on_before)
     OR (SELECT count(*) FROM public.discovery_spend_ledger) + (SELECT count(*) FROM public.discovery_spend_counters) <> (SELECT spend_rows FROM discovery_on_before) THEN
    RAISE EXCEPTION 'SMOKE FAILED: test rows were left behind';
  END IF;
  RAISE NOTICE 'smoke test ok: lock, zero-cost reservation and settlement, one cent / AI reading / another source refused, a feed import is a private draft; test rows rolled back';
END
$$;

COMMIT;

-- 4. RESULT (after COMMIT, read-only). Expect one row: every column true, feed_drafts_now equal to the number before (a run has not happened yet).
SELECT
  (SELECT enabled FROM public.discovery_settings WHERE id)                                                                  AS kill_switch_on,
  (SELECT count(*) FROM public.discovery_sources WHERE enabled) = 1
    AND EXISTS (SELECT 1 FROM public.discovery_sources WHERE id = 'jobicy' AND enabled AND cost_per_call_cents = 0
                  AND daily_budget_cents = 0 AND max_fetches_per_run = 1)                                                 AS only_one_free_source_one_fetch,
  (SELECT daily_ceiling_cents = 0 AND per_user_daily_cents = 0 FROM public.discovery_settings WHERE id)                     AS ceilings_zero,
  NOT EXISTS (SELECT 1 FROM public.discovery_sources WHERE id = 'manual-ai')                                                AS ai_reading_has_no_source,
  (SELECT count(*) FROM public.discovery_spend_ledger) + (SELECT count(*) FROM public.discovery_spend_counters)
    = (SELECT spend_rows FROM discovery_on_before)                                                                          AS no_spend_rows_left,
  (SELECT count(*) FROM public.external_listings) = (SELECT listings FROM discovery_on_before)                              AS no_listing_changed,
  NOT (has_table_privilege('anon', 'public.discovery_settings', 'SELECT') OR has_table_privilege('authenticated', 'public.discovery_settings', 'SELECT')
       OR has_table_privilege('anon', 'public.discovery_sources', 'SELECT') OR has_table_privilege('authenticated', 'public.discovery_sources', 'SELECT')) AS clients_cannot_read_settings,
  (SELECT count(*) FROM public.external_listings WHERE status = 'draft' AND created_by IS NULL)                             AS feed_drafts_now;
