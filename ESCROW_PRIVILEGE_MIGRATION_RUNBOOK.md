# Escrow Privilege Migration Runbook

**Status: `BLOCKED_MIGRATION_NOT_APPLIED`**

This is the exact, step-by-step manual runbook for applying
[`20260824100000_milestones_privilege_hardening.sql`](supabase/migrations/20260824100000_milestones_privilege_hardening.sql).
**No SQL has been applied by Claude.** Every query below is either
read-only (inspection/preflight/postflight) or is the migration text
itself, presented for the user to review and run manually in the
Lovable Cloud SQL Editor. This document does not touch the database —
it prepares everything a human needs to do that safely.

## 0. Why this exists

A real, live HTTP test through the actual client path — not
service_role, not the SQL Editor superuser context — found that a
direct `PATCH` to `milestones.status` / `escrow_status` succeeds
(`HTTP 204`) when it should be rejected (`HTTP 403 / 42501`). Full
detail and the raw test transcripts: [ESCROW_RLS_NEGATIVE_TEST_REPORT.md](ESCROW_RLS_NEGATIVE_TEST_REPORT.md),
tests 6–8. Root cause and full reasoning: the migration file itself,
[`20260824100000_milestones_privilege_hardening.sql`](supabase/migrations/20260824100000_milestones_privilege_hardening.sql).

## 1. Verify target project identity — DO THIS FIRST

Every step below assumes you are connected to the **Kretopia** Lovable
Cloud project, Supabase project ref **`kwmcocsitwssrtzkdojh`** — the
same project this session's earlier wallet-privilege work verified and
applied against (see `LOVABLE_CLOUD_ACCESS_REPORT.md`). Before running
anything else, confirm the SQL Editor you have open is connected to
that project, not a different one:

```sql
select current_database(), inet_server_addr();
```

There is no single query that prints "kwmcocsitwssrtzkdojh" back to
you — Lovable Cloud's SQL Editor is already scoped to one project by
the UI itself. The check that matters is visual: confirm the project
name/URL shown in the Lovable Cloud dashboard reads "Kretopia" (or
whatever this project is currently named there) before you run
anything past this point. If you are not certain, stop and confirm in
the dashboard rather than proceeding.

## 2. Inspect migration history (has this file already run?)

```sql
select version, name
from supabase_migrations.schema_migrations
where version::text like '2026082%'
order by version desc;
```

