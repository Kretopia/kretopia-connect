-- APPLY (2 of 2): close the old "the link is the owner" claim path for scouted gigs and events (PR #278, merged). Paste the whole
-- file into the SQL editor of the production database (kwmcocsitwssrtzkdojh) and run it once.
--
-- BEFORE YOU RUN IT (all three are true as of the last check, but look again if time has passed):
--   * migration 1 is applied (security/apply-scouted-claim-requests-2026-10-29.sql);
--   * the frontend with the new claim pages is PUBLISHED (www.kretopia.com/version.json changed; the published /claim-gig and
--     /claim-event code calls request_scouted_claim and no longer calls the old functions);
--   * nothing else calls claim_scouted_opportunity / claim_scouted_event (checked in the app and the edge functions).
--
-- What it does: replaces the BODY of two existing functions, claim_scouted_opportunity(text) and claim_scouted_event(text). Before, any
-- signed-in person who held a claim link became the owner (created_by, claim_status = 'claimed'). After, they answer
-- {"claimed": false, "reason": "verification_required"} and change nothing. Name, signature and grants stay (CREATE OR REPLACE keeps
-- them), so a browser tab still on the old page gets an answer, not an error. Ownership then moves ONLY through decide_scouted_claim,
-- which needs a curator. Section 2 is supabase/migrations/20261029110100_scouted_claim_close_token_ownership.sql from main, byte for byte.
-- No table, row, column, policy or grant is changed.
--
-- Safety: ONE transaction. The preflight (1) refuses unless migration 1 is in place and the two old functions look like the repo's
-- version and are not already closed; the smoke test (3) raises on any surprise (including a replacement that did not take effect);
-- either rolls the whole script back. Needs no secret. Rollback: security/rollback-scouted-claim-close-token-ownership-2026-10-29.sql
-- (it puts the old bodies back, which RE-OPENS the hole: use it only if the new claim pages cannot be used).

BEGIN;

-- 1. PREFLIGHT (read-only, apart from two session-only temp tables). Stops the whole script, changing nothing, unless:
--    * migration 1 is applied (the table scouted_claim_requests and request_/list_/decide_ functions exist): without it the new claim
--      pages have nothing to call, and closing the old path would leave claim links with no path at all;
--    * the two old claim functions exist (this script REPLACES them, it never creates them) and still look like the repo's version:
--      they set created_by and claim_status = 'claimed' for whoever holds the link;
--    * they have not been closed already.
--    Also prints (counts only, never a link) how many gigs and events a link could still claim, and how many requests are open.
CREATE TEMP TABLE scouted_close_before (acl text, gigs text, jams text, requests bigint, gig_body_matches_repo boolean, event_body_matches_repo boolean);
CREATE TEMP TABLE scouted_close_smoke (gig_link_tested boolean, event_link_tested boolean);

DO $$
DECLARE
  g text;
  e text;
  gigs integer;
  events integer;
  open_requests integer;
BEGIN
  IF to_regclass('public.scouted_claim_requests') IS NULL
     OR to_regprocedure('public.request_scouted_claim(text, text)') IS NULL
     OR to_regprocedure('public.list_scouted_claim_requests()') IS NULL
     OR to_regprocedure('public.decide_scouted_claim(uuid, text)') IS NULL THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: migration 1 (scouted claim requests) is not applied; apply it first; nothing was changed';
  END IF;
  IF to_regprocedure('public.claim_scouted_opportunity(text)') IS NULL OR to_regprocedure('public.claim_scouted_event(text)') IS NULL THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: an old claim function is missing; this script replaces them and does not create them; nothing was changed';
  END IF;
  SELECT prosrc INTO g FROM pg_proc WHERE oid = 'public.claim_scouted_opportunity(text)'::regprocedure;
  SELECT prosrc INTO e FROM pg_proc WHERE oid = 'public.claim_scouted_event(text)'::regprocedure;
  IF g LIKE '%verification_required%' OR e LIKE '%verification_required%' THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: already applied (an old claim function already answers verification_required); nothing was changed';
  END IF;
  IF g NOT LIKE '%claim_token = p_token%' OR g NOT LIKE '%claim_status = ''claimed''%'
     OR e NOT LIKE '%claim_token = p_token%' OR e NOT LIKE '%claim_status = ''claimed''%' THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: an old claim function does not look like the repo version (gig md5 %, event md5 %); nothing was changed; send me this message', md5(g), md5(e);
  END IF;
  SELECT count(*) INTO gigs FROM public.opportunities WHERE claim_token IS NOT NULL AND length(claim_token) >= 12 AND coalesce(claim_status, 'unclaimed') = 'unclaimed';
  SELECT count(*) INTO events FROM public.creative_jams WHERE claim_token IS NOT NULL AND length(claim_token) >= 12 AND claim_status = 'unclaimed';
  SELECT count(*) INTO open_requests FROM public.scouted_claim_requests WHERE status = 'pending';
  INSERT INTO scouted_close_before
    SELECT (SELECT string_agg(coalesce(proacl::text, '-'), '|' ORDER BY proname) FROM pg_proc WHERE oid IN ('public.claim_scouted_opportunity(text)'::regprocedure, 'public.claim_scouted_event(text)'::regprocedure)), (SELECT md5(coalesce(string_agg(id::text || '|' || coalesce(claim_status, '-') || '|' || coalesce(created_by::text, '-'), ',' ORDER BY id), '')) FROM public.opportunities), (SELECT md5(coalesce(string_agg(id::text || '|' || coalesce(claim_status, '-') || '|' || coalesce(created_by::text, '-'), ',' ORDER BY id), '')) FROM public.creative_jams), (SELECT count(*) FROM public.scouted_claim_requests),
           md5(g) = '1c80d25b37710ae962c2e83088d9b1b5', md5(e) = '8edd9ae1f53c9055a84738ff38ecc641';
  RAISE NOTICE 'preflight ok: migration 1 present; % gig(s) and % event(s) could still be claimed by link holders until now; % open request(s); live bodies equal the repo: gig %, event %',
    gigs, events, open_requests, md5(g) = '1c80d25b37710ae962c2e83088d9b1b5', md5(e) = '8edd9ae1f53c9055a84738ff38ecc641';
END
$$;

-- 2. THE MIGRATION (verbatim).
-- Closes the old "the token is the owner" path for scouted gigs and events.
--
-- APPLY ONLY AFTER 20261029110000 IS APPLIED *AND* THE FRONTEND THAT CALLS request_scouted_claim IS PUBLISHED
-- (www.kretopia.com/version.json changed; /claim-gig/<token> and /claim-event/<token> show "Request sent").
-- Applying it earlier makes the OLD claim pages say "Couldn't claim" for everyone.
--
-- claim_scouted_opportunity(token) and claim_scouted_event(token) used to set created_by = auth.uid() for any signed-in
-- caller holding the token. They keep their name, signature and grants (so an old browser tab gets an answer, not a 404)
-- but no longer change anything: ownership now only moves through decide_scouted_claim, which needs an admin.
--
-- No data change. Rollback: re-run the two function bodies from 20261009100000 and 20261009090300.

CREATE OR REPLACE FUNCTION public.claim_scouted_opportunity(p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to claim this gig' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object('claimed', false, 'reason', 'verification_required');
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_scouted_event(p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to claim this event' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object('claimed', false, 'reason', 'verification_required');
END;
$$;

NOTIFY pgrst, 'reload schema';

-- 3. SMOKE TEST inside the same transaction. It proves the point of this migration: a signed-in person holding a real claim link
--    gets "verification_required" and NOTHING changes hands. Any write it makes is rolled back by its own sub-transaction, and if the
--    replacement had not taken effect the old body would claim the gig inside it, the hash check below would see it, and the WHOLE
--    script would roll back, the migration included. Claim links are read inside the database and never printed.
DO $$
DECLARE
  b scouted_close_before%ROWTYPE;
  v_member uuid;
  v_gig_token text;
  v_event_token text;
  r jsonb;
  v_gig_tested boolean := false;
  v_event_tested boolean := false;
BEGIN
  SELECT * INTO b FROM scouted_close_before;
  SELECT u.id INTO v_member FROM auth.users u WHERE NOT public.external_is_admin(u.id) ORDER BY u.created_at LIMIT 1;
  IF v_member IS NULL THEN
    RAISE EXCEPTION 'SMOKE FAILED: no ordinary member exists to act as';
  END IF;
  SELECT o.claim_token INTO v_gig_token FROM public.opportunities o
   WHERE o.claim_token IS NOT NULL AND length(o.claim_token) >= 12 AND coalesce(o.claim_status, 'unclaimed') = 'unclaimed' ORDER BY o.id LIMIT 1;
  SELECT j.claim_token INTO v_event_token FROM public.creative_jams j
   WHERE j.claim_token IS NOT NULL AND length(j.claim_token) >= 12 AND j.claim_status = 'unclaimed' ORDER BY j.id LIMIT 1;

  BEGIN
    -- signed out: still refused, as before
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claims', '', true);
    BEGIN
      PERFORM public.claim_scouted_opportunity(repeat('a', 20));
      RAISE EXCEPTION 'SMOKE FAILED: a signed-out gig claim was accepted';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    BEGIN
      PERFORM public.claim_scouted_event(repeat('a', 20));
      RAISE EXCEPTION 'SMOKE FAILED: a signed-out event claim was accepted';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;

    -- a signed-in member holding a real link (or an unknown one when none exists right now)
    PERFORM set_config('request.jwt.claim.sub', v_member::text, true);
    r := public.claim_scouted_opportunity(coalesce(v_gig_token, 'smoke_unknown_' || gen_random_uuid()::text));
    IF coalesce((r->>'claimed')::boolean, true) OR r->>'reason' IS DISTINCT FROM 'verification_required' THEN
      RAISE EXCEPTION 'SMOKE FAILED: the old gig function still answers something else than verification_required';
    END IF;
    r := public.claim_scouted_event(coalesce(v_event_token, 'smoke_unknown_' || gen_random_uuid()::text));
    IF coalesce((r->>'claimed')::boolean, true) OR r->>'reason' IS DISTINCT FROM 'verification_required' THEN
      RAISE EXCEPTION 'SMOKE FAILED: the old event function still answers something else than verification_required';
    END IF;
    v_gig_tested := v_gig_token IS NOT NULL;
    v_event_tested := v_event_token IS NOT NULL;
    IF (SELECT md5(coalesce(string_agg(id::text || '|' || coalesce(claim_status, '-') || '|' || coalesce(created_by::text, '-'), ',' ORDER BY id), '')) FROM public.opportunities) IS DISTINCT FROM b.gigs OR (SELECT md5(coalesce(string_agg(id::text || '|' || coalesce(claim_status, '-') || '|' || coalesce(created_by::text, '-'), ',' ORDER BY id), '')) FROM public.creative_jams) IS DISTINCT FROM b.jams THEN
      RAISE EXCEPTION 'SMOKE FAILED: holding a claim link still changes ownership';
    END IF;

    -- the new path is intact: a valid link still opens a pending request (it writes only the new table, rolled back below)
    IF v_gig_token IS NOT NULL THEN
      r := public.request_scouted_claim('gig', v_gig_token);
      IF NOT coalesce((r->>'requested')::boolean, false) OR coalesce((r->>'verified')::boolean, true) THEN
        RAISE EXCEPTION 'SMOKE FAILED: the new request path stopped working';
      END IF;
    END IF;

    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SMOKE_ROLLBACK';   -- undoes every test row written above
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM <> 'SMOKE_ROLLBACK' THEN RAISE; END IF;
  END;

  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);
  IF (SELECT count(*) FROM public.scouted_claim_requests) <> b.requests THEN RAISE EXCEPTION 'SMOKE FAILED: test requests were left behind'; END IF;
  IF (SELECT md5(coalesce(string_agg(id::text || '|' || coalesce(claim_status, '-') || '|' || coalesce(created_by::text, '-'), ',' ORDER BY id), '')) FROM public.opportunities) IS DISTINCT FROM b.gigs OR (SELECT md5(coalesce(string_agg(id::text || '|' || coalesce(claim_status, '-') || '|' || coalesce(created_by::text, '-'), ',' ORDER BY id), '')) FROM public.creative_jams) IS DISTINCT FROM b.jams THEN
    RAISE EXCEPTION 'SMOKE FAILED: a gig or an event changed hands';
  END IF;
  INSERT INTO scouted_close_smoke VALUES (v_gig_tested, v_event_tested);
  RAISE NOTICE 'smoke test ok: signed out refused; a member holding a link gets verification_required and nothing moves (gig link used: %, event link used: %); the request path still works; test rows rolled back', v_gig_tested, v_event_tested;
END
$$;

COMMIT;

-- 4. RESULT (after COMMIT, read-only). Expect one row. The first nine columns must be true.
--    real_gig_link_tested / real_event_link_tested: true means the smoke test used a REAL claim link (the old function answered
--    verification_required and nothing moved); false only means no gig / event could be claimed with a link at that moment, so an
--    unknown link was used.
--    old_gig_body_was_the_repo_version / old_event_body_was_the_repo_version: true means the function you just replaced was
--    byte-identical to the repo's original, so the rollback script puts back exactly what was there. False means it differed (still
--    replaced, since it did the same dangerous thing): the rollback would restore the repo's version, not yours. Tell me if so.
SELECT
  (SELECT prosrc LIKE '%verification_required%' AND prosrc NOT ILIKE '%update public.%' FROM pg_proc WHERE oid = 'public.claim_scouted_opportunity(text)'::regprocedure) AS gig_function_closed,
  (SELECT prosrc LIKE '%verification_required%' AND prosrc NOT ILIKE '%update public.%' FROM pg_proc WHERE oid = 'public.claim_scouted_event(text)'::regprocedure) AS event_function_closed,
  (SELECT string_agg(coalesce(proacl::text, '-'), '|' ORDER BY proname) FROM pg_proc WHERE oid IN ('public.claim_scouted_opportunity(text)'::regprocedure, 'public.claim_scouted_event(text)'::regprocedure)) = (SELECT acl FROM scouted_close_before)                                              AS privileges_unchanged,
  NOT (has_function_privilege('anon', 'public.claim_scouted_opportunity(text)', 'EXECUTE') OR has_function_privilege('anon', 'public.claim_scouted_event(text)', 'EXECUTE')) AS anon_still_cannot_execute,
  (has_function_privilege('authenticated', 'public.claim_scouted_opportunity(text)', 'EXECUTE') AND has_function_privilege('authenticated', 'public.claim_scouted_event(text)', 'EXECUTE')) AS old_tabs_get_a_clean_answer,
  to_regprocedure('public.request_scouted_claim(text, text)') IS NOT NULL
    AND to_regprocedure('public.decide_scouted_claim(uuid, text)') IS NOT NULL                          AS request_path_still_there,
  (SELECT md5(coalesce(string_agg(id::text || '|' || coalesce(claim_status, '-') || '|' || coalesce(created_by::text, '-'), ',' ORDER BY id), '')) FROM public.opportunities) = (SELECT gigs FROM scouted_close_before) AND (SELECT md5(coalesce(string_agg(id::text || '|' || coalesce(claim_status, '-') || '|' || coalesce(created_by::text, '-'), ',' ORDER BY id), '')) FROM public.creative_jams) = (SELECT jams FROM scouted_close_before) AS no_gig_or_event_changed,
  (SELECT count(*) FROM public.scouted_claim_requests) = (SELECT requests FROM scouted_close_before)   AS requests_untouched,
  to_regclass('public.scouted_claim_requests') IS NOT NULL                                              AS migration_1_intact,
  (SELECT gig_link_tested FROM scouted_close_smoke)                                                     AS real_gig_link_tested,
  (SELECT event_link_tested FROM scouted_close_smoke)                                                   AS real_event_link_tested,
  (SELECT gig_body_matches_repo FROM scouted_close_before)                                              AS old_gig_body_was_the_repo_version,
  (SELECT event_body_matches_repo FROM scouted_close_before)                                            AS old_event_body_was_the_repo_version;
