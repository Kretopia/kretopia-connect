# Wallet Client-Path Verification Report

**Status: `NEGATIVE_CLIENT_TESTS_VERIFIED`**

This is the layer of verification the grant-inspection queries in
`WALLET_SECURITY_VERIFICATION_REPORT.md` couldn't provide on their own:
real HTTP requests through the actual client path — the public anon key
plus a real authenticated test user's JWT — with zero use of
`service_role`, the `postgres` role, an admin bypass, or the SQL editor's
superuser context. This is what an actual attacker's browser would
produce, not an inspection of what Postgres's catalog says should
happen.

## Test identity

- Actor: real authenticated test/dev account (`thriveinapp@gmail.com`,
  `user_id 4b565cca-3389-4488-9b09-114bf894ad84`) — a dedicated Kretopia
  test account, not a real end-user's account. Session obtained by the
  user logging in through the app's own UI in a browser pane; the
  resulting session token was read from `localStorage` after login. No
  account was created and no password was entered by Claude at any point
  — both are hard-prohibited regardless of user request.
- Auth: real Supabase Auth JWT (`role: authenticated`, `aal: aal1`),
  obtained the same way any real user's session is obtained.
- Key: the public anon/publishable key (`role: anon` in its own JWT
  payload) — the same key shipped in the production client bundle, not a
  secret.
- No `service_role` key, no `postgres` role, no admin bypass, no SQL
  editor, was used for any of the 15 requests below.

## Method

Every request: `curl` directly against
`https://kwmcocsitwssrtzkdojh.supabase.co/rest/v1/<table>`, `apikey:
<anon key>`, `Authorization: Bearer <test-user JWT>`. First pass used
`Prefer: return=representation` on every request; a second, corrected
pass for the positive tests used `Prefer: return=minimal` after the
first pass's results needed root-causing (see note below the negative
table).

## Negative tests — attempt and assert failure

