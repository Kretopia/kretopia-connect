# Outbound senders, fifth pass: the six "signal only" senders, and agent-send-dm

Slice Y. Closes the inventory of `outbound-senders-security-evidence.md` (#161): the last six senders marked "signal only" (an authentication helper was present, recipient and content constraints were not read). Gate, as in the earlier passes: *what makes Kretopia send a message is triggered by a proven actor, to a recipient the actor is entitled to reach, with a bounded blast radius, once.* Code only: no migration, no policy, no secret, no data change. Not deployed. Repository findings; none was reproduced against production.

## 1. Verdicts

| Sender | Actor | Recipient scope | Content | Replay / rate | Failure and logging | Verdict |
|---|---|---|---|---|---|---|
| `send-invoice-chase` | JWT claims; invoice read with `issued_by = caller` | the invoice's own `brand_email` (set by its issuer), mailed through the caller's own `send-outreach-draft` | AI draft, subject 200 and body 4000 clipped | **none**: every call drafts and sends again; no check that the invoice is unpaid. The in-app drawer drafts with `send: false` and sends through `send-outreach-draft`, which knew nothing about the invoice either | hand-off failure was swallowed: `ok: true` and no sign it was not sent | **NEEDS FIX** (fixed here, Y1: in both functions) |
| `thrivefund-create-pledge` | session token | the caller's own address | template, escaped | one confirmation per pledge id | the confirmation says "pledge confirmed" before payment | **BLOCKED**: the real finding is the pledge state, not the mail. See section 3 and `proposal-thrivefund-pledge-authorization-state.md` |
| `notify-swipe` | JWT claims, a **real** right swipe required, the displayed identity from the caller's own profile (fixed earlier) | the swiped profile | fixed text, escaped name | **none**: the same swipe could be replayed into unlimited email and push to that person | partial: failures logged | **NEEDS FIX** (fixed here, Y2) |
| `notify-speed-pool-ping` | `getUser`, host of the session or admin | RSVPs of that session who have not joined | fixed text + the session title | **none**: each call inserts a notification per RSVP, no cooldown | insert error surfaced | **NEEDS FIX** (fixed here, Y3) |
| `notify-speed-session-update` | `getUser`, host of the session or admin | RSVPs of that session | `reason` unclipped and untyped (an object becomes "[object Object]"), `changes` unclipped (a string throws a 500 on `.join`) | **none**, same storm | insert error surfaced | **NEEDS FIX** (fixed here, Y4) |
| `rsvp-speed-session` | JWT claims | **only the caller's own address**, resolved server-side | session fields through the escaping template; calendar link built with `URLSearchParams` | idempotency key `ss-rsvp-<session>-<user>`: one mail per session and person | caught and logged | **SAFE**. One non-security defect noted: `prof.full_name` throws when the profile row is missing and the mail is silently skipped (`prof?.full_name`). Not changed here. |

## 2. What changed (5 functions, 1 shared helper, 1 component, 1 test)

`_shared/notificationGuards.ts` (new, pure, no dependency) and:

- **Y1 `send-invoice-chase` and `send-outreach-draft`.** A payment reminder leaves in one place, `send-outreach-draft` (the in-app drawer calls it directly after the user reviews the draft; `send-invoice-chase` with `send: true` hands off to it), so the rule lives there and applies to both:
  - a paid, cancelled or `paid_at`-stamped invoice is never chased (drafting or sending); a draft invoice is not sent as a reminder; no reminder within 24 hours (409 with a `reason`); an invoice that is not the caller's or not found is 404; an unreadable invoice is 503;
  - the reminder is **claimed** by compare-and-set on `invoices.reminder_sent_at` (`null` or older than 24 h) before the mail leaves, so two clicks or two tabs cannot both send; the previous date is restored if the SMTP send fails, and the agent claim of #172 is released too;
  - only a draft with `source = 'chase_invoice'` and an `invoice_id` is affected: every other outreach draft behaves as before;
  - `send-invoice-chase` checks the same rule first, so a refused call costs no AI request; it saves the draft as `draft`, makes it `approved` only at the hand-off, puts it back if the hand-off fails, and answers `sent: false` with the downstream reason instead of always `ok: true`;
  - `InvoiceChaseDrawer.tsx` shows the reason (paid or cancelled; a reminder already went today) instead of a generic error.
- **Y2 `notify-swipe`.** After the real swipe is proven: 60 swipe notifications per account per hour (503 if the count cannot be read), then a **once-per-pair claim** in the `email_send_log` registry (`swipe-notify:<swiper>:<recipient>`, written as a `sent` row, so the registry's partial unique index on `message_id` makes it atomic). A repeat answers `success: true, duplicate: true` and sends nothing; a claim that cannot be written answers 503 and sends nothing; a notification that reached nobody (both channels failed or were switched off) releases its claim.
- **Y3 `notify-speed-pool-ping`.** One ping per session per two minutes (429; 503 if the count cannot be read), counted on the `notifications` rows of that type and session link.
- **Y4 `notify-speed-session-update`.** `reason` is a clipped string (500), `changes` at most 8 strings of 60; an update is not repeated within two minutes and a cancellation within an hour, per session.

## 3. Finding that is not fixed here: ThriveFund pledges count before payment

While reading `thrivefund-create-pledge` for its mail, the state it writes was the problem. Evidence (repository, not production):

| # | Where | Fact |
|---|---|---|
| 1 | `thrivefund-create-pledge`, the `pledges` insert | the row is created with `capture_status: "authorized"` when the **Checkout session is created**, before the backer has paid or authorised anything |
| 2 | `refresh_campaign_totals` trigger (migration `20260419014818`) | `total_raised`, `backer_count` and the tier `claimed_count` sum rows whose status is `authorized`, `captured` or `released` |
| 3 | `thrivefund-finalize-campaign` | `goalMet = total_raised >= goal_amount`, then every real authorised pledge is **captured** when it is met; unpaid rows are cancelled only afterwards, so they have already counted |
| 4 | the functions directory | no function handles the checkout completion for pledges: nothing flips a row to authorised on payment |
| 5 | `thrivefund-create-pledge` | `amount` has no upper bound |

So a signed-in account that never pays can raise a campaign's displayed total, sell out its tiers, and, if it pushes `total_raised` over the goal, make the finalizer charge genuine backers for a campaign that had not been funded. This is a payment-state finding: per the program's rules it is **not** changed in this slice. The proposal (prose, no SQL) and the questions to answer first are in `proposal-thrivefund-pledge-authorization-state.md`. **Until it is decided, nobody should run a finalization on a campaign whose `total_raised` has not been compared with Stripe by hand.**

## 4. agent-send-dm

The brief for this pass listed it as not bound to the exact recipient and message. It is: step Q (#163, merged) does this, and the code on `main` was re-read for this pass.

| Requirement | Where it is enforced |
|---|---|
| exact recipient | `bindApprovedDm`: the request's `to_user_id` must equal the approved arguments' (`send_dm`: `to_user_id`; `spin_up_project`: `creator_user_id`) |
| exact text | the request's trimmed `body` must equal the approved `body` / `kickoff_message` (clipped as the bundle clips it); the sent text is that same trimmed value |
| actor | `evaluateExecutionGuard` with the caller's id: the action and its approval record must be the caller's |
| exact approval record | the approving record's `edited_args` when it has one, else the action's `tool_args`; an `orch_approvals` positive decision is required |
| revoked, rejected, cancelled | the existing guard denies (409) |
| expired | older than 30 minutes: 410 |
| reused / duplicate | `approved -> executed` compare-and-set before the insert (409 on the second call); released if the insert fails |
| missing | no `_agent_action_id`: 428 with the draft; a failed lookup: 503 |
| any other tool | 403 `unsupported_tool` |

Tests: `src/lib/__tests__/agentDmBinding.test.ts` (26 tests, re-run in this pass: all pass). What is still open is **deployment** (step Q of the bundle), not code. Two residual notes, neither a send path: the recipient existence check logs and continues if the auth lookup throws (the `messages.receiver_id` foreign key still refuses a missing user), and the binding compares trimmed text, not a hash, which is equivalent for this purpose.

## 5. Tests

`src/lib/__tests__/notificationGuards.test.ts` (new): session text (string only, clipped, no control characters; an object, an array or a number is refused; at most 8 short strings), cooldown (allowed, 429, **503 on an unreadable count**, windows), `decideInvoiceChase` (paid, cancelled, `paid_at`, draft with and without send, 23 h refused and 25 h allowed, an unreadable date is not a refusal), the once-claim (claimed; `23505` is a duplicate; any other error is an error; ids differ by direction; release touches only a `sent` row of that message as `failed`), the recent-notification count (filters; null on error), and the wiring of the four functions (the proof comes first, then the count, then the claim, then any send; 503 and 429 paths; the claim before the hand-off; the previous reminder date restored; the outcome reported). Not run: a real Resend queue, push, or a real two-tab double click.

## 6. Not addressed

- `notify-swipe`: a recipient who has blocked the swiper is not checked (no canonical block record was found in the functions).
- The cooldowns for the session senders are counted on `notifications` rows; two calls in the same instant can both pass (at most two notices).
- The registry is still `email_send_log` metadata, not a purpose-built table (`proposal-outbound-send-registry.md`).

## 7. Release

Paste `_shared/notificationGuards.ts` first, then the five functions (`send-invoice-chase`, `send-outreach-draft`, `notify-swipe`, `notify-speed-pool-ping`, `notify-speed-session-update`). `notify-swipe` also imports `_shared/outboundBudget.ts` (already in the bundle, step R, and replaced by the step X copy). Behaviour visible to users: a second "send reminder" within a day answers 409 with a message; a second swipe notification for the same pair does nothing; a second ping within two minutes answers 429.

## 8. Rollback

Re-paste the previous five functions. `_shared/notificationGuards.ts` can stay (only these four import it). Registry rows written under `swipe-notify` are harmless.
