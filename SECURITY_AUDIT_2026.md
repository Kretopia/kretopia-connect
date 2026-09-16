# Kretopia Security Audit — Phase 1 (30-Day Stabilize)

Date: 2026-06-22  
Scope: RLS · JWT verification · Admin guard · Wallet/payment flows  
Status: **AUDIT — no fixes applied yet. Awaiting approval before Phase 1 remediation migration.**

---

## 0. Headline Numbers

| Metric | Count |
|---|---|
| Public tables total | 295 |
| Tables with RLS **enabled but ZERO policies** | **6** 🔴 |
| Edge functions total | 291 |
| Edge functions with no `getClaims()` / no admin guard | **~190** ⚠️ (review category) |
| Edge functions with `verify_jwt = false` in `config.toml` | 8 (intentional public/webhook) |
| Cron/admin functions reading `CRON_SECRET` **without** `requireAdminOrCron` | **11** 🟠 |
| Functions using `requireAdminOrCron` correctly | 12 ✅ |
| Linter findings | 468 (mostly `function_search_path_mutable` WARN) |
| Security scanner findings | 462 |

---

## 1. RLS Audit

### 1.1 🔴 CRITICAL — Tables with RLS enabled but **no policies** (fully locked to clients, but exposed to any caller using service role; risk = silent data path failures + future policy regressions)

| Table | Why it matters | Recommended posture |
|---|---|---|
| `stripe_webhook_events` | Idempotency log for Stripe webhooks. Writes only via service role in `stripe-wallet-webhook` / `stripe-marketplace-webhook`. | Add **explicit deny** policy `USING (false)` for `anon`/`authenticated` (defense in depth). Service role bypasses RLS anyway. |
| `guest_wallets` | Guest-mode wallet ledger (anonymous IRL event flow). | Currently accessed only via service role in `guest-wallet-*` fns. Add explicit deny policy + document service-role-only. |
| `guest_wallet_sessions` | Token → wallet mapping. | Same — explicit deny, service-role-only. |
| `guest_wallet_topups` | Stripe topup records. | Same. |
| `guest_wallet_transactions` | Spend ledger. | Same. |
| `telegram_messages` | Inbound Telegram bot messages. | Same — bot writes via service role, no client access. |

**Action proposed:** one migration adding `REVOKE ALL ... FROM anon, authenticated` + a single `CREATE POLICY "service role only" ... USING (false)` per table. This makes intent explicit and prevents the "RLS enabled, no policy" silent-deny pattern that hides future RLS regressions from the linter.

### 1.2 🟡 Linter warnings (lower priority)

- **468 linter issues**, of which the dominant categories are:
  - `function_search_path_mutable` (WARN) — hundreds of DB functions without `SET search_path = public`. Real exploit risk requires a search_path manipulation in the role's session — low for our setup, but standard to fix. Recommend batch migration in Phase 1 close-out (mechanical `ALTER FUNCTION ... SET search_path = public`).
  - `rls_policy_always_true` (WARN) — a small number of `USING (true)` policies on UPDATE/DELETE/INSERT. Need column-by-column review (deferred to Phase 1.b after this report is approved).

### 1.3 No tables found with RLS **disabled** in `public` ✅

---

## 2. JWT Verification Audit

### 2.1 Intentional public functions (`verify_jwt = false` in `supabase/config.toml`) — 8 total

| Function | Purpose | Auth model | Status |
|---|---|---|---|
| `epk-og-image` | OG image render for public EPK | Public read | ✅ OK |
| `event-og-image` | OG image render for public events | Public read | ✅ OK |
| `redeem-video-guest-link` | Guest call link redemption | Token validated in code | ✅ OK |
| `send-activity-digest` | Cron | `CRON_SECRET` check | ⚠️ should use `requireAdminOrCron` |
| `send-notification-email` | Internal/webhook | Service-role caller | ⚠️ verify signature/secret in code |
| `send-streak-warning` | Cron | `CRON_SECRET` | ⚠️ should use `requireAdminOrCron` |
| `transcribe-call` | Daily.co webhook | Daily signature should be validated | 🟠 **verify Daily signature exists** |
| `stripe-wallet-webhook` (implicit) | Stripe webhook | Stripe `constructEventAsync` ✅ + idempotency via `stripe_webhook_events` ✅ | ✅ OK |

### 2.2 🟠 Functions without `getClaims()` AND without admin guard — 50 sampled / ~190 estimated

Many of these are **correctly public** (webhooks, AI fan-outs called from edge), but the audit cannot tell intent from grep alone. Recommended action: add a one-line CSV manifest `supabase/functions/_manifest.ts` annotating each function as `public | user | admin | cron | webhook`, and a CI check that fails when a `user` function lacks `getClaims()`. **Defer the actual classification sweep to Phase 1.b** — produce the manifest skeleton in this phase.

High-risk functions to spot-check immediately (handle money, identity, or PII):

- `create-checkout`, `create-payment`, `create-escrow-payment`, `create-milestone-payment`, `create-payment-link-checkout`, `create-connect-payment`, `capture-escrow-payment`, `capture-milestone-payment`, `checkout-event-tickets`, `checkout-stage-ticket`, `create-founder-checkout`, `create-invoice-checkout`, `customer-portal`, `batch-milestone-payout`
- `claim-and-create-profile`, `connect-platform`, `analyze-profile-url`
- `desk-agent`, `desk-ai`, `ai-pricing-copilot`, `ai-finance` (AI cost surfaces — must check user from JWT)

