# Stripe Access Blocker

Project: Kretopia · ref `kwmcocsitwssrtzkdojh` · 2026-08-23
**STATUS: BLOCKED_STRIPE_DASHBOARD_ACCESS**

## What is blocked and why
The Stripe account owner is recovering credentials, so the Stripe Dashboard cannot be
reached. Nothing that touches Stripe was attempted or simulated in this pass.

Explicitly NOT done (and not attempted):
- No PaymentIntent, Checkout Session, transfer, payout or refund was created.
- No Stripe key was generated, guessed, inferred or printed.
- The existing `STRIPE_SECRET_KEY` was **not** used for any call — its mode was previously
  recorded as **live**, so it is unusable for testing under the safety gate.
- No payment email was sent.
- No live payment configuration was modified.
- No claim is made that the sandbox is verified, that webhooks are verified in Stripe,
  that payments are operational, or that live payments are enabled.

## What was done instead (safe preparation only)
1. Full static audit of every Stripe secret reference in the repository.
2. Per-function Cloud Secret name inventory (names only, no values).
3. Frontend / logs / Git history / build output exposure check.
4. Payment state-machine, amount-derivation and authorization review.
5. Idempotency and event-deduplication review.
6. Offline automated webhook signature + dedupe test suite (9 cases, all passing).
7. Runbooks and gates written.

## Required human action from the Stripe account owner
The following can only be performed by a human with Stripe Dashboard access.
Do all of it in **test mode** first.

1. Recover Dashboard access and confirm which Stripe account the platform should use
   (previous session recorded connected account `acct_1GweNPJvOS7zG18h`, "ThriveIN",
   a live standard account — confirm whether this is still the intended account).
2. Toggle the Dashboard to **Test mode** and create/copy the test secret key.
3. Register the three **test-mode** webhook endpoints listed in
   `KREPAY_STRIPE_DASHBOARD_RUNBOOK.md`.
4. Copy each endpoint's **own** signing secret.
5. Save the four values into Lovable Cloud secrets under the exact names in
   `KREPAY_STRIPE_SECRET_INVENTORY.md` — never paste them into chat, code or a file.
6. Tell the team when the secrets are saved. Only then can the sandbox matrix run.

Nothing further proceeds until step 6 is confirmed.
