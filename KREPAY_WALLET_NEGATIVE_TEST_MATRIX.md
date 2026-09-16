# KrePay Wallet Negative Test Matrix

**Update 2026-08-24: the "owner" persona rows below (A1, A2, A4, B1-B3,
plus 4 `profiles` columns not previously in this matrix —
`stripe_account_status`, `subscription_tier`, `verification_score`, and
the already-listed `stripe_account_id` covered under a different
section) are now executed, not hypothetical** — real HTTP requests
through the anon key + a real authenticated test-user JWT, against the
fix as it actually landed (table-level `REVOKE` across 6 tables +
`profiles` column allow-list, via the merge described in
`PRIVILEGE_DRIFT_INVESTIGATION.md`, not the original narrower migration
this file was first written against). Full request/response detail:
`WALLET_CLIENT_PATH_VERIFICATION_REPORT.md`. Every executed row passed.
**B4 (`charges_enabled`) and B5 (`requirements`) were not tested** —
still hypothetical, matching the grant-layer check's confirmation but
not a real-request one.

**Not executed**: the ordinary-user (non-owner), creator, payer, admin,
and anonymous persona rows below — those need additional test identities
this session doesn't have (a second test account, and one with an admin
role). They remain the original hypothetical matrix, still worth running
if a second test identity becomes available; nothing about the owner-row
results implies these would also pass — a broken cross-user check is a
different bug class from a broken owner-self check, and both were real
historical bugs in this exact codebase (see `HIRE_LOOP_AUDIT.md` for an
example of the former).

## Personas

| Persona | Definition for these tests |
|---|---|
| Ordinary authenticated user | Any signed-up account with no relationship to the target wallet/row |
| Owner | `auth.uid()` equals the target row's `user_id` — the wallet is their own |
| Creator | A user with a `creator_wallets` row (earns/receives payouts) — distinct row from "owner" tests where relevant |
| Payer | A user who has paid the target user via a completed milestone/invoice — has a real financial relationship but no write authority over the recipient's wallet |
| Admin | `has_role(auth.uid(), 'admin')` is true |
| Anonymous | No `Authorization` header, or the `anon` key with no session |

---

## A. Direct REST access to `public.wallets`

| # | Persona | Request | Before fix | Expected after fix |
|---|---|---|---|---|
| A1 | Ordinary user | `PATCH /rest/v1/wallets?user_id=eq.<own-id>` body `{"balance": 999999}` | 200, balance forged | **EXECUTED, PASS** — real HTTP 403 `42501 permission denied for table wallets`, see `WALLET_CLIENT_PATH_VERIFICATION_REPORT.md` test #1 |
| A2 | Owner (same as A1 — "owner" *is* the attacker for this table) | Same as A1 | 200 | **EXECUTED, PASS** — same request, same result, tested as the owner (this is what A1 actually tested) |
| A3 | Ordinary user | `PATCH /rest/v1/wallets?user_id=eq.<someone-else's-id>` body `{"balance": 999999}` | Already denied — RLS `USING (auth.uid()=user_id)` blocks cross-user rows regardless of this fix | Still denied (unchanged, not part of this fix) |
| A4 | Ordinary user | `PATCH /rest/v1/wallets?user_id=eq.<own-id>` body `{"credits": 999999}` | 200, credits forged | **EXECUTED, PASS** — real HTTP 403, test #2 |
| A5 | Admin | `PATCH /rest/v1/wallets?user_id=eq.<own-id>` body `{"balance": 999999}` | 200 | **403/empty result** — no admin-specific RLS bypass exists on this table; admin has no special standing here and shouldn't |
| A6 | Anonymous | Same as A1, no auth header | Already denied (`USING (auth.uid()=user_id)` evaluates false with no session) | Still denied (unchanged) |
| A7 | Owner | `PATCH /rest/v1/wallets?user_id=eq.<own-id>` body `{"updated_at": "2020-01-01"}` | 200 | **Still 200** — `updated_at` was intentionally left writable; not a security-sensitive column. Confirm this is still true post-fix (it should be — only `balance`/`credits` were revoked) |

## B. Direct REST access to `public.creator_wallets`

| # | Persona | Request | Before fix | Expected after fix |
|---|---|---|---|---|
| B1 | Creator (owner of the row) | `PATCH /rest/v1/creator_wallets?user_id=eq.<own-id>` body `{"payouts_enabled": true}` | 200, gate bypassed | **EXECUTED, PASS** — real HTTP 403, test #3 |
| B2 | Creator | Same, body `{"kyc_status": "verified"}` | 200 | **EXECUTED, PASS** — real HTTP 403, test #4 |
| B3 | Creator | Same, body `{"stripe_account_id": "acct_fake123"}` | 200 | **EXECUTED, PASS** — real HTTP 403, test #5 |
| B4 | Creator | Same, body `{"charges_enabled": true}` | 200 | **403/empty result** |
| B5 | Creator | Same, body `{"requirements": {}}` | 200 | **403/empty result** |
| B6 | Creator | Same, body `{"country": "US"}` | 200 | **Still 200 — intentional.** Confirm this legitimate self-service field remains writable |
| B7 | Creator | Same, body `{"default_currency": "USD"}` | 200 | **Still 200 — intentional** |
| B8 | Ordinary user (no `creator_wallets` row yet) | `PATCH /rest/v1/creator_wallets?user_id=eq.<own-id>` body `{"payouts_enabled": true}` | Already denied — no existing row to match `USING`, and `INSERT` policy requires `auth.uid()=user_id` but doesn't let INSERT set arbitrary values either (should be checked, out of scope of this fix but worth a glance) | Same as B1 |
| B9 | Payer | `PATCH /rest/v1/creator_wallets?user_id=eq.<creator-they-paid>` body `{"payouts_enabled": true}` | Already denied — cross-user, blocked by `USING` | Still denied (unchanged) |
| B10 | Admin | `PATCH /rest/v1/creator_wallets?user_id=eq.<own-id>` body `{"payouts_enabled": true}` | 200 | **403/empty result** — same as A5, no admin RLS bypass exists |
| B11 | Anonymous | Same as B1, no auth | Already denied | Still denied |

