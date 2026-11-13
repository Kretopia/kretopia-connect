# Payments, Credits, Ownership and IP Review — Kretopia

**Status:** Internal draft · **not** legal advice, **not** a compliance or AML assessment
**Review date:** 2026-11-13
**Legal markers:** any statement about what the law requires is marked **[LEGAL REVIEW REQUIRED]**.

> **Not legal advice.** Contract, IP and financial-regulatory conclusions require qualified counsel in each operating jurisdiction.

## Evidence limits

- Stripe account configuration, Radar rules, country settings and live prices were not inspected (no external system access).
- The deployed schema may differ from the repo; two drift signals are recorded below (PAY-08).
- No payment was executed. Idempotency and reconciliation conclusions are code-level.

**Status vocabulary:** *Implemented* = verified in the repository; *Partial* = incomplete; *Not implemented* = no control found; *Proposed* = recommended; *Out of scope* = not assessed.

---

## 1. What a user actually buys

**Verified in code:** Kretopia sells subscriptions, event/stage tickets, digital products, invoices, milestone/escrow work, and wallet top-ups. It does **not** sell a fungible currency:

- Wallet top-ups create a **stored balance** used for transfers and payouts (`wallet-topup`, `wallet-topup-confirm`, `wallet-transfer`, `wallet-payout`).
- A "credit" in the product sense is **portfolio attribution** — a role on a project — not a token (`supabase/migrations/20251001040029_e8d405a3-2a40-4e86-8eb1-49a0cf103544.sql:2-12`).
- A separate `wallets.credits` integer exists, is seeded at 10, is never spent, and is visible to its owner (`supabase/migrations/20250930110718_317c2f4c-5455-4bfa-a91f-54b9282081b8.sql:7,58-75`; `supabase/functions/wallet-balance/index.ts:22`).

**Product clarification (proposed, must be stated in UI and terms):** *A user purchases a defined role/job on a project, or a platform service (subscription, ticket, product, paid engagement). They do not purchase a fungible currency, and credits are not redeemable for cash.*

**Risk:** three unrelated meanings of "credit" (portfolio, wallet integer, AI usage) invite users and reviewers to read the wallet integer as money. The mentor's concern is therefore justified. **[LEGAL REVIEW REQUIRED]** on whether the stored balance is e-money or a limited-use prepayment instrument in each market.

---

## 2. How credits work today

### 2.1 Portfolio credits (attribution)
| Aspect | Status | Evidence |
|---|---|---|
| Created by owner or assigned on a project | Implemented | `supabase/migrations/20251001040029_*.sql:63-77` |
| Project attribution row | Implemented | `project_credits` (`supabase/migrations/20260307132546_*.sql:3-14`) |
| Assigned-by check | Partial — no project-access requirement on INSERT | `20260307132546_*.sql:30-32` |
| Credited user confirms | Implemented | `20260307132546_*.sql:35-38` |
| Dispute → ownership transfer | Implemented but automated without human approval | `supabase/functions/auto-resolve-disputes/index.ts:26-49` |
| Verification badge | Implemented; AI writes confidence only, not the badge | `supabase/functions/verify-credit/index.ts:131-151` |
| Expiry / transfer between users / sale | **Not implemented** | no code path found |

### 2.2 Wallet balance
| Aspect | Status | Evidence |
|---|---|---|
| Server-only debit/credit | Implemented for UPDATE | `wallet_debit` / `wallet_credit` are SECDEF and service-role only (`supabase/migrations/20260804103153_*.sql:75-78`) |
| Client can create its own wallet | **Vulnerable** | INSERT policy survives (`20250930110718_*.sql:34-36`); client does it (`src/components/WalletCard.tsx:33-36`) |
| Client can create transaction rows | **Vulnerable** | `20250930110718_*.sql:47-49` |
| Transfer limits | Implemented | `check_transfer_limit`, `wallet_transfer_limits` (`supabase/migrations/20260306101009_*.sql`) |
| Transfer idempotency | Implemented (code) but column not tracked in migrations | `wallet-transfer/index.ts:85-117` |
| Payout requires Connect `payouts_enabled` | Implemented | `wallet-payout/index.ts:31-35` |
| Negative balance | Prevented by CHECK + `balance >= amount` | `20260804103153_*.sql:43` |
| Statement / export | **Not implemented** | — |
| Balance ↔ Stripe reconciliation job | **Not implemented** | — |

