# KrePay Payment System — End-to-End Audit

Read-only static code audit. Repo: `/Users/noeplantier/thrivein-new-beta`, branch `feature/activation-priority-plan`. Audit date: 2026-08-23. No Stripe API calls were made, no files were modified, no secret values are printed anywhere in this document.

**This is not the first audit of this system.** The repo already contains three prior, independently-produced audit documents covering overlapping ground: `docs/SECURITY_RELEASE_GATE.md` / `SECURITY_RELEASE_GATE.md` (2026-08-12), `STRIPE_SECURITY_AUDIT.md` (2026-08-18, static audit of all 31 payment edge functions), and `FINAL_SECURITY_EMAIL_PAYMENT_QA.md` (2026-08-18, fix log). This report **independently re-verified every finding those documents claim as fixed by reading the current file contents directly** (not by trusting the prior document's word), and cross-references them throughout. Where this report disagrees with or adds to those documents, it says so explicitly.

---

## 0. Stripe mode — live or test?

**Cannot be determined from code alone**, as expected: every payment function reads the key as `Deno.env.get("STRIPE_SECRET_KEY")` (e.g. `supabase/functions/create-milestone-payment/index.ts:186`, `supabase/functions/wallet-topup/index.ts:69`, `supabase/functions/stripe-wallet-webhook/index.ts:16`) with no mode indicator anywhere in source. Confirmed via repo-wide grep: **no `sk_live_` or `sk_test_` prefixed string is hardcoded anywhere in `src/` or `supabase/functions/`** — the client bundle never holds a secret key, and every edge function reads it from the environment, never a literal.

**However**, this repo already contains a dated record answering the question directly: `EMAIL_STRIPE_SANDBOX_QA.md` (compiled 2026-08-18, five days before this audit) states that a prior session **asked the user directly** whether `STRIPE_SECRET_KEY` is test or live, and records: *"Confirmed: live mode."* That session then deliberately skipped all Stripe testing for that reason, to avoid moving real money.

**This audit could not independently re-confirm that today** — verifying the actual key value requires the Supabase dashboard/CLI (`supabase secrets list` shows names, not values, but the Stripe dashboard's own key list — test vs. live — is the authoritative source) or the user's direct confirmation. Given the prior recorded answer, **treat every finding below that involves real fund movement as a live-money issue, not a sandbox one**, until someone re-confirms current key mode via the Stripe dashboard or Supabase secrets.

---

## 1. The KrePay page(s)

- **Primary route**: `/thrivepay` → `src/pages/ThrivePay.tsx` (682 lines), registered in `src/App.tsx:392`. `/wallet`, `/purchases`, `/accounting`, `/thrivemoney` all redirect here (`src/App.tsx:394-397`).
- Already condensed into **3 tabs** as expected: `Tabs defaultValue="get-paid"` at `ThrivePay.tsx:453` — **Get Paid** (`PaymentLinksSection`), **Activity** (`AccountingDashboard` + recent `transactions`), **Payouts & Fees** (Stripe Connect onboarding/status + fee schedule). Above the tabs sit always-visible summary widgets: `ThriveWalletCard`, `MoneyBrief`, `WeeklyMoneyInsights`, a wallet-balance/available/pending card row.
- A **second, separate payment surface** exists outside `/thrivepay`: **project milestones/escrow** (`src/components/project/MilestoneBoard.tsx`), reachable from a project's Desk workspace via `src/components/project/finance/FinanceHub.tsx:349` (unconditionally rendered — see §4 canonical-flow note). This is where actual milestone-based Stripe Checkout/escrow payments happen; `/thrivepay`'s Activity tab only *displays* the resulting `invoices`/`transactions` rows.
- Public, no-login payer-facing pages: `PayLink.tsx` (`/pay/:slug`), `PayInvoice.tsx` (`/pay/invoice/:id`), `PaymentSuccess.tsx`, `PaymentCanceled.tsx`, `GuestPay.tsx`.

---

## 2. Every Stripe-related edge function

40 functions under `supabase/functions/` import or reference Stripe. Grouped by purpose:

**Checkout/payment creation**
| Function | Purpose |
|---|---|
| `create-milestone-payment` | Builds Checkout session to pay a project milestone (immediate or escrow/manual-capture) |
| `capture-milestone-payment` | Captures or cancels an escrowed milestone PaymentIntent |
| `batch-milestone-payout` | Captures multiple escrow milestones + one combined Checkout for non-escrow ones |
| `create-invoice-checkout` | Public Checkout session to pay an invoice |
| `create-payment-link-checkout` | Public Checkout session to pay a KrePay payment link |
| `create-connect-payment` | Generic Connect-destination Checkout (**dead code**, see §5) |
| `create-payment` | Generic wallet-style Checkout (**dead code**, see §5) |
| `create-checkout` / `create-founder-checkout` | Subscription / Founder-Circle Checkout (not KrePay-specific) |
| `wallet-topup` / `wallet-topup-confirm` | Create + client-confirm a Kretopia Wallet top-up Checkout |
| `guest-wallet-topup` | Same, for the guest (no-account) wallet |
| `checkout-event-tickets` / `checkout-stage-ticket` | Event/stage ticket Checkout (adjacent, not KrePay) |
| `join-paid-circle` | Paid Circle-membership Checkout (adjacent) |
| `thrivefund-create-pledge` | Crowdfunding pledge Checkout (adjacent) |

**Stripe Connect (payouts/onboarding)**
`create-connect-account`, `create-connect-login-link`, `check-connect-status`, `get-connect-balance`, `wallet-add-bank`, `wallet-balance`, `wallet-payout`.

**Money movement outside Checkout**
`release-escrow` (capture/cancel a marketplace-order PaymentIntent), `wallet-transfer` (internal peer-to-peer ledger transfer, no Stripe call), `thrivefund-release-milestone` (`stripe.transfers.create` to a campaign creator), `thrivefund-finalize-campaign` (bulk capture), `batch-milestone-payout` (also does manager-commission transfers).

**Confirmation / verification (client-invoked, must re-check with Stripe)**
`wallet-topup-confirm`, `verify-founder-payment`, `verify-circle-payment`, `verify-event-ticket`, `verify-stage-ticket`, `get-payment-intent` (read-only, unused — see §5).

**Webhooks (Stripe → server, must verify signature)**
`stripe-marketplace-webhook`, `stripe-wallet-webhook`, `guest-wallet-webhook`. See §4.

**Read-only / info**
`invoice-pay-info`, `payment-link-info`, `send-get-paid-link`, `send-invoice-chase`, `customer-portal`, `check-subscription`.

---

## 3. Payment-creation function checks (server-side / auth / amount / idempotency)

| Function | Server-side only? | Validates JWT (not client user id)? | Amount from server-owned record? | Idempotency key to Stripe? |
|---|---|---|---|---|
| `create-milestone-payment` | Yes | Yes — `supabaseClient.auth.getUser(token)`, `index.ts:50-52` | **Yes** — `milestone.amount` from DB, `index.ts:74-78, 121`; client `amount` is logged-and-ignored on mismatch (`index.ts:122-126`) | No (checkout session creation — no `idempotencyKey` param) |
| `capture-milestone-payment` | Yes | Yes, `index.ts:38-40` | n/a (captures the already-created PaymentIntent by ID) | No explicit key; relies on Stripe rejecting a second `.capture()` |
| `batch-milestone-payout` | Yes | Yes, `index.ts:36-38` | Yes — `milestone.amount`/`payment_intent_id` from DB, `index.ts:62-79` | No |
| `create-invoice-checkout` | Yes | **No auth required — intentionally public** (payer has no account) | **Yes** — `invoice.total_amount` from DB, `index.ts:32` | No |
| `create-payment-link-checkout` | Yes | **No auth required — intentionally public** | **Yes** — `link.amount_cents` (fixed) or clamped to `link.min/max_amount_cents` (variable), `index.ts:33-43` | No |
| `wallet-topup` | Yes | Yes, `index.ts:35` | Client-supplied `amount`, capped at `$10,000` (`index.ts:43-49`) and only credited later after Stripe re-verification (see §4/§7) | No |
| `create-payment` (dead) | Yes | Yes | **No — client-supplied `amount`/`type` used directly**, `index.ts:27,52` | No |
| `create-connect-payment` (dead) | Yes | Yes | **No — client-supplied `amount` AND `recipientAccountId` used directly**, `index.ts:52-58,103,112` | No |

**No payment-creation function in this codebase passes a Stripe `idempotencyKey`** on `stripe.checkout.sessions.create(...)`. This matters less for Checkout (a duplicate session just produces a second unused payment page) than for direct-money calls — see `thrivefund-release-milestone` and `wallet-payout` in §6, which are the ones that actually move money without a Checkout step in between.

---

## 4. Webhook handlers

Three Stripe webhook handlers exist. All three do real signature verification and reject on failure — this is solid:

| Webhook | Raw body used? | Signature verified? | Rejects on failure? | Dedup by Stripe event ID? |
|---|---|---|---|---|
| `stripe-wallet-webhook` | Yes — `req.text()` before any parsing, `index.ts:20` | Yes — `stripe.webhooks.constructEventAsync(body, sig, secret)`, `index.ts:32` | Yes — 400 on bad sig (`index.ts:35`), 500 if secret missing (`index.ts:24`) | **Yes** — `insert` into `stripe_webhook_events(event_id)` (PK), `23505` → return 200 no-op, `index.ts:39-44` |
| `guest-wallet-webhook` | Yes — `req.text()`, `index.ts:20` | Yes — `constructEventAsync`, `index.ts:27` | Yes — 400 on bad sig, `index.ts:31-34` | **Yes** — same `stripe_webhook_events` table pattern, `index.ts:71-81`, plus a second per-row guard (`topup.status === "succeeded"` short-circuit, `index.ts:101-106`, and a conditional `.eq("status","pending")` update, `index.ts:109-114`) |
| `stripe-marketplace-webhook` | Yes — `req.text()`, `index.ts:38` | Yes — `constructEventAsync`, `index.ts:42-48` | Yes — 400 on bad sig, `index.ts:49-51` | **No** — this handler never writes to `stripe_webhook_events` at all. It has *per-branch* dedup instead: the milestone branch checks `milestone.status === 'paid'` before writing (`index.ts:185-190`, well-commented), and the marketplace-order branch checks for an existing order by `checkout_session_id` and `payment_intent_id` (`index.ts:350-375`). The **invoice branch** (`index.ts:66-95`) and **payment-link branch** (`index.ts:98-148`) have no such pre-check — a redelivered event re-writes `invoices.status='paid'` (harmless no-op) but also **re-increments `payment_links.use_count`** (`index.ts:117-129`), which can prematurely disable a `single_use`/`max_uses`-limited link after a redelivery of the same real payment. See finding #3 in §6. |

Three different webhook-secret env vars are used across these: `STRIPE_WALLET_WEBHOOK_SECRET`, `STRIPE_MARKETPLACE_WEBHOOK_SECRET`, and `STRIPE_WEBHOOK_SECRET` (used by `guest-wallet-webhook`, oddly named the same as what's typically the "default" one). **Confirming all three are actually registered as separate endpoints in the live Stripe dashboard with matching signing secrets is a production-access check this audit could not perform** — see §7.

---

## 5. Payment-related database tables and RLS

Core tables (migration file cited per table):

| Table | Key state column(s) / values found | RLS — client write path today |
|---|---|---|
| `wallets` (`20250930110718...sql`) | `balance numeric CHECK(balance>=0)`, `credits int` | **Owner-UPDATE policy, no column restriction, still in force today.** `wallet_debit`/`wallet_credit` RPCs (added `20260804103153...sql`) are `service_role`-only and are the *intended* sole write path — but the original `wallets` UPDATE policy (`USING (auth.uid()=user_id)`, no `WITH CHECK`) was never revoked. See finding #1, §6. |
| `transactions` (`20250930110718...sql`) | `type IN (credit_purchase, credit_earned, credit_spent, payment_received, payment_sent, withdrawal)`, `status IN (pending, completed, failed, cancelled)` | Owner INSERT/SELECT only (no client UPDATE policy) — fine, this table is an append-only log. |
| `milestones` (`20250930134421...sql`, hardened `20260812071205...sql`) | `status IN (pending, in_progress, submitted/review, approved/completed, paid)`, `escrow_status`, `payment_intent_id` | **`status`, `paid_at`, `paid_to`, `escrow_status` are column-REVOKEd from `authenticated`/`anon`** (`20260812071205...sql:427`). Sole write path is `confirm_milestone_paid_offline(uuid)`, a `SECURITY DEFINER` RPC that requires caller = project's `client_user_id`/`created_by` (`...sql:459-462`). Confirmed fixed — was previously any-collaborator-writable. |
| `invoices` (`20251003171922...sql`, hardened `20260812071205...sql`) | `status IN (draft, sent, paid, cancelled, overdue)` | **`status`, `paid_at` REVOKEd from `authenticated`/`anon`** (`...sql:488`). Sole write path is `confirm_invoice_paid_manually(uuid, text)`, requires caller = `issued_by`, rejects if already paid, requires a non-empty payment-method note (`...sql:490-524`). **Still self-attestation by the issuer with no payer/counterparty confirmation — by design, documented, unchanged.** |
| `payment_history` | `type IN (payment_received, payment_sent, refund, commission)`, `status IN (pending, completed, failed, cancelled)` | Owner-SELECT only, **no client write policy at all** — effectively service-role/definer-only. Good. |
| `payment_links` (`20260602182007...sql`) | `mode IN (fixed, open, suggested)`, `active`, `use_count` | Owner-UPDATE, **no column restriction** (`...sql:43-45`) — but this only lets the link owner edit/toggle their *own* link (e.g. `active`), not falsify a payment; low risk. |
| `payment_link_payments` (`20260602182007...sql`) | `status IN (pending, paid, failed, refunded)` | Table has a `GRANT ...UPDATE... TO authenticated` but **no RLS UPDATE/INSERT policy exists** — under RLS, no matching policy = default deny, so despite the misleading GRANT, only `service_role` (the webhook) can actually write. Correct in practice, GRANT is just dead/confusing. |
| `creator_wallets` (`20260528125850...sql`) | `kyc_status IN (none,pending,verified,restricted)`, `payouts_enabled`, `charges_enabled` | **Owner-UPDATE policy, no column restriction, still in force today** (`...sql:20`). `wallet-payout/index.ts:27-35` gates a real `stripe.payouts.create()` call on exactly `payouts_enabled`. See finding #2, §6. |
| `creator_payouts` (`20260528125850...sql`) | `status IN (pending,in_transit,paid,failed,canceled)` | `GRANT SELECT, INSERT` but **no INSERT RLS policy** → default-deny → effectively service-role only. Good. |
| `stripe_webhook_events` | n/a (dedup table) | `service_role`-only grant, RLS enabled, no client policies. Good. |
| `guest_wallets`, `guest_wallet_topups`, `guest_wallet_transactions` (`20260509004356...sql`) | topup `status`, wallet `balance_cents` | Deny-all client policies confirmed by a prior audit pass in this repo; only the signature-verified `guest-wallet-webhook` writes these under `service_role`. |
| `marketplace_orders` | `status IN (escrow, completed, disputed, ...)` (inferred from code, not a CHECK constraint found in the reviewed migration) | Written by `stripe-marketplace-webhook` (service role) and by `release-escrow` (service role, ownership-checked in-function). Client-side `SellerOrderCard.tsx` does call `.update()` on this table directly, but only for shipping fields (`shipped_at`), not `status`/`amount` — not investigated column-by-column for a REVOKE, flagged as a follow-up. |

---

## 6. What is unsafe — ranked by severity

Given the recorded live-mode Stripe key (§0), treat everything below as a real-money issue unless noted otherwise.

### 1. CRITICAL — `wallets.balance` is directly client-writable, and that balance is spendable as real money (open, unfixed)

- **Where**: `supabase/migrations/20250930110718_317c2f4c...sql:38-40` — `CREATE POLICY "Users can update their own wallet" ON public.wallets FOR UPDATE USING (auth.uid() = user_id);` — no `WITH CHECK`, no column-level `REVOKE`. Confirmed via full migration grep: **no later migration ever revoked `UPDATE` on this column.**
- **Exploit**: any authenticated user, with nothing but their own valid Supabase JWT (browser devtools or `curl`), can call `supabase.from('wallets').update({ balance: 999999 }).eq('user_id', <own id>)` directly against the Supabase REST API — no app UI needed. `supabase/functions/wallet-transfer/index.ts:77-92` then treats that fabricated balance as real, moving it to another user's wallet via the (correctly-hardened) `wallet_debit`/`wallet_credit` RPCs, which only check that `balance >= amount` — they have no way to know the balance itself was forged.
- **Why it's not just theoretical**: the app's own UI never writes to `wallets` directly (confirmed — only a benign 10-credit seed trigger at signup), so this requires a direct API call, not normal app usage. But RLS, not UI behavior, is the actual security boundary Supabase relies on — and it's broken here.
- **Documented previously** as C4 in `docs/SECURITY_RELEASE_GATE.md` (2026-08-12) and cross-referenced in `STRIPE_SECURITY_AUDIT.md`'s `wallet-transfer` notes (2026-08-18); **independently re-confirmed still open today** by reading the full migration history.

### 2. CRITICAL — `creator_wallets.payouts_enabled`/`kyc_status` directly client-writable, gates a real Stripe payout (open, unfixed)

- **Where**: `supabase/migrations/20260528125850_6b5c8803...sql:20` — `CREATE POLICY "own wallet update" ON public.creator_wallets FOR UPDATE TO authenticated USING (auth.uid() = user_id);` — no column restriction.
- **Exploit**: `supabase/functions/wallet-payout/index.ts:27-35` reads `wallet.stripe_account_id`/`wallet.payouts_enabled` as its *sole application-level gate* before calling `stripe.payouts.create(...)` (`index.ts:46-52`). A user could flip `payouts_enabled=true` on their own row via a direct `.update()` call, bypassing the app's own "did this user actually complete Stripe KYC" check. Stripe's own account-capability checks are a backstop (Stripe will reject a payout from an account that hasn't genuinely completed onboarding), but the app-level trust boundary this code was clearly written to rely on is not real.
- **Documented previously** as C5 in `docs/SECURITY_RELEASE_GATE.md`; **independently re-confirmed still open today.**

### 3. HIGH — `stripe-marketplace-webhook` has no event-ID-level idempotency, and its payment-link branch double-counts on redelivery (open, unfixed)

- **Where**: `supabase/functions/stripe-marketplace-webhook/index.ts` — contrast with its two siblings (`stripe-wallet-webhook:39-44`, `guest-wallet-webhook:71-81`), which both insert into `stripe_webhook_events(event_id)` (a primary key) and no-op on a `23505` duplicate. This file never does that.
- **Failure scenario**: Stripe explicitly documents that webhook events can be delivered more than once for the same event. On a redelivery of a `checkout.session.completed` event for a payment link payment, `index.ts:111-129` re-reads `use_count` and increments it again — a link with `single_use: true` or `max_uses: 1` gets disabled after one real payment plus one redelivery, incorrectly telling the next real payer the link is used up. The invoice branch (`index.ts:66-95`) is lower-risk (re-setting `status='paid'` twice is a harmless no-op) but is the same missing-guard pattern.
- **Documented previously**, same conclusion, in `STRIPE_SECURITY_AUDIT.md` §"stripe-marketplace-webhook — inconsistent idempotency guards" and `FINAL_SECURITY_EMAIL_PAYMENT_QA.md` §Phase 5. Independently re-confirmed by direct read.

### 4. MEDIUM — `create-connect-payment` and `create-payment` remain deployed with fully client-controlled amount/destination (dead code, but live URLs on a live Stripe account)

- **Where**: `supabase/functions/create-connect-payment/index.ts:52-58,103,112` — `amount` and `recipientAccountId` come straight from the request body and are used unchecked as the Checkout line-item price and the `transfer_data.destination`. `supabase/functions/create-payment/index.ts:27,52` — same pattern for `amount`/`type`, no destination-routing but also no DB record and no webhook branch anywhere reads its `wallet_topup` metadata, so it's a dead end even if paid.
- **Confirmed dead**: repo-wide grep of `src/` for `create-connect-payment` and `invoke("create-payment"` returns zero hits.
- **Why it's still worth ranking above "ignore"**: an Edge Function URL is reachable the moment it's deployed, independent of whether any frontend code calls it. Any signed-up user with a valid JWT could `curl` `create-connect-payment` directly and build a real Stripe Checkout session that routes funds (minus a computed platform fee) to *any* Stripe Connect account ID they supply — completely divorced from any project, milestone, or fee-audit trail this platform otherwise enforces everywhere else. It can't steal existing funds (the payer must complete checkout with their own card), but it is an unaudited, unattributed payment-routing capability sitting on a live Stripe account — a plausible fraud/laundering relay if ever discovered and misused, or if a future frontend change accidentally starts calling it.
- **Documented previously** (`STRIPE_SECURITY_AUDIT.md`, `FINAL_SECURITY_EMAIL_PAYMENT_QA.md` recommend deletion); **still present, unfixed, at the same file paths today.**

### 5. MEDIUM — `wallet-payout` and `wallet-transfer` pass no Stripe/request idempotency key (open, unfixed)

- **Where**: `supabase/functions/wallet-payout/index.ts:46-52` (`stripe.payouts.create` with no `idempotencyKey` option), `supabase/functions/wallet-transfer/index.ts:77-92` (no dedup marker on the request at all).
- **Failure scenario**: a double-click, a client-side retry after a slow response, or a mobile network timeout-then-resend can create two real Stripe payouts, or two real internal wallet transfers, for what the user experienced as one action. The underlying `wallet_debit`/`wallet_credit` RPCs are atomic against a *concurrent* race on a single call, which is a different problem from two *sequential*, individually-valid calls.
- **Contrast**: `thrivefund-release-milestone/index.ts:124-137` (fixed 2026-08-18) shows the correct pattern already exists in this codebase — a deterministic `idempotencyKey` plus a DB reservation table with a unique constraint.

### 6. LOW (functional, not security) — `batch-milestone-payout`'s non-escrow combined-checkout path has no completion handler

- **Where**: `supabase/functions/batch-milestone-payout/index.ts:116-169` creates one Stripe Checkout session with `metadata: { batch: 'true', milestoneIds, ... }` for multiple non-escrow milestones. Repo-wide grep confirms **nothing reads `session.metadata.batch`** anywhere — not `stripe-marketplace-webhook`, not any other function. A user can pay through this flow and the milestones will never flip to `paid`. Under-executes rather than over-executes (no money-theft risk), but the "batch payout" button in `MilestoneBoard.tsx:336` is effectively non-functional end-to-end.

### 7. LOW — No automated test coverage for any of the above

- Repo-wide search of `**/*.test.ts(x)` for `stripe`, `payment`, `webhook`, `krepay` (case-insensitive) found **one incidental match** (`src/components/profile/__tests__/BrandPassportHero.test.tsx`, which only contains an unrelated `payment_verified: true` mock field) — i.e., **zero real test coverage** of any Stripe/payment/webhook/wallet/milestone logic anywhere in the codebase (client or edge functions). None of the fixes described as "verified locally" in `FINAL_SECURITY_EMAIL_PAYMENT_QA.md` were covered by an automated payment test; verification there relied on `tsc`/`build`/the (payment-unrelated) 62-test suite passing, not on any payment-specific assertion.

### 8. LOW — No refund API usage anywhere

- Repo-wide grep for `stripe.refunds.create`/`refunds` found **zero hits**. Refund-adjacent logic that does exist: `capture-milestone-payment` action=`'cancel'` calls `stripe.paymentIntents.cancel()` (voids an *uncaptured* authorization — not a refund of captured money) and `release-escrow` action=`'dispute'` only sets `marketplace_orders.status='disputed'` plus a notification to the seller — there is no function anywhere that processes a dispute to resolution or issues an actual Stripe refund on a captured charge. If a captured milestone or marketplace payment needs to be reversed today, it would have to be done manually in the Stripe dashboard with no corresponding app-side record of the reversal.

---

## Findings confirmed FIXED (independently re-verified against current code, not just prior documents' word)

To avoid re-raising stale alarms, these were checked by reading the actual current file — all are genuinely closed:

- **`verify-circle-payment`** (was: zero Stripe interaction, free-membership exploit) — now retrieves the real session and checks `payment_status==='paid'`, `metadata.type==='circle_subscription'`, `metadata.circle_id===circleId`, **and** `metadata.buyer_id===user.id` (`index.ts:51-65`). Fixed.
- **`thrivefund-release-milestone`** (was: no idempotency on real `stripe.transfers.create`) — now reserves a row in `thrivefund_milestone_releases` (composite PK on `campaign_id, milestone_index`) *before* calling Stripe, plus a deterministic `idempotencyKey: thrivefund_milestone_${campaignId}_${milestoneIndex}` on the transfer call itself, with rollback of the reservation on a genuine Stripe error (`index.ts:93-148`). Fixed, and more thoroughly than the minimum (two independent guards).
- **`verify-founder-payment`** (was: no check the Stripe session belongs to the caller) — `index.ts:68`: `if (session.metadata?.user_id !== user.id) { ... }`. Fixed.
- **`create-milestone-payment`** (was: no ownership check before building a checkout session for an arbitrary milestone) — `index.ts:96-108` now loads the milestone's project and requires the caller be `client_user_id` or `created_by`. Fixed.
- **`milestones.status`/`invoices.status` self-attestation** (was: any project collaborator / the issuer could set `status='paid'` via a raw client `.update()`) — both columns are now `REVOKE`d from `authenticated`/`anon` (`20260812071205...sql:427,488`), with `confirm_milestone_paid_offline`/`confirm_invoice_paid_manually` `SECURITY DEFINER` RPCs as the only write path, each with a real ownership check. Fixed (invoice path is still issuer-self-attested by design — see the invoices row in §5's table — but the column-tampering vector specifically is closed).

---

## Which flow is canonical

**`/thrivepay` (`src/pages/ThrivePay.tsx`) is the canonical, currently-shipped consumer-facing KrePay surface**, already condensed to 3 tabs as expected going into this audit. It is wired to: `wallet-topup`/`wallet-topup-confirm`/`wallet-transfer`/`wallet-balance` (Kretopia Wallet internal ledger), `create-payment-link-checkout`/`payment-link-info` (Get Paid tab), `AccountingDashboard`→`InvoiceGenerator` (Activity tab, invoices/quotes/expenses), and `create-connect-account`/`check-connect-status`/`create-connect-login-link`/`get-connect-balance`/`wallet-payout` (Payouts & Fees tab).

**Milestone/escrow payments are a second, real, live-wired flow — not dead code — but live outside `/thrivepay`**, inside a project's Desk workspace (`FinanceHub.tsx:349` → `MilestoneBoard.tsx`, unconditionally rendered). The two flows share underlying tables (`invoices`, `transactions`) so milestone payments surface back on `/thrivepay`'s Activity tab, but a user only reaches milestone/escrow creation through a project, not through `/thrivepay` directly. **`H2` from the prior audit is confirmed still accurate**: `src/config/kretopiaV1.ts:30` declares `krePayAdvanced: { on: false, ... }` with a comment that escrow/milestones should be off for V1, but `isV1('krePayAdvanced')` has zero call sites anywhere — the flag gates nothing, and the full escrow create/capture/cancel/batch-payout UI is live for every user today regardless of the flag's value.

The dozen or so *other* Stripe-touching functions (`checkout-event-tickets`, `join-paid-circle`, `thrivefund-*`, `guest-wallet-*`) are real, live, wired-up flows too, but they belong to adjacent features (events, Circles, ThriveFund crowdfunding, guest checkout) — not KrePay itself.

---

## Dead / duplicated payment code

| Function/file | Status | Evidence |
|---|---|---|
| `supabase/functions/create-payment/index.ts` | **Dead** — no frontend caller, no webhook branch consumes its metadata | `grep -rn "create-payment" src/` (exact-name invoke) → 0 hits |
| `supabase/functions/create-connect-payment/index.ts` | **Dead** — no frontend caller | `grep -rn "create-connect-payment" src/` → 0 hits |
| `supabase/functions/get-payment-intent/index.ts` | **Unused** by any current frontend caller found, but read-only/harmless if it stays | `grep -rn "get-payment-intent" src/` → 0 hits |
| `batch-milestone-payout`'s non-escrow combined-checkout path | **Functionally dead-ended** (reachable, takes payment, never completes) | See §6 finding 6 |
| `create-escrow-payment` / `capture-escrow-payment` | **Already deleted** — removed in a prior session (`SECURITY_RELEASE_GATE.md` M1, commit `c86d0ca7`) after the same client-controlled-amount pattern now seen in `create-connect-payment`/`create-payment` was found in these two. **Recommendation**: apply the same deletion to `create-payment` and `create-connect-payment` rather than leaving them as the one precedent not followed through on. |
| `create-payment` vs. `wallet-topup`+`wallet-topup-confirm` | Duplicated concept — `create-payment` is a superseded, cruder version of the properly-built top-up pair (no persisted topup record, no re-verification step, no wallet credit on completion). |

---

## Actions that require production access (could not be verified from code alone)

1. **Stripe key mode (test vs. live)** — see §0. Code cannot prove this either way; the only evidence is a prior session's recorded user confirmation of "live mode" (`EMAIL_STRIPE_SANDBOX_QA.md`, 2026-08-18). Re-confirm via the Stripe dashboard (Developers → API keys) or `supabase secrets list` cross-referenced against which key was pasted in.
2. **Whether `stripe-marketplace-webhook`, `stripe-wallet-webhook`, and `guest-wallet-webhook` are actually registered as three separate webhook endpoints in the live Stripe dashboard**, each with a signing secret matching the three different env-var names used (`STRIPE_MARKETPLACE_WEBHOOK_SECRET`, `STRIPE_WALLET_WEBHOOK_SECRET`, `STRIPE_WEBHOOK_SECRET`). A misconfigured or missing endpoint would silently mean certain payment confirmations never fire, with no error visible in this codebase.
3. **Whether the two dead functions (`create-payment`, `create-connect-payment`) are still actually deployed** to the live Supabase project, vs. only present as source in this repo. Deleting the source file does not by itself undeploy an already-live function (noted as a caveat in `SECURITY_RELEASE_GATE.md` M1 for the functions that *were* deleted) — confirming current deployment status requires `supabase functions list` or dashboard access.
4. **Whether `wallets.balance`/`creator_wallets.payouts_enabled` (findings #1/#2) have ever actually been exploited** — this requires a database audit-log or query against production data (e.g., any `wallets` row whose `balance` doesn't reconcile against the sum of its `wallet_topups`/`wallet_transfers` history), which this static-code audit cannot perform.
5. **The Stripe sandbox test matrix** (successful payment, declined card, webhook replay, duplicate-click) that a prior session (`FINAL_SECURITY_EMAIL_PAYMENT_QA.md` Phase 6) flagged as blocked — still blocked, still needs a human with Stripe test-mode dashboard access.
6. **Applying the RLS fix for findings #1 and #2** — per this audit's own operating rules, writing/applying RLS or migration changes is out of scope for a read-only audit; the fix (column-level `REVOKE` + `service_role`-only RPC, mirroring the pattern already used correctly for `wallet_transfers` and `milestones.status`) needs a deliberate migration reviewed and applied by a human with database access, the same way the two related migrations in this repo already were.
