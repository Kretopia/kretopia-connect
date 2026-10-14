# Proposal: a ThriveFund pledge counts only once it is authorised

**Status: PROPOSAL, NOT DONE.** It touches payment state, so no code, migration or data change has been made. It needs an explicit decision (see section 6). This document contains no runnable SQL on purpose.

## 1. Finding

A pledge row is created, with the status `authorized`, when the Checkout session is created, before the backer has paid. The database totals and the finalizer both trust that status. Evidence (repository, read in the Y pass):

1. `supabase/functions/thrivefund-create-pledge/index.ts`: the insert into `pledges` sets `capture_status: "authorized"` and only afterwards creates the Stripe session. `amount` is any number greater than zero.
2. Migration `20260419014818`: the trigger `refresh_campaign_totals` recomputes `campaigns.total_raised` and `backer_count` from pledges whose status is `authorized`, `captured` or `released`; `refresh_tier_claimed` does the same for `pledge_tiers.claimed_count`.
3. `supabase/functions/thrivefund-finalize-campaign/index.ts`: `goalMet` is `total_raised >= goal_amount`. If met, every authorised pledge with a payment intent is **captured** (the first milestone tranche), then pledges without one are cancelled.
4. No function in `supabase/functions` handles the completion of a pledge's Checkout session, so nothing moves a row to "authorised" on payment, nor back on abandonment before the deadline.

## 2. Impact

- **Inflated progress.** Any signed-in account can raise a campaign's displayed total and backer count, and exhaust a tier (`max_backers`), by creating sessions it never completes.
- **Wrongful capture.** If the phantom total reaches the goal, the finalizer treats the campaign as funded and charges the genuine backers whose cards were really authorised, for a campaign whose real authorised amount was below the goal. That breaks the all-or-nothing promise the product states.
- **Who can do it.** Any account with a session token, including a second account of the campaign's own creator. There is no ceiling on `amount`, no cap on pledges per account, and no refusal of a creator pledging to their own campaign.

Nothing here was reproduced against production. Exposure is limited to campaigns that are `active` and approaching their deadline; the owner should check them by hand before any finalization (section 5).

## 3. Options (none is applied)

**A. A pledge is pending until Stripe says it is authorised (recommended).**
- A new row starts as "pending" and is counted by no total.
- A signed Stripe webhook (the existing signature and freshness helpers apply) moves it to "authorised" on the checkout session completing with an authorisation that can be captured, and to "cancelled" on expiry.
- The totals trigger and the tier counter keep counting only authorised, captured and released rows, so they need no change if "pending" is a distinct value.
- Needs: a new status value (the column is free text today: confirm whether a check constraint exists), one new function (the webhook), one change in `thrivefund-create-pledge`. Existing rows need a one-off decision (below).

**B. The finalizer verifies before it decides (a code-only interim).**
- `thrivefund-finalize-campaign` stops trusting `total_raised`: for each authorised pledge it resolves the session and payment intent at Stripe and sums only those whose intent can still be captured; `goalMet` uses that sum. Everything else is cancelled as it is today.
- No schema change. It does not fix the displayed totals or the tier counts, only the money decision. It is the smallest change that stops wrongful capture.

**C. Hardening that belongs with either (access control, not state):** an upper bound on `amount`; refusing a creator pledging to their own campaign; at most one open pledge per account and campaign; the confirmation email only after authorisation (today it says "pledge confirmed" at session creation).

Recommendation: **B immediately** (one function, testable with a fake Stripe client, protects backers' cards), **then A** with C, so the displayed numbers are true as well.

## 3b. What each option would not change

| | Displayed totals | Tier counts | Wrongful capture | Existing phantom rows |
|---|---|---|---|---|
| none | wrong | wrong | possible | stay |
| B | wrong | wrong | prevented | cancelled at finalization |
| A (+ C) | true | true | prevented | need a decision |

## 4. Tests that would be required (denied paths first)

A phantom pledge never counts toward the goal; a pledge whose intent is not capturable is cancelled, not captured; a campaign with real authorisations below the goal fails and nobody is charged; a replayed webhook is idempotent; an unsigned or stale webhook is refused; a creator pledging to their own campaign is refused; an oversized amount is refused; a double click makes one pledge.

## 5. Read-only questions to answer before deciding (prose, for whoever has production access)

- How many campaigns are `active`, and how close is each deadline?
- For each, how does `total_raised` compare with the number and amount of pledges that have a payment intent in an authorised state at Stripe?
- How many pledge rows are `authorized` with no payment intent at all, and how old are they?
- Has any campaign already finalised as funded? If so, were all its captured intents backed by completed checkouts?

An operational mitigation that needs no code: do not trigger or let the scheduler run `thrivefund-finalize-campaign` on any campaign until the second question has been answered for it. The finalizer is guarded (admin or cron), so this is a decision about the cron schedule, which this program does not change.

## 6. Decisions owed

1. Option B now, A later (recommended), A alone, or hold finalization until A is built.
2. What happens to existing `authorized` rows with no payment intent: left to the finalizer's existing cancel, or cancelled earlier by a one-off, which is a production data change and needs your approval.
3. Whether a creator may ever pledge to their own campaign.
4. The amount ceiling (a number) and whether a backer may hold more than one open pledge.

## 7. Rollback

Option B is one function: re-paste the previous one. Option A is a status value, a webhook and a function change: the webhook is removed and the function re-pasted; rows left "pending" stay uncounted and are harmless.