**P0:** §2.1/§2.2 show that a signed-in client can create its own wallet and transaction rows with arbitrary values. Until SEC-01/SEC-02 are fixed, no statement about balance integrity is supportable.

---

## 3. Project ownership and permissions

| Question | Answer (verified) | Evidence |
|---|---|---|
| Who owns a project? | `projects.created_by`; immutable through the API since 2026-10-19 | `supabase/migrations/20261019120000_guard_project_created_by.sql` |
| Who is a member? | `project_collaborators` with roles `member \| client \| creative \| guest` | `supabase/migrations/20260825100000_studio_role_based_money_rls.sql:69-81` |
| Does a pending invite grant access? | No — explicitly excluded | `supabase/migrations/20261009090200_studio_pending_invitees_and_collaborator_writes.sql:38-63` |
| Who can invite? | Re-derived from DB, role-limited, rate-budgeted | `send-project-invitation/index.ts:127-166` |
| Who can accept? | Signed-in user with confirmed email matching the invite | `accept-project-invitation/index.ts:58-82` |
| Who can change settings? | Owner/client for commercial and owner columns | `20261020130000_guard_project_payer_columns.sql`; `20261021100000_guard_project_owner_columns.sql` |
| Who can accept a deliverable? | **Any accepted member** | `supabase/migrations/20260211050740_*.sql:116` |
| Who can delete a project? | Owner via `copilot-collaborator-tools` (approval-gated) or direct owner policy; no "owner cannot be removed" guard | `copilot-collaborator-tools/index.ts:451-514` |
| Ownership transfer | **Not implemented** | no function found |
| Company/workspace layer | Exists as an org workspace, not project ownership | `supabase/migrations/20260912130000_minimal_org_workspace_layer.sql:42` |

**P1:** acceptance is not separated from delivery. Add an approver role and record acceptance in the audit trail.

---

## 4. Payment flows and Stripe integration

### 4.1 Implemented controls (verified)
- **Server-side price resolution:** subscriptions map tier → server-known Price ID (`create-checkout/index.ts:31-37`); invoices charge the stored total (`create-invoice-checkout/index.ts:33,56-59`); milestones read the amount from the DB (`create-milestone-payment/index.ts:60-66,105-124`); payment links are bounded per link (`create-payment-link-checkout/index.ts:41-52`).
- **Auth before payment:** checkout requires a verified user (`create-checkout/index.ts:27-29`); escrow release requires the buyer (`release-escrow/index.ts:60`); offline payment self-attestation is payer-or-owner (`supabase/migrations/20260812071205_*.sql:429-478`) and invoice self-report is issuer-only (`:490-527`).
- **Webhook integrity:** HMAC + timestamp tolerance (`_shared/stripeSignature.ts`), ledger claimed before processing and released on failure (`_shared/webhookLedger.ts:25-43`), CAS escrow transitions (`stripe-marketplace-webhook/index.ts:194-267`).
- **Idempotency keys:** checkout, transfer, payout (`create-checkout/index.ts:84-86`; `wallet-payout/index.ts:54,60`).
- **Payout gating:** Connect `payouts_enabled` required (`wallet-payout/index.ts:31-35`).
- **Bank validation:** country allowlist + IBAN checksum (`wallet-add-bank/index.ts:13-21,52-77`).

### 4.2 Gaps

