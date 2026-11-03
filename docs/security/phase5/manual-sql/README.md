# Manual SQL pack -- security lockdown, phase 5

The session that wrote this folder had no database, and by rule no `psql`, `supabase db` or connector: every file below was written from the
repository's migrations and read by eye. That is why every apply script starts with assertions that stop the transaction on anything
unexpected, and why every lot has a read-only preflight you run first. Since then (2026-11-01):

* **Syntax.** The grammar of PostgreSQL 17 itself (libpg_query, through `pglast` 8.7) parsed all 22 `.sql` files, the PL/pgSQL bodies of
  every `DO` block and function included, plus `03b_verify_as_roles.sql`: 0 failures. (Lots A-E only: F-I were added on 2026-11-03 and were
  not part of that run.) The checker accepts the lot A files that Postgres
  accepted in production and rejects two deliberately broken files. This proves **syntax only**: it does not show that a table, column or
  role exists, nor what a statement does. Re-run it after any edit, from the repository root:
  `python3 -m venv v && v/bin/pip install pglast && v/bin/python docs/security/phase5/tools/parse_sql_pack.py $(find docs/security/phase5 -name '*.sql')`.
* **Lots A, C, C2, D and E were run by the owner in production** and the results were reported (`A_durable_budgets/RESULTS.md`, `C_verification_badge/RESULTS.md`, `C2_profile_entitlements/RESULTS.md`, `E_approvals/RESULTS.md`, `D_topup_atomicity/RESULTS.md`). Nothing else among lots A-E has been reported as run, and lots F-I (below) carry no run report of their own.

## Where, how

* Only in the SQL Editor of the Lovable project **kretopia-app** (the one that reaches production). Never in "Kretopia Connect": its database
  is a different one and the preflights refuse to go on there. kretopia-app is an editor project, not a GitHub repository: the repository
  `Kretopia/kretopia-app` is archived and read-only and plays no part in running these scripts.
* One lot at a time, files in numeric order: `01_preflight` (read-only) -> `02_apply` (one transaction) -> `03_verify` (read-only) ->
  `04_rollback` (only if needed). Stop at the first error; an error in an apply script means nothing was changed.
* Paste each result back before the next step. The verify scripts say, in their first lines, **what they prove and what they do not**: the
  SQL Editor runs as `postgres` and bypasses RLS, so a catalog check never shows how a real anonymous or signed-in caller is treated. The
  REST calls at the end of each verify script are that proof.

## The lots, their status, and the order I would take

| Lot | Folder | What it does | Concurrency | Status |
|---|---|---|---|---|
| C | `C_verification_badge` | A member can no longer set their own verification, badge, subscription, XP, nor the phone code and number; narrows UPDATE and INSERT on `profiles`, never widens | no | **APPLIED by the owner 2026-11-01, catalog-verified (9 of 9).** REST calls and a click-through of the profile editor, onboarding, daily check-in and undo swipe still owed; five review candidates await a decision (`C_verification_badge/RESULTS.md`) |
| C2 | `C2_profile_entitlements` | Members can no longer write `project_credits`, `available_invites`, `invite_code_used`, `invited_by` on their own profile (column REVOKE, nothing else touched) | no | **APPLIED by the owner 2026-11-01, catalog-verified (6 of 6)**; its preflight found no function writing these columns |
| E | `E_approvals` | A member can record an approval only for their own action; a decided action cannot be rewritten; one positive approval per action | yes | **APPLIED by the owner 2026-11-01** (02 reported applied; the 03 result was not seen). Concurrency: **WAITING_FOR_VALIDATION** (`05_CONCURRENCY_TEST.md`) |
| B | `B_privacy` | Waitlist: visitors insert 11 named columns only, nobody but an admin reads or changes entries. The other privacy tables: a discovery query and a decision matrix, no guessed policy | no | **READY_FOR_APPROVAL** for the waitlist; the other tables are **BLOCKED** on your decisions (`DECISIONS.md`) |
| A | `A_durable_budgets` | New: `budget_buckets`, `budget_reservations`, `reserve_budget` / `commit_budget` / `release_budget` (service role only, cannot overshoot) | yes | **APPLIED by the owner 2026-11-01, catalog-verified (16 of 16), unwired.** Concurrency: **WAITING_FOR_VALIDATION** (`05_CONCURRENCY_TEST.md`); optional `03b_verify_as_roles.sql` not run yet |
| D | `D_topup_atomicity` | New function `complete_wallet_topup` (claim and credit in one transaction), one-payment-one-top-up index, status constraint | yes | **APPLIED by the owner 2026-11-01, catalog-verified (11 of 11), unwired.** The code change is NOT done and waits for the owner (and the concurrency test, `05_CONCURRENCY_TEST.md`) |