Expected, based on everything already applied to this project as
tracked in the repo: this should list every `202608*` migration up
through `20260824061125`, but **not** `20260824100000` (this
migration's own version stamp). If `20260824100000` already appears
here, stop — do not re-run the migration below; instead skip to
§6 (post-migration verification) to confirm its current effect.

## 3. Confirm the fix is not already (accidentally) in effect

```sql
select grantee, privilege_type, is_grantable
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'milestones'
  and grantee in ('authenticated', 'anon')
order by grantee, privilege_type;
```

If this shows `UPDATE` present for `authenticated` at the **table**
level (no column list — that's what `role_table_grants` reports;
column-level grants show up in `role_column_grants`, queried
separately in §4), the gap is still open and the migration is needed.
If `UPDATE` is absent entirely for `authenticated` here, something
already closed it — do not proceed with the migration blindly; instead
re-run the exact negative test from `ESCROW_RLS_NEGATIVE_TEST_REPORT.md`
tests 6–8 first to see whether the live gap is actually closed already.

## 4. Inspect current milestones schema

```sql
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'milestones'
order by ordinal_position;
```

```sql
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.milestones'::regclass;
```

Expected (from the tracked migration history, for cross-reference
against what the live schema actually returns):
- `status` CHECK: `requested`, `pending`, `in_progress`, `submitted`,
  `approved`, `paid` only (from `20260506234034_...sql`).
- `escrow_status` CHECK: `none`, `authorized`, `captured`, `cancelled`
  only (from `20251001071212_...sql`).

If the live constraint differs from this, **stop** — the migration's
RPC (`update_milestone_workflow_status`) hard-codes the `status`
allow-list `('requested','pending','in_progress','submitted','approved')`
and will reject anything else, including a value the live schema might
actually permit that isn't in the tracked migration history. Report
the discrepancy rather than applying.

## 5. Inspect RLS policies on milestones

```sql
select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'milestones'
order by cmd, policyname;
```

Expected: an `UPDATE` policy named "Users can update milestones in
their projects" whose `USING` clause allows the project owner, match
participants, and accepted collaborators — and **no `WITH CHECK`
clause** (Postgres defaults `WITH CHECK` to the same as `USING` for
`UPDATE` when omitted). This means RLS governs *which rows* a
collaborator can touch, not *which columns or values* — confirming
that column/table-level GRANTs are the only mechanism actually
preventing a collaborator from writing `status='paid'` or
`escrow_status='authorized'` on a row they can already see. This is
why the fix is a GRANT/REVOKE + RPC migration, not an RLS policy
change.

## 6. Inspect table and column privileges (the actual gap)

```sql
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'milestones'
  and grantee in ('authenticated', 'anon')
order by grantee, privilege_type;
```

```sql
select grantee, column_name, privilege_type
from information_schema.role_column_grants
where table_schema = 'public' and table_name = 'milestones'
  and grantee in ('authenticated', 'anon')
order by grantee, column_name, privilege_type;
```

Same query shape used to root-cause and later verify the wallets/
profiles privilege drift earlier this session (`PRIVILEGE_VERIFICATION_QUERIES.sql`).
If `authenticated` has table-level `UPDATE` here with no matching
column-level `REVOKE` actually taking effect (the coexistence that
makes a column-level-only REVOKE a no-op), that confirms the same root
cause as the wallets finding: a project-level default privilege never
issued by any tracked migration.

## 7. Frontend and server write paths — already inspected (code, not DB)

Confirmed via `grep -rn "from(['\"]milestones['\"])" src/` across the
whole frontend:

| File | Operation | After this migration |
|---|---|---|
| `src/components/project/MilestoneBoard.tsx` | was `.update({status})`, now `.rpc('update_milestone_workflow_status', ...)` | Already migrated (this session, prior commit `0ee6a763`) |
| `src/components/project/finance/PaymentRequestsReview.tsx` | was `.update({status:'approved'})`, now same RPC | Already migrated (same commit) |
| `src/components/project/ProjectSettings.tsx`, `ProjectSettingsMenu.tsx` | `.delete()` | Unaffected — this migration only touches `UPDATE` |
| `src/components/project/ProjectTemplatePicker.tsx`, `ScopeGuardian.tsx`, `studio/AutopilotProjectGuide.tsx`, `studio/RequestPaymentCard.tsx` | `.insert()` | Unaffected — this migration only touches `UPDATE` |
| `supabase/functions/capture-milestone-payment/index.ts`, `stripe-marketplace-webhook/index.ts` | `.update({status, escrow_status, ...})` via **service-role** client | Unaffected — service_role bypasses all table/column grants and RLS entirely |
| `public.confirm_milestone_paid_offline` (existing `SECURITY DEFINER` RPC) | Direct `UPDATE` inside the function body | Unaffected — `SECURITY DEFINER` functions run as their owner, not the caller |

No write path was found that this migration would silently break. The
two client call sites that legitimately write `status` were already
migrated to the RPC in the same session that wrote this migration
(caught before finalizing — see the migration file's own header
comment for the mistake that was corrected).

## 8. Preflight queries — run these immediately BEFORE applying

Capture their output somewhere (paste into this file's own history, a
scratch note, wherever) so §9's postflight queries have something to
diff against:

```sql
-- A: current grants (compare against §9-A after applying)
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'milestones'
  and grantee in ('authenticated', 'anon')
order by grantee, privilege_type;

-- B: does the RPC already exist under this name? (it shouldn't)
select proname, pg_get_function_identity_arguments(oid)
from pg_proc
where proname = 'update_milestone_workflow_status';

-- C: row count sanity check -- confirms nothing about this migration
-- accidentally touches existing data (it shouldn't; it's grants + one
-- function definition, no UPDATE/DELETE on milestones rows themselves)
select count(*) from public.milestones;
```

## 9. The migration itself

Full text: [`supabase/migrations/20260824100000_milestones_privilege_hardening.sql`](supabase/migrations/20260824100000_milestones_privilege_hardening.sql).

**To apply**: open the Lovable Cloud SQL Editor for the Kretopia
project (confirmed in §1), paste the complete contents of that file
exactly as committed, and run it. Do not edit it in the editor before
running — if something here looks wrong, stop and fix it in the repo
first so the applied SQL matches what's in version control.

## 10. Post-migration verification queries — run immediately AFTER applying

```sql
-- A: grants should now show UPDATE narrowed to specific columns only
-- (title, description, amount, due_date, updated_at) for authenticated,
-- and no table-level bare UPDATE grant remaining
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'milestones'
  and grantee in ('authenticated', 'anon')
order by grantee, privilege_type;

select grantee, column_name, privilege_type
from information_schema.role_column_grants
where table_schema = 'public' and table_name = 'milestones'
  and grantee = 'authenticated' and privilege_type = 'UPDATE'
order by column_name;

-- B: the RPC should now exist, SECURITY DEFINER, owned appropriately
select proname, prosecdef, pg_get_function_identity_arguments(oid)
from pg_proc
where proname = 'update_milestone_workflow_status';

-- C: EXECUTE grant should be authenticated-only, not anon/PUBLIC
select grantee, privilege_type
from information_schema.role_routine_grants
where routine_name = 'update_milestone_workflow_status';

-- D: row count should be unchanged from the §8-C preflight value --
-- this migration must not have modified any existing milestone data
select count(*) from public.milestones;
```

Expected §10-A/B results, read together: `authenticated` has `UPDATE`
listed in `role_table_grants` (Postgres always shows a bare table-level
row when *any* column-level grant exists — this is normal, not a
regression) but `role_column_grants` shows only
`title, description, amount, due_date, updated_at` for that grantee.
`status`, `paid_at`, `paid_to`, `escrow_status` must **not** appear in
the column-grants list for `authenticated` at all.

## 11. Negative tests — re-run the real client-path tests, not SQL Editor proof

SQL Editor output alone is not sufficient evidence per this
engagement's standing rule (SQL Editor runs as a superuser role,
identical to the `service_role`/`postgres`-bypass problem this rule
exists to prevent). Re-run the exact same real HTTP tests already
executed once against the *unpatched* state in
[ESCROW_RLS_NEGATIVE_TEST_REPORT.md](ESCROW_RLS_NEGATIVE_TEST_REPORT.md)
tests 6–8, using the same test identity (`thriveinapp@gmail.com`) and
the same anon-key + real-JWT client path (never service_role):

