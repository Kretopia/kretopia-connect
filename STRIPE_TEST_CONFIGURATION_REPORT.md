# Stripe Test Configuration Report

Project: Kretopia · ref `kwmcocsitwssrtzkdojh` · 2026-08-24

## 1. What changed in code (IMPLEMENTED)

New module `supabase/functions/_shared/stripeEnv.ts`:

```
STRIPE_MODE = "test" | "live"        (defaults to "live" — backwards compatible)

test  -> STRIPE_SECRET_KEY_TEST                        (must be sk_test_/rk_test_)
live  -> STRIPE_SECRET_KEY_LIVE ?? STRIPE_SECRET_KEY   (must NOT be a test key)
```

Exports:
- `getStripeMode()` — validated mode.
- `resolveStripeSecretKey()` — fails closed; throws rather than falling back.
  A live key under `STRIPE_MODE=test` is refused, and a test key under
  `STRIPE_MODE=live` is refused. Only the key *prefix class* is inspected;
  no value is logged, returned, or embedded in an error message.
- `assertEventMatchesMode(livemode)` — rejects a live event delivered to a test
  deployment and a test event delivered to a live deployment.
- `stripeModeDiagnostics()` — presence booleans only, never values.

All **37** Stripe edge functions now call `resolveStripeSecretKey()` instead of
`Deno.env.get("STRIPE_SECRET_KEY")`. The only remaining reference to the raw
name is inside `stripeEnv.ts` itself, as the live-mode fallback.

The three webhook handlers additionally call `assertEventMatchesMode(event.livemode)`
immediately after signature verification and before any state change.

## 2. Behaviour today (no secrets changed)
`STRIPE_MODE` is unset → resolves to `live` → uses the existing
`STRIPE_SECRET_KEY`. Production behaviour is unchanged by this refactor.

## 3. Remaining manual steps to reach READY_FOR_STRIPE_SANDBOX
These require Stripe Dashboard access in test mode and cannot be done from here,
because the connected platform credential is live-mode only.

1. In Stripe **test mode**, create a secret key and save it as Cloud Secret
   `STRIPE_SECRET_KEY_TEST`.
2. Set Cloud Secret `STRIPE_MODE=test` on the environment used for sandbox runs
   (and leave it unset / `live` in production).
3. Optionally rename the live key to `STRIPE_SECRET_KEY_LIVE` for full symmetry;
   the fallback keeps `STRIPE_SECRET_KEY` working either way.
4. Register the three test-mode endpoints listed in
   `STRIPE_WEBHOOK_ENDPOINT_MATRIX.md` and store each endpoint's **own** signing
   secret under the matching name. Never reuse one signing secret across endpoints.

**Status: BLOCKED_STRIPE_TEST_CONFIGURATION.**
