-- APPLY: stop clients from WRITING through the public view public.public_external_listings. URGENT: apply as soon as you can.
-- Paste the whole file into the SQL editor of the production database (kwmcocsitwssrtzkdojh) and run it once. Safe to run twice.
--
-- THE PROBLEM (found 2026-10-29, confirmed against production with zero-row requests only):
--   The view runs with its owner's rights (the base table is service-role only) and is a plain single-table view, so Postgres lets a client
--   INSERT / UPDATE / DELETE through it, applied to the base table with the OWNER's rights. The earlier migration ended with
--   `REVOKE ALL ... FROM PUBLIC`, which does not remove what Supabase's default privileges had already granted to anon and authenticated by name
--   (ACL anon=arwdDxtm, authenticated=arwdDxtm). With nothing but the public key, anyone could change or delete a published external listing
--   (for example point its apply_url to another site) and insert rows into external_listings. Checked live: PATCH and DELETE on the view with
--   the public key answered 204 (allowed, 0 rows because the id did not exist), and a POST reached the base table's NOT NULL check.
--   Every OTHER public view is `security_invoker`, so its writes are checked against its base table as the caller; only this one was open.
--   Looked for signs of use in the data: 278 listings, every one has an audit event, no published listing was changed after its last audit
--   event, all 44 public apply_urls are on jobicy.com or remoteok.com. That is not proof for the past; it is what the data shows.
--
-- WHAT THIS DOES (one transaction, no data touched):
--   1. REVOKE ALL on the view from PUBLIC, anon, authenticated; GRANT SELECT to anon and authenticated (the pages and the Match deck read it);
--      GRANT ALL to service_role (the edge functions).
--   2. ALTER VIEW ... SET (security_barrier = true): a client-supplied filter can no longer be evaluated against rows the view's own WHERE
--      excludes (drafts, private, flagged), so they cannot be probed through error messages.
-- Nothing else changes: not a listing, not a table, not a function, not another view.
--
-- SAFETY: the preflight refuses if the view is missing. The smoke test (3) raises on any surprise and rolls everything back: it checks the
-- privilege catalog for anon, authenticated and service_role, and, where this editor may switch role, that anon and authenticated can still
-- READ the view and are REFUSED an update, a delete and an insert. No undo script on purpose: write access through a read-only view is
-- the defect. If reads ever fail, `GRANT SELECT ON public.public_external_listings TO anon, authenticated;` is the whole repair.

BEGIN;

-- 1. PREFLIGHT (read-only, apart from a session-only temp table).
CREATE TEMP TABLE close_view_before (listings bigint, public_rows bigint, anon_acl text);

DO $$
DECLARE
  v_kind "char";
BEGIN
  SELECT relkind INTO v_kind FROM pg_class WHERE oid = to_regclass('public.public_external_listings');
  IF v_kind IS DISTINCT FROM 'v' THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: public.public_external_listings is not a view here (is the external discovery migration applied?); nothing was changed';
  END IF;
  INSERT INTO close_view_before
    SELECT (SELECT count(*) FROM public.external_listings),
           (SELECT count(*) FROM public.public_external_listings),
           (SELECT string_agg(a.privilege_type, ',' ORDER BY a.privilege_type)
              FROM (SELECT (aclexplode(relacl)).* FROM pg_class WHERE oid = 'public.public_external_listings'::regclass) a
              JOIN pg_roles r ON r.oid = a.grantee WHERE r.rolname = 'anon');
  RAISE NOTICE 'preflight ok: the view exists; % listing(s), % public; anon holds: %', (SELECT listings FROM close_view_before), (SELECT public_rows FROM close_view_before), coalesce((SELECT anon_acl FROM close_view_before), 'nothing');
END
$$;

-- 2. THE CHANGE.
REVOKE ALL ON public.public_external_listings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.public_external_listings TO anon, authenticated;
GRANT ALL ON public.public_external_listings TO service_role;
ALTER VIEW public.public_external_listings SET (security_barrier = true);

-- 3. SMOKE TEST inside the same transaction. Any failed expectation raises and rolls the WHOLE script back, the change above included.
DO $$
DECLARE
  r text;
  can_switch boolean;
  denied boolean;
  p text;
  v_oid oid := 'public.public_external_listings'::regclass;
