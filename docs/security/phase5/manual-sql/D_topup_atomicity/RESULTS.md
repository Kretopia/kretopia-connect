# Lot D -- results reported by the owner, 2026-11-01

Run in the SQL Editor of the Lovable project that reaches production, as `postgres`. Pasted into the conversation; the author did not run
anything and has no access to the database.

| Script | Reported result |
|---|---|
| `01_preflight.sql` | `topups` 6 (`pending_topups` 5); `completed_without_a_payment_id` 1 (a top-up completed by older code; the lot does not touch it); `topups_in_a_currency_other_than_usd` 0; `wallets_with_a_negative_balance` 0 |
| `02_apply.sql` | `result` = applied |
| `03_verify.sql` | **11 of 11 checks true**: `function_exists`, `security_definer`, `search_path_pinned`, `anon_cannot_execute`, `authenticated_cannot_execute`, `public_pseudo_role_cannot_execute`, `service_role_can_execute`, `one_payment_one_topup_index`, `no_payment_id_on_two_topups`, `status_constraint_validated`, `no_negative_balance`. `informational_pending_topups` = 5 |

## What this shows

* The function `complete_wallet_topup` exists, runs as its owner with a pinned `search_path`, and only the service role can execute it.
* One payment id can now complete at most one top-up (unique index, no duplicates found), and a top-up can only be pending, completed, failed or
  cancelled (constraint validated against the 6 stored rows).
* The table is small: 6 top-ups, none in another currency, no wallet below zero.

## What it does not show

* How the function behaves. It was never executed: the apply has no smoke test and nothing calls it. Parsing proved the syntax only.
* Behaviour under concurrency (`05_CONCURRENCY_TEST.md`).

## Status

Lot D: **applied and catalog-verified, and unwired.** The gap this lot is meant to close, a paid top-up never credited after a crash between the
claim and the credit, stays open until `wallet-topup-confirm` calls the function. The existing code already cannot credit twice (its claim is a
compare-and-set), so waiting does not expose a double credit; the cost is the rare crash case.
