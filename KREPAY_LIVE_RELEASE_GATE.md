# KrePay — Live Release Gate

Project: Kretopia · ref `kwmcocsitwssrtzkdojh` · updated 2026-08-23
**Gate status: CLOSED — BLOCKED_STRIPE_DASHBOARD_ACCESS.**
Stripe LIVE mode was not enabled. No payment object of any kind was created.

## Update 2026-10-28: payment readiness pass

**Gate status: CLOSED, BLOCKED by the Stripe account itself.** Production changes made: NONE. No payment object was created, no live write was made, nothing is deployed.

**Baseline.** Repo `Kretopia/kretopia-connect` main `bf51a0511`. Published SHA: UNKNOWN (`version.json` is a random per-build hash, live `6bd29d291bbf9706`; it cannot be mapped to a commit). Live Supabase `kwmcocsitwssrtzkdojh`; the functions are pasted into the Lovable project `kretopia-app` (last edit 2026-10-22). Deployed copy of `stripe-marketplace-webhook` matches the repo (ledger release present); the other functions were not diffed.

**Evidence (read-only GETs with the logged-in Stripe CLI, live mode, account `acct_1GweNPJvOS7zG18h`, Thrive Collective LTD, GB).**
- `charges_enabled=false`, `payouts_enabled=false`, `details_submitted=true`; `card_payments` and `transfers` inactive (Klarna and Przelewy24 active). The API does not return `requirements` for a platform's own account, so the reason is only in the Dashboard. Last `account.updated` events: 2026-10-08.
- Available balance EUR -1,405.47 (negative), GBP 0.10. Default currency EUR; all prices are USD.
- Live webhook endpoints registered: **0** (`GET /v1/webhook_endpoints` empty), while the deployed handlers answer `400 No signature` (the secret names exist).
- All 9 live Price IDs in `subscriptionPrices.ts` exist, are active and match the amounts (Pro 29/mo, 278/yr; Creator Pro and Brand Pro 59/mo, 566/yr; Brand Enterprise 129/mo, 1,238/yr; Founder Circle 199 one-time). Product ids match `check-subscription`'s tier map.
- Last live charge 2026-04-22; newest live Checkout Sessions expired unpaid (2026-05-21). Checkout offers card, Link, Apple/Google Pay, Klarna, TWINT, BLIK, EPS, Bancontact: no delayed-settlement method, so `checkout.session.async_payment_*` is not needed today.
- Connected Express accounts sampled (5 of more): all with charges and payouts disabled.
- Production probe (unauthenticated, no side effect): 13 payment functions deployed; the 3 webhooks refuse an unsigned POST; anonymous REST reads of 11 payment and wallet tables (invoices, milestones, orders, wallets, guest wallets, founder purchases, the webhook ledger and others) return `[]` or permission denied (`payment_links` active rows and `digital_products` are public by design).

**Flows.** Kretopia subscriptions and Founder Circle: UI, `create-checkout` / `create-founder-checkout`, Stripe, then `check-subscription` / `verify-founder-payment` read Stripe's own state (no webhook needed). Invoices, payment links, milestones, escrow and marketplace: UI, checkout functions, Stripe, `stripe-marketplace-webhook` (signed, mode-guarded, event ledger), database. These need live webhook endpoints.

**Changes (branch `fix/payments-live-ready`, not deployed).**
- Founder Circle: activation was only triggered by the buyer landing on `/payment-success`, so a buyer who paid and closed the tab stayed `pending` and free; two verifications at once both completed the row and both paid the 5,000 XP. New `_shared/founderActivation.ts`: one conditional claim (`status <> 'completed'`), tier and bonus exactly once, claim given back if the tier write fails, duplicate pending rows collapsed, recovery from Stripe's own record inside `check-subscription`. `verify-founder-payment` answers 401 (was a crash, 500) without an Authorization header.
- Tests: `founderActivation.test.ts` (17, three mutations each fail the right tests) and `edge/marketplaceWebhookScenarios.test.ts` (13, against the real handler with a fake Stripe and in-memory database): success, unpaid/delayed, duplicate event, retry after a failed write, decline, cancellation, out-of-order, refund and dispute without touching project status, no signature, forged signature, test event on a live deployment.
- Sandbox matrix against real Stripe test mode: NOT RUN (no deployed test environment; production is live and refuses test events by design).