## C. `wallet_debit`/`wallet_credit` RPC — direct invocation attempt

These were already `service_role`-only **before today's migration**
(`20260804103153_...sql`) — this migration doesn't touch them, but they
are load-bearing for why A1-A4 being blocked is sufficient (the only
legitimate write path left standing must itself be unreachable by a
client). Confirm this hasn't regressed.

| # | Persona | Request | Expected |
|---|---|---|---|
| C1 | Ordinary user | `POST /rest/v1/rpc/wallet_debit` body `{"p_user_id": "<own-id>", "p_amount": 1}` with own JWT | **403** — `EXECUTE` not granted to `authenticated` |
| C2 | Ordinary user | `POST /rest/v1/rpc/wallet_credit` body `{"p_user_id": "<own-id>", "p_amount": 1}` | **403** |
| C3 | Admin | Same as C1/C2 | **403** — admin role has no special EXECUTE grant on these either |
| C4 | Anonymous | Same as C1, no auth | **403/401** |

## D. `wallet-payout` edge function — post-fix gate behavior

Requires the migration applied so `payouts_enabled` can no longer be
self-forged; these tests confirm the *edge function's* gate now actually
holds given a real (unforgeable) `creator_wallets` state.

| # | Persona | Scenario | Expected |
|---|---|---|---|
| D1 | Creator, `payouts_enabled=false` (real, unforged state) | Calls `wallet-payout` normally through the app | **400** — `"Wallet not ready. Add a bank account first."` |
| D2 | Creator, no `stripe_account_id` at all | Calls `wallet-payout` | **400** — same message |
| D3 | Creator, legitimately `payouts_enabled=true` (set only by `stripe-wallet-webhook` on a real `account.updated` event) | Calls `wallet-payout` with a valid amount | Proceeds to call Stripe — **do not actually run this against a live/production Stripe account under this task's rules**; if a test-mode account is ever available, this is the one legitimate-path test to run there |
| D4 | Ordinary user with no `creator_wallets` row | Calls `wallet-payout` | **400** — `wallet` is null, same gate message |

## E. `wallet-transfer` edge function — idempotency (KP-05, MEDIUM, not one of the two CRITICAL findings)

| # | Persona | Scenario | Expected |
|---|---|---|---|
| E1 | Ordinary user | Calls `wallet-transfer` twice with the **same** `idempotencyKey`, second call before the first's response returns (simulated race) | **Second call returns `{success:true, alreadyProcessed:true}`** — no second debit/credit; `wallet_transfers` has exactly one row for that key (unique index enforces this even under a true race) |
| E2 | Ordinary user | Calls `wallet-transfer` twice with **different** `idempotencyKey` values, same recipient/amount | Two separate real transfers — correct, this is two distinct user actions, not a retry |
| E3 | Ordinary user | Calls `wallet-transfer` with an `idempotencyKey` that collides with another user's transfer (attacker guesses/reuses a UUID they observed) | Should still fail closed — the unique index is global on `idempotency_key`, so a collision returns the **other person's** transfer's `alreadyProcessed:true` response with **no new debit** rather than executing the attacker's transfer under someone else's key. Confirm this doesn't leak the other transfer's `amount`/details beyond what's already returned today (recheck the response shape — currently returns `amount` only, not sender/recipient identity, which is correct) |

## F. Sanity — legitimate flows still work post-fix

Not adversarial, but critical to run: the whole point of a column-level
`REVOKE` is that it's surgical. Confirm none of these regress.

| # | Scenario | Expected |
|---|---|---|
| F1 | Real Stripe checkout completes for a wallet top-up → `wallet-topup-confirm` runs | `wallets.balance` increases correctly (writes via `wallet_credit`, `service_role`, unaffected by the REVOKE) |
| F2 | User completes real Stripe Connect onboarding → `stripe-wallet-webhook` receives `account.updated` | `creator_wallets.payouts_enabled`/`kyc_status`/`charges_enabled`/`requirements` update correctly (writes via `service_role` admin client, unaffected) |
| F3 | User legitimately sends a wallet transfer with a real, sufficient balance | Succeeds exactly as before |
| F4 | User edits their own `creator_wallets.country` in Settings | Still succeeds — this column was deliberately left writable |
| F5 | Admin confirms a manual bank transfer via `admin_confirm_bank_transfer` | Still succeeds — writes via `SECURITY DEFINER`, unaffected by the REVOKE |
