# Who can write a "paid" state: a map of the writers (docs only)

Matrix row 14 (GA PROD-05, M4; CE p.18, p.36): *manual attestation must be distinct from provider-confirmed*. The row's next step was "map every writer of the paid state (docs only)". The ThriveFund finding (`proposal-thrivefund-pledge-authorization-state.md`, #180) is the reason to do it now: a state was written before the proof existed, and a total, a trigger and a finalizer trusted it. This map asks the same question of every other money state.

**Docs only. No code, migration, policy, grant, cron or secret changed; no payment or payout logic touched.** Repository evidence (code and migrations); nothing was reproduced against production.

## 1. Method and limits
- Searched `supabase/functions` for writes of `paid`, `completed`, `succeeded`, `captured`, `released`, `authorized`, `paid_at`, `escrow_status`, `capture_status`, `payment_status`; `src` for client-side writers of the same; `supabase/migrations` for SQL functions and triggers that set them.
- For each writer: who may call it, what proof it requires before writing, whether a replay is harmless. "Provider-confirmed" means the function reads the provider's own record (a signature-verified webhook event, or a Checkout session / payment intent retrieved from Stripe and bound to the caller or the object) before it writes.
- **Read for the gate and the write, not traced end to end.** Where a function was only skimmed the table says so. Production grants, policies and rows were not available.

## 2. Writers

### 2a. Provider-confirmed (the write follows the provider's own record)
| Writer | Writes | Proof before the write | Replay |
|---|---|---|---|
| `stripe-marketplace-webhook` (invoice, payment link, milestone, digital product) | `invoices.status = paid` + `paid_at` + `stripe_payment_intent_id`; `payment_link_payments`; milestone `escrow_status` and `paid`; marketplace order | signed Stripe event; `payment_status === paid`; for escrow, the payment intent is retrieved and must be `requires_capture` before `escrow_status = authorized` | guarded by `escrow_status = none` and event handling; the update's error is not checked (see PM-6) |
| `complete-product-purchase` | marketplace order `payment_status = completed` | session retrieved, paid, bound to the product and the buyer (step K) | order looked up by session |
| `verify-stage-ticket` | `curated_stage_orders.status = paid` + RSVP | session retrieved, paid, `metadata.user_id` equals the caller | update by session id |
| `verify-event-ticket` | `event_orders` paid + seat | session retrieved from the order's own `stripe_session_id` | idempotent per its own comment |
| `verify-founder-payment` | founder purchase `completed` | session retrieved, paid, `metadata.user_id` equals the caller | already-processed check by session id |
| `wallet-topup-confirm` | top-up `completed` + `wallet_credit` | the caller's own top-up row; session retrieved, paid, bound to this user and this product | row state |
| `guest-wallet-webhook` | guest top-up `succeeded` + credit | signed webhook; `payment_status === paid` | event ledger `stripe_webhook_events` and a credited check |
| `thrivefund-finalize-campaign` (capture) | `pledges.capture_status = captured` | the payment intent is captured at Stripe first; **but the decision to capture rests on `total_raised`** (PM-1) | idempotent re-call |

### 2b. Internal ledger and payout (money moves between balances we hold or to a connected account)
| Writer | Writes | Gate |
|---|---|---|
| `wallet-transfer` | wallet debit / credit, transaction `completed` | authenticated sender; optional client idempotency key; refund on a failed credit |
| `batch-milestone-payout` | milestone `paid`, `escrow_status = captured`, payout invoice `paid` | authenticated payer must be the project's client or creator |
| `thrivefund-release-milestone` | wallet transaction `completed` for a tranche | authenticated campaign creator; database idempotency (migration `20260818120000`) and Stripe idempotency key |
| `confirm_invoice_paid_manually` (SQL function) | `invoices.status = paid`, `paid_at = now()`, `payment_method` | **issuer only**, any invoice they issued, with a free-text note: self-attested (PM-2) |
| `invoice-report-bank-transfer` (guest, unauthenticated, invoice UUID as the secret) | `bank_transfer_reported_at` only | never sets `paid`: a "the payer says" signal, as its header states |