| ID | Sev | Gap | Evidence | Risk |
|---|---|---|---|---|
| PAY-01 | **P0** | No documented credit taxonomy or user-facing statement of what is purchased, while three "credit" concepts coexist and one is client-writable | §1, §2 | Users may believe they bought currency; refunds, chargebacks and consumer complaints become unanswerable |
| PAY-02 | **P1** | Refunds are notification-only; no refund/dispute state machine, ledger or operator tooling | `stripe-marketplace-webhook/index.ts:749-783` | Paid state persists after refund; entitlement and payout drift; no audit trail |
| PAY-03 | **P1** | No handlers for subscription lifecycle, failed invoices, failed payouts, closed disputes, early fraud warnings | event switch in `stripe-marketplace-webhook`; `check-subscription` | Stale entitlements; failed payouts unnoticed; fraud signals ignored |
| PAY-04 | **P1** | No reconciliation job between Stripe and the database | not found | Undetected imbalance; no evidence for audits or fundraising diligence |
| PAY-05 | **P1** | Escrow/milestone release has no deliverable-acceptance dependency | `release-escrow` confirms on buyer action; deliverables accept any member | Buyer can release without an accepted deliverable, or a member can accept on the buyer's behalf |
| PAY-06 | **P1** | No refund request/approval workflow or evidence upload for chargebacks | not found | Manual, undocumented handling; missed provider deadlines |
| PAY-07 | **P1** | Hardcoded commercial rates in code: 10% manager commission, 15% platform fee | `stripe-marketplace-webhook/index.ts:410-412,635-646` | Fee changes require a deploy; no per-market configurability or disclosure link |
| PAY-08 | **P2** | Schema drift: `transactions.type` CHECK rejects values written by wallet functions; `wallet_transfers.idempotency_key` has no migration | `20250930110718_*.sql:18`; `wallet-transfer/index.ts:95,105` | Runtime failure or untracked production schema |
| PAY-09 | **P2** | `wallet-topup` WiPay path is a stub returning "coming soon" | `wallet-topup/index.ts:53` | Incomplete alternative payment method; must not be advertised as available |
| PAY-10 | **P2** | Batch milestone payout has a documented historical reconciliation bug | `_shared/batchPayout.ts:13,51`; `batch-milestone-payout/index.ts:73,169` | Old sessions may never reconcile; needs a one-off audit |

### 4.3 Refunds, disputes, reconciliation

| Process | Status |
|---|---|
| Refund issued in Stripe → DB state | **Notification only** (`stripe-marketplace-webhook:749-783`) |
| Buyer-initiated dispute on an order | Implemented: `disputed` + reason + notify (`release-escrow:132-161`) |
| Chargeback evidence | **Not implemented** |
| Commission clawback on transfer reversal | Implemented (`stripe-marketplace-webhook:818-832`) |
| Product entitlement after refund | Implemented (`get-download-urls:90`; `_shared/purchaseEntitlement.ts:37-51`) |
| Event ticket refunds | **Out of band**, explicitly (`_shared/ticketPurchase.ts:7`) |
| Monthly Stripe ↔ DB reconciliation | **Not implemented** |

---

## 5. Fraud, sanctions and money-laundering risk

| Control | Status | Evidence |
|---|---|---|
| Identity verification (KYC) | Delegated to the payment provider's Connect onboarding only | `creator_wallets.kyc_status` (`20260528125850_*.sql:6`); `check-connect-status:62-113` |
| Payout eligibility gated on provider verification | Implemented | `wallet-payout:31-35` |
| Country allowlist | Implemented for **bank linking only** (8 countries): US, CA, GB, AU, DE, FR, NL, ES | `wallet-add-bank:13-21,98-99` |
| Sanctions / PEP / OFAC screening | **Not implemented** | no code found |
| AML transaction monitoring / SAR workflow | **Not implemented** | no code found |
| Velocity limits | Wallet transfers only | `wallet_transfer_limits` (`20260306101009_*.sql`) |
| Device fingerprinting / IP risk | **Not implemented** | — |
| Stripe Radar rule configuration | **Not visible in repo** | — |
| User/country denylist at signup or checkout | **Not implemented** | — |
| Fraud/abuse review queue | **Not implemented** | — |

**Assessment:** the platform's money-movement surface (wallet top-up → transfer → payout, plus escrow and invoices) is exposed to classic layering patterns: multiple accounts, small transfers, payout to a verified-but-not-genuinely-owned account, and refund/chargeback abuse. Current controls are provider-default KYC plus a per-transfer limit. That is **not** a money-laundering control programme. **[LEGAL REVIEW REQUIRED]** on registration/licensing obligations and on whether the platform is a payment intermediary in each market.

**P0 (product decision, not a code change):** do not enable new wallet/payout capabilities until PAY-01 and SEC-01/SEC-02 are resolved, and until a documented risk assessment exists.

---

## 6. IP treatment

