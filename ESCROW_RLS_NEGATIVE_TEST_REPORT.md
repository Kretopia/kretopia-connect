# Escrow RLS / Authorization Negative Test Report

Real HTTP requests through the actual client path — anon/publishable
key + a real authenticated test-user JWT (`thriveinapp@gmail.com`,
`4b565cca-3389-4488-9b09-114bf894ad84`), zero `service_role`/`postgres`/
admin bypass/SQL editor. Same methodology as
`WALLET_CLIENT_PATH_VERIFICATION_REPORT.md` earlier this session.

**This test account has zero milestones visible to it** (confirmed by
test #0 below) — it has no project involvement. Every test below
therefore targets either a syntactically-valid-but-nonexistent
milestone/PaymentIntent ID, or (tests 6-8) a direct table-level
privilege probe. This proves the *authorization/permission-layer*
behavior correctly, but does **not** prove RLS's *row-level* behavior
against a real milestone belonging to a different real user — that
would need a second test identity with an actual project, which this
session doesn't have. Flagged explicitly, not glossed over.

## Headline finding: a new, real, currently-open privilege gap

**Tests 6-8 found that `milestones.status` and `.escrow_status` are
currently client-writable via a direct REST `PATCH`**, despite
`20260812071205_...sql:427` explicitly revoking `UPDATE` on those
columns from `authenticated`/`anon`. A genuine column-level permission
denial (`42501`) fires unconditionally on any `UPDATE` statement
referencing a revoked column, regardless of whether the `WHERE` clause
matches zero or a million rows — that's how Postgres checks column
privileges, before row-matching is evaluated. Getting `204 Success`
instead of `403` on a target row that doesn't even exist is the same
signal already investigated and root-caused earlier this session for
`wallets`/`creator_wallets`: **a table-level `GRANT UPDATE` (almost
certainly Supabase's project-level default privilege, since no explicit
`GRANT` for `milestones` exists anywhere in tracked migrations — grep
confirmed) that a later column-level `REVOKE` can never override.**

This means the exact vulnerability that migration was written to close
— any project collaborator self-attesting `status='paid'` on a
milestone — is very likely still open today, on `milestones`
specifically, via the identical mechanism already fixed for
`wallets`/`creator_wallets`/`profiles` in this session's earlier work.
**This was not previously known** — the earlier privilege-drift
investigation was scoped to the payment/wallet tables the original two
CRITICAL findings named; `milestones` was never checked the same way
until this test.

**Not yet confirmed against a real row** — see the scope note above.
The next step to close this with certainty is either (a) the same
`has_table_privilege('authenticated','public.milestones','UPDATE')`
query used for the wallet tables, or (b) this exact test repeated
against a real milestone ID this test account genuinely doesn't own.
Given the mechanism is identical to an already-proven case, high
confidence is warranted without further live confirmation, but it is
recorded as **not independently re-verified via `has_table_privilege`**,
consistent with this session's own standard for not overclaiming.

## Results

| # | Target | Route | Method | Payload | Result | Expected | Actual | Pass/Fail |
|---|---|---|---|---|---|---|---|---|
| 0 | `milestones` (own visibility) | `GET /rest/v1/milestones` | GET | `select=...` | `[]` — zero rows | n/a (scoping check) | Confirmed no real milestone accessible to this account | n/a |
| 1 | `capture-milestone-payment` | Edge Function | POST | valid-shaped body, **no Authorization header** | `HTTP 500`, `{"error":"Cannot read properties of null (reading 'replace')"}` | `401 Unauthorized` | **Rejected, but with a leaky 500 instead of a clean 401** — see finding below | **FAIL (error handling), PASS (no state change)** |
| 2 | `capture-milestone-payment` | Edge Function | POST | authenticated, nonexistent `milestoneId`+`paymentIntentId` | `404`, `{"error":"Milestone not found for this payment"}` | 404, no state change | Matches exactly | **PASS** |
| 3 | `capture-milestone-payment` | Edge Function | POST | authenticated, `action:"release_all_funds"` (invalid) | `HTTP 500`, `{"error":"Invalid action. Must be 'capture' or 'cancel'"}` | `400 Bad Request` | Correct message, **wrong status code** (falls through to the generic 500 default since a plain `Error` isn't an `EscrowAuthError`) | **FAIL (status code), PASS (rejected, no state change)** |
| 4 | `create-milestone-payment` | Edge Function | POST | valid-shaped body, **no Authorization header** | `HTTP 500`, identical `null.replace` error | `401 Unauthorized` | Same leaky-500 bug as #1 | **FAIL (error handling), PASS (no state change)** |
| 5 | `create-milestone-payment` | Edge Function | POST | authenticated, nonexistent `milestoneId`, client-supplied `amount:999999` | `404`, `{"error":"Milestone not found."}` | 404, no Stripe object created, no state change | Matches — and confirms the client-supplied amount was never even reached/used, since the milestone lookup fails first | **PASS** |
| 6 | `public.milestones` | `PATCH /rest/v1/milestones` | PATCH | `{"status":"paid"}` on nonexistent id | `HTTP 204` | `403 42501 permission denied` (per the existing, intended column-level REVOKE) | **204 — REVOKE does not appear to be in effect** | **FAIL — see headline finding** |
| 7 | `public.milestones` | `PATCH /rest/v1/milestones` | PATCH | `{"status":"in_progress"}` on nonexistent id | `HTTP 204` | Same as #6 (this column has no value-specific carve-out in the REVOKE — it blocks the column outright) | Same as #6 | **FAIL — see headline finding** |
| 8 | `public.milestones` | `PATCH /rest/v1/milestones` | PATCH | `{"escrow_status":"authorized"}` on nonexistent id | `HTTP 204` | Same as #6 | Same as #6 | **FAIL — see headline finding** |

## Secondary finding: leaky error handling on missing auth (tests 1, 4)

Both `capture-milestone-payment` and `create-milestone-payment` do:

```ts
const authHeader = req.headers.get("Authorization")!;
const token = authHeader.replace("Bearer ", "");
```

The `!` is a compile-time-only assertion — at runtime,
`req.headers.get("Authorization")` genuinely returns `null` when the
header is absent, and calling `.replace()` on `null` throws, producing
an unhandled `TypeError` that the outer `catch` reports as `HTTP 500`
with the raw JS error message (`"Cannot read properties of null
(reading 'replace')"`). This **does not create a security bypass** —
the request is still rejected, no financial state changes — but it is
not a "safe error response" (leaks an internal implementation detail,
returns the wrong status class for what's actually an auth failure) and
would show as a generic server error in monitoring rather than a clean,
attributable 401. Low severity, real, worth a one-line fix
(`if (!authHeader) return 401` before the `.replace()` call) independent
of anything else in this report.

## What this report does not cover

- No test against a real milestone belonging to a different real user
  (no second test identity with project data available this session).
- No test of `batch-milestone-payout`'s authorization path.
- No test of the manager-commission transfer path (deliberately —
  triggering it would risk a real Stripe transfer, see
  `ESCROW_FLOW_AUDIT.md` finding 3).
- No live Stripe object was created or referenced by any request here —
  every `paymentIntentId` used was a syntactically-plausible but
  entirely fake placeholder (`pi_fake_test_00000000`), never sent to
  Stripe by these functions since the milestone lookup fails first in
  every case tested.

## Status

Authorization-rejection behavior for the two Edge Functions is
**mostly confirmed correct** (2 of 2 meaningful auth/data-integrity
checks passed; 2 additional findings are error-handling quality, not
security bypasses). The direct-table-write behavior (tests 6-8)
**failed** and surfaced a real, likely-currently-exploitable gap on
`milestones` that was not previously known or tracked by this
engagement's earlier wallet-focused security work. See
`KREPAY_ESCROW_RELEASE_GATE.md` for how this changes the overall gate.
