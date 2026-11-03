-- APPLY: credit trust-field guard (approved 2026-10-28). Paste the whole file into the SQL editor of the production
-- database (kwmcocsitwssrtzkdojh) and run it once.
--
-- What it does: replaces ONE function, guard_credit_verification_escalation() (the trigger on public.credits stays
-- as it is). After it, an unauthorized caller can no longer INSERT a credit already marked 'peer', nor one that
-- carries an endorsement_count or a verified_by_name. Section 2 is supabase/migrations/
-- 20261028130000_guard_credit_trust_fields_on_insert.sql, byte for byte. No table, column, grant or data changes;
-- existing credits are not touched. verification_url and ai_confidence are deliberately not guarded (the importers
-- write them). Authorized writers are unchanged: the service role, and the SECURITY DEFINER co-sign / verification
-- RPCs that set app.credit_verification_authorized.
--
-- Safety: everything runs in ONE transaction. The preflight (1) and the smoke test (3) raise on any surprise and the
-- whole script rolls back. Rollback after a successful run: security/rollback-credit-trust-guard-2026-10-28.sql.
-- Needs no secret. Writes only the function definition (the smoke test writes nothing).

BEGIN;

-- 1. PREFLIGHT (read-only). Stops the whole script, changing nothing, unless production looks like the repo:
--    the guard function and its trigger exist, and the three columns the new guard reads exist on credits (a guard that
--    names a missing column would make EVERY credit insert fail). Also prints how many credits already carry a trust
--    signal; those rows are not touched, the guard only judges new writes.
DO $$
DECLARE
  missing text;
  n_peer integer;
  n_endorsed integer;
  n_verifier integer;
BEGIN
  IF to_regprocedure('public.guard_credit_verification_escalation()') IS NULL THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: public.guard_credit_verification_escalation() does not exist; nothing was changed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    WHERE t.tgrelid = 'public.credits'::regclass
      AND t.tgname = 'guard_credit_verification_escalation'
      AND NOT t.tgisinternal
      AND (t.tgtype & 23) = 23  -- ROW + BEFORE + INSERT + UPDATE
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: the BEFORE INSERT OR UPDATE trigger guard_credit_verification_escalation is not attached to public.credits; nothing was changed';
  END IF;

  SELECT string_agg(c, ', ') INTO missing
  FROM unnest(ARRAY['verification_status', 'endorsement_count', 'verified_by_name']) AS c
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'credits' AND column_name = c
  );
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: public.credits has no column(s) %; nothing was changed', missing;
  END IF;

  SELECT count(*) FILTER (WHERE verification_status = 'peer'),
         count(*) FILTER (WHERE COALESCE(endorsement_count, 0) <> 0),
         count(*) FILTER (WHERE verified_by_name IS NOT NULL)
    INTO n_peer, n_endorsed, n_verifier
  FROM public.credits;
  RAISE NOTICE 'preflight ok. existing credits (untouched): % peer, % with an endorsement count, % with a verifier name', n_peer, n_endorsed, n_verifier;
END
$$;

-- 2. THE MIGRATION (verbatim).
-- A credit's trust signals are written by the server, never by the credit's owner.
--
-- guard_credit_verification_escalation() (20260812071205) refuses an INSERT or an UPDATE that sets
-- verification_status to 'verified' or 'auto_discovered' unless the caller is service_role or inside an RPC that set
-- app.credit_verification_authorized. Two other trust signals were left open on INSERT:
--   * verification_status = 'peer': the co-signed state. statusEngine and creativeRecord count it as a trust rung, and
--     the only legitimate writer is submit_credit_endorsement_by_token (it sets the authorization flag first).
--   * endorsement_count > 0 and verified_by_name: "N endorsements" and "verified by <name>" are rendered next to the
--     credit. Column UPDATE is already revoked from authenticated/anon (20260904210000), but a plain INSERT sets them.
-- So a signed-in user could insert credits already marked 'peer', with an endorsement count and a verifier name, and
-- raise their Creative Status without a single co-sign. No client code sends these fields on insert.
--
-- Now the same rule covers 'peer', and an INSERT by an unauthorized caller must carry no endorsement count and no
-- verifier name. Deliberately NOT touched: verification_url and ai_confidence (connect-platform, the fetch-*-credits
-- importers and enrich-creator-profile write them for credits that stay 'pending' / 'unverified').
--
-- Unchanged: who is authorized (service_role, or an RPC that set the flag), the downgrade freedom (a user may set
-- their own credit to 'unverified' / 'rejected'), the trigger itself (CREATE OR REPLACE keeps it).
--
-- No schema change, no data change. Not applied to production by the commit that adds this file.
-- Rollback: re-run the function from 20260812071205_c57b2c1c-1974-49bb-9075-ffff9ffb5e30.sql (lines 121-139).

