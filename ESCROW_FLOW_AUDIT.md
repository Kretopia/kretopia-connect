# Escrow / Milestone Payment Flow Audit

**This is a code-reading audit only. Nothing in this document has been
locally tested, browser-tested, Stripe-sandbox-tested, webhook-verified,
database-verified, or production-verified — those layers are blocked by
`BLOCKED_STRIPE_TEST_CONFIGURATION` (no Stripe test-mode key or webhook
secrets exist; see `KREPAY_STRIPE_SANDBOX_REPORT.md`) and are covered
separately in `ESCROW_SANDBOX_TEST_REPORT.md`, which records that
blocker explicitly rather than guessing at what a live run would show.**

Every claim below is a direct citation to the actual current code, not
an assumption from function names, comments, or what the code "should"
do.

---

## Headline finding: the escrow flow is very likely broken end-to-end, for a specific, code-confirmed reason

Not "untested and therefore unknown" — there is direct evidence the
critical hand-off step is missing entirely:

1. `create-milestone-payment` creates a Stripe Checkout Session with
   `payment_intent_data.capture_method: 'manual'` for escrow
   (`index.ts:265-280`). After the payer completes Checkout, the
   underlying PaymentIntent moves to `requires_capture` — funds are
   authorized, not yet captured.
2. `stripe-marketplace-webhook`'s milestone branch **explicitly excludes
   escrow**: `if (kind === "milestone" && session.metadata?.useEscrow
   !== "true" && ...)` (`index.ts:175`). There is no other branch, no
   other handler, and no listener anywhere in this codebase for
   `payment_intent.amount_capturable_updated` — the event Stripe fires
   specifically to signal "a manual-capture PaymentIntent just became
   capturable." **Escrow milestones receive zero webhook handling.**
3. `ThriveDesk.tsx:95-98`'s own comment states the intended design
   plainly: *"The milestone itself updates via the realtime subscription
   in useProjectData once the webhook lands — this is just giving the
   user immediate, honest feedback instead of silently dropping them
   back on the page with an ignored ?payment= param."* The webhook this
   comment depends on does not fire for escrow, per (2).
4. `grep`-confirmed: no file anywhere in `supabase/functions/` or `src/`
   ever writes `escrow_status: 'authorized'` (or equivalent) to the
   `milestones` table. The only writers of `escrow_status` at all are
   `capture-milestone-payment` (`'captured'` or `'cancelled'`,
   `index.ts:79,86`) — reached only via an explicit, separate
   owner-initiated action, never by anything payment-completion-driven.
5. `MilestoneBoard.tsx` gates the Capture/Cancel UI itself on that same
   never-set value: `milestone.escrow_status === 'authorized'`
   (`:329,596,667`), and `FinanceHub.tsx:126` / `FinancialSummaryPanel.tsx:37`
   both filter "money in escrow" the same way.

**Net effect, read straight from the code**: a payer completes Stripe
Checkout, Stripe genuinely holds the authorized funds, the payer sees a
"Payment received — confirming with Stripe" toast — and then nothing
in the app ever reflects that the authorization happened. The
owner/creator has no button to capture or cancel it, because the
button's own visibility condition depends on a database value nothing
ever sets. The authorization sits until Stripe's own automatic
expiration window closes it (typically ~7 days for most card networks,
Stripe-side, not app-controlled), with no notification, no UI signal,
and no record in `milestones` beyond whatever `pending`/`in_progress`
status it already had before payment.

This is a confident, code-derived conclusion, not a guess — it rests on
the *absence* of a specific write path that three separate pieces of UI
logic depend on, confirmed by grep across the entire relevant
directories, plus a comment in the code itself describing the intended
(and, per this reading, unimplemented) design.

---

## Second finding, found while tracing the first: the normal (non-payment) milestone status workflow is currently broken too

Unrelated to escrow specifically, but found investigating how
`status`/`escrow_status` transitions are supposed to work at all.
`MilestoneBoard.tsx:130-134`, `handleStatusChange`:

```ts
const { error } = await supabase
  .from('milestones')
  .update({ status: newStatus })
  .eq('id', milestoneId);
```

This is the handler wired to the ordinary "mark in progress" / "submit
for review" / "mark completed" buttons (`:658` calls it with `'review'`,
and the label map at `:151-156` covers `in_progress`/`review`/`completed`/`paid`).
It performs a **direct client-side `UPDATE` on the `status` column**.