| Question | Current state | Evidence |
|---|---|---|
| Platform IP | Terms assert Kretopia and licensors retain platform rights; no repo `LICENSE`; `package.json` `"private": true` | `src/content/legal/terms.ts:233-247`; `package.json:2` |
| User content ownership | User retains ownership; grants a non-exclusive operational licence | `src/content/legal/terms.ts:106-120` |
| Work-product ownership between users | **Not established.** A generic contract builder has a `work_for_hire` label but no clause text, no assignment, no moral-rights waiver | `src/components/project/contracts/ContractBuilder.tsx:26-49`; `supabase/migrations/20260410004947_*.sql:43-66` |
| Host-only modification/acceptance | **Not established.** Any member can edit deliverables; no host-only acceptance | `20260211050740_*.sql:110-119` |
| Project retention after engagement | **Not established.** No retention rule or export-on-exit | no code found |
| Pre-existing work / background IP | **Not addressed** | no clause text |
| Contributor licence agreement (platform contributors) | **Not found** | grep across `docs/` and `src/` |
| Terms acceptance record | **Not found** | no column, no clickwrap, no timestamp |
| AI-generated content ownership | Terms describe AI features generally; no ownership or training position | `terms.ts:189-212`; `LEGAL_PUBLICATION_NOTES.md:5` |

**Recommendation (product + legal):** state the default clearly and make it a first-class project setting, not a blank contract field: *the host/client retains ownership of project IP unless a written agreement says otherwise; contributors retain pre-existing work and grant a licence for the project; acceptance is host-only.* **[LEGAL REVIEW REQUIRED]**

---

## 7. Contract outline (draft — requires legal review)

The full draft outline is in `docs/security-compliance/terms-and-ip-draft.md`. Summary of the seven required areas:

1. **Project ownership** — who owns the project container, the brief, and the outputs; default rule; transfer on payment.
2. **Contributor IP** — pre-existing work, licence grant, moral rights, AI-assisted output, third-party assets.
3. **Confidentiality** — what is confidential, carve-outs, duration, return/destruction.
4. **Acceptable use** — prohibited content, fraud, scraping, impersonation, AI misuse.
5. **Liability** — cap, exclusions, consumer-law carve-outs.
6. **Termination** — suspension, deletion, data export window, surviving clauses.
7. **Dispute handling** — negotiation, escalation, platform-assisted resolution, governing law/forum.

---

## 8. Prioritised remediation list

### P0
| ID | Action | Files / systems | Acceptance |
|---|---|---|---|
| PAY-01 | Publish a one-page credit taxonomy and align UI labels: "credit = role attribution", "wallet balance = prepaid platform balance", "AI credits = usage allowance". Freeze new wallet/payout activation until done. | product copy, `src/components/WalletCard.tsx`, `wallet-*` functions, terms | No surface calls a portfolio credit "currency"; support can answer "what did I buy" from the terms |
| SEC-01/02 | Server-only wallet and transaction writes | see security review | Client insert returns 403 |

### P1
PAY-02, PAY-03, PAY-04, PAY-05, PAY-06, PAY-07; deliverable approver role; terms-acceptance record; contributor IP clauses; refund/dispute workflow; sanctions screening decision.

### P2
PAY-08, PAY-09, PAY-10; wallet statement/export; fee configurability; multi-currency/tax determination.

---

## 9. Open questions requiring legal and financial review

1. Is the stored wallet balance e-money, a limited-use prepayment instrument, or neither, in each market? **[LEGAL REVIEW REQUIRED]**
2. Does operating escrow between users require a licence or a regulated partner? **[LEGAL REVIEW REQUIRED]**
3. What KYC/AML programme is proportionate, and does the platform rely entirely on the payment provider? **[LEGAL REVIEW REQUIRED]**
4. Which sanctions lists apply, and at what threshold is screening required? **[LEGAL REVIEW REQUIRED]**
5. What is the default IP position, and is a separate contributor agreement needed? **[LEGAL REVIEW REQUIRED]**
6. Consumer withdrawal rights vs. bespoke work and digital content. **[LEGAL REVIEW REQUIRED]**
7. Tax treatment of platform fees, commissions and payouts. **[LEGAL REVIEW REQUIRED]**
