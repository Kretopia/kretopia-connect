# Lovable Cloud SQL — Execution Preview (READ-ONLY PRE-FLIGHT)

Date: 2026-08-23 (UTC)
Project: Kretopia (Lovable Cloud)
Backend ref: `kwmcocsitwssrtzkdojh` — confirmed
DB: PostgreSQL 17.6, database `postgres`
Read-only role used: `sandbox_exec` (SELECT/INSERT only — cannot mutate)
Status: **AWAITING APPROVAL — NO WRITES PERFORMED**

## 0. Hard-stop checks

| Check | Result |
|---|---|
| Correct project | Yes — ref matches `kwmcocsitwssrtzkdojh` |
| Migration history readable | Yes (latest `20260817013618`) |
| Backup / recovery point | **Unknown** — Lovable Cloud manages PITR; not verifiable from this session |
| Migrations already applied? | Wallet / notification / KrePay patches are **not present** in history |
| Secrets printed | None |

Last 6 applied migrations: `20260817013618`, `20260812071229`, `20260812071205`, `20260804103219`, `20260804103153`, `20260803093711`.

## 1. Current state (evidence)

### RLS
RLS is **enabled** on every table in scope: `wallets`, `creator_wallets`, `creator_wallet_balances`, `creator_payouts`, `creator_payout_methods`, `profiles`, `notifications`, `invoices`, `milestones`, `marketplace_orders`, `transactions`, `stripe_webhook_events`.

### Table-level privileges (from `pg_class.relacl`)

| Table | anon | authenticated |
|---|---|---|
| `wallets` | SELECT, INSERT, DELETE (no UPDATE) | SELECT, INSERT, DELETE (no UPDATE) |
| `creator_wallets` | **SELECT, INSERT, UPDATE, DELETE** | **SELECT, INSERT, UPDATE, DELETE** |
| `creator_wallet_balances` | **full incl. UPDATE** | **full incl. UPDATE** |
| `creator_payouts` | **full incl. UPDATE** | **full incl. UPDATE** |
| `creator_payout_methods` | **full incl. UPDATE** | **full incl. UPDATE** |
| `profiles` | INSERT, UPDATE, DELETE + column-scoped SELECT | same |
| `stripe_webhook_events` | **full incl. UPDATE** | **full incl. UPDATE** |

`profiles` SELECT is already column-scoped (prior PII patch); `profiles` **UPDATE is whole-table** and only constrained by RLS (`auth.uid() = user_id`), i.e. an owner can currently write any of the 177 columns including `stripe_account_id`, `subscription_tier`, `payment_verified`, `verification_score`, `storage_limit_bytes`, `badge`, `credit_score`, `xp`.

### RLS policies in scope
- `wallets`: SELECT/INSERT/UPDATE own (`auth.uid() = user_id`). UPDATE policy exists but the **grant is already revoked**, so client UPDATE is dead — good, and the policy should be dropped for clarity.
- `creator_wallets`: `own wallet read` (SELECT), `own wallet update` (UPDATE), `own wallet upsert` (INSERT) — all self-scoped. **UPDATE is live**, so a creator can currently set `payouts_enabled = true`, `charges_enabled`, `kyc_status`, `stripe_account_id`. This is the payout-gate bypass.
- `creator_payouts` / `creator_wallet_balances`: only a SELECT policy exists, so UPDATE grants are unusable via PostgREST today — but the grant is drift and should be revoked.
- `profiles`: `Owner full access` (ALL, self), plus `Users can update own profile` (UPDATE, self, no WITH CHECK).
- `notifications`: self read/update/delete; INSERT self-or-admin.

### Wallet-related routines
`create_wallet_for_user` (SECDEF), `ensure_creator_wallet` (SECDEF), `wallet_credit(p_user_id, p_amount)` (SECDEF), `wallet_debit(p_user_id, p_amount)` (SECDEF).