BEGIN
  -- the privilege catalog, for the three roles that matter
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF NOT has_table_privilege(r, v_oid, 'SELECT') THEN RAISE EXCEPTION 'SMOKE FAILED: % can no longer read the public view', r; END IF;
    FOREACH p IN ARRAY ARRAY['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'] LOOP
      IF has_table_privilege(r, v_oid, p) THEN RAISE EXCEPTION 'SMOKE FAILED: % still holds % on the public view', r, p; END IF;
    END LOOP;
  END LOOP;
  IF NOT (has_table_privilege('service_role', v_oid, 'SELECT') AND has_table_privilege('service_role', v_oid, 'UPDATE')) THEN
    RAISE EXCEPTION 'SMOKE FAILED: service_role lost access to the public view';
  END IF;
  IF NOT coalesce((SELECT 'security_barrier=true' = ANY (reloptions) FROM pg_class WHERE oid = v_oid), false) THEN
    RAISE EXCEPTION 'SMOKE FAILED: security_barrier is not on';
  END IF;

  -- and the real thing, where this editor may switch role: read works, update / delete / insert are refused
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    can_switch := true;
    BEGIN
      EXECUTE format('SET LOCAL ROLE %I', r);
    EXCEPTION WHEN insufficient_privilege THEN
      can_switch := false;
      RAISE NOTICE 'this editor cannot switch to role %; relying on the privilege catalog for it', r;
    END;
    IF can_switch THEN
      BEGIN
        PERFORM count(*) FROM public.public_external_listings;
      EXCEPTION WHEN OTHERS THEN
        RESET ROLE;
        RAISE EXCEPTION 'SMOKE FAILED: % could not read the public view: %', r, SQLERRM;
      END;

      denied := false;
      BEGIN UPDATE public.public_external_listings SET title = title WHERE false; EXCEPTION WHEN insufficient_privilege THEN denied := true; END;
      IF NOT denied THEN RESET ROLE; RAISE EXCEPTION 'SMOKE FAILED: % can still UPDATE through the public view', r; END IF;

      denied := false;
      BEGIN DELETE FROM public.public_external_listings WHERE false; EXCEPTION WHEN insufficient_privilege THEN denied := true; END;
      IF NOT denied THEN RESET ROLE; RAISE EXCEPTION 'SMOKE FAILED: % can still DELETE through the public view', r; END IF;

      denied := false;
      BEGIN INSERT INTO public.public_external_listings (kind, title) VALUES ('gig', 'smoke'); EXCEPTION WHEN insufficient_privilege THEN denied := true; END;
      IF NOT denied THEN RESET ROLE; RAISE EXCEPTION 'SMOKE FAILED: % can still INSERT through the public view', r; END IF;

      RESET ROLE;
    END IF;
  END LOOP;

  IF (SELECT count(*) FROM public.external_listings) <> (SELECT listings FROM close_view_before)
     OR (SELECT count(*) FROM public.public_external_listings) <> (SELECT public_rows FROM close_view_before) THEN
    RAISE EXCEPTION 'SMOKE FAILED: a listing count changed';
  END IF;
  RAISE NOTICE 'smoke test ok: anon and authenticated can read and cannot write; service_role keeps its access; security_barrier on; nothing changed';
END
$$;

COMMIT;

-- 4. RESULT (after COMMIT, read-only). Expect one row: every column true; listings_unchanged compares with the count before.
SELECT
  has_table_privilege('anon', 'public.public_external_listings', 'SELECT')
    AND has_table_privilege('authenticated', 'public.public_external_listings', 'SELECT')                                       AS clients_can_read_the_view,
  NOT (has_table_privilege('anon', 'public.public_external_listings', 'INSERT') OR has_table_privilege('anon', 'public.public_external_listings', 'UPDATE')
       OR has_table_privilege('anon', 'public.public_external_listings', 'DELETE') OR has_table_privilege('authenticated', 'public.public_external_listings', 'INSERT')
       OR has_table_privilege('authenticated', 'public.public_external_listings', 'UPDATE') OR has_table_privilege('authenticated', 'public.public_external_listings', 'DELETE')) AS clients_cannot_write_the_view,
  has_table_privilege('service_role', 'public.public_external_listings', 'SELECT')                                              AS service_role_can_use_the_view,
  coalesce((SELECT 'security_barrier=true' = ANY (reloptions) FROM pg_class WHERE oid = 'public.public_external_listings'::regclass), false) AS security_barrier_on,
  (SELECT count(*) FROM public.external_listings) = (SELECT listings FROM close_view_before)                                    AS no_listing_changed,
  NOT (has_table_privilege('anon', 'public.external_listings', 'SELECT') OR has_table_privilege('authenticated', 'public.external_listings', 'SELECT')
       OR has_table_privilege('anon', 'public.external_listings', 'UPDATE') OR has_table_privilege('authenticated', 'public.external_listings', 'UPDATE')) AS base_table_still_closed,
  (SELECT count(*) FROM public.public_external_listings)                                                                        AS public_rows_now;
