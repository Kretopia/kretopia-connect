-- APPLY: open Himalayas (https://himalayas.app/docs/remote-jobs-api) as a source of gigs next to the other free feeds, at ZERO cost.
-- Paste the whole file into the SQL editor of the kretopia-app project (the one that reaches the production database kwmcocsitwssrtzkdojh;
-- NOT the Kretopia Connect project, whose database holds no external listings and makes the preflight refuse) and run it once.
-- Run it AFTER apply-discovery-on-2026-10-29.sql (it refuses otherwise), and only once the frontend carrying the Himalayas credit is published
-- and the discovery functions (external-discovery-run, external-import) have been pasted/deployed with the same version of the _shared files.
--
-- What it does (one write, nothing else): in discovery_sources, one row for himalayas, enabled, cost_per_call_cents = 0, daily_budget_cents = 0,
-- max_fetches_per_run = 8 (the eight tested search queries of the registry: video editor, motion designer, art director, photographer,
-- illustrator, copywriter, content creator, designer; each answers at most 20 jobs). Every other source row is left exactly as it is.
-- DELETE nothing from the list below to keep all eight queries; LOWER the number to read only the first N queries.
--
-- What it allows and does not allow:
--   * It allows an ADMIN (or, later, the cron secret) to call external-discovery-run, which then also reads Himalayas. Nothing runs by itself:
--     this script creates NO schedule. Each job becomes a PRIVATE draft that only the admin page can see; nothing is published, nothing is
--     sent to anyone. A draft carries the job's own expiry date as its deadline and its pay range when the source states one, so once a
--     curator publishes it, the public view stops showing it the moment Himalayas stops listing it.
--   * It allows NO spending: both ceilings stay 0, so a cent is refused, and automatic reading by an AI model has no source row.
--   * Terms, as read on 2026-10-29 (https://himalayas.app/docs/remote-jobs-api): free, no key; credit Himalayas with a visible link (the
--     listing pages, the Sourced lane and the Match card now name it and link to it); every apply action goes to the job's own Himalayas
--     page (applicationLink, with utm_source=api); show the jobs only on sites you operate (Kretopia only); remove a job once it expires
--     (the view does, by the deadline); never pass them on to other job boards or aggregators; the feed refreshes daily, so run it AT MOST
--     ONCE A DAY.
--
-- Safety: ONE transaction. The preflight (1) refuses unless the kill switch is ON, both ceilings are 0, Jobicy is an enabled free source,
-- every other enabled source is one of the approved free feeds, and the list holds only himalayas; the smoke test (3) raises on any
-- surprise; either rolls the whole script back. Needs no secret. Undo: security/rollback-open-himalayas-2026-10-29.sql (the kill switch
-- alone also stops everything).

BEGIN;

-- 0. THE SOURCE THIS SCRIPT OPENS: (id, feeds read per run).
CREATE TEMP TABLE open_sources (id text PRIMARY KEY, fetches integer NOT NULL CHECK (fetches BETWEEN 1 AND 20));
INSERT INTO open_sources (id, fetches) VALUES
  ('himalayas', 8);

-- 1. PREFLIGHT (read-only, apart from session-only temp tables).
CREATE TEMP TABLE open_himalayas_before (listings bigint, feed_drafts bigint, spend_rows bigint, others_hash text, others_enabled text);

DO $$
DECLARE
  s public.discovery_settings%ROWTYPE;
  t text;
  missing text;
  stray text;
  not_free text;
  unknown_ids text;
  j public.discovery_sources%ROWTYPE;
BEGIN
  FOREACH t IN ARRAY ARRAY['discovery_settings', 'discovery_sources', 'external_listings', 'discovery_spend_counters', 'discovery_spend_ledger', 'public_external_listings'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE EXCEPTION 'PREFLIGHT FAILED: the table % is missing (is the external discovery migration applied?); nothing was changed', t;
    END IF;
  END LOOP;
  SELECT string_agg(f, ', ') INTO missing FROM unnest(ARRAY['reserve_discovery_spend', 'settle_discovery_spend', 'expire_discovery_spend', 'acquire_discovery_run', 'release_discovery_run', 'record_discovery_run', 'import_external_listing']) AS f
   WHERE NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = f);
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: functions missing: %; nothing was changed', missing;
  END IF;

  SELECT string_agg(id, ', ') INTO unknown_ids FROM open_sources WHERE id <> 'himalayas';
  IF unknown_ids IS NOT NULL THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: % is not what this script opens (only himalayas); nothing was changed', unknown_ids;
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
  -- The feeds opened by apply-open-feeds-2026-10-29.sql may or may not be on; anything else enabled is something this script does not know.
  SELECT string_agg(id, ', ') INTO stray FROM public.discovery_sources WHERE enabled AND id NOT IN ('jobicy', 'remoteok', 'weworkremotely', 'arbeitnow', 'himalayas');
  IF stray IS NOT NULL THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: source(s) already enabled that this script does not know about: %; nothing was changed', stray;
  END IF;
  SELECT string_agg(id, ', ') INTO not_free FROM public.discovery_sources
   WHERE enabled AND id <> 'himalayas' AND (cost_per_call_cents IS DISTINCT FROM 0 OR daily_budget_cents <> 0);
  IF not_free IS NOT NULL THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: an enabled source is not free: %; this script keeps everything at zero and does not guess; nothing was changed', not_free;
  END IF;

  INSERT INTO open_himalayas_before
    SELECT (SELECT count(*) FROM public.external_listings),
           (SELECT count(*) FROM public.external_listings WHERE status = 'draft' AND created_by IS NULL),
           (SELECT count(*) FROM public.discovery_spend_ledger) + (SELECT count(*) FROM public.discovery_spend_counters),
           coalesce((SELECT md5(string_agg(x::text, '|' ORDER BY x.id)) FROM public.discovery_sources x WHERE x.id <> 'himalayas'), ''),
           coalesce((SELECT string_agg(id, ',' ORDER BY id) FROM public.discovery_sources WHERE enabled AND id <> 'himalayas'), '');
  RAISE NOTICE 'preflight ok: kill switch ON, both ceilings 0, jobicy enabled and free, every other enabled source one of the approved free feeds (%); % listing(s), % feed draft(s) so far; opening himalayas',
    (SELECT others_enabled FROM open_himalayas_before), (SELECT listings FROM open_himalayas_before), (SELECT feed_drafts FROM open_himalayas_before);
END
$$;

-- 2. THE CHANGE (one statement).
INSERT INTO public.discovery_sources (id, enabled, cost_per_call_cents, daily_budget_cents, max_fetches_per_run)
SELECT id, true, 0, 0, fetches FROM open_sources
ON CONFLICT (id) DO UPDATE
   SET enabled = true, cost_per_call_cents = 0, daily_budget_cents = 0, max_fetches_per_run = EXCLUDED.max_fetches_per_run,
       consecutive_failures = 0, last_error = NULL, dead_lettered_at = NULL, run_lock_until = NULL;

-- 3. SMOKE TEST inside the same transaction. Everything it writes is rolled back by its own sub-transaction; any failed expectation
--    raises and rolls the WHOLE script back, the change above included. It exercises what a run does, at zero cost.
DO $$
DECLARE
  v_key text := 'smoke-himalayas-' || gen_random_uuid()::text;
  a jsonb; b jsonb; c jsonb; d jsonb; e jsonb; f jsonb; g jsonb;
  v_id uuid;
  s public.discovery_settings%ROWTYPE;
BEGIN
  BEGIN
    -- the lock a run takes: one at a time
    IF NOT public.acquire_discovery_run('himalayas', 5) THEN RAISE EXCEPTION 'SMOKE FAILED: the run lock for himalayas could not be taken'; END IF;
    IF public.acquire_discovery_run('himalayas', 5) THEN RAISE EXCEPTION 'SMOKE FAILED: two runs of himalayas could hold the lock at once'; END IF;

    -- the reservation a run makes BEFORE it fetches, at zero cents, and its settlement
    a := public.reserve_discovery_spend(v_key, 'himalayas', NULL, 0);
    IF NOT coalesce((a->>'ok')::boolean, false) THEN RAISE EXCEPTION 'SMOKE FAILED: a zero-cost reservation for himalayas was refused: %', a; END IF;
    e := public.settle_discovery_spend(v_key, 0);
    IF NOT coalesce((e->>'ok')::boolean, false) THEN RAISE EXCEPTION 'SMOKE FAILED: the zero-cost reservation for himalayas could not be settled: %', e; END IF;

    -- nothing that costs money can be reserved for it
    b := public.reserve_discovery_spend(v_key || '-1c', 'himalayas', NULL, 1);
    IF coalesce((b->>'ok')::boolean, true) OR coalesce(b->>'reason', '') NOT LIKE 'cap_reached%' THEN RAISE EXCEPTION 'SMOKE FAILED: one cent was reservable for himalayas: %', b; END IF;
    PERFORM public.release_discovery_run('himalayas');

    -- automatic reading by a model has no source row, and a source nobody opened is refused
    c := public.reserve_discovery_spend(v_key || '-ai', 'manual-ai', NULL, 2);
    IF coalesce((c->>'ok')::boolean, true) OR (c->>'reason') IS DISTINCT FROM 'source_disabled' THEN RAISE EXCEPTION 'SMOKE FAILED: automatic reading by a model was reservable: %', c; END IF;
    d := public.reserve_discovery_spend(v_key || '-other', 'web-search', NULL, 0);
    IF coalesce((d->>'ok')::boolean, true) OR (d->>'reason') IS DISTINCT FROM 'source_disabled' THEN RAISE EXCEPTION 'SMOKE FAILED: a source nobody opened could run: %', d; END IF;

    -- what a run imports: a draft nobody owns, private, never in the public view, carrying the source's expiry date and pay range
    f := public.import_external_listing(NULL, jsonb_build_object('kind', 'gig', 'source_type', 'feed', 'source_provider', 'himalayas', 'source_id', 'smoke-co/smoke-job',
           'identity_key', 'himalayas:smoke-co/smoke-job', 'title', 'Smoke Himalayas posting', 'original_publisher', 'Smoke',
           'apply_url', 'https://himalayas.app/companies/smoke-co/jobs/smoke-job',
           'deadline_at', now() + interval '20 days', 'budget', jsonb_build_object('min', 50000, 'max', 70000, 'currency', 'USD', 'period', 'year')));
    IF NOT coalesce((f->>'created')::boolean, false) THEN RAISE EXCEPTION 'SMOKE FAILED: a feed import did not create a draft: %', f; END IF;
    v_id := (f->>'listing_id')::uuid;
    IF (SELECT count(*) FROM public.external_listings WHERE id = v_id AND status = 'draft' AND visibility = 'private' AND created_by IS NULL AND source_provider = 'himalayas') <> 1 THEN
      RAISE EXCEPTION 'SMOKE FAILED: the feed draft is not a private draft with no owner';
    END IF;
    IF (SELECT count(*) FROM public.external_listings WHERE id = v_id AND deadline_at > now() + interval '19 days' AND deadline_at < now() + interval '21 days'
          AND budget->>'currency' = 'USD' AND (budget->>'min')::numeric = 50000 AND (budget->>'max')::numeric = 70000 AND budget->>'period' = 'year') <> 1 THEN
      RAISE EXCEPTION 'SMOKE FAILED: the import did not keep the source''s expiry date and pay range';
    END IF;
    IF (SELECT count(*) FROM public.public_external_listings WHERE id = v_id) <> 0 THEN RAISE EXCEPTION 'SMOKE FAILED: a feed draft is in the public view'; END IF;
    g := public.import_external_listing(NULL, jsonb_build_object('kind', 'gig', 'source_type', 'feed', 'source_provider', 'himalayas', 'identity_key', 'himalayas:smoke-co/smoke-job', 'title', 'Smoke again'));
    IF coalesce((g->>'created')::boolean, true) OR (g->>'reason') IS DISTINCT FROM 'already_known' THEN RAISE EXCEPTION 'SMOKE FAILED: the same job was imported twice: %', g; END IF;

    -- "remove a job once it expires": once published, the public view shows it only until the deadline the source gave
    UPDATE public.external_listings SET status = 'published', visibility = 'public' WHERE id = v_id;
    IF (SELECT count(*) FROM public.public_external_listings WHERE id = v_id) <> 1 THEN RAISE EXCEPTION 'SMOKE FAILED: a published job with a future deadline is not in the public view'; END IF;
    UPDATE public.external_listings SET deadline_at = now() - interval '1 minute' WHERE id = v_id;
    IF (SELECT count(*) FROM public.public_external_listings WHERE id = v_id) <> 0 THEN RAISE EXCEPTION 'SMOKE FAILED: a job past its deadline is still in the public view'; END IF;

    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SMOKE_ROLLBACK';   -- undoes every test row written above
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM <> 'SMOKE_ROLLBACK' THEN RAISE; END IF;
  END;

  -- afterwards: exactly the intended state, and no trace of the test
  SELECT * INTO s FROM public.discovery_settings WHERE id;
  IF NOT s.enabled THEN RAISE EXCEPTION 'SMOKE FAILED: the kill switch is not on'; END IF;
  IF s.daily_ceiling_cents <> 0 OR s.per_user_daily_cents <> 0 THEN RAISE EXCEPTION 'SMOKE FAILED: a spending ceiling is not zero'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.discovery_sources x, open_sources o WHERE x.id = o.id AND x.enabled AND x.cost_per_call_cents = 0 AND x.daily_budget_cents = 0
                  AND x.max_fetches_per_run = o.fetches AND x.run_lock_until IS NULL AND x.consecutive_failures = 0 AND x.dead_lettered_at IS NULL) THEN
    RAISE EXCEPTION 'SMOKE FAILED: himalayas is not an enabled free source with the listed number of fetches per run';
  END IF;
  IF coalesce((SELECT string_agg(id, ',' ORDER BY id) FROM public.discovery_sources WHERE enabled AND id <> 'himalayas'), '') <> (SELECT others_enabled FROM open_himalayas_before)
     OR coalesce((SELECT md5(string_agg(x::text, '|' ORDER BY x.id)) FROM public.discovery_sources x WHERE x.id <> 'himalayas'), '') <> (SELECT others_hash FROM open_himalayas_before) THEN
    RAISE EXCEPTION 'SMOKE FAILED: another source was changed';
  END IF;
  IF (SELECT count(*) FROM public.external_listings) <> (SELECT listings FROM open_himalayas_before)
     OR (SELECT count(*) FROM public.discovery_spend_ledger) + (SELECT count(*) FROM public.discovery_spend_counters) <> (SELECT spend_rows FROM open_himalayas_before) THEN
    RAISE EXCEPTION 'SMOKE FAILED: test rows were left behind';
  END IF;
  RAISE NOTICE 'smoke test ok: a lock, a zero-cost reservation and settlement, one cent refused; AI reading and an unopened source refused; a feed import is a private draft keeping the expiry date and pay range, is not imported twice, and leaves the public view at its deadline; test rows rolled back';