Remaining: **B (waitlist)**. **A**, **C**, **C2** and **D** are applied and verified in the catalog; **E** is applied, its verify result is owed. They are independent of each other: none needs another
to be applied first, and none needs an edge function to be deployed first or after. The only lot that ends in a code change is **D**.

Before C, look at lot 0 (`../lot0_sec01_sec02_verification.md`): it closes the verification of SEC-01 and SEC-02 and shares the habit of reading
the catalog first.

## Lots F-I: eighteen scripts moved here from the root `security/` folder (2026-11-03)

These are the paste scripts of the October work (atomic AI quota, credit trust guard, external discovery, scouted claims). They had been
kept **untracked** in `security/` on purpose, and an automated "open a PR" run pushed all 18 of them straight to `main` (commit `e649182dc`,
taken back by PR 299). They now live in one folder per lot, so that a production script has one home. What did **not** change:

* **The bytes.** Each file is identical to the pushed one (`git show e649182dc:security/<name>`), and `MOVED_FROM_SECURITY.sha256` proves it:
  `cd docs/security/phase5/manual-sql && shasum -a 256 -c MOVED_FROM_SECURITY.sha256` must print 18 `OK` lines before you paste anything.
  Do not edit a script to "fix a path": the comments and `RAISE` messages inside still say `security/<name>` or just `<name>`. The name is
  the same, only the folder changed. If a script really must change, change it, regenerate the manifest, and say why in the commit.
* **The rules above.** Only in the SQL Editor of the Lovable project **kretopia-app**; one script at a time; paste the result back before the
  next step; stop at the first error. These lots keep their original file names (they cite each other by name) instead of the
  `01_preflight` ... `04_rollback` numbering of lots A-E; each apply script carries its own preflight and smoke test in one transaction.
* **The tracked verify scripts stay put.** `security/verify-atomic-ai-quota-2026-10-28.sql` and `security/verify-credit-trust-guard-2026-10-28.sql`
  were tracked before the incident and are cited by `KREPAY_LIVE_RELEASE_GATE.md`; they are the read-only checks for lots F and G.

**Nothing below says a script was run.** Whether, when, and in full or in part, each one was applied to production is not recorded in git
for most of them. Where the repository does record something, the cell quotes it; everywhere else the status is **unknown**: read the SQL
Editor history of kretopia-app or ask the owner before assuming either way. None of them was run from the session that moved them.

| Lot | Folder | Files (apply / rollback / other) | What it does | Order | What the repository records |
|---|---|---|---|---|---|
| F | `F_atomic_ai_quota` | `apply-atomic-ai-quota-2026-10-28.sql`, `rollback-atomic-ai-quota-2026-10-28.sql` | replaces the three AI counters (`consume_copilot_message`, `consume_studio_ai_generation`, `consume_ai_feature_call`) with atomic ones | after the preflight inside the script; verify with `security/verify-atomic-ai-quota-2026-10-28.sql` | **unknown.** `KREPAY_LIVE_RELEASE_GATE.md` lists it as waiting for approval when that gate was written |
| G | `G_credit_trust_guard` | `apply-credit-trust-guard-2026-10-28.sql`, `rollback-credit-trust-guard-2026-10-28.sql` | `guard_credit_verification_escalation`: an unauthorized caller can no longer insert a credit already marked `peer` | after the preflight inside the script; verify with `security/verify-credit-trust-guard-2026-10-28.sql` | **unknown.** Same gate document, same state |
| H | `H_external_discovery` | `apply-external-discovery-2026-10-29.sql`, `rollback-external-discovery-2026-10-29.sql`, `apply-discovery-on-2026-10-29.sql`, `rollback-discovery-on-2026-10-29.sql`, `apply-open-feeds-2026-10-29.sql`, `rollback-open-feeds-2026-10-29.sql`, `apply-open-himalayas-2026-10-29.sql`, `rollback-open-himalayas-2026-10-29.sql`, `close-weworkremotely-arbeitnow-2026-10-29.sql`, `verify-swipes-opportunity-2026-10-29.sql` | the external-discovery tables, view and functions (fresh install only); the kill switch on with Jobicy as the one free source; three more free feeds; Himalayas; an optional close of two sources; a read-only check of `swipes.target_type` | `apply-external-discovery` -> `apply-discovery-on` -> `apply-open-feeds` (refuses otherwise) -> `apply-open-himalayas` (refuses otherwise, and only once the frontend carrying its credit is published); `close-weworkremotely-arbeitnow` is optional | `docs/release/EXTERNAL_DISCOVERY.md`: "Opening the other three feeds (applied 2026-10-29)"; Himalayas "prepared 2026-10-29, not applied" (a later state is not recorded there); the optional close "rehearsed 9/9". The first two scripts: **unknown** from git |
| I | `I_scouted_claims` | `apply-scouted-claim-requests-2026-10-29.sql`, `rollback-scouted-claim-requests-2026-10-29.sql`, `apply-scouted-claim-close-token-ownership-2026-10-29.sql`, `rollback-scouted-claim-close-token-ownership-2026-10-29.sql` | a request table and three functions for claims, then the replacement of the two old token-claim functions so that holding a link no longer makes anyone the owner | (1) requests script, (2) publish the frontend, (3) close-token-ownership script: publishing first makes `/claim-gig` and `/claim-event` answer "Request failed" | **unknown.** `EXTERNAL_DISCOVERY.md` says the second migration is "APPLY ONLY AFTER the frontend is published" |

