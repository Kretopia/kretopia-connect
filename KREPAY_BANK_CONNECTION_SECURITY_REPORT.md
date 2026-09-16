# KrePay Bank Connection — Fix Report

Scope: contained fix, per your explicit decision — validate/reject a country
mismatch against an existing Connect account, fix the account-creation
misconfiguration found live, map errors to actionable codes, add
idempotency, branch `account_holder_type`. **The legacy
`create-connect-account` flow and its existing accounts are untouched**, as
agreed.

## What was actually broken (revised from the Phase 1 audit)

The Phase 1 audit's static-analysis root cause (Root Cause B: reusing a
pre-existing, country-less legacy Connect account) is real and still fixed
here — but live testing against the *currently deployed* function surfaced a
more fundamental, universal bug the audit couldn't see from code alone:

```
POST /functions/v1/wallet-add-bank  →  500
{"error":"When `stripe_dashboard[type]=none` and `requirement_collection=stripe`,
Stripe must be liable for negative balances or refunds and chargebacks."}
```

`wallet-add-bank/index.ts`'s `stripe.accounts.create()` call set
`controller.losses.payments: "application"` — telling Stripe the *platform*
bears liability for refunds/negative balances — while also declaring
`stripe_dashboard: { type: "none" }` (headless, no hosted onboarding) and
`requirement_collection: "stripe"` (Stripe collects KYC, not the platform).
Stripe only allows that specific dashboard/requirement combination when
Stripe itself bears the liability (`losses.payments: "stripe"`) — this
account type is Stripe's "recipient" model, correct for a transfers-only,
payout-only account that never processes charges. **This broke Connect
account creation for every brand-new user, in every country** — reproduced
live via a direct call to the deployed function with a fresh test account
that had no pre-existing wallet at all, ruling out the country-mismatch
theory as the sole cause for that specific test.

## What changed

`supabase/functions/wallet-add-bank/index.ts`:
1. **Fixed the account-creation misconfiguration** — `losses.payments` →
   `"stripe"`, matching the account type this flow actually needs.
2. **Country-mismatch guard** — before attaching a bank account to an
   *existing* Connect account, retrieves it and compares `account.country`
   to the submitted country; returns `connect_account_mismatch` (409) with
   an actionable message instead of letting Stripe's rejection fall through
   as a generic 500. (This remains a real, separate risk for any user who
   touched the legacy Connect flow before this fix shipped.)
3. **Server-side IBAN normalization + validation** — strips whitespace,
   validates the country prefix, expected length per country, and the
   ISO 7064 mod-97 checksum, authoritative server-side regardless of what
   the frontend sends. Does not claim payout-readiness — Stripe's own
   validation still runs after.
4. **Supported country/currency allow-list enforced server-side**, not just
   in the frontend's `<Select>`.
5. **Idempotency keys** on both `stripe.accounts.create` and
   `createExternalAccount`, matching the existing pattern in
   `wallet-payout/index.ts`.
6. **`account_holder_type` now branches on `profiles.account_type`**
   (`individual`/`company`) instead of being hardcoded to `"individual"`.
7. **Full error-code vocabulary** (`errorResponse`/`mapStripeError`) — every
   failure path returns one of the spec's required codes with a safe,
   actionable message; Stripe's raw error text is logged server-side only,
   never returned to the client.

`src/components/wallet/WalletAddBankSheet.tsx`:
1. Reads the Edge Function's real error body (`error.context.json()`)
   instead of showing Supabase-JS's generic "non-2xx" wrapper message —
   this alone fixes the exact string in the original bug report,
   independent of the backend fix above.
2. Maps each error code to the reviewed copy in `ERROR_COPY`, never
   surfacing raw Stripe/DB internals.
3. Success toast now distinguishes "still needs verification" (when Stripe
   returns `requirements_due`) from a clean "you can now get paid."
4. Typed the response shape (`AddBankResponse`) instead of `as any` casts —
   net lint-neutral versus the pre-existing file.

## Verified

- **Live, against the actual deployed function** (no deployment performed by
  me): reproduced the exact "non-2xx" bug end-to-end in the browser with a
  real France/IBAN submission, then confirmed via a direct authenticated
  API call that the underlying error is the Stripe configuration issue
  above — this is real production behavior, not a simulation.
- Confirmed via direct REST read that the failed attempts left no orphaned
  `creator_wallets.stripe_account_id` or `creator_payout_methods` row —
  the failure is clean, no partial state was created.
- `npm run typecheck` — clean. `npm run test` — 99/99 passing.
  `npx eslint` on both changed files — clean (net lint-neutral, replaced
  the file's pre-existing `any` casts rather than adding new ones).
- Edge Function syntax/brace-balance checked (no local Deno runtime
  available to run `deno check`, same limitation as every other Edge
  Function change in this project).

## Not verified — requires deployment (your manual step, per standing rule)

I do not deploy Edge Functions. The account-creation fix (`losses.payments:
"stripe"`) directly targets the exact live error reproduced above, but
confirming it actually resolves account creation requires deploying this
function and re-running the same French-IBAN submission. Once deployed, the
fastest re-check is repeating exactly what I did: open KrePay → Add your
bank → France → a test IBAN, and confirm it now succeeds (or, for a
still-mismatched legacy account, returns the new `connect_account_mismatch`
message instead of a generic 500).

## Explicitly not touched, per your decision

- `supabase/functions/create-connect-account/index.ts` and its existing,
  country-less Express accounts — untouched.
- No reconciliation between the legacy and new Connect account systems —
  flagged separately as a follow-up task, not attempted here.