`supabase/migrations/20260812071205_...sql:427`:
```sql
REVOKE UPDATE (status, paid_at, paid_to, escrow_status) ON public.milestones FROM authenticated, anon;
```

`status` is explicitly included in that column-level `REVOKE` —
confirmed by reading the migration directly, not from memory. That
migration's intent (per its own commit, from earlier in this session's
work) was to close a payment-integrity hole (any collaborator could
self-attest `status='paid'`); the fix is column-level, which means it
also blocks the *legitimate*, non-payment status transitions this same
function is used for. This is the identical bug *class* as the
hire-loop notification break found earlier this session: a correct,
justified security fix that didn't audit every client-side caller of
the column it locked down.

**Confirmed by code alone, not yet by a live request** — `ESCROW_RLS_NEGATIVE_TEST_REPORT.md`
covers the client-path test this session did run for the payment-relevant
piece (`status='paid'` specifically). Whether `'review'`/`'in_progress'`/`'completed'`
genuinely also fail the same way — as this reading predicts — was
confirmed live; see that report.

---

## Third finding: a captured escrow release can trigger a real, synchronous Stripe transfer

`capture-milestone-payment/index.ts:160-195` — when a milestone's
creator has an active `talent_referrals` row with a manager who has a
Stripe Connect account, the `capture` action calls
`stripe.transfers.create()` **synchronously, inline, as part of
handling the capture request** — not gated behind any separate
confirmation, not webhook-driven, not queued. This is real money
movement triggered directly by an owner clicking "Release payment" in
the UI, with no separate step.

**Direct, immediate consequence for any future live testing of this
flow**: a test milestone must have **no manager referral** attached
(`talent_referrals` with `status='active'` for the milestone's
`created_by`), or a capture test would attempt a real Stripe transfer —
squarely inside what this and every prior task in this engagement have
forbidden. Flagged here specifically so it's impossible to miss when
someone eventually runs the blocked sandbox matrix in
`ESCROW_SANDBOX_TEST_REPORT.md`.

