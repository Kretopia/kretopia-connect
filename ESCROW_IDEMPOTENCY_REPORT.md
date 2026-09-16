# Escrow Idempotency Report

**Status: static code review only — no live duplicate-request test was run (`BLOCKED_STRIPE_TEST_CONFIGURATION`).**

Idempotency here means two things, checked separately: (1) does
creating a Checkout Session / PaymentIntent twice for the same
milestone produce two charges, and (2) does the same Stripe webhook
event, delivered twice (Stripe's own at-least-once guarantee), get
processed twice.

## 1. Checkout Session / PaymentIntent creation — no idempotency key

Reviewed `create-milestone-payment/index.ts` and
`capture-milestone-payment/index.ts` (both in `ESCROW_FLOW_AUDIT.md`'s
citation set). Neither passes an
[`Idempotency-Key`](https://stripe.com/docs/api/idempotent_requests) to
the Stripe SDK call that creates the Checkout Session or the
PaymentIntent capture. Stripe's SDK does not synthesize one on its own
— it must be supplied explicitly per call.

Concretely: if a payer double-clicks "Pay" (network lag, page re-render,
retried fetch), or the client retries after a timeout without knowing
whether the first request landed, two Checkout Sessions get created for
the same milestone, each capable of independently authorizing funds.
There is no request-fingerprint dedup, no unique constraint at the DB
level tying one milestone to at most one active Checkout Session, and
no application-level guard rejecting a second attempt while a first is
in flight.

This is not unique to escrow — the same absence applies to the
non-escrow milestone payment path — but it's specifically relevant here
because escrow's manual-capture model means an "authorized" duplicate
sits live (holding a customer's funds) for up to 7 days before Stripe
auto-cancels an uncaptured PaymentIntent, rather than failing fast.

## 2. Webhook delivery — no dedup, but also not reachable for escrow

`ESCROW_WEBHOOK_VERIFICATION_REPORT.md` already establishes that no
webhook handler processes escrow events at all right now, so "does the
handler double-process a duplicate delivery" is moot for escrow
specifically — there's no first processing to duplicate.

For the general (non-escrow) `stripe-marketplace-webhook` handler that
does exist: reviewed for a processed-event-ID ledger (the standard
pattern — record `event.id` before acting, skip if already seen). None
found. The handler relies on Stripe's own idempotent-object-state
reasoning in places (e.g., checking the milestone's current `status`
before transitioning it) rather than an explicit event-ID dedup table.
That's a weaker but not absent safeguard for the non-escrow path — a
second delivery of the same "milestone paid" event would find the
milestone already `status='paid'` and most likely no-op on the second
pass, depending on the exact guard clause. This report does not certify
that behavior since it's outside escrow's scope and wasn't tested live;
it's noted only because escrow's own future handler (once built) should
carry the same or a stronger version of this protection, not skip it.

## 3. Capture path — real financial side effect confirmed non-idempotent

`ESCROW_FLOW_AUDIT.md` finding 3: `capture-milestone-payment/index.ts`
lines ~160-195 call `stripe.transfers.create()` directly for manager
commissions during capture, with no idempotency key on that call either.
A retried capture request — whether from a client retry, a duplicate
webhook (once escrow has one), or an operator re-running the action —
would create a second real transfer. This is the single highest-severity
idempotency gap found, because unlike Checkout Session creation
(recoverable — just an extra hold), a duplicate transfer moves real
money out and is not something the escrow-status state machine, as
currently implemented (per `ESCROW_STATE_MACHINE.md`), has any
reconciliation step to catch after the fact.

## Summary table

| Operation | Idempotency key used? | Duplicate-safe? | Verified live? |
|---|---|---|---|
| Checkout Session creation (`create-milestone-payment`) | No | No | No — blocked |
| PaymentIntent capture (`capture-milestone-payment`) | No | No | No — blocked |
| Manager commission transfer (inside capture) | No | **No — real financial duplication risk** | No — blocked |
| Webhook event processing (non-escrow) | No explicit event-ID ledger; partial protection via status-guard | Partial, untested | No — blocked |
| Webhook event processing (escrow) | N/A — no handler exists | N/A | No — blocked |

## Recommendation (not implemented — audit scope only)

Any future work that builds the missing escrow webhook handler should
add, at minimum: a Stripe `Idempotency-Key` on the transfer and capture
calls (derived deterministically from the milestone ID + a fixed
purpose string, not a random UUID, so retries of the *same logical
operation* collapse to one Stripe-side result), and a processed-event-ID
table for the webhook itself. Neither exists today; this report does
not add them, per the task's own audit/verify framing.
