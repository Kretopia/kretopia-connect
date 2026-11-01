# Lot A -- concurrency test (run by you, on an ISOLATED database, never on production)

Status of lot A's behaviour under concurrency until this test has been run and its three results match: **WAITING_FOR_VALIDATION**.
Nothing here was run by the author: the session had no database and, by rule, no `psql`.

Lot A itself was applied to production by the owner on 2026-11-01, before this test (`RESULTS.md`: 16 of 16 catalog checks true). So this
test no longer gates the application. It gates the **wiring**: no edge function should call `reserve_budget` in production until the three
results below match. Nothing calls it today.

What it must show: with many simultaneous sessions, `used + reserved` never passes the limit, a reservation is settled at most
once, and the counters equal the sum of the reservation rows.

## 1. An isolated database

Use a throwaway Postgres (production is 17.6, so 17 is the closest; 15 or 16 also work), in a local container or on a machine that has
nothing to do with production:

```bash
createdb budget_test
```

**Connect as the service role, or every call fails.** The three functions refuse any caller whose JWT role is not `service_role`, except
the database users `postgres` and `supabase_admin`. On a plain Postgres your login is neither (with Homebrew it is your macOS user), so
without the line below `02_apply.sql`'s own smoke test stops with `42501` and so does every `pgbench` call. In production the editor is
`postgres`, which is why it did not show there. Export it once, in the shell you use for `psql` and `pgbench` (lot D's test needs the same
line):

```bash
export PGOPTIONS='-c request.jwt.claim.role=service_role'
```

(Alternative: `createuser -s postgres`, then connect with `-U postgres`.)

A plain Postgres has none of Supabase's roles, so create the stand-ins first (test database only, never in production):

```sql
-- stubs.sql  (run once in budget_test)
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.role', true), '') $$;
```

Then `01_preflight.sql`, `02_apply.sql`, `03_verify.sql` of this folder, in that order, in the same database. All three must succeed.

## 2. One bucket, 640 attempts against a limit of 100

`reserve.sql` (one line):

```sql
SELECT allowed FROM public.reserve_budget('test:one', 3600, 100, 1, 300);
```

```bash
pgbench -n -f reserve.sql -c 32 -j 8 -t 20 budget_test      # 32 sessions x 20 = 640 attempts
```

Expected, exactly:

```sql
SELECT used_units, reserved_units, limit_units FROM public.budget_buckets WHERE bucket_key = 'test:one';
-- used_units 0, reserved_units 100, limit_units 100        (not 101, not 99)
SELECT count(*) FROM public.budget_reservations WHERE bucket_key = 'test:one';
-- 100
```

## 3. Mixed settlement under load

`mixed.sql`:

```sql
\set pick random(1, 3)
WITH r AS (SELECT * FROM public.reserve_budget('test:mixed', 3600, 50, 1, 300))
SELECT CASE WHEN :pick = 1 THEN (SELECT public.commit_budget(reservation_id) FROM r WHERE allowed)
            WHEN :pick = 2 THEN (SELECT public.release_budget(reservation_id) FROM r WHERE allowed)
            ELSE NULL END;
```

```bash
pgbench -n -f mixed.sql -c 24 -j 8 -t 200 budget_test
```

Expected: no error (no deadlock, no constraint violation), and these three queries all return `true`:

```sql
SELECT b.used_units + b.reserved_units <= b.limit_units AS never_over
FROM public.budget_buckets b WHERE b.bucket_key = 'test:mixed';

SELECT b.used_units = COALESCE((SELECT sum(units) FROM public.budget_reservations r
                                WHERE r.bucket_key = b.bucket_key AND r.window_start = b.window_start AND r.status = 'committed'), 0)
   AND b.reserved_units = COALESCE((SELECT sum(units) FROM public.budget_reservations r
                                WHERE r.bucket_key = b.bucket_key AND r.window_start = b.window_start AND r.status = 'reserved'), 0)
       AS counters_equal_the_rows
FROM public.budget_buckets b WHERE b.bucket_key = 'test:mixed';

SELECT NOT EXISTS (SELECT 1 FROM public.budget_reservations WHERE status NOT IN ('reserved', 'committed', 'released', 'expired')) AS only_known_states;
```

## 4. Settle twice

Two sessions call `commit_budget` and `release_budget` on the same reservation at the same time (open two `psql` windows with the
`PGOPTIONS` above exported, `BEGIN;` in both, run the calls, then `COMMIT;` one after the other). Exactly one call returns `true`; the
other returns `false`; the row ends in one state only.

## What to report back

The three results of steps 2 to 4 (counts and the three booleans). If any differs, wire nothing to `reserve_budget` and say so: lot A is
already in production, and would need `04_rollback.sql` (it is safe to run while nothing calls the functions) or a corrected definition.

## What this test does not cover

The behaviour with a real PostgREST caller: `03b_verify_as_roles.sql` makes the database answer as each API role, and the REST call at the
end of `03_verify.sql` is the only look at PostgREST's own answer. Nor lock waits at production volume; the lock is per bucket and window,
so unrelated buckets never wait on each other.