The repository is public, and the incident put these files in its history: they contain no credential (a pattern scan of all 18 on
2026-11-03 found none), but they do name tables, functions and the production project reference. Moving them does not change that.

## Compatibility with what is deployed today, lot by lot

| Lot | Code that touches the objects | Effect on it | Risk to the business if wrong |
|---|---|---|---|
| C | the profile editor, onboarding, `send-phone-otp`, payment webhooks | the app writes none of the locked columns directly (a scan of `src/` on 2026-11-01 found 66 writes to `profiles`; the three that name a privileged column, `is_claimed` (profile auto-provision), `current_streak` (daily check-in) and `daily_swipes` (undo swipe), are why those three are NOT locked; the rest is not written by the app; `phone_number`, `phone_otp` and `phone_otp_expires_at` are written only by `send-phone-otp` with the service role) | a screen that PATCHes a locked column would start to answer 403. Click through the profile editor and onboarding once after applying |
| C2 | no browser code (66 writes to `profiles` scanned), the sign-up functions (they run as their owner) | members lose write access to four columns | a function that runs as the caller and UPDATEs one of them would start to fail: the preflight lists such functions |
| E | `agent-orchestrator`, `_shared/agentAuthority.ts`, `agent-send-dm`, `send-outreach-draft`, `telegram-webhook` (it rejects only proposed actions), `reconcile_stale_orch_runs()` | all make only transitions the guard allows (enumerated in `E_approvals/02_apply.sql`) | a writer I could not see that makes another transition fails with SQLSTATE 23514 and a message naming the transition; `04_rollback.sql` removes the guard |
| B (waitlist) | `WaitlistForm` (insert only), `WaitlistAdmin` (admin reads and updates), `validate-waitlist-ai` (service role) | unchanged for all three | none expected; the repository had no admin UPDATE policy, so admin approval may only start working |
| A | nothing calls the new functions yet (`_shared/durableBudget.ts` is the client, unwired) | none | none until a function is wired to it |
| D | nothing calls the new function yet | none; the two constraints are in force | a top-up with a status outside the four allowed is refused: the preflight lists such rows first |

## What is deliberately not here

* The seven privacy alerts other than the waitlist: the list is the dashboard's, not the repository's (`B_privacy/DECISIONS.md`).
* A table of approvals: the approvals already live in `orch_actions` / `orch_approvals`; a second place would only be a second place to disagree.
  What the database adds is lot E.
* Anything that deletes data. The only DROPs are in the `04_rollback` files and in lot B's replacement of its own table's policies.

## Vetting log: code writers checked against each lot before it was handed over

A statement in this README that the code is compatible is only worth what was checked. Static scans of `src/` and `supabase/functions` (and
the repository's migrations), with what each found:

| Lot | Date | Result |
|---|---|---|
| C | 2026-11-01 | **The first claim was wrong.** 66 browser writes to `profiles`; three name a column the lot locked (`is_claimed`, `current_streak`, `daily_swipes`). They were taken out of the locked list before the lot ran. Edge functions that write locked columns use the service role |
| C2 | 2026-11-01 | No browser or edge write to the four columns; the preflight found no database function writing them; the seven denied columns lot C does not name are written by no code |
| E | 2026-11-01 | 11 UPDATEs of `orch_actions` in edge functions, all along transitions the guard allows (Telegram rejects only after reading `proposed`); approvals inserted only by the orchestrator with the service role; the preflight found no database function updating `orch_actions` |
| B (waitlist) | 2026-11-01 | `WaitlistForm` inserts exactly the 11 granted columns, with `status` `review`, and does not read the row back; `WaitlistAdmin` (select, update) is covered by the admin policy; `validate-waitlist-ai` uses the service role |
| D | 2026-11-01 | `wallet-topup` inserts `pending`, `wallet-topup-confirm` writes `completed` and, if the credit fails, restores the previous status and clears `gateway_payment_id`; the SQL function in the migrations writes `failed`: all inside the status constraint and compatible with the unique payment index. Nothing calls `complete_wallet_topup` yet |

A scan reads the repository, not production: functions pasted by hand are invisible to it, which is why the C2 and E preflights list them.