### 2c. Written before the proof
| Writer | Writes | Why it is premature |
|---|---|---|
| `thrivefund-create-pledge` | `pledges.capture_status = authorized` at session creation | the backer has not paid; the totals trigger counts it (PM-1) |
| `checkout-event-tickets`, free path | `event_orders.status = paid` when `totalCents = 0` | correct for a free ticket if the total is computed server-side; whether a promo can bring a priced tier to 0 was **not traced** |

### 2d. Display only
`AccountingDashboard.tsx` labels marketplace sales "completed" after filtering the query to `status = completed`; the label is accurate to the row, and the row's own writers are the question (PM-3). KrePay, TodayStrip, WeeklyMoneyInsights, MoneyBrief, AccountingDashboard sum `status = paid` invoices as collected: they inherit PM-2.

## 3. Findings
| # | Finding | Evidence | Effect |
|---|---|---|---|
| **PM-1** | Pledges count as `authorized` before payment; the finalizer captures real backers when the phantom total reaches the goal | create-pledge insert; `refresh_campaign_totals`; finalizer `goalMet` | wrongful capture and inflated progress; a campaign wrongly marked funded is also what `thrivefund-release-milestone` requires (`funded` or `completed`) before the creator releases tranches. Covered by #180; **needs a payment decision** |
| **PM-2** | A self-attested paid invoice is indistinguishable from a provider-confirmed one, and both feed public trust signals | `confirm_invoice_paid_manually` sets `status = paid` and `paid_at` for any invoice the caller issued (`payment_method` is free text; the UI sends "Marked paid manually"). `BookedThisMonthChip` counts the issuer's `status = paid` invoices this month and is shown on the public profile and on the swipe card | an account can issue invoices and confirm them paid to show "N booked this month" to people deciding whether to hire it. Also counted as "collected" in the money dashboards |
| PM-3 | A marketplace order's `status` is writable by its buyer or seller | recorded in the commerce proposal (#160) and the slice K evidence | the "completed" sales shown in the dashboards, and the download entitlement, depend on a status the parties can write. Already a proposal; listed so the map is whole |
| PM-4 | `HireMeTrustBar` filters `invoices` by `creator_id`; the `invoices` table has `issued_by` and no `creator_id` | the legacy schema row type and the invoice migrations | the "repeat / market rate" confidence never fires: the query errors and is swallowed. **Do not fix this before PM-2 is decided**, or self-attested invoices would start moving a public confidence label |
| PM-5 | `verify-stage-ticket` and similar writers retrieve any Checkout session by a caller-supplied id | each requires the session's metadata to name the caller (and, where read, the object); the stage order is updated by `stripe_session_id` | no cross-user path found; noted because the id is caller-supplied and the binding is the only protection |
| PM-6 | The webhook's invoice `update` writes `stripe_payment_intent_id` and does not check the update's error; the repository has no migration adding that column to `invoices` and the legacy row type does not list it | webhook lines 87-97; migration search; `legacyTypes.ts` | if the column is absent in production, a Stripe-paid invoice would silently stay unpaid. Only the production schema can answer: a read-only question |

## 4. Read-only questions for whoever has production access
1. Does `invoices` have a `stripe_payment_intent_id` column? How many invoices are `paid` with it null (self-attested or lost), and how many with it set?
2. How many accounts show a non-zero "booked this month" count whose paid invoices are all manual (null intent, `payment_method` equal to the manual note)?
3. For ThriveFund: the questions in section 5 of the proposal.
4. How many promo codes can bring a priced ticket tier to a zero total?

## 5. Decisions owed (none is applied)
1. **PM-2:** a self-attested paid invoice may stay `paid` for the issuer's own books, but is it allowed to count toward a public trust signal? Options, in order of cost: (a) the public chips and confidence label count only invoices with a provider reference, a code-only change in the readers once question 1 is answered; (b) a distinct, visible state (`paid (manual)`) and a database column for the attestation, a schema change; (c) leave as is and label the chip "self-reported".
2. **PM-1:** option B then A of #180.
3. **PM-4:** fix the column only after PM-2.

## 6. Not traced
Every writer of `projects.status = completed` (not a payment); `process-challenge-winners`, `refresh-my-universe`, `merge-accounts-verify` (they write "completed" for non-money records); the wallet SQL functions `wallet_credit` and `wallet_debit` bodies; the promo code validation path; Stripe Connect transfer functions other than `thrivefund-release-milestone` and `batch-milestone-payout`.