```bash
# Test 6 (repeat): direct PATCH to milestones.status for a nonexistent id
curl -s -o /dev/null -w "%{http_code}\n" \
  -X PATCH "https://kwmcocsitwssrtzkdojh.supabase.co/rest/v1/milestones?id=eq.00000000-0000-0000-0000-000000000000" \
  -H "apikey: <anon key>" \
  -H "Authorization: Bearer $TEST_JWT" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d '{"status":"paid"}'
# Expected AFTER migration: 403 (was 204 before)

# Test 7 (repeat): direct PATCH to milestones.status, different value
curl -s -o /dev/null -w "%{http_code}\n" \
  -X PATCH "https://kwmcocsitwssrtzkdojh.supabase.co/rest/v1/milestones?id=eq.00000000-0000-0000-0000-000000000000" \
  -H "apikey: <anon key>" \
  -H "Authorization: Bearer $TEST_JWT" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d '{"status":"in_progress"}'
# Expected AFTER migration: 403 (was 204 before)

# Test 8 (repeat): direct PATCH to milestones.escrow_status
curl -s -o /dev/null -w "%{http_code}\n" \
  -X PATCH "https://kwmcocsitwssrtzkdojh.supabase.co/rest/v1/milestones?id=eq.00000000-0000-0000-0000-000000000000" \
  -H "apikey: <anon key>" \
  -H "Authorization: Bearer $TEST_JWT" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d '{"escrow_status":"authorized"}'
# Expected AFTER migration: 403 (was 204 before)

# New test 9: the non-sensitive columns should STILL be writable directly
# (confirms the narrow re-GRANT works, not just that everything is now blocked)
curl -s -o /dev/null -w "%{http_code}\n" \
  -X PATCH "https://kwmcocsitwssrtzkdojh.supabase.co/rest/v1/milestones?id=eq.00000000-0000-0000-0000-000000000000" \
  -H "apikey: <anon key>" \
  -H "Authorization: Bearer $TEST_JWT" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d '{"title":"test"}'
# Expected: 403 too, but for a DIFFERENT reason -- RLS row-visibility
# (this milestone id doesn't exist / isn't owned by this test user), not
# a privilege error. Distinguishing the two requires reading the response
# body's error code (PGRST116/no rows vs 42501/permission denied), not
# just the HTTP status -- capture the full response body, not just -w.

# New test 10: the RPC itself, called for a milestone this test user has
# no relationship to, should reject with not_authorized (not throw a raw
# Postgres error, and not silently succeed)
curl -s -X POST "https://kwmcocsitwssrtzkdojh.supabase.co/rest/v1/rpc/update_milestone_workflow_status" \
  -H "apikey: <anon key>" \
  -H "Authorization: Bearer $TEST_JWT" \
  -H "Content-Type: application/json" \
  -d '{"_milestone_id":"00000000-0000-0000-0000-000000000000","_status":"approved"}'
# Expected: 200 with body {"success":false,"error":"milestone_not_found"}
# (this id doesn't exist) -- run again against a real milestone id this
# test user is NOT a collaborator/owner on to see {"success":false,
# "error":"not_authorized"} instead once one is available.
```

Do not report this migration as applied/verified until tests 6–10
above have actually been run against the live post-migration database
and their real output recorded — not assumed from reading the SQL.

## Final status

`BLOCKED_MIGRATION_NOT_APPLIED`. This document stops here. The
migration has not been run. §§1–7 are inspection, §8 is preflight, §9
is the exact text to paste, §10–11 are what to run immediately after —
all pending manual execution by the user in the Lovable Cloud SQL
Editor.