END
$$;

COMMIT;

-- 4. RESULT (after COMMIT, read-only). Expect one row: every column true; feed_drafts_now equal to the number before (a run has not happened yet).
SELECT
  (SELECT enabled FROM public.discovery_settings WHERE id)                                                                  AS kill_switch_still_on,
  EXISTS (SELECT 1 FROM public.discovery_sources x, open_sources o WHERE x.id = o.id AND x.enabled AND x.cost_per_call_cents = 0
            AND x.daily_budget_cents = 0 AND x.max_fetches_per_run = o.fetches)                                              AS himalayas_open_free_as_listed,
  coalesce((SELECT string_agg(id, ',' ORDER BY id) FROM public.discovery_sources WHERE enabled AND id <> 'himalayas'), '') = (SELECT others_enabled FROM open_himalayas_before)
    AND coalesce((SELECT md5(string_agg(x::text, '|' ORDER BY x.id)) FROM public.discovery_sources x WHERE x.id <> 'himalayas'), '') = (SELECT others_hash FROM open_himalayas_before)
                                                                                                                            AS other_sources_untouched,
  (SELECT daily_ceiling_cents = 0 AND per_user_daily_cents = 0 FROM public.discovery_settings WHERE id)                     AS ceilings_zero,
  NOT EXISTS (SELECT 1 FROM public.discovery_sources WHERE id = 'manual-ai')                                                AS ai_reading_has_no_source,
  (SELECT count(*) FROM public.discovery_spend_ledger) + (SELECT count(*) FROM public.discovery_spend_counters)
    = (SELECT spend_rows FROM open_himalayas_before)                                                                        AS no_spend_rows_left,
  (SELECT count(*) FROM public.external_listings) = (SELECT listings FROM open_himalayas_before)                            AS no_listing_changed,
  NOT (has_table_privilege('anon', 'public.discovery_settings', 'SELECT') OR has_table_privilege('authenticated', 'public.discovery_settings', 'SELECT')
       OR has_table_privilege('anon', 'public.discovery_sources', 'SELECT') OR has_table_privilege('authenticated', 'public.discovery_sources', 'SELECT')) AS clients_cannot_read_settings,
  (SELECT count(*) FROM public.external_listings WHERE status = 'draft' AND created_by IS NULL)                             AS feed_drafts_now;
