# Proposal: option A, a pledge is pending until Stripe authorises it

**Status: PROPOSAL. It needs a migration, so nothing is written, deployed or applied.** The owner approved options B, A and C in chat on 2026-10-15; B is #184 and C is its own PR; A changes a database constraint and a default, which this program does not do without a reviewed migration. This document contains no runnable SQL on purpose.

## 1. Why B and C are not enough
With B (the finalizer verifies at Stripe) wrongful capture is prevented. With C an account cannot hold many pledges, nor a huge one, nor back its own campaign. What stays wrong until A:
- `campaigns.total_raised`, `backer_count` and `pledge_tiers.claimed_count` of an **active** campaign count rows nobody has paid, so the page shows progress and sold-out tiers that are not real.
- the "pledge confirmed" email is sent when the Checkout session is created.
- a pledge abandoned at Stripe stays `authorized` until the deadline.

## 2. The change
1. **A new state.** `pledges.capture_status` has a CHECK constraint (`authorized`, `captured`, `released`, `refunded`, `failed`, `cancelled`) and the default `authorized`. A new value, `pending`, is added to the constraint; the **default becomes `pending`**; `thrivefund-create-pledge` inserts `pending`.
2. **Nothing counts pending.** `refresh_campaign_totals` and `refresh_tier_claimed` already count only `authorized`, `captured` and `released`, so they need no change: a pending row moves no total and takes no tier slot. (A tier slot is therefore not held while the backer is on the Stripe page; the finalizer's verification still decides who is charged. If holding the slot matters, it is a product decision.)
3. **A signed webhook moves it.** A new Edge Function, `stripe-thrivefund-webhook`, verifies the Stripe signature and a bounded timestamp (the existing helpers `stripeSignature.ts` and `webhookFreshness.ts`), keeps an event ledger for idempotency (the pattern of `guest-wallet-webhook` and its `stripe_webhook_events` table), and handles:
   - `checkout.session.completed` for a pledge session: retrieve the payment intent; only if it is `requires_capture` for at least the pledged amount, in the campaign currency, naming this pledge and campaign, set the row `authorized`, store the intent id, and send the confirmation email **now**;
   - `checkout.session.expired`: set the row `cancelled`.
4. **The finalizer keeps its verification** (B stays as defence in depth) and also cancels any row still `pending` at the deadline.
5. **`thrivefund-create-pledge` stops sending the confirmation** (the webhook does).

## 3. Order of work
1. Review and approve this proposal and the migration text (to be produced after approval, as a reviewed file, not pasted by me).
2. Migration: the constraint and the default. Applying it before the new create function is deployed is safe: the old function names `authorized` explicitly.
3. Paste `thrivefund-create-pledge` (inserts `pending`) **only after** the webhook is live and verified, or every new pledge stays pending and never counts.
4. Create the webhook endpoint in the Stripe dashboard and store its signing secret: **a secret and a provider configuration, the owner's action**; this program does not touch either.
5. Paste `stripe-thrivefund-webhook`, verify with a Stripe test-mode event, then switch the create function.

## 4. Existing rows
Rows already `authorized` stay as they are (the finalizer verifies each at Stripe). Re-labelling the unpaid ones early is a production data change and needs separate approval; it is not required for correctness once B is deployed.

## 5. Tests required (denied first)
An unsigned or stale event is refused; a replayed event is a no-op; a completed session whose intent is not `requires_capture`, or is short, or names another pledge or campaign, does not authorise the row; an expired session cancels it; a pending row counts in no total; a pledge authorised twice is one; the create function inserts `pending`; the confirmation is sent once and only after authorisation; the finalizer still cancels a pending row and never captures it.

## 6. Read-only questions before the migration
- Is there anything else that writes or filters on `capture_status = authorized` (reports, the client, other functions)? A repository search found the finalizer, the release function, the totals triggers and the create function; production-only objects (views, policies) were not visible.
- How many rows are `authorized` with no intent today (these become the only unpaid rows the finalizer cancels)?
- Does the front end read `capture_status` for the backer's own pledge page?

## 7. Rollback
Re-paste the previous create function (it inserts `authorized` explicitly) and disable the webhook endpoint at Stripe; the constraint can keep the extra value. Rows left `pending` are inert and uncounted.
