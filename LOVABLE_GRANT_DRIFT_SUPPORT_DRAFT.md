# Lovable Support Draft — Grant Drift Observation

Draft only — not sent. For review and editing before submission. States
only what was directly observed; does not assert a cause.

---

**Subject: Column-level REVOKE on production tables observed with
different results across two checks — requesting audit-log review**

Hi Lovable support,

We're reporting an observation from our own database, not a claim about
what caused it — we'd like your help determining that.

**What we did**: applied two migrations to our project's database, each
containing column-level `REVOKE UPDATE (...)` statements against three
tables: `public.wallets`, `public.creator_wallets`, `public.profiles`,
for the `authenticated` and `anon` roles.

**First verification** — [fill in: exact date/time from your SQL editor's
query history]. We ran:

```sql
SELECT grantee, table_name, column_name, privilege_type
FROM information_schema.column_privileges
WHERE table_schema = 'public'
  AND table_name IN ('wallets', 'creator_wallets')
  AND column_name IN ('balance', 'credits', 'kyc_status', 'payouts_enabled', 'charges_enabled', 'stripe_account_id')
  AND grantee IN ('authenticated', 'anon');
```

**Result observed**: 2 rows — `creator_wallets.stripe_account_id` showed
an `UPDATE` grant (and a `SELECT` grant) for `authenticated`. All other
queried columns (`wallets.balance`, `wallets.credits`,
`creator_wallets.kyc_status`, `.payouts_enabled`, `.charges_enabled`)
returned no rows for `UPDATE`.

A follow-up migration then added a `REVOKE UPDATE` for the remaining
`creator_wallets.stripe_account_id` column, plus two additional columns
on `public.profiles` (`stripe_account_id`, `stripe_account_status`) that
a related investigation had identified as having the same unrestricted
grant.

**Second verification** — [fill in: exact date/time]. We ran the
extended version of the same query, covering all three tables and
filtered to `privilege_type = 'UPDATE'` only:

```sql
SELECT grantee, table_name, column_name, privilege_type
FROM information_schema.column_privileges
WHERE table_schema = 'public'
  AND (
    (table_name = 'wallets' AND column_name IN ('balance', 'credits'))
    OR (table_name = 'creator_wallets' AND column_name IN ('kyc_status', 'payouts_enabled', 'charges_enabled', 'stripe_account_id', 'requirements'))
    OR (table_name = 'profiles' AND column_name IN ('stripe_account_id', 'stripe_account_status'))
  )
  AND privilege_type = 'UPDATE'
  AND grantee IN ('authenticated', 'anon');
```

**Result observed**: 18 rows — all 8 queried columns across all 3
tables, for **both** `authenticated` and `anon`, showed an active
`UPDATE` grant. This includes columns that had returned zero rows in the
first check (`wallets.balance`, `wallets.credits`,
`creator_wallets.kyc_status`/`.payouts_enabled`/`.charges_enabled`).

**Tables and roles affected**: `public.wallets`, `public.creator_wallets`,
`public.profiles`; `authenticated` and `anon`.

**Migrations we checked on our end**: we reviewed our full tracked
migration history for these three tables. We found no `ALTER DEFAULT
PRIVILEGES` or schema-wide `GRANT` statement touching the `public`
schema anywhere in our own migration files — the only such statements we
have are scoped to the unrelated `net` extension schema. We separately
confirmed `public.creator_wallets` was created with an explicit
table-level `GRANT UPDATE ... TO authenticated` at table-creation time
(one of our own earlier migrations), which our later column-level
`REVOKE` statements would not have been able to override — Postgres
column-level `REVOKE` cannot narrow a coexisting table-level `GRANT`.
We were not able to confirm from our own tracked files whether
`public.wallets` and `public.profiles` similarly carry a table-level
grant that predates our migrations (e.g. via a project-level default
privilege set outside our migration history) — this is the main thing
we're hoping you can help confirm or rule out.

**Actions we did not perform**: we did not run any `GRANT` statement
between the two checks. We did not modify RLS policies. We did not
recreate, drop, or alter the ownership of any of the three tables. We
have not been able to determine, from our side, whether anything else —
a schema-sync process, a "push to database" action, a visual
schema-editor change, or manual intervention — touched these tables in
that window.

**Questions for you**:
1. Can you check our project's audit/activity log for any `GRANT`,
   schema-sync, or "push to database" event affecting `public.wallets`,
   `public.creator_wallets`, or `public.profiles` between the two
   timestamps above?
2. Does this project have a project-level default privilege
   (`ALTER DEFAULT PRIVILEGES ... GRANT ALL ON TABLES TO anon,
   authenticated`) set at provisioning time, outside our own migration
   history? If so, can you confirm which tables it applies to?
3. Is there a supported, durable way to apply a column-level privilege
   restriction on this platform that won't be affected by whatever
   caused the second check's result — e.g., does your platform's schema
   sync ever reapply baseline grants to existing tables, and if so, is
   there a way to exclude specific tables/columns from that?

We're not asserting this was caused by anything on your end — we
genuinely don't know, and that's exactly what we're hoping the audit log
can help clarify. This affects a live production security fix, so we'd
appreciate a look when you're able.

Thanks