### Client code mapping (evidence for the allow-list)
- `creator_wallets` — the app **only reads** it (`src/components/sessions/PayoutsConnectWarning.tsx`). No client UPDATE path exists. Writes come from edge functions `wallet-add-bank`, `wallet-balance`, `stripe-wallet-webhook` (service role).
- `wallets` — client does SELECT plus one INSERT (`WalletCard.tsx`). No client UPDATE path.
- `profiles` — 407 client references; the read allow-list already exists in `src/lib/profile/profileColumns.ts`. There is **no** enumerated write allow-list, so a deny-list on server-managed columns is the safe, non-breaking approach.

### Notification prerequisites — NOT MET
- `notifications` has **no dedupe/idempotency column** (columns: id, user_id, type, title, message, read, link, created_at, action_url, action_text, image_url, priority, category) and no unique index other than the PK.
- There is **no identified "acceptance → Studio creation → applicant notification" pipeline** in the codebase; acceptance flows are spread across `review-stage-application`, `ManageOpportunities.tsx`, `OpportunityDetail.tsx` with differing shapes.
- Therefore the required key `studio-created:{studio_id}:applicant:{applicant_id}` cannot be attached to a defined event. **Section 3 is blocked pending a definition of which acceptance flow is canonical.**

### Stripe environment (values not printed)
| Item | Mode |
|---|---|
| `STRIPE_SECRET_KEY` (backend) | **LIVE** |
| `STRIPE_WALLET_WEBHOOK_SECRET` | not set |
| `STRIPE_WEBHOOK_SECRET` | not set |
| Frontend publishable key | not set in this environment |

Per §5 hard-stop this forces **BLOCKED_STRIPE_LIVE_MODE**. No payment, transfer or payout test may run. In addition, `stripe-wallet-webhook` cannot verify signatures at all today because its signing secret is absent — the webhook path is currently non-functional, not merely untested.

## 2. Proposed change set (NOT APPLIED)

### Migration A — `wallet_privilege_hardening`
1. Revoke `UPDATE, DELETE` on `public.wallets` from `anon, authenticated`; drop the now-dead `Users can update their own wallet` policy. Balance/credit mutation stays exclusively in `wallet_credit` / `wallet_debit`.
2. Revoke `UPDATE, DELETE, INSERT` on `public.creator_wallets`, `creator_wallet_balances`, `creator_payouts`, `creator_payout_methods` from `anon, authenticated`; keep `SELECT` for `authenticated` (self-scoped by existing policies); keep `ALL` for `service_role`. Drop `creator_wallets` `own wallet update` / `own wallet upsert` policies. Wallet rows are created by `ensure_creator_wallet` (SECDEF) and edge functions, so no client path breaks.
3. Revoke all client privileges on `public.stripe_webhook_events` from `anon, authenticated` (service-role only).
4. `profiles`: keep table UPDATE, then `REVOKE UPDATE (col, …)` for the server-managed deny-list:
   `stripe_account_id, stripe_account_status, stripe_customer_id, stripe_subscription_id, subscription_tier, subscription_status, subscription_product_id, subscription_end_date, payment_verified, credit_score, verification_score, verification_status, verification_tier, verification_breakdown, verified_at, verified_credentials, verified_metrics, id_verified, id_verified_at, identity_face_verified, identity_face_verified_at, email_verified, phone_verified, age_verified, portfolio_verified, social_verified, imdb_verified, spotify_verified, youtube_verified, instagram_verified, discogs_verified, mother_agency_verified, badge, achievement_badges, xp, total_xp, level, storage_used_bytes, storage_limit_bytes, available_invites, boost_expires_at, double_xp_expires_at, og_promotion_expires_at, claim_token, claimed_by, claimed_at, is_claimed, role, ambassador_code, icdb_creator_id, membership_number`.
   Every other column (bio, links, rates, availability, site_*, company_*, model_*, etc.) stays owner-editable. RLS continues to scope updates to the owner.

Rollback: a paired `restore` migration re-granting the exact privileges captured above.

### Migration B — notifications
**Not proposed.** Prerequisites unknown (see above). Requires: (a) which acceptance flow is canonical, (b) approval to add `dedupe_key text` + partial unique index to `notifications`.

### KrePay §4/§5
Not startable while the backend key is live and no webhook signing secret is configured.

