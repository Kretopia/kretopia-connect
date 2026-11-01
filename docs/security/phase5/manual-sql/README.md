# Manual SQL pack -- security lockdown, phase 5

The session that wrote this folder had no database, and by rule no `psql`, `supabase db` or connector: every file below was written from the
repository's migrations and read by eye. That is why every apply script starts with assertions that stop the transaction on anything
unexpected, and why every lot has a read-only preflight you run first. Since then (2026-11-01):

* **Syntax.** The grammar of PostgreSQL 17 itself (libpg_query, through `pglast` 8.7) parsed all 22 `.sql` files, the PL/pgSQL bodies of
  every `DO` block and function included, plus `03b_verify_as_roles.sql`: 0 failures. The checker accepts the lot A files that Postgres
  accepted in production and rejects two deliberately broken files. This proves **syntax only**: it does not show that a table, column or
  role exists, nor what a statement does. Re-run it after any edit, from the repository root:
  `python3 -m venv v && v/bin/pip install pglast && v/bin/python docs/security/phase5/tools/parse_sql_pack.py $(find docs/security/phase5 -name '*.sql')`.
* **Lots A and C were run by the owner in production** and the results were reported (`A_durable_budgets/RESULTS.md`, `C_verification_badge/RESULTS.md`). Nothing else in this folder has been reported as run.

## Where, how

* Only in the SQL Editor of the Lovable project **kretopia-app** (the one that reaches production). Never in "Kretopia Connect": its database
  is a different one and the preflights refuse to go on there.
* One lot at a time, files in numeric order: `01_preflight` (read-only) -> `02_apply` (one transaction) -> `03_verify` (read-only) ->
  `04_rollback` (only if needed). Stop at the first error; an error in an apply script means nothing was changed.
* Paste each result back before the next step. The verify scripts say, in their first lines, **what they prove and what they do not**: the
  SQL Editor runs as `postgres` and bypasses RLS, so a catalog check never shows how a real anonymous or signed-in caller is treated. The
  REST calls at the end of each verify script are that proof.

## The lots, their status, and the order I would take

| Lot | Folder | What it does | Concurrency | Status |
|---|---|---|---|---|
| C | `C_verification_badge` | A member can no longer set their own verification, badge, subscription, XP, nor the phone code and number; narrows UPDATE and INSERT on `profiles`, never widens | no | **APPLIED by the owner 2026-11-01, catalog-verified (9 of 9).** REST calls and a click-through of the profile editor, onboarding, daily check-in and undo swipe still owed; five review candidates await a decision (`C_verification_badge/RESULTS.md`) |
| C2 | `C2_profile_entitlements` | Members can no longer write `project_credits`, `available_invites`, `invite_code_used`, `invited_by` on their own profile (column REVOKE, nothing else touched) | no | **READY_FOR_APPROVAL** after you read its preflight (syntax parsed, not executed) |
| E | `E_approvals` | A member can record an approval only for their own action; a decided action cannot be rewritten; one positive approval per action | yes | **WAITING_FOR_VALIDATION** (test in `05_CONCURRENCY_TEST.md`) |
| B | `B_privacy` | Waitlist: visitors insert 11 named columns only, nobody but an admin reads or changes entries. The other privacy tables: a discovery query and a decision matrix, no guessed policy | no | **READY_FOR_APPROVAL** for the waitlist; the other tables are **BLOCKED** on your decisions (`DECISIONS.md`) |
| A | `A_durable_budgets` | New: `budget_buckets`, `budget_reservations`, `reserve_budget` / `commit_budget` / `release_budget` (service role only, cannot overshoot) | yes | **APPLIED by the owner 2026-11-01, catalog-verified (16 of 16), unwired.** Concurrency: **WAITING_FOR_VALIDATION** (`05_CONCURRENCY_TEST.md`); optional `03b_verify_as_roles.sql` not run yet |
| D | `D_topup_atomicity` | New function `complete_wallet_topup` (claim and credit in one transaction), one-payment-one-top-up index, status constraint | yes | **WAITING_FOR_VALIDATION**; the matching code change is NOT done and waits for the test |

Recommended order: **C2**, then **E**, then **B (waitlist)**, then **D** (**A** and **C** are done). They are independent of each other: none needs another
to be applied first, and none needs an edge function to be deployed first or after. The only lot that ends in a code change is **D**.

Before C, look at lot 0 (`../lot0_sec01_sec02_verification.md`): it closes the verification of SEC-01 and SEC-02 and shares the habit of reading
the catalog first.

## Compatibility with what is deployed today, lot by lot

| Lot | Code that touches the objects | Effect on it | Risk to the business if wrong |
|---|---|---|---|
| C | the profile editor, onboarding, `send-phone-otp`, payment webhooks | the app writes none of the locked columns directly (a scan of `src/` on 2026-11-01 found 66 writes to `profiles`; the three that name a privileged column, `is_claimed` (profile auto-provision), `current_streak` (daily check-in) and `daily_swipes` (undo swipe), are why those three are NOT locked; the rest is not written by the app; `phone_number`, `phone_otp` and `phone_otp_expires_at` are written only by `send-phone-otp` with the service role) | a screen that PATCHes a locked column would start to answer 403. Click through the profile editor and onboarding once after applying |
| C2 | no browser code (66 writes to `profiles` scanned), the sign-up functions (they run as their owner) | members lose write access to four columns | a function that runs as the caller and UPDATEs one of them would start to fail: the preflight lists such functions |
| E | `agent-orchestrator`, `_shared/agentAuthority.ts`, `agent-send-dm`, `send-outreach-draft`, `reconcile_stale_orch_runs()` | all make only transitions the guard allows (enumerated in `E_approvals/02_apply.sql`) | a writer I could not see that makes another transition fails with SQLSTATE 23514 and a message naming the transition; `04_rollback.sql` removes the guard |
| B (waitlist) | `WaitlistForm` (insert only), `WaitlistAdmin` (admin reads and updates), `validate-waitlist-ai` (service role) | unchanged for all three | none expected; the repository had no admin UPDATE policy, so admin approval may only start working |
| A | nothing calls the new functions yet (`_shared/durableBudget.ts` is the client, unwired) | none | none until a function is wired to it |
| D | nothing calls the new function yet | none; the two constraints are in force | a top-up with a status outside the four allowed is refused: the preflight lists such rows first |

## What is deliberately not here

* The seven privacy alerts other than the waitlist: the list is the dashboard's, not the repository's (`B_privacy/DECISIONS.md`).
* A table of approvals: the approvals already live in `orch_actions` / `orch_approvals`; a second place would only be a second place to disagree.
  What the database adds is lot E.
* Anything that deletes data. The only DROPs are in the `04_rollback` files and in lot B's replacement of its own table's policies.
