-- APPLY (1 of 2): scouted gig/event claim requests (PR #278, merged). Paste the whole file into the SQL editor of
-- the production database (kwmcocsitwssrtzkdojh) and run it once.
--
-- What it does: creates 1 NEW table (scouted_claim_requests) and 3 functions: request_scouted_claim (a person who opens a
-- claim link ASKS to claim; nothing is claimed), list_scouted_claim_requests and decide_scouted_claim (curators only; approving
-- is the only path that sets created_by). Section 2 is supabase/migrations/20261029110000_scouted_claim_requests.sql from main
-- (PR #278), byte for byte.
-- Purely additive: the old claim functions keep working exactly as today (they are only closed by the SECOND migration, after
-- the frontend is published). No existing table, column, grant, policy or row is read for anything but the preflight counts
-- and changed. The table is server-only: clients get no table access; the functions are not executable by anon.
--
-- Order: (1) this script, (2) publish the frontend, (3) apply the second migration (supabase/migrations/20261029110100_...).
-- Publishing the frontend BEFORE this script makes /claim-gig and /claim-event answer "Request failed".
--
-- Safety: ONE transaction. The preflight (1) refuses anything but a fresh install on the expected schema, and the smoke test (3)
-- raises on any surprise; either rolls the whole script back. Needs no secret. Rollback: security/rollback-scouted-claim-requests-2026-10-29.sql.

BEGIN;

-- 1. PREFLIGHT (read-only). Stops the whole script, changing nothing, unless this database looks like the repo:
--    * it is a fresh install: the table scouted_claim_requests and the 3 functions do not exist yet;
--    * public.external_is_admin(uuid) exists (it comes from the external discovery migration, applied 2026-10-29);
--    * public.opportunities and public.creative_jams have id (uuid), title, claim_token, claim_status and created_by;
--    * public.profiles has user_id and full_name, auth.users has id, auth.uid() and gen_random_uuid() exist;
--    * the roles anon, authenticated and service_role exist.
--    Also prints (counts only, never a link) how many gigs and events could be claimed with a link, and how many admins exist.
DO $$
DECLARE
  existing text;
  admins integer;
  gigs integer;
  events integer;
  t text;
BEGIN
  IF to_regclass('public.scouted_claim_requests') IS NOT NULL THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: the table scouted_claim_requests already exists; this script is for a fresh install, nothing was changed (use the rollback script first if this is a leftover)';
  END IF;
  SELECT string_agg(f, ', ') INTO existing FROM unnest(ARRAY['request_scouted_claim', 'list_scouted_claim_requests', 'decide_scouted_claim']) AS f
   WHERE EXISTS (SELECT 1 FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = f);
  IF existing IS NOT NULL THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: functions already present: %; nothing was changed', existing;
  END IF;
  IF to_regprocedure('public.external_is_admin(uuid)') IS NULL THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: public.external_is_admin(uuid) is missing (apply the external discovery migration first); nothing was changed';
  END IF;
  FOREACH t IN ARRAY ARRAY['opportunities', 'creative_jams'] LOOP
    IF to_regclass('public.' || t) IS NULL
       OR (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name IN ('id', 'title', 'claim_token', 'claim_status', 'created_by')) <> 5
       OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = 'id' AND data_type = 'uuid')
       OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = 'created_by' AND data_type = 'uuid') THEN
      RAISE EXCEPTION 'PREFLIGHT FAILED: public.% is missing or lacks id (uuid), title, claim_token, claim_status or created_by (uuid); nothing was changed', t;
    END IF;
  END LOOP;
  IF to_regclass('public.profiles') IS NULL
     OR (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name IN ('user_id', 'full_name')) <> 2 THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: public.profiles(user_id, full_name) is missing; nothing was changed';
  END IF;
  IF to_regclass('auth.users') IS NULL OR to_regprocedure('auth.uid()') IS NULL THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: auth.users or auth.uid() is missing; nothing was changed';
  END IF;
  IF to_regproc('gen_random_uuid') IS NULL THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: gen_random_uuid() is not available; nothing was changed';
  END IF;
  IF (SELECT count(*) FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'service_role')) < 3 THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: the roles anon, authenticated and service_role are not all present; nothing was changed';
  END IF;
  EXECUTE 'SELECT count(*) FROM public.user_roles WHERE role::text = ''admin''' INTO admins;
  SELECT count(*) INTO gigs FROM public.opportunities WHERE claim_token IS NOT NULL AND length(claim_token) >= 12 AND coalesce(claim_status, 'unclaimed') = 'unclaimed';
  SELECT count(*) INTO events FROM public.creative_jams WHERE claim_token IS NOT NULL AND length(claim_token) >= 12 AND claim_status = 'unclaimed';
  RAISE NOTICE 'preflight ok: fresh install; % admin(s) can decide; % gig(s) and % event(s) can be claimed with a link right now', admins, gigs, events;