## 3. Post-application checks (to run after approval)
- Re-read `relacl` / `attacl` for all touched tables and diff against §1.
- Negative: anon UPDATE `wallets.balance`; authenticated non-owner UPDATE; owner UPDATE `balance`; owner UPDATE `creator_wallets.payouts_enabled`; owner UPDATE `profiles.stripe_account_id` / `payment_verified` / `subscription_tier` → all must fail.
- Positive: owner UPDATE `profiles.bio`; `wallet_credit` / `wallet_debit` via service role; `ensure_creator_wallet`; `PayoutsConnectWarning` read; `wallet-balance` edge function.
- Supabase linter re-run.

## 4. Status

**BLOCKED_STRIPE_LIVE_MODE** (payments track) — and Migration A is **awaiting explicit approval**.

Remaining uncertainty: backup/PITR availability could not be confirmed from this session; the `profiles` write deny-list is derived from column semantics, not from an enumerated frontend write map (407 call sites).

---

## 5. EXECUTED — Migration A (approved 2026-08-23)

Applied in five migrations:

1. `wallet_privilege_hardening` — revoked client INSERT/UPDATE/DELETE on `wallets`, `creator_wallets`, `creator_wallet_balances`, `creator_payouts`, `creator_payout_methods`; dropped dead write policies (`Users can update their own wallet`, `own wallet update`, `own wallet upsert`, `own methods write`); `stripe_webhook_events` is now service-role only; `anon` lost SELECT on the creator wallet stack.
2. `profiles write allow-list` — the column-level REVOKE was a no-op while the table-level UPDATE grant existed, so the table grant was revoked and re-issued as an explicit column allow-list. **124 of 177 columns writable**; 53 server-managed columns locked. `anon` lost all profile writes.
3. `award_xp` / `spend_xp` (SECURITY DEFINER) — points are now awarded (≤500/award, always logged) and spent (atomic balance check) server-side. Closes the "spend XP → set `subscription_tier='pro'`" escalation. `profiles.role` was re-granted: it is the creative role text, not a permission.
4. `finalize_unclaimed_profile_claim` — claiming an imported profile is server-verified; clients can no longer self-assign `badge='og'` or `verification_tier='industry'`.
5. `set_age_verified_from_dob` trigger — `age_verified` derived from `date_of_birth`, never client-asserted.

Client rewires: `WalletXPSection`, `StreakCard`, `CheckIn`, `DailyCheckIn`, `ConnectionRequestActions`, `lib/creditSystem`, `ClaimProfileDialog`, `AIProfileDiscoveryStep`, `FundNew`.

### Verification matrix

| Check | Result |
|---|---|
| `profiles` writable columns (authenticated) | 124 / 177 |
| `subscription_tier`, `payment_verified`, `verification_score`, `badge`, `xp`, `storage_limit_bytes`, `is_claimed`, `age_verified` | read-only |
| `bio`, `avatar_url`, `role`, `date_of_birth`, `current_streak`, `streak_freeze_count` | writable |
| `anon` writes to `profiles` | none |
| `wallets` / creator wallet stack, client UPDATE | revoked (SELECT only, self-scoped by RLS) |
| `stripe_webhook_events` | service-role only |
| `award_xp` / `spend_xp` / `finalize_unclaimed_profile_claim` EXECUTE | `authenticated` + `service_role` only (not `anon`) |
| Typecheck | clean |

Linter deltas after these migrations are the pre-existing project-wide `SECURITY DEFINER` function warnings (222/236) plus the three new functions — all intentionally callable by signed-in users and internally auth-scoped.

## 6. Still blocked

- **KrePay / Stripe:** `STRIPE_SECRET_KEY` is LIVE and no webhook signing secrets are set → `BLOCKED_STRIPE_LIVE_MODE`. Needs test-mode keys + `STRIPE_WALLET_WEBHOOK_SECRET` / `STRIPE_WEBHOOK_SECRET` before any payment, transfer or payout test.
- **Notifications (Section 3):** `notifications` has no dedupe column/index and no canonical acceptance → Studio-creation pipeline is defined in the codebase.
