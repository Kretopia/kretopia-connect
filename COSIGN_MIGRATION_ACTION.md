# Co-Sign Migration — Lovable Cloud SQL Action

**P0. Prepared for manual review and execution by the user. Not applied by Claude — no DB-write path exists for Claude in this environment (confirmed repeatedly across this engagement: the Supabase CLI on this machine is authenticated to 13 unrelated projects, not this one; Supabase MCP is unauthenticated).**

**Status as of 2026-08-21, re-checked live: APPLIED AND CONFIRMED WORKING.** Applied by the user via the Lovable Cloud SQL editor (not by Claude — no DB-write path exists for Claude in this environment, unchanged). Re-ran the exact same live guest-confirm functional test against the exact same pending test endorsement (`credit_endorsements.id = 7d2e1458-ebfc-4ed5-9c74-78fdfc24438b`, token `d5c80fd4-...`) that previously failed with the `23514` constraint violation — it now **succeeds**: `{"status":"accepted","success":true,"endorsement_count":1}`, no error. Verified end to end, not just the RPC's own response:
- `credits.verification_status` for the target credit (`d851ee81-...`, "Le Mythe") is now `'peer'`, `updated_at` freshly timestamped to the moment of the test.
- `credit_endorsements.status` for the request is now `'accepted'`, `responded_at` populated.
- Aggregate distribution: `peer` count moved from 0 → 1, `pending_review` dropped by exactly 1 (263, was 264) — the credit's real state transition, not a coincidental unrelated change.

All three real-world checks (constraint-effect via a live write, the credit row, the endorsement row) agree. See §Post-migration checks below for the full record.

## What this fixes

Every real (non-self) Co-Sign endorsement accept has been hard-failing since 2026-05-03. `submit_credit_endorsement_by_token()` writes `verification_status = 'peer'` on a credit's first accepted endorsement — the intentional, already-shipped intermediate state (a credit needs 2 accepted endorsements to reach `'verified'`; `src/lib/creativeRecord.ts`, `StatusProgressCard.tsx`, `statusEngine.ts`, `ProductionPage.tsx`, and `CreatorEPK.tsx` all already read/render `'peer'`). But `credits_verification_status_check` (last touched 2026-04-18) never allowed `'peer'` as a value, so that `UPDATE` has always violated the check constraint and rolled back the whole RPC call.

**Reproduced live** this engagement via a real guest confirm on a real credit (`TRELLO_RELEASE_INVENTORY.md` card 2.2) and again via a direct RPC call to `submit_credit_endorsement_by_token` — both returned `HTTP 400, code: "23514", message: 'new row for relation "credits" violates check constraint "credits_verification_status_check"'`. The decline path is unaffected (it never touches `credits.verification_status`).

## Preflight checks — run these first, before the migration

All read-only. Run in the Lovable Cloud SQL editor and record the output before proceeding.

### 1. Confirm the current constraint does not yet allow `'peer'`

```sql
SELECT pg_get_constraintdef(oid) AS current_constraint
FROM pg_constraint
WHERE conname = 'credits_verification_status_check';
```

Expected output (this is the bug): a `CHECK` clause listing `unverified, verified, pending, pending_review, rejected, auto_discovered, disputed` — **without** `peer`. If `peer` is already present, the migration was already applied — stop and skip to Post-migration checks below to verify state instead.

### 2. Baseline `verification_status` distribution

```sql
SELECT verification_status, count(*) 
FROM public.credits 
GROUP BY verification_status 
ORDER BY count(*) DESC;
```

Live-queried via the app's own anon-scoped client during this pass (2026-08-21, may have shifted slightly by the time you run this): **406 total credits** — `pending_review` 264, `verified` 80, `unverified` 41, `auto_discovered` 14, `pending` 7, `rejected` 0, `disputed` 0, **`peer` 0**. That last number is the direct fingerprint of this bug: the endorsement-accept flow has been live and used, yet zero credits have ever successfully reached the `'peer'` state — every attempt has been silently rolled back by the constraint violation. Re-run this query yourself immediately before applying the migration to get the exact current numbers.

### 3. Confirm no other write path already depends on the current (narrower) constraint

```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_definition ILIKE '%credits_verification_status_check%';
```

Expected: no rows (Postgres check constraints aren't referenced by name from function bodies in normal usage — this just confirms nothing unusual is coded against the constraint's specific current shape).

## The migration

Exact contents of `supabase/migrations/20260819140000_fix_credits_peer_status_constraint.sql`, already written and committed to this branch, not yet applied to production:

```sql
ALTER TABLE public.credits DROP CONSTRAINT IF EXISTS credits_verification_status_check;
ALTER TABLE public.credits ADD CONSTRAINT credits_verification_status_check
  CHECK (verification_status IS NULL OR verification_status IN (
    'unverified', 'verified', 'pending', 'pending_review', 'rejected', 'auto_discovered', 'disputed', 'peer'
  ));
```

This only **widens** the allowed value set (adds `'peer'` and explicitly allows `NULL`, which was implicitly allowed before since a plain `CHECK (col IN (...))` already permits `NULL` under standard SQL three-valued logic — the explicit `IS NULL OR` makes that intent visible rather than changing behavior). It does not touch any existing row, does not add a `NOT NULL` constraint, does not narrow anything. Every row that currently satisfies the old constraint still satisfies the new one.

## Post-migration checks

### 1. Confirm the constraint now allows `'peer'`

```sql
SELECT pg_get_constraintdef(oid) AS updated_constraint
FROM pg_constraint
WHERE conname = 'credits_verification_status_check';
```

Expected: the `IN (...)` list now includes `'peer'`. **Not independently re-run via SQL editor by Claude** (no DB-write/read path outside the app's own REST API) — but confirmed indirectly and conclusively via check §3 below, which could only succeed if this is true.

### 2. Confirm no existing row was affected

```sql
SELECT verification_status, count(*) 
FROM public.credits 
GROUP BY verification_status 
ORDER BY count(*) DESC;
```

**CONFIRMED 2026-08-21**, via the app's own REST API (equivalent read): counts before the functional test in §3 matched the preflight baseline exactly except for unrelated background activity (`auto_discovered` grew from 14→22 between checks — a separate auto-discovery job, not this migration; `peer` was still 0 immediately before the functional test). No existing row's status was altered by the migration itself.

### 3. Live functional confirmation — DONE, 2026-08-21

Accepted the real pending test endorsement (`token d5c80fd4-...`) via the exact same guest, no-account code path a real user would use (`submit_credit_endorsement_by_token`, called with the app's own client while unauthenticated). Result: `{"status":"accepted","success":true,"endorsement_count":1}` — previously this exact call returned `HTTP 400 / 23514`. Re-queried immediately after:
- The credit's `verification_status`: `'peer'` (was `'pending_review'`... via `pending_review` count 264→263).
- The endorsement's `status`: `'accepted'`, `responded_at` populated.
- Aggregate `peer` count: 0 → 1.

**Fix confirmed working end-to-end, not just at the constraint level.**

## Rollback considerations

Reverting is the mirror operation:

```sql
ALTER TABLE public.credits DROP CONSTRAINT IF EXISTS credits_verification_status_check;
ALTER TABLE public.credits ADD CONSTRAINT credits_verification_status_check
  CHECK (verification_status IS NULL OR verification_status IN (
    'unverified', 'verified', 'pending', 'pending_review', 'rejected', 'auto_discovered', 'disputed'
  ));
```

**This is not automatically safe once the fix has been live for any length of time.** If even one credit has legitimately reached `'peer'` status after this migration is applied (which is the whole point of applying it), rolling back the constraint will immediately make that row **invalid against the reverted constraint** — the row itself won't be touched by the `ALTER TABLE ADD CONSTRAINT` (Postgres validates existing rows against a new constraint by default and will actually **refuse to apply the rollback** if any row currently violates it, erroring out rather than silently accepting bad data). So in practice: if any real endorsement has been accepted since the fix went live, a naive rollback will fail outright at the `ADD CONSTRAINT` step — a safety net, not a hazard, but worth knowing before attempting it. If a rollback is genuinely needed after real `'peer'` rows exist, those rows would need to be explicitly handled first (e.g., reverted to `'pending_review'`), which is a product/data decision, not a mechanical one — flag this to the user rather than deciding it unilaterally.

## Blast radius / risk assessment

- **Scope**: one table (`public.credits`), one constraint, additive-only change.
- **No data migration, no backfill, no trigger changes, no RLS changes.**
- **No application code changes required** — the frontend and the `submit_credit_endorsement_by_token()` RPC already write `'peer'` and already handle it in every place that reads `verification_status`; they've simply never been able to successfully do so until this constraint is fixed.
- **Reversible in the common case** (no `'peer'` rows yet exist) via the rollback SQL above; **not cleanly reversible** once real `'peer'` rows exist, as explained above.
- **No payment, email, or auth surface touched.**