**Blockers and next actions.**
1. Stripe account owner (Thrive Collective LTD): open Dashboard, resolve the restriction behind `charges_enabled=false` (Action required banner / Settings, Business, Verification), cover the negative EUR balance, add a payout bank account, update the business website and statement descriptor (`www.keepthrivein.com`, `WWW.KEEPTHRIVEIN.COM`) to the Kretopia site. Collection cannot open before this; a Payment Link on the same account is blocked by the same restriction.
2. Approval to deploy (paste order): `_shared/founderActivation.ts`, `check-subscription`, `verify-founder-payment`. Rollback: paste the previous versions from `bf51a0511`.
3. Separate approval, only for invoice, milestone, escrow, marketplace and wallet flows: register 3 live endpoints (`stripe-marketplace-webhook`, `stripe-wallet-webhook`, `guest-wallet-webhook`) and store their signing secrets under `STRIPE_MARKETPLACE_WEBHOOK_SECRET`, `STRIPE_WALLET_WEBHOOK_SECRET`, `STRIPE_WEBHOOK_SECRET`.
4. Product decision, not mine: which product opens first, at what price; funds destination of invoices, payment links and milestones (platform account versus connected account, application fee, payout after capture; open since #196 and #203).
5. First controlled live charge: written human approval, as below. Fees unconfirmed.

**Noted, not changed.** Founder cap (1,000) counts completed rows only, so concurrent pending sessions can oversell. Eleven other functions return 500 instead of 401 when called without an Authorization header (`get("Authorization")!`; fail-closed). The $29 Stripe product is still named "Creator Pro" while the app calls the tier "Pro".

## Update 2026-10-28 (second pass): engineering gaps A to F, Stripe set aside

Branch `fix/engineering-gaps-a-f` from `main` `e9880cd8e`. Production changes made: NONE. Nothing is deployed, no migration is applied.

| Item | Confirmed gap and evidence | Change |
|---|---|---|
| E. AI quotas | `consume_copilot_message`, `consume_studio_ai_generation`, `consume_ai_feature_call` read the count, then incremented. On a throwaway Postgres 16, 40 parallel calls at a cap of 5 let through 17, 40 and 7. | Migration `20261028120000_atomic_ai_quota_consume.sql`: one conditional upsert; exactly 5 on all three. A NULL cap now denies (it passed as unlimited). |
| D. Credit provenance | `guard_credit_verification_escalation` blocked INSERT of `verified` / `auto_discovered` only: a signed-in user could insert credits already `peer` with an endorsement count and a verifier name. Throwaway Postgres: allowed before, refused after. | Migration `20261028130000_guard_credit_trust_fields_on_insert.sql`; `verification_url` / `ai_confidence` untouched (importers write them). |
| C. Hidden write failures | Writes rejected by CHECK constraints and ignored: `manual` (sign-up credit claim, dropped from sessionStorage first, logged "Auto-attached"), `imported` (4 import functions, credits), `ai_imported` (onboarding AI discovery and portfolio import). | `pendingCreditClaim.ts` (allowed status, error read, claim kept on failure, no duplicate), statuses `auto_discovered` / `pending_review` / `imported` (awards); `creditStatusWrites.test.ts` reads the latest constraint of credits, awards and press_links. |
| A. Access | `redeem-project-guest-link`: use limit and revocation checked on a read, counter written from it. Real handler: single-use link + 5 at once admitted 5; cap 3 + 10 admitted 10; unlimited + 8 counted 1; revoked in flight admitted. `accept-project-invitation` overwrote a row the owner had just removed back to accepted. | Use reserved by a compare-and-swap before access is granted (bounded retry); acceptance requires `status = pending` (404 `no_invitation` on a lost race). |
| F. Hiring to Studio | `SimpleProjectChat` invited @mentions with role `collaborator`, which `project_collaborators_role_check` rejects: the invite never worked. `copilot-executor` and `desk-agent` inserted an `owner` row (also rejected, error ignored). | Role `member`; the dead `owner` writes removed (owner is derived from `projects.created_by`); `collaboratorRoleWrites.test.ts`. The match and template hire dialogs check every write. |
| B. Recordings | Webhook already checks freshness, validates the room name before any filter, claims one row per recording id and requires explicit `true` consent; their tests pass. | No change. |

**Evidence.** Typecheck, build and lint (3,730 problems) identical to the baseline; 2,631 tests pass (45 new) plus the one existing `VoiceFirstCreateModal` failure. Each new test was mutation-checked against the old behavior.

**To deploy (all manual, none done).**
1. Frontend publish: `AuthContext`, `SimpleProjectChat`, the two onboarding steps. No migration needed first.
2. Edge functions by paste (none imports a new shared file, any order): `redeem-project-guest-link`, `accept-project-invitation`, `import-profile-from-url`, `bulk-import-profiles`, `import-odos-members`, `auto-discover-creatives`, `copilot-executor`, `desk-agent`.
3. Two migrations, each needing your exact-scope approval, then the read-only check: `security/verify-atomic-ai-quota-2026-10-28.sql`, `security/verify-credit-trust-guard-2026-10-28.sql`. Rollback is in each migration header.

**Product notes, not decided here.** Credits imported from an AI-discovered profile in onboarding are filed `pending_review` (a user JWT cannot write `auto_discovered`); say so if you want another rung. Real AI caps stay a product decision (call sites still pass -1 except Copilot).
**Noted, not changed.** `findCallByRoom` interpolates the room name into an `ilike` where `_` is a wildcard (names are `[A-Za-z0-9_-]`, generated names contain none). `payment_links.use_count` in the marketplace webhook is a read-then-write (payments set aside). `createEventStudio` does not check for an existing Studio of the event (single caller).

## Gate matrix

| Gate condition | Status |
|---|---|
| Wallet security migration applied | PASS |
| Negative wallet tests pass (privilege matrix) | PASS |
| Privilege state stable (no drift) | PASS |
| Notification migration applied | PASS |
| acceptance → Studio → notification flow passes | PASS (12-case matrix) |
| Stripe secret inventory complete | PASS (`KREPAY_STRIPE_SECRET_INVENTORY.md`) |
| No Stripe secret in frontend / `.env` / Git history / build output | PASS |
| Webhook handlers read raw body before parsing | PASS (all 3) |
| Webhook handlers fail closed on invalid signature | PASS (all 3) |
| Webhook handlers fail closed on missing secret | PASS (all 3) |
| Database event-ID deduplication on all webhook handlers | PASS (all 3) |
| Automated signature / replay / dedupe tests | PASS (9/9, offline) |
| Server-side amount & currency derivation | PASS |
| Payer / project / milestone authorization | PASS |
| Stripe idempotency keys on Checkout Session creation | **FAIL — missing on 5 session creators** |
| Test-mode Stripe key configured (`STRIPE_SECRET_KEY_TEST`) | NOT CONFIGURED |
| Test webhook endpoints registered | NOT CONFIGURED |
| Test webhook signing secrets stored | NOT CONFIGURED |
| Sandbox payment matrix executed | NOT RUN (blocked) |
| Live/test key mode separation | **FAIL — one secret name serves both modes** |
| Live webhook endpoints exist | NOT CONFIGURED |
| Live webhook secrets match live endpoints | NOT CONFIGURED |
| Production URLs verified | PASS (`https://kretopia.com`, `https://www.kretopia.com`) |
| Payout / Connect configuration complete | PARTIAL — stack exists, unverified end-to-end |
| Human approval for a live charge recorded | NOT RECORDED |

## Ordered path to open the gate
1. Stripe account owner recovers Dashboard access.
2. Owner completes `KREPAY_STRIPE_DASHBOARD_RUNBOOK.md` sections B–E (test mode only).
3. Engineering adds mode separation: functions prefer `STRIPE_SECRET_KEY_TEST` when the
   project is in test mode, so a live key can never serve a sandbox run.
4. Engineering adds deterministic `idempotencyKey` values to the five Checkout Session
   creators (`create-payment`, `create-connect-payment`, `create-invoice-checkout`,
   `create-milestone-payment`, `create-payment-link-checkout`).
5. Run the full sandbox matrix (success, decline, 3DS, refund, duplicate delivery,
   replay, out-of-order, Connect payout) and record results.
6. Only after 1–5 are green: register live endpoints, store live signing secrets, and
   obtain a separate, explicit, written human approval for a first controlled live charge
   (proposal: 1.00 USD, dedicated internal account, refunded within 10 minutes).

A live charge must never be executed from an automated prompt.
