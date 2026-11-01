-- LOT A -- durable budgets (CREATION) -- 01 PREFLIGHT. Read-only. Changes nothing.
-- Run it in the SQL Editor of the Lovable project "kretopia-app" (the one that reaches production), nowhere else.
--
-- It stops with an error if anything this lot creates already exists (a table, an index, a function of the same name, in
-- ANY form), or if something it needs is missing. If it ends with a result row, every value must be true.
-- It does not prove the lot will behave well under concurrency: that is 05_CONCURRENCY_TEST.md, on an isolated database.

DO $preflight$
DECLARE
  v_missing text;
  v_clash text;
BEGIN
  -- Needed by the lot
  SELECT string_agg(r, ', ') INTO v_missing
  FROM unnest(ARRAY['anon', 'authenticated', 'service_role']) AS r
  WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r);
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: role(s) missing: %. This is not a Supabase database; nothing was changed.', v_missing;
  END IF;

  IF to_regprocedure('auth.role()') IS NULL THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: auth.role() does not exist here; the functions of this lot check it. Nothing was changed.';
  END IF;

  IF to_regprocedure('gen_random_uuid()') IS NULL THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: gen_random_uuid() is not available. Nothing was changed.';
  END IF;

  -- Nothing of the same name may exist, whatever it is (table, view, index, sequence, type, function with any arguments)
  SELECT string_agg(format('%s %s', c.relkind, c.relname), ', ') INTO v_clash
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname IN ('budget_buckets', 'budget_reservations', 'budget_reservations_open_idx', 'budget_buckets_window_idx',
                      'budget_buckets_pkey', 'budget_reservations_pkey');
  IF v_clash IS NOT NULL THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: already present in public: %. Another definition may be in use; decide before going on. Nothing was changed.', v_clash;
  END IF;

  SELECT string_agg(p.oid::regprocedure::text, ', ') INTO v_clash
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname IN ('reserve_budget', 'commit_budget', 'release_budget');
  IF v_clash IS NOT NULL THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: function(s) already present: %. Nothing was changed.', v_clash;
  END IF;

  SELECT string_agg(t.typname, ', ') INTO v_clash
  FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = 'public' AND t.typname IN ('budget_buckets', 'budget_reservations');
  IF v_clash IS NOT NULL THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: type(s) already present: %. Nothing was changed.', v_clash;
  END IF;
END
$preflight$;

SELECT
  true AS roles_present,
  true AS auth_role_function_present,
  true AS gen_random_uuid_present,
  true AS no_table_index_function_or_type_of_these_names,
  current_setting('server_version') AS postgres_version,
  current_user AS running_as,
  'The SQL Editor runs as postgres and bypasses RLS: this proves what exists, not how a signed-in caller is treated.' AS limit_of_this_check;