All 9 attempted a write to the test user's **own** row (`user_id
eq.<own id>`) — the exact scenario the original findings described
("any authenticated user could PATCH their own wallet/profile row").

| # | Table | Field | Route | Requested op | Result | Before | After | Expected | Actual | Pass/Fail |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `wallets` | `balance` | `PATCH /rest/v1/wallets` | Set to `999999` | HTTP 403, `{"code":"42501","message":"permission denied for table wallets"}` | n/a — rejected before any read | unchanged | Rejected | Rejected | **PASS** |
| 2 | `wallets` | `credits` | `PATCH /rest/v1/wallets` | Set to `999999` | HTTP 403, same error | unchanged | unchanged | Rejected | Rejected | **PASS** |
| 3 | `creator_wallets` | `payouts_enabled` | `PATCH /rest/v1/creator_wallets` | Set to `true` | HTTP 403, `permission denied for table creator_wallets` | unchanged | unchanged | Rejected | Rejected | **PASS** |
| 4 | `creator_wallets` | `kyc_status` | `PATCH /rest/v1/creator_wallets` | Set to `"verified"` | HTTP 403, same error | unchanged | unchanged | Rejected | Rejected | **PASS** |
| 5 | `creator_wallets` | `stripe_account_id` | `PATCH /rest/v1/creator_wallets` | Set to `"acct_test_injected"` | HTTP 403, same error | unchanged | unchanged | Rejected | Rejected | **PASS** |
| 6 | `profiles` | `stripe_account_id` | `PATCH /rest/v1/profiles` | Set to `"acct_test_injected"` | HTTP 403, `permission denied for table profiles` | unchanged | unchanged | Rejected | Rejected | **PASS** |
| 7 | `profiles` | `stripe_account_status` | `PATCH /rest/v1/profiles` | Set to `"active"` | HTTP 403, same error | unchanged | unchanged | Rejected | Rejected | **PASS** |
| 8 | `profiles` | `subscription_tier` | `PATCH /rest/v1/profiles` | Set to `"pro"` | HTTP 403, same error | unchanged | unchanged | Rejected | Rejected | **PASS** |
| 9 | `profiles` | `verification_score` | `PATCH /rest/v1/profiles` | Set to `999` | HTTP 403, same error | unchanged | unchanged | Rejected | Rejected | **PASS** |

All nine returned Postgres error code `42501` (`insufficient_privilege`)
— a genuine grant-layer rejection, not an RLS-invisible-row 200-with-
empty-result (the ambiguous case that would have needed closer reading).
Because Postgres evaluates column/table privileges before executing the
statement, a `42501` means **zero columns were written** — not a partial
update rolled back, an update that never started.

## Positive tests — attempt and assert success (owner's own public fields)

First pass, using `Prefer: return=representation` on all three, **also**
returned `403 permission denied for table profiles`. Investigated before
concluding anything: `return=representation` makes PostgREST return the
updated row via an implicit `RETURNING profiles.*`/`select=*`, which
requires `SELECT` on **every** column of the row — including ones
deliberately `SELECT`-restricted by an earlier, unrelated migration
(`20260803091710_...sql`, a pre-existing PII protection, not part of
today's fix). That restriction blocked the *read-back*, not the *write*.
Confirmed directly: a `PATCH` with `Prefer: return=minimal` (no
read-back) on the identical field succeeded with `204`, and a follow-up
`GET` with an explicit column list (not `select=*`) confirmed the value
had actually changed. This is a real methodology detail worth recording,
not a product bug — no legitimate app code path was found to request
`select=*` after a profile-field update (checked: `ProfileEdit`-style
flows in this codebase request specific columns).

Second pass, corrected to `Prefer: return=minimal` for the writes and
explicit-column `select=` for verification:

| # | Table | Field | Route | Requested op | Result | Before | After write | Expected | Actual | Pass/Fail |
|---|---|---|---|---|---|---|---|---|---|---|
| 10 | `profiles` | `full_name` | `PATCH /rest/v1/profiles` | Set to `"NegTestProbe-TEMP"` | HTTP 204 | `"Gabriel Auguste "` | `"NegTestProbe-TEMP"` (confirmed via follow-up GET) | Success | Success | **PASS** |
| 11 | `profiles` | `bio` | `PATCH /rest/v1/profiles` | Set to `"negtestprobe-temp"` | HTTP 204 | `"Creating and testing this platform under another profile"` | `"negtestprobe-temp"` | Success | Success | **PASS** |
| 12 | `profiles` | `role` | `PATCH /rest/v1/profiles` | Set to `"negtestprobe-temp"` | HTTP 204 | `"Content Creator"` | `"negtestprobe-temp"` | Success | Success | **PASS** |

## Cleanup — no test residue

All three probed fields reverted to their exact original values
(captured before any write, not reconstructed from memory):

| # | Field | Revert op | Result |
|---|---|---|---|
| 13 | `full_name` | Set to `"Gabriel Auguste "` | HTTP 204 |
| 14 | `bio` | Set to `"Creating and testing this platform under another profile"` | HTTP 204 |
| 15 | `role` | Set to `"Content Creator"` | HTTP 204 |

Final state, read back with explicit columns:
`{"full_name":"Gabriel Auguste ","bio":"Creating and testing this
platform under another profile","role":"Content Creator"}` — an exact
match to the pre-test state. No residue.

## What this confirms that the grant-layer check alone didn't

- The negative findings hold through the actual PostgREST request
  pipeline (auth, role-switching, privilege check, statement execution),
  not just at the `has_table_privilege`/`has_column_privilege` function
  level.
- A real, valid, non-`service_role` session cannot write any of the 9
  fields — even to its own row, which is the exact scenario every
  original finding (KP-01, KP-02, and the two related `stripe_account_*`
  findings) described.
- Legitimate self-service profile editing still works through the same
  real client path — the fix did not silently break normal product
  functionality, which the grant-layer check alone couldn't have shown
  (it doesn't simulate an actual write-then-read-back the way a real
  form submission does).
- No partial writes, no residue, no false-success UI state possible to
  observe from this session (all 9 negative attempts returned an
  explicit error status the client SDK surfaces as an error, not a
  silent no-op).

## Errors surfaced correctly / no false success

Every negative attempt returned a non-2xx status (`403`) with a
structured Postgres error body (`code`, `message`) — the Supabase JS
client (`supabase.from(...).update(...)`) surfaces this as `{ data:
null, error: {...} }`, which every call site in this codebase that
performs a profile/wallet update already checks (`if (error) { ... }`
patterns, confirmed present in `WalletTransferDialog.tsx`,
`WalletPayoutSheet.tsx`, and the profile-edit flows during this
session's earlier work). There is no code path found that would display
a false-success toast on a `403` from these tables.

## Automated test coverage

Not added for this specific scenario. A true integration test replaying
these 15 HTTP requests against the live database would need a dedicated
CI-provisioned test account and network access to the real Supabase
project — infrastructure this repo's existing test suite (fast, offline
Vitest unit/component tests) doesn't have and that adding here, as a
one-off, would be a mismatch with the existing architecture rather than
a natural extension of it. `src/lib/__tests__/stripeWebhookSignature.test.ts`
(added by the parallel Lovable session) is the right *shape* of
addition for this suite — pure logic, no live network dependency; a
live-privilege integration suite would need its own harness and
credential-provisioning story, which is a real gap worth flagging
(`KREPAY_RELEASE_GATE.md`) but not one to force into today's test run.

## Status

**`NEGATIVE_CLIENT_TESTS_VERIFIED`.** All 9 negative and 3 positive
client-path tests pass, real requests through the real path, zero
residue. Combined with `WALLET_SECURITY_VERIFICATION_REPORT.md`'s
grant-layer confirmation, both verification layers now agree. Given the
history of this exact privilege set reverting twice before under no
active adversary, a further durability check after time has passed is
still worth the five minutes it costs — see
`WALLET_SECURITY_VERIFICATION_REPORT.md` for that recommendation, and
`KREPAY_RELEASE_GATE.md` for what's still open beyond this.