Also worth noting: the `cancel` action's code comment calls it
`// Cancel the authorized payment (refund)` (`:82`), but the actual call
is `stripe.paymentIntents.cancel()` (`:84`) — which only works on an
*uncaptured* authorization (releases the hold) and is not a refund of
already-captured funds. The comment is inaccurate; worth fixing
independent of anything else, low severity (doesn't affect behavior,
could mislead a future maintainer into thinking this function handles
post-capture refunds, which it does not and cannot — no
`stripe.refunds.create()` call exists anywhere in this codebase,
confirmed in `KREPAY_PAYMENT_AUDIT.md` finding #8 earlier this session).

---

## 12-step flow, mapped against the actual code

| Step | What the task asked to verify | What the code actually does | Verification level |
|---|---|---|---|
| 1. Owner creates milestone | — | `MilestoneBoard.tsx` creation form → direct client `INSERT` into `milestones` (not traced in depth this pass; `created_by` presumably set client-side, RLS-enforced — not re-verified here) | Code-reviewed (partial) |
| 2. Amount derived server-side | Must not trust client amount | **Confirmed correct.** `create-milestone-payment/index.ts:75-79,122-127`: amount is read from the milestone's own DB row (`milestone.amount`); a client-supplied `amount` is compared and logged if it mismatches, never used. | Code-reviewed |
| 3. Payer authorization checked | Must reject non-owners | **Confirmed correct**, and recently fixed per the code's own comment (`:89-96`): only `projects.client_user_id`/`created_by` may pay a milestone — this comment describes closing a real prior gap ("an unrelated user could pay someone else's milestone... locking out the real client"). | Code-reviewed |
| 4. PaymentIntent created | Once, not duplicated on retry | **Partial gap.** `stripe.checkout.sessions.create()` is called once per request (`:282`), but there is **no idempotency key** passed to Stripe, and no reservation-row pattern (unlike `thrivefund_milestone_releases`, the proven pattern elsewhere in this codebase). A double-click or client retry could create two Checkout Sessions / two PaymentIntents for the same milestone-pay attempt. The `milestone.status === 'paid'` check (`:114-120`) guards against re-paying an *already-captured* milestone, but not against two *simultaneous* first attempts racing before either completes. | Code-reviewed |
| 5. Payment method confirmed | — | Handled entirely by Stripe's hosted Checkout UI — not custom Payment Element code in this repo. Nothing to review here beyond confirming Checkout is genuinely used (`stripe.checkout.sessions.create`, confirmed). | Code-reviewed |
| 6. PaymentIntent reaches expected state | `requires_capture` for escrow | Structurally correct per Stripe's own semantics (`capture_method: 'manual'` produces `requires_capture` after confirmation) — **never independently confirmed against a real PaymentIntent object**, since no test payment has been run. | Code-reviewed only |
| 7. Funds held or captured | — | See headline finding — funds are held at Stripe, but nothing in the app ever *records* that they're held. | Code-reviewed — gap found |
| 8. Milestone status changes | On funding, and on capture | **Does not happen on funding** (headline finding). Does happen on capture: `status:'paid', escrow_status:'captured'` (`capture-milestone-payment/index.ts:104-113`), written synchronously by the edge function immediately after `stripe.paymentIntents.capture()` returns — not webhook-driven. See state-desync risk below. | Code-reviewed |
| 9. Webhook updates database | — | **Does not happen for escrow at all** (headline finding). For non-escrow "Pay Now" milestones, yes (`stripe-marketplace-webhook/index.ts:175-215`, not re-audited in depth this pass — out of scope, non-escrow). | Code-reviewed — gap found |
| 10. Creator and owner see correct state | — | Cannot be correct while step 8/9's gap stands — the UI has no signal to show between "payer completed Checkout" and "owner captures" because no DB field changes in between. | Code-reviewed — gap found |
| 11. Release/capture only with correct authorization | — | **Confirmed correct.** `escrowAuth.ts`'s `assertCanReleaseMilestone` — checks the PaymentIntent metadata's recorded payer first, falls back to the project's client/owner, rejects everyone else with a 403 before any Stripe call. `loadMilestoneForIntent` additionally requires the milestone row to actually match the given `payment_intent_id`, preventing a valid milestone ID from being paired with an unrelated PaymentIntent. | Code-reviewed; the authorization-rejection half is also client-path tested, see `ESCROW_RLS_NEGATIVE_TEST_REPORT.md` |
| 12. Cancellation/refund behaves correctly | — | Cancellation (of an uncaptured authorization) is implemented correctly per Stripe's actual capability (`paymentIntents.cancel`). **"Refund" is not implemented at all** — no `stripe.refunds.create()` exists anywhere in this codebase for any payment type, escrow included. The code comment calling `cancel` a "refund" is inaccurate terminology, not a functional bug, but worth fixing. | Code-reviewed |

---

## State-desync risk (found while tracing step 8)

`capture-milestone-payment` calls `stripe.paymentIntents.capture()`
(line 77) and, only if that call doesn't throw, proceeds to update the
`milestones` row (lines 104-113). If the Stripe call succeeds but the
subsequent Supabase update fails (network blip, transient DB error,
function timeout mid-execution) — Stripe's real state says "captured,"
Kretopia's database still says whatever it said before, and **nothing
reconciles this**, since the webhook (the natural reconciliation path)
doesn't process escrow events at all (headline finding). The same class
of risk applies to the manager-commission transfer at lines 160-195,
which is wrapped in its own try/catch that logs a warning and updates
`referral_commissions.status` back to `'earned'` on failure — a real,
present partial-reconciliation mechanism for *that specific piece*, but
nothing equivalent exists for the milestone row itself.

---

## Report classification key, applied honestly throughout this document

- **Code-reviewed**: read directly from the current source, cited by
  file and line.
- **Locally tested**: not applicable this session — no local Supabase
  instance was running (`supabase status` failed on a missing Docker
  daemon, confirmed earlier this session).
- **Browser-tested**: not done for escrow specifically this pass — see
  `ESCROW_SANDBOX_TEST_REPORT.md`.
- **Stripe sandbox-tested**: none of this — `BLOCKED_STRIPE_TEST_CONFIGURATION`,
  no test key exists.
- **Webhook-verified**: none — no test event has been generated or
  delivered for the escrow path.
- **Database-verified**: none via live query for escrow objects
  specifically (the RLS negative tests in the companion report did hit
  the real database, but only to confirm *rejection* of unauthorized
  writes, not to observe a real escrow object's lifecycle).
- **Production-verified**: none, and none should be attempted per this
  task's own safety rules.

## Status

Findings are code-reviewed with high confidence (each rests on a
concrete absence — grep across the relevant directories — not an
inference from a function's name or docstring). The escrow flow should
be assumed broken end-to-end for real transactions until the missing
webhook handling (or an equivalent reconciliation path) is added and
actually exercised against a real `requires_capture` PaymentIntent in
Stripe test mode — which remains blocked. See
`KREPAY_ESCROW_RELEASE_GATE.md` for the consolidated status.