END
$$;

CREATE TEMP TABLE scouted_smoke (request_path boolean, admin_path boolean);

-- 2. THE MIGRATION (verbatim).
-- A scouted gig or event link starts a REQUEST to claim. It never makes anyone the owner.
--
-- PROBLEM (read from 20261009100000_opportunity_claim_by_token.sql and 20261009090300_scouted_event_claim_rpc.sql)
--   claim_scouted_opportunity(token) and claim_scouted_event(token) set created_by = auth.uid() and claim_status =
--   'claimed' for ANY signed-in caller who holds the token. The token is a share link: the scout hands it to the
--   publisher (get_or_create_opportunity_claim_token), so a link that is forwarded, pasted in a chat, screenshotted or
--   read from a log makes whoever opens it the owner: edit rights, applicants, the "claimed" trust label. Possession of
--   a link is not proof that someone publishes the gig or hosts the event. The external discovery loop already works the
--   other way (a link is an invitation to verify; ownership needs proof or a curator's decision).
--
-- FIX (this file is ADDITIVE and safe to apply before the frontend that uses it)
--   * scouted_claim_requests: one row per person asking to claim a gig or an event. Service role and the functions
--     below only (RLS on, no policy, no client grant).
--   * request_scouted_claim(kind, token): any signed-in person with a valid token for an UNCLAIMED target opens a
--     pending request. Nothing is claimed, no created_by changes. One open request per person and target, and at most
--     five open requests per person.
--   * list_scouted_claim_requests() and decide_scouted_claim(request, decision): admins only (external_is_admin, from
--     20261029100000). Approving is the ONLY path that sets created_by / claim_status = 'claimed', as a compare-and-swap
--     on "still unclaimed", and closes the other open requests for the same target.
--
-- The old functions keep working until 20261029110100 (apply it only after the frontend is published).
-- Rollback: DROP FUNCTION decide_scouted_claim(uuid, text), list_scouted_claim_requests(), request_scouted_claim(text, text);
--           DROP TABLE scouted_claim_requests.

CREATE TABLE IF NOT EXISTS public.scouted_claim_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('gig', 'event')),
  target_id uuid NOT NULL,
  claimant_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS scouted_claim_requests_one_open
  ON public.scouted_claim_requests (kind, target_id, claimant_user_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS scouted_claim_requests_open_by_claimant
  ON public.scouted_claim_requests (claimant_user_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS scouted_claim_requests_open_by_age
  ON public.scouted_claim_requests (created_at) WHERE status = 'pending';

ALTER TABLE public.scouted_claim_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.scouted_claim_requests FROM PUBLIC, anon, authenticated;

-- ── a person asks to claim ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.request_scouted_claim(p_kind text, p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_target uuid;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to ask to claim this' USING ERRCODE = '42501';
  END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('gig', 'event') THEN
    RETURN jsonb_build_object('requested', false, 'reason', 'invalid_kind');
  END IF;
  IF p_token IS NULL OR length(p_token) < 12 THEN
    RETURN jsonb_build_object('requested', false, 'reason', 'invalid_token');
  END IF;

  IF p_kind = 'gig' THEN
    SELECT o.id INTO v_target FROM public.opportunities o
     WHERE o.claim_token = p_token AND coalesce(o.claim_status, 'unclaimed') = 'unclaimed' LIMIT 1;
  ELSE
    SELECT j.id INTO v_target FROM public.creative_jams j
     WHERE j.claim_token = p_token AND j.claim_status = 'unclaimed' LIMIT 1;
  END IF;
  IF v_target IS NULL THEN
    -- an unknown token and an already claimed target answer the same way
    RETURN jsonb_build_object('requested', false, 'reason', 'not_available');
  END IF;

  SELECT r.id INTO v_id FROM public.scouted_claim_requests r
   WHERE r.kind = p_kind AND r.target_id = v_target AND r.claimant_user_id = v_uid AND r.status = 'pending';
  IF v_id IS NULL THEN
    IF (SELECT count(*) FROM public.scouted_claim_requests r WHERE r.claimant_user_id = v_uid AND r.status = 'pending') >= 5 THEN
      RETURN jsonb_build_object('requested', false, 'reason', 'too_many_open');
    END IF;
    INSERT INTO public.scouted_claim_requests (kind, target_id, claimant_user_id)
    VALUES (p_kind, v_target, v_uid)
    ON CONFLICT (kind, target_id, claimant_user_id) WHERE status = 'pending' DO NOTHING
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN
      SELECT r.id INTO v_id FROM public.scouted_claim_requests r
       WHERE r.kind = p_kind AND r.target_id = v_target AND r.claimant_user_id = v_uid AND r.status = 'pending';
    END IF;
  END IF;

  -- A request is not ownership, and the answer says so.
  RETURN jsonb_build_object('requested', true, 'verified', false, 'request_id', v_id, 'status', 'pending');
END;
$$;

-- ── a curator reads the open requests ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.list_scouted_claim_requests()
RETURNS TABLE(id uuid, kind text, target_id uuid, title text, claimant_user_id uuid, claimant_name text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.external_is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT r.id, r.kind, r.target_id,
           CASE WHEN r.kind = 'gig' THEN (SELECT o.title FROM public.opportunities o WHERE o.id = r.target_id)
                ELSE (SELECT j.title FROM public.creative_jams j WHERE j.id = r.target_id) END,
           r.claimant_user_id,
           (SELECT p.full_name FROM public.profiles p WHERE p.user_id = r.claimant_user_id LIMIT 1),
           r.created_at
      FROM public.scouted_claim_requests r
     WHERE r.status = 'pending'
     ORDER BY r.created_at
     LIMIT 200;
END;
$$;

-- ── a curator decides ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.decide_scouted_claim(p_request uuid, p_decision text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_admin uuid := auth.uid();
  r public.scouted_claim_requests%ROWTYPE;
  v_done uuid;
BEGIN
  IF NOT public.external_is_admin(v_admin) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('approve', 'reject') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bad_decision');
  END IF;

  -- Lock order is always TARGET first, then the request, so curators deciding on the same target queue up in one order.
  -- (A precaution: a deadlock with the other order was suspected but could not be reproduced.) Read without a lock to find the target.
  SELECT * INTO r FROM public.scouted_claim_requests WHERE id = p_request;
  IF NOT FOUND OR r.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_pending');
  END IF;

  IF p_decision = 'reject' THEN
    UPDATE public.scouted_claim_requests SET status = 'rejected', decided_by = v_admin, decided_at = now()
     WHERE id = r.id AND status = 'pending' RETURNING id INTO v_done;
    IF v_done IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_pending'); END IF;
    RETURN jsonb_build_object('ok', true, 'status', 'rejected');
  END IF;

  IF r.kind = 'gig' THEN
    PERFORM 1 FROM public.opportunities WHERE id = r.target_id FOR UPDATE;
  ELSE
    PERFORM 1 FROM public.creative_jams WHERE id = r.target_id FOR UPDATE;
  END IF;
  SELECT * INTO r FROM public.scouted_claim_requests WHERE id = p_request FOR UPDATE;
  IF r.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_pending'); -- decided while this call waited for the target
  END IF;

  -- The only place a scouted target changes hands: still unclaimed at this very moment, or nothing changes.
  IF r.kind = 'gig' THEN
    UPDATE public.opportunities SET created_by = r.claimant_user_id, claim_status = 'claimed'
     WHERE id = r.target_id AND coalesce(claim_status, 'unclaimed') = 'unclaimed'
    RETURNING id INTO v_done;
  ELSE
    UPDATE public.creative_jams SET created_by = r.claimant_user_id, claim_status = 'claimed'
     WHERE id = r.target_id AND claim_status = 'unclaimed'
    RETURNING id INTO v_done;
  END IF;
  IF v_done IS NULL THEN
    UPDATE public.scouted_claim_requests SET status = 'rejected', decided_by = v_admin, decided_at = now() WHERE id = r.id;
    RETURN jsonb_build_object('ok', false, 'reason', 'not_available');
  END IF;

  UPDATE public.scouted_claim_requests SET status = 'approved', decided_by = v_admin, decided_at = now() WHERE id = r.id;
  UPDATE public.scouted_claim_requests SET status = 'rejected', decided_by = v_admin, decided_at = now()
   WHERE kind = r.kind AND target_id = r.target_id AND status = 'pending' AND id <> r.id;
  RETURN jsonb_build_object('ok', true, 'status', 'approved', 'kind', r.kind, 'target_id', r.target_id);
END;
$$;

REVOKE ALL ON FUNCTION public.request_scouted_claim(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_scouted_claim(text, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.list_scouted_claim_requests() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_scouted_claim_requests() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.decide_scouted_claim(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decide_scouted_claim(uuid, text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- 3. SMOKE TEST inside the same transaction. It never writes to opportunities or creative_jams (a gig or an event never changes
--    hands here); it only writes to the NEW table, and that is rolled back by its own sub-transaction. Any failed expectation
--    raises and rolls the WHOLE script back, the migration included. Claim links are read inside the database and never printed.
DO $$
DECLARE
  v_member uuid;
  v_admin uuid;
  v_gigs_before text;
  v_jams_before text;
  v_gig_id uuid;
  v_gig_token text;
  r jsonb;
  r2 jsonb;
  n integer;
  v_request_path boolean := false;
  v_admin_path boolean := false;
BEGIN
  SELECT md5(coalesce(string_agg(id::text || '|' || coalesce(claim_status, '-') || '|' || coalesce(created_by::text, '-'), ',' ORDER BY id), '')) INTO v_gigs_before FROM public.opportunities;
  SELECT md5(coalesce(string_agg(id::text || '|' || coalesce(claim_status, '-') || '|' || coalesce(created_by::text, '-'), ',' ORDER BY id), '')) INTO v_jams_before FROM public.creative_jams;
  SELECT u.id INTO v_member FROM auth.users u WHERE NOT public.external_is_admin(u.id) ORDER BY u.created_at LIMIT 1;
  SELECT ur.user_id INTO v_admin FROM public.user_roles ur WHERE ur.role::text = 'admin' ORDER BY ur.user_id LIMIT 1;
  IF v_member IS NULL THEN
    RAISE EXCEPTION 'SMOKE FAILED: no ordinary member exists to act as';
  END IF;

  BEGIN
    -- signed out: a request is refused
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claims', '', true);
    BEGIN
      PERFORM public.request_scouted_claim('gig', repeat('a', 20));
      RAISE EXCEPTION 'SMOKE FAILED: a signed-out request was accepted';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;

    -- an ordinary member: the refusals, then no listing and no deciding
    PERFORM set_config('request.jwt.claim.sub', v_member::text, true);
    IF (public.request_scouted_claim('nope', repeat('a', 20))->>'reason') IS DISTINCT FROM 'invalid_kind' THEN RAISE EXCEPTION 'SMOKE FAILED: an unknown kind was not refused'; END IF;
    IF (public.request_scouted_claim('gig', 'short')->>'reason') IS DISTINCT FROM 'invalid_token' THEN RAISE EXCEPTION 'SMOKE FAILED: a short link was not refused'; END IF;
    IF (public.request_scouted_claim('gig', 'smoke_unknown_' || gen_random_uuid()::text)->>'reason') IS DISTINCT FROM 'not_available' THEN RAISE EXCEPTION 'SMOKE FAILED: an unknown gig link was accepted'; END IF;
    IF (public.request_scouted_claim('event', 'smoke_unknown_' || gen_random_uuid()::text)->>'reason') IS DISTINCT FROM 'not_available' THEN RAISE EXCEPTION 'SMOKE FAILED: an unknown event link was accepted'; END IF;
    BEGIN
      PERFORM * FROM public.list_scouted_claim_requests();
      RAISE EXCEPTION 'SMOKE FAILED: a member listed the claim requests';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    IF (public.decide_scouted_claim(gen_random_uuid(), 'approve')->>'reason') IS DISTINCT FROM 'forbidden' THEN RAISE EXCEPTION 'SMOKE FAILED: a member decided a claim'; END IF;

    -- the request path, only if a real gig can be claimed with a link right now (its link is used here and never shown)
    SELECT o.id, o.claim_token INTO v_gig_id, v_gig_token FROM public.opportunities o
     WHERE o.claim_token IS NOT NULL AND length(o.claim_token) >= 12 AND coalesce(o.claim_status, 'unclaimed') = 'unclaimed' ORDER BY o.id LIMIT 1;
    IF v_gig_id IS NOT NULL THEN
      r := public.request_scouted_claim('gig', v_gig_token);
      IF NOT coalesce((r->>'requested')::boolean, false) OR coalesce((r->>'verified')::boolean, true) OR r->>'status' IS DISTINCT FROM 'pending' THEN RAISE EXCEPTION 'SMOKE FAILED: a valid link did not open a pending request'; END IF;
      r2 := public.request_scouted_claim('gig', v_gig_token);
      IF r2->>'request_id' IS DISTINCT FROM r->>'request_id' OR (SELECT count(*) FROM public.scouted_claim_requests) <> 1 THEN RAISE EXCEPTION 'SMOKE FAILED: asking twice must be the same request'; END IF;
      IF (SELECT coalesce(claim_status, 'unclaimed') FROM public.opportunities WHERE id = v_gig_id) <> 'unclaimed' THEN RAISE EXCEPTION 'SMOKE FAILED: asking to claim changed the gig'; END IF;
      v_request_path := true;

      IF v_admin IS NOT NULL THEN
        PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
        SELECT count(*) INTO n FROM public.list_scouted_claim_requests() q WHERE q.target_id = v_gig_id AND q.claimant_user_id = v_member;
        IF n <> 1 THEN RAISE EXCEPTION 'SMOKE FAILED: the curator does not see the open request'; END IF;
        r := public.decide_scouted_claim((r2->>'request_id')::uuid, 'reject');
        IF NOT coalesce((r->>'ok')::boolean, false) OR r->>'status' IS DISTINCT FROM 'rejected' THEN RAISE EXCEPTION 'SMOKE FAILED: the curator could not decline the request'; END IF;
        IF (public.decide_scouted_claim((r2->>'request_id')::uuid, 'reject')->>'reason') IS DISTINCT FROM 'not_pending' THEN RAISE EXCEPTION 'SMOKE FAILED: a decided request was decided twice'; END IF;
        v_admin_path := true;
      END IF;
    END IF;

    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SMOKE_ROLLBACK';   -- undoes every test row written above
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM <> 'SMOKE_ROLLBACK' THEN RAISE; END IF;
  END;

  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);
  IF (SELECT count(*) FROM public.scouted_claim_requests) <> 0 THEN RAISE EXCEPTION 'SMOKE FAILED: test rows were left behind'; END IF;
  IF v_gigs_before IS DISTINCT FROM (SELECT md5(coalesce(string_agg(id::text || '|' || coalesce(claim_status, '-') || '|' || coalesce(created_by::text, '-'), ',' ORDER BY id), '')) FROM public.opportunities)
     OR v_jams_before IS DISTINCT FROM (SELECT md5(coalesce(string_agg(id::text || '|' || coalesce(claim_status, '-') || '|' || coalesce(created_by::text, '-'), ',' ORDER BY id), '')) FROM public.creative_jams) THEN
    RAISE EXCEPTION 'SMOKE FAILED: a gig or an event changed hands';
  END IF;
  INSERT INTO scouted_smoke VALUES (v_request_path, v_admin_path);
  RAISE NOTICE 'smoke test ok: refusals, member cannot list or decide, request path tested on a real gig: %, curator decline tested: %; test rows rolled back, no gig or event changed', v_request_path, v_admin_path;
END
$$;

COMMIT;

-- 4. RESULT (after COMMIT, read-only). Expect one row. The first eight columns must be true. The last two say how far the smoke test
--    could go on THIS data: true means it ran a real request on a real gig and a curator's decline (both rolled back); false only
--    means no gig could be claimed with a link at that moment, or no admin exists, so that step was skipped, not failed.
SELECT
  to_regclass('public.scouted_claim_requests') IS NOT NULL                                              AS table_exists,
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.scouted_claim_requests'::regclass)            AS rls_on,
  NOT (has_table_privilege('anon', 'public.scouted_claim_requests', 'SELECT')
       OR has_table_privilege('anon', 'public.scouted_claim_requests', 'INSERT')
       OR has_table_privilege('anon', 'public.scouted_claim_requests', 'UPDATE')
       OR has_table_privilege('anon', 'public.scouted_claim_requests', 'DELETE')
       OR has_table_privilege('authenticated', 'public.scouted_claim_requests', 'SELECT')
       OR has_table_privilege('authenticated', 'public.scouted_claim_requests', 'INSERT')
       OR has_table_privilege('authenticated', 'public.scouted_claim_requests', 'UPDATE')
       OR has_table_privilege('authenticated', 'public.scouted_claim_requests', 'DELETE'))              AS clients_cannot_touch_table,
  (SELECT count(*) FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname IN ('request_scouted_claim', 'list_scouted_claim_requests', 'decide_scouted_claim')) = 3 AS functions_3,
  NOT (SELECT bool_or(has_function_privilege('anon', p.oid, 'EXECUTE'))
         FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname IN ('request_scouted_claim', 'list_scouted_claim_requests', 'decide_scouted_claim'))        AS anon_cannot_execute,
  (SELECT bool_and(has_function_privilege('authenticated', p.oid, 'EXECUTE'))
         FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname IN ('request_scouted_claim', 'list_scouted_claim_requests', 'decide_scouted_claim'))        AS members_can_call_the_three,
  (SELECT count(*) FROM public.scouted_claim_requests) = 0                                              AS no_test_rows_left,
  to_regprocedure('public.claim_scouted_opportunity(text)') IS NOT NULL
    AND to_regprocedure('public.claim_scouted_event(text)') IS NOT NULL                                  AS old_functions_still_there,
  (SELECT request_path FROM scouted_smoke)                                                               AS request_path_tested,
  (SELECT admin_path FROM scouted_smoke)                                                                 AS curator_decline_tested;
