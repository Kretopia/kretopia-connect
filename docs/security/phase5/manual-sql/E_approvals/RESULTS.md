# Lot E -- results reported by the owner, 2026-11-01

Run in the SQL Editor of the Lovable project that reaches production, as `postgres`. Pasted into the conversation; the author did not run
anything and has no access to the database.

| Script | Reported result |
|---|---|
| `01_preflight.sql` | `action_status_counts`: auto_executed 43, failed 29, rejected 10, executed 4, **no proposed and no approved action**. `approvals_for_a_missing_or_foreign_action`: **0**. Policies on `orch_approvals`: INSERT `Users insert own orch approvals` (`auth.uid() = user_id`) and SELECT `Users view own orch approvals`. Triggers on `orch_actions`: `trg_advance_money_proof_chain` (AFTER UPDATE OF status, `advance_money_proof_chain()`) and `trg_set_orch_action_persona` (BEFORE INSERT). **`functions_that_update_orch_actions`: no row** |
| `02_apply.sql` | `result` = applied |
| `03_verify.sql` | **not seen.** The paste held the page text and the script but no result row. Run it again and copy the single row it returns |

## What this shows

* Nothing was waiting for an approval, so applying the guard could not stop a running proposal.
* No approval had ever been written for another member's action: E2 closes a hole that had not been used.
* No function of the database UPDATEs `orch_actions` with the pattern the preflight looks for, so no hand-pasted writer is hit by the guard. The
  repository's `reconcile_stale_orch_runs()` is also absent from that list, which suggests migration 20260914090000 is not applied in production
  (check with `SELECT to_regprocedure('public.reconcile_stale_orch_runs()') IS NOT NULL`).
* The existing `trg_advance_money_proof_chain` runs AFTER the guard. A transition the guard refuses aborts the update before the chain advances.

## What it does not show

That the guard and the unique index are in place as designed (03_verify), how they behave under concurrency (`05_CONCURRENCY_TEST.md`, on an
isolated database), and how PostgREST answers a real member (the REST call at the end of `03_verify.sql`).

## Status

Lot E: **applied; verification not seen; concurrency WAITING_FOR_VALIDATION.**