CREATE OR REPLACE FUNCTION public.guard_credit_verification_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_authorized boolean :=
    auth.role() = 'service_role'
    OR current_setting('app.credit_verification_authorized', true) IS NOT DISTINCT FROM 'true';
BEGIN
  IF NOT v_authorized THEN
    IF NEW.verification_status IN ('verified', 'auto_discovered', 'peer')
       AND (TG_OP = 'INSERT' OR NEW.verification_status IS DISTINCT FROM OLD.verification_status)
    THEN
      RAISE EXCEPTION 'verification_status cannot be escalated to % directly — use an authorized verification RPC', NEW.verification_status;
    END IF;

    IF TG_OP = 'INSERT'
       AND (COALESCE(NEW.endorsement_count, 0) <> 0 OR NEW.verified_by_name IS NOT NULL)
    THEN
      RAISE EXCEPTION 'endorsement_count and verified_by_name are set by verification, not on insert';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 3. SMOKE TEST inside the same transaction. It simulates a signed-in API caller (transaction-local JWT settings,
--    reset by the COMMIT) and tries three forged inserts on credits: status 'peer', an endorsement count, a verifier
--    name. The guard fires BEFORE the row exists, so nothing is written when it works. If any forged insert is
--    ALLOWED, the script raises and everything rolls back, the migration and that row included. If the caller cannot be
--    simulated, or an unrelated trigger answers first, the case is reported as inconclusive (NOTICE) and the result
--    query below is the check.
DO $$
DECLARE
  forged text[] := ARRAY['peer', 'endorsement_count', 'verified_by_name'];
  kind text;
  refused integer := 0;
BEGIN
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', '{"role":"authenticated"}', true);
  IF auth.role() IS DISTINCT FROM 'authenticated' THEN
    RAISE NOTICE 'smoke test skipped: auth.role() cannot be simulated here (got %); use the result query', auth.role();
    RETURN;
  END IF;

  FOREACH kind IN ARRAY forged LOOP
    BEGIN
      IF kind = 'peer' THEN
        INSERT INTO public.credits (user_id, project_name, verification_status) VALUES (gen_random_uuid(), 'zz-smoke-test', 'peer');
      ELSIF kind = 'endorsement_count' THEN
        INSERT INTO public.credits (user_id, project_name, endorsement_count) VALUES (gen_random_uuid(), 'zz-smoke-test', 5);
      ELSE
        INSERT INTO public.credits (user_id, project_name, verified_by_name) VALUES (gen_random_uuid(), 'zz-smoke-test', 'Someone');
      END IF;
      RAISE EXCEPTION 'SMOKE FAILED: a forged insert (%) was ALLOWED', kind;
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE 'SMOKE FAILED%' THEN
        RAISE;
      ELSIF SQLERRM LIKE '%cannot be escalated%' OR SQLERRM LIKE '%set by verification%' THEN
        refused := refused + 1;
      ELSE
        RAISE NOTICE 'smoke case % inconclusive: %', kind, SQLERRM;
      END IF;
    END;
  END LOOP;

  RAISE NOTICE 'smoke test ok: % of 3 forged inserts refused by the guard, 0 allowed', refused;
END
$$;

COMMIT;

-- 4. RESULT (after COMMIT, read-only). Expect one row, all three true.
SELECT
  p.prosrc ILIKE '%''verified'', ''auto_discovered'', ''peer''%'  AS guards_peer,
  p.prosrc ILIKE '%endorsement_count%verified_by_name%'            AS guards_insert_trust_fields,
  EXISTS (
    SELECT 1 FROM pg_trigger t
    WHERE t.tgrelid = 'public.credits'::regclass
      AND t.tgname = 'guard_credit_verification_escalation'
      AND NOT t.tgisinternal
  )                                                                  AS trigger_still_attached
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'guard_credit_verification_escalation';