**Action proposed:** Phase 1.b spreadsheet (CSV) classifying each, then a follow-up PR adds `getClaims()` to anything labeled `user`.

### 2.3 ✅ The 8 explicit `verify_jwt = false` entries in `config.toml` are intentional and known.

---

## 3. Admin Guard Audit

### 3.1 ✅ Functions using `requireAdminOrCron` (12)

Correctly gated. No changes needed.

### 3.2 🟠 Cron/admin functions reading `CRON_SECRET` **directly** without the shared guard (11)

These work, but they each re-implement the check and may drift:

```
auto-outreach-watch
daily-match-digest
desk-daily-nudge
draft-outreach-email
inbox-triage-agent
money-agent-watch
process-drip-campaign
send-broadcast-email
send-founder-note-reminder
send-waitlist-invite
send-weekly-digest
```

**Action proposed:** mechanical refactor in Phase 1.b — replace each with `await requireAdminOrCron(req)`. Low risk, ~5 LOC per function.

### 3.3 Admin tables with proper `has_role(auth.uid(),'admin')` policies — spot-checked ✅

---

## 4. Wallet & Payment Security Review

### 4.1 `stripe-wallet-webhook` ✅

- Signature: `stripe.webhooks.constructEventAsync(body, sig, secret)` ✅
- Idempotency: inserts into `stripe_webhook_events` and aborts on duplicate ✅
- CORS scoped to `stripe-signature, content-type` ✅
- Service role used for ledger writes ✅

**Verdict: secure.**

### 4.2 `guest-wallet-webhook` ✅

- Signature validated against `STRIPE_WEBHOOK_SECRET` ✅
- Missing-signature/missing-secret → throws ✅
- Recommend: also insert into `stripe_webhook_events` for idempotency (currently only the main webhook does). **Action proposed.**

### 4.3 `guest-wallet-me` ✅ (read-only)

- Validates `x-guest-token` against UUID regex ✅
- Looks up session in `guest_wallet_sessions`, checks `expires_at` ✅
- Updates `last_used_at` ✅
- Service role used for read ✅

**No escalation path to a real wallet** — guest tokens only map to `guest_wallets`, never to `wallets` or `creator_wallets`. ✅

### 4.4 `wallet-add-bank`, `wallet-balance`, `wallet-payout`, `wallet-topup*`, `wallet-transfer` 🟡

Not deeply re-audited in this pass (already shipped under Wallet Phase 0 with `requirement_collection='stripe'`). **Action proposed:** Phase 1.b spot-check that each:
1. Validates `getClaims()` and scopes all queries by `auth.uid()`.
2. Uses `service_role` ONLY for the cross-user balance row, never for the bank-account write.
3. Enforces `wallet_transfer_limits` before any `wallet-payout` / `wallet-transfer`.

### 4.5 Stripe Connect controller settings ✅

- `controller.requirement_collection = 'stripe'`
- `controller.stripe_dashboard = 'none'`
- `controller.losses = 'application'`

Matches Wallet Phase 0 memory. Creators cannot reach the Stripe dashboard — losses fall to the platform, which is the correct model for our "never say Stripe" UX.

### 4.6 🟠 PII surface area in `profiles` (carry-over from Phase 0 audit)

174-column `profiles` table includes phone, email-mirrors, payout-method hints, geo. The `public_profiles_safe` view exists (per memory `hardened-platform-access-control`), but components still query `profiles` directly in places. **Out of scope for Phase 1 fixes** (profile split is Phase 2 of the 60-day plan), but flagged here for tracking.

---

## 5. Recommended Phase 1 Remediation Migration (proposal — NOT yet executed)

Single migration after approval:

1. **Add deny-by-default policies** to the 6 RLS-enabled-no-policy tables (`stripe_webhook_events`, `guest_wallets`, `guest_wallet_sessions`, `guest_wallet_topups`, `guest_wallet_transactions`, `telegram_messages`).
2. **Bulk `SET search_path = public`** on flagged DB functions (mechanical, ~hundreds — scripted via `pg_proc` query).
3. **Add `stripe_webhook_events` idempotency** insert to `guest-wallet-webhook`.
4. **Refactor 11 cron fns** to `requireAdminOrCron` (code-only, no DB change).

## 6. Out of Scope for Phase 1 (tracked, not fixed now)

- `profiles` 174-column split → 60-day plan
- Edge function consolidation 291 → ~90 → 60-day plan
- Model router → 60-day plan
- Full `verify_jwt` classification of all 291 fns → Phase 1.b after manifest skeleton

---

## 7. Severity Summary

| Severity | Count | Items |
|---|---|---|
| 🔴 Critical (silent data path) | 6 | RLS-enabled-no-policy tables |
| 🟠 High (admin guard / webhook idempotency) | 12 | 11 cron fns + guest-wallet-webhook idempotency |
| 🟡 Medium (lint / hygiene) | ~450 | search_path mutable + permissive `USING(true)` |
| ⚠️ Review (classification needed) | ~190 | Unclassified edge fns |

---

## Decision Required

**Approve Phase 1 remediation migration?** (Items 1–4 in §5 above.) Reply with:

- **"Apply Phase 1 fixes"** — I will run the migration + code refactor in one batch.
- **"Apply only the 6 RLS denies first"** — minimum-risk first cut.
- **"Hold — re-scope first"** — discuss before any changes.

Phase 2 (Analytics Foundation) begins once Phase 1 fixes are merged.
