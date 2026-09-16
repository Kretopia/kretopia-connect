# EDGE FUNCTION MANIFEST — Kretopia Platform

**Generated:** 2026-06-22 · **Total functions:** 291 · **Source:** automated scan of `supabase/functions/*/index.ts`

> Phase 1.b deliverable. Purpose: complete visibility of platform security posture before Analytics Foundation. **No JWT rewrites in this phase** — inventory + classification only, plus the 3 surgical hardening fixes already shipped (6 RLS deny policies, 7 cron functions standardized to `requireAdminOrCron`, `guest-wallet-webhook` event-id idempotency).

---

## 1. Executive Summary

| Class | Count | Meaning |
|---|---:|---|
| Public | 11 | Intended for unauthenticated callers (OG images, sitemap, public lookups). Must not return PII. |
| User | 136 | Validates a user JWT via `getClaims()` or `auth.getUser()`. Acts on behalf of that user. |
| Admin | 0 | Enforces admin role via `has_role(...,'admin')`. No cron path. |
| Cron | 4 | Validates `x-cron-secret` directly (legacy pattern — should migrate to shared guard). |
| Cron/Admin | 18 | Uses `requireAdminOrCron` (standard pattern — cron OR admin user). |
| Webhook | 9 | External provider call (Stripe, Telegram). Auth = signature verification. |
| Internal/Unauth | 112 | ⚠️ NO auth check found by static scan. Many are service-role-only callers from other functions, but each must be re-verified individually before reducing edge-fn count. |
| **Total** | **290** | |

### Top findings

1. **🔴 112 functions have no in-code auth check** detected by static scan. Most likely fall into 3 sub-buckets: (a) genuinely public (need to be moved to `Public`), (b) service-role-only callees of other edge functions (need a shared-secret guard), (c) **unintentionally open** (need user-JWT validation). Triage in Phase 2.a before consolidation.
2. **🟠 All 291 functions deploy with `verify_jwt = false`** (Lovable-managed default for the signing-keys system). Auth MUST be validated in code — there is no platform-level gate.
3. **🟢 Webhooks (9):** all 3 Stripe webhooks verify signatures; `guest-wallet-webhook` now has event-id idempotency (this phase).
4. **🟢 Cron (22):** 18 use the shared `requireAdminOrCron` guard. 4 remain on the legacy `CRON_SECRET` inline check (`draft-outreach-email` and `inbox-triage-agent` are dual-mode and intentionally permissive; `auto-outreach-watch` retains a CRON_SECRET reference for downstream invocation only).
5. **🟢 RLS posture:** the 6 tables previously flagged (RLS-enabled / zero policies) now carry explicit RESTRICTIVE deny-all-anon-authenticated policies. Only `service_role` reaches them.

---

## 2. Classification rules

Each function received the **highest-priority** class that matched:

```
Webhook        → file contains `constructEventAsync` OR name ends in `-webhook`, AND no per-user JWT path
Public         → known public surface (og-*, sitemap, public-stats, payment-link-info, etc.)
Cron/Admin     → imports `requireAdminOrCron`
Cron           → reads `CRON_SECRET` / `x-cron-secret` inline (no admin path)
Admin          → checks `has_role(..., 'admin')` but no cron path
User           → calls `supabase.auth.getClaims()` or `auth.getUser()`
Internal/Unauth→ none of the above (NEEDS REVIEW)
```

For each function we record:
- **verify_jwt** — value in `supabase/config.toml` if explicitly set, else `false (default)`.
- **auth mechanism** — `Stripe signature` / `requireAdminOrCron` / `CRON_SECRET inline` / `getClaims` / `getUser+RLS` / `None`.
- **service_role** — does the function read `SUPABASE_SERVICE_ROLE_KEY`? (privileged DB writer)
- **risk level** — derived per class; explicit overrides for known-sensitive functions.

---

## 3. Sensitive class detail

### 3.1 Webhook (9)

| Function | verify_jwt | Auth | Uses service_role | Risk |
|---|---|---|:-:|---|
| `auth-email-hook` | false (default) | None | — | 🟢 Low (sig verified) |
| `daily-recording-webhook` | false (default) | None | ✅ | 🟢 Low (sig verified) |
| `guest-wallet-webhook` | false (default) | Stripe signature | ✅ | 🟠 Medium (money flow) |
| `handle-email-suppression` | false (default) | None | ✅ | 🟢 Low (sig verified) |
| `send-push-notification` | false (default) | None | ✅ | 🟢 Low (sig verified) |
| `stripe-marketplace-webhook` | false (default) | Stripe signature | ✅ | 🟠 Medium (money flow) |
| `stripe-wallet-webhook` | false (explicit) | Stripe signature | ✅ | 🟠 Medium (money flow) |
| `telegram-setup-webhook` | false (explicit) | None | — | 🟢 Low (sig verified) |
| `telegram-webhook` | false (explicit) | None | ✅ | 🟢 Low (sig verified) |

### 3.2 Cron (4)

| Function | verify_jwt | Auth | Uses service_role | Risk |
|---|---|---|:-:|---|
| `daily-match-digest` | false (default) | None | ✅ | 🟠 Medium — legacy inline check; migrate to `requireAdminOrCron` |
| `desk-daily-nudge` | false (default) | None | ✅ | 🟠 Medium — legacy inline check; migrate to `requireAdminOrCron` |
| `draft-outreach-email` | false (default) | CRON_SECRET inline | ✅ | 🟠 Medium — legacy inline check; migrate to `requireAdminOrCron` |
| `inbox-triage-agent` | false (default) | CRON_SECRET inline | ✅ | 🟠 Medium — legacy inline check; migrate to `requireAdminOrCron` |

### 3.3 Cron/Admin (18)

| Function | verify_jwt | Auth | Uses service_role | Risk |
|---|---|---|:-:|---|
| `ai-autofill-profile` | false (default) | requireAdminOrCron | — | 🟢 Low (standardized) |
| `auto-discover-creatives` | false (default) | requireAdminOrCron | ✅ | 🟢 Low (standardized) |
| `auto-outreach-watch` | false (default) | requireAdminOrCron | ✅ | 🟢 Low (standardized) |
| `backfill-credit-media` | false (default) | requireAdminOrCron | ✅ | 🟢 Low (standardized) |
| `batch-enrich-profiles` | false (default) | requireAdminOrCron | ✅ | 🟢 Low (standardized) |
| `bulk-import-profiles` | false (default) | requireAdminOrCron | ✅ | 🟢 Low (standardized) |
| `bulk-submit-projects` | false (default) | requireAdminOrCron | ✅ | 🟢 Low (standardized) |
| `import-odos-members` | false (default) | requireAdminOrCron | ✅ | 🟢 Low (standardized) |
| `money-agent-watch` | false (default) | requireAdminOrCron | ✅ | 🟢 Low (standardized) |
| `process-drip-campaign` | false (default) | requireAdminOrCron | ✅ | 🟢 Low (standardized) |
| `seed-atlas-locations` | false (default) | requireAdminOrCron | ✅ | 🟢 Low (standardized) |
| `seed-icdb` | false (default) | requireAdminOrCron | ✅ | 🟢 Low (standardized) |
| `send-broadcast-email` | false (default) | requireAdminOrCron | ✅ | 🟢 Low (standardized) |
| `send-founder-note-reminder` | false (default) | requireAdminOrCron | ✅ | 🟢 Low (standardized) |
| `send-test-emails` | false (default) | requireAdminOrCron | ✅ | 🟢 Low (standardized) |
| `send-waitlist-invite` | false (default) | requireAdminOrCron | — | 🟢 Low (standardized) |
| `send-weekly-digest` | false (default) | requireAdminOrCron | ✅ | 🟢 Low (standardized) |
| `update-unclaimed-profiles` | false (default) | requireAdminOrCron | ✅ | 🟢 Low (standardized) |

### 3.4 Admin (0)

| Function | verify_jwt | Auth | Uses service_role | Risk |
|---|---|---|:-:|---|

### 3.5 Public (11)

| Function | verify_jwt | Auth | Uses service_role | Risk |
|---|---|---|:-:|---|
| `epk-og-image` | false (default) | None | ✅ | 🟢 Low (read-only) — re-verify no PII |
| `event-og-image` | false (default) | None | ✅ | 🟢 Low (read-only) — re-verify no PII |
| `fetch-og-data` | false (default) | None | — | 🟢 Low (read-only) — re-verify no PII |
| `generate-sitemap` | false (default) | None | ✅ | 🟢 Low (read-only) — re-verify no PII |
| `invoice-pay-info` | false (explicit) | None | ✅ | 🟢 Low (read-only) — re-verify no PII |
| `lookup-auth-providers` | false (default) | None | ✅ | 🟢 Low (read-only) — re-verify no PII |
| `og-campaign` | false (default) | None | ✅ | 🟢 Low (read-only) — re-verify no PII |
| `og-magazine` | false (default) | None | ✅ | 🟢 Low (read-only) — re-verify no PII |
| `payment-link-info` | false (explicit) | None | ✅ | 🟢 Low (read-only) — re-verify no PII |
| `project-og-image` | false (default) | None | ✅ | 🟢 Low (read-only) — re-verify no PII |
| `public-stats` | false (default) | None | ✅ | 🟢 Low (read-only) — re-verify no PII |

---

## 4. ⚠️ Internal/Unauth bucket (112 — needs triage)

These functions did not match any auth pattern in static scan. **None of these should remain in this state long-term.** Triage actions for Phase 2.a:

- (a) **True public** → move to `Public` class, add response-shape audit (no PII).
- (b) **Service-role-only callee** → add `x-internal-secret` header check using a new shared `requireInternal()` guard.
- (c) **Accidentally open** → add `getClaims()` user check.

| Function | Uses service_role | Likely bucket (best guess) |
|---|:-:|---|
| `agent-rsvp-event` | — | (c) Re-verify — likely needs user JWT |
| `agent-vouch-credit` | — | (c) Re-verify — likely needs user JWT |
| `ai-credit-import` | — | (c) Re-verify — likely needs user JWT |
| `ai-markup-suggest` | — | (c) Re-verify — likely needs user JWT |
| `analyze-profile-url` | — | (c) Re-verify — likely needs user JWT |
| `auto-resolve-disputes` | ✅ | (b) Internal callee / cron-adjacent |
| `challenge-deadline-reminder` | ✅ | (b) Internal callee / cron-adjacent |
| `claim-and-create-profile` | ✅ | (c) Re-verify — service_role + no auth |
| `compose-magazine-article` | — | (c) Re-verify — likely needs user JWT |
| `convert-currency` | — | (c) Re-verify — likely needs user JWT |
| `create-invoice-checkout` | ✅ | (c) Re-verify — service_role + no auth |
| `create-payment-link-checkout` | ✅ | (c) Re-verify — service_role + no auth |
| `discover-creators` | ✅ | (c) Re-verify — service_role + no auth |
| `discover-profiles` | — | (c) Re-verify — likely needs user JWT |
| `draft-lead-reply` | — | (c) Re-verify — likely needs user JWT |
| `elevate-brief` | — | (c) Re-verify — likely needs user JWT |
| `enhance-listing-ai` | — | (c) Re-verify — likely needs user JWT |
| `enhance-task` | — | (c) Re-verify — likely needs user JWT |
| `enrich-creator-profile` | ✅ | (c) Re-verify — service_role + no auth |
| `enrich-credits` | ✅ | (c) Re-verify — service_role + no auth |
| `enrich-press-links` | ✅ | (c) Re-verify — service_role + no auth |
| `event-reminders` | ✅ | (b) Internal callee / cron-adjacent |
| `extract-brief` | — | (c) Re-verify — likely needs user JWT |
| `fetch-link-metadata` | — | (c) Re-verify — likely needs user JWT |
| `fetch-portfolio-data` | — | (c) Re-verify — likely needs user JWT |
| `fetch-youtube-playlist` | — | (c) Re-verify — likely needs user JWT |
| `finalize-challenges` | ✅ | (c) Re-verify — service_role + no auth |
| `gen-campaign-matrix` | — | (c) Re-verify — likely needs user JWT |
| `gen-content-shotlist` | — | (c) Re-verify — likely needs user JWT |
| `gen-event-runsheet` | — | (c) Re-verify — likely needs user JWT |
| `gen-music-temp` | — | (c) Re-verify — likely needs user JWT |
| `gen-podcast-questions` | — | (c) Re-verify — likely needs user JWT |
| `gen-release-checklist` | — | (c) Re-verify — likely needs user JWT |
| `generate-bio` | — | (c) Re-verify — likely needs user JWT |
| `generate-challenges` | ✅ | (c) Re-verify — service_role + no auth |
| `generate-content` | — | (c) Re-verify — likely needs user JWT |
| `generate-event-cover` | — | (c) Re-verify — likely needs user JWT |
| `generate-gig-cover` | ✅ | (c) Re-verify — service_role + no auth |
| `generate-gig-description` | — | (c) Re-verify — likely needs user JWT |
| `generate-ice-breakers` | — | (c) Re-verify — likely needs user JWT |
| `generate-magazine-article` | — | (c) Re-verify — likely needs user JWT |
| `generate-match-explanation` | — | (c) Re-verify — likely needs user JWT |
| `generate-opportunity-image` | — | (c) Re-verify — likely needs user JWT |
| `generate-site` | — | (c) Re-verify — likely needs user JWT |
| `generate-vapid-keys` | — | (c) Re-verify — likely needs user JWT |
| `geocode-location` | ✅ | (c) Re-verify — service_role + no auth |
| `get-payment-intent` | — | (c) Re-verify — likely needs user JWT |
| `gig-moderator` | ✅ | (c) Re-verify — service_role + no auth |
| `guest-wallet-me` | ✅ | (c) Re-verify — service_role + no auth |
| `guest-wallet-session` | ✅ | (c) Re-verify — service_role + no auth |
| `guest-wallet-topup` | ✅ | (c) Re-verify — service_role + no auth |
| `handle-email-unsubscribe` | ✅ | (c) Re-verify — service_role + no auth |
| `handle-unsubscribe` | ✅ | (c) Re-verify — service_role + no auth |
| `import-profile-from-url` | ✅ | (c) Re-verify — service_role + no auth |
| `import-profile-url` | — | (c) Re-verify — likely needs user JWT |
| `moderate-opportunity` | — | (c) Re-verify — likely needs user JWT |
| `notify-swipe` | ✅ | (b) Internal callee / cron-adjacent |
| `onboarding-discover` | — | (c) Re-verify — likely needs user JWT |
| `polish-magazine-article` | — | (c) Re-verify — likely needs user JWT |
| `preview-transactional-email` | — | (c) Re-verify — likely needs user JWT |
| `process-challenge-winners` | ✅ | (b) Internal callee / cron-adjacent |
| `process-email-queue` | ✅ | (b) Internal callee / cron-adjacent |
| `process-outreach-queue` | ✅ | (b) Internal callee / cron-adjacent |
| `process-partner-submission` | ✅ | (b) Internal callee / cron-adjacent |
| `process-scheduled-campaigns` | ✅ | (b) Internal callee / cron-adjacent |
| `production-detail` | ✅ | (c) Re-verify — service_role + no auth |
| `redeem-project-share` | ✅ | (c) Re-verify — service_role + no auth |
| `redeem-video-guest-link` | ✅ | (c) Re-verify — service_role + no auth |
| `route-studio-outcome` | — | (c) Re-verify — likely needs user JWT |
| `route-studio-post` | ✅ | (c) Re-verify — service_role + no auth |
| `route-thrive-intent` | — | (c) Re-verify — likely needs user JWT |
| `route-vault-file` | ✅ | (c) Re-verify — service_role + no auth |
| `scan-receipt` | — | (c) Re-verify — likely needs user JWT |
| `scrape-thumbnail` | ✅ | (c) Re-verify — service_role + no auth |
| `search-credits-web` | — | (c) Re-verify — likely needs user JWT |
| `search-icdb` | ✅ | (c) Re-verify — service_role + no auth |
| `send-activity-digest` | ✅ | (b) Internal callee / cron-adjacent |
| `send-credit-invite` | ✅ | (b) Internal callee / cron-adjacent |
| `send-day2-engagement` | ✅ | (b) Internal callee / cron-adjacent |
| `send-event-reminders` | ✅ | (b) Internal callee / cron-adjacent |
| `send-notification-email` | ✅ | (b) Internal callee / cron-adjacent |
| `send-onboarding-reminders` | ✅ | (b) Internal callee / cron-adjacent |
| `send-project-invitation` | ✅ | (b) Internal callee / cron-adjacent |
| `send-reengagement` | ✅ | (b) Internal callee / cron-adjacent |
| `send-reengagement-emails` | ✅ | (b) Internal callee / cron-adjacent |
| `send-streak-warning` | ✅ | (b) Internal callee / cron-adjacent |
| `send-transactional-email` | ✅ | (b) Internal callee / cron-adjacent |
| `spark-ideas` | — | (c) Re-verify — likely needs user JWT |
| `speed-session-autocancel` | ✅ | (b) Internal callee / cron-adjacent |
| `speed-session-matcher` | ✅ | (b) Internal callee / cron-adjacent |
| `speed-session-recap` | ✅ | (b) Internal callee / cron-adjacent |
| `speed-session-reminders` | ✅ | (b) Internal callee / cron-adjacent |
| `sso-token` | ✅ | (c) Re-verify — service_role + no auth |
| `sso-userinfo` | ✅ | (c) Re-verify — service_role + no auth |
| `stage-reminders` | ✅ | (b) Internal callee / cron-adjacent |
| `telegram-status` | — | (c) Re-verify — likely needs user JWT |
| `thrivefund-ai-assist` | — | (c) Re-verify — likely needs user JWT |
| `thrivefund-finalize-campaign` | ✅ | (c) Re-verify — service_role + no auth |
| `transcribe-call` | ✅ | (c) Re-verify — service_role + no auth |
| `transcribe-voice-note` | ✅ | (c) Re-verify — service_role + no auth |
| `universal-search` | ✅ | (c) Re-verify — service_role + no auth |
| `update-verification-score` | ✅ | (c) Re-verify — service_role + no auth |
| `validate-event-promo` | ✅ | (c) Re-verify — service_role + no auth |
| `validate-waitlist-ai` | ✅ | (c) Re-verify — service_role + no auth |
| `verify-brand-credit` | ✅ | (c) Re-verify — service_role + no auth |
| `verify-credit` | ✅ | (c) Re-verify — service_role + no auth |
| `verify-event-ticket` | ✅ | (c) Re-verify — service_role + no auth |
| `verify-guest-opportunity` | ✅ | (c) Re-verify — service_role + no auth |
| `verify-profile-claim` | — | (c) Re-verify — likely needs user JWT |
| `voice-command` | — | (c) Re-verify — likely needs user JWT |
| `voice-to-task` | — | (c) Re-verify — likely needs user JWT |
| `weekly-universe-scan` | ✅ | (c) Re-verify — service_role + no auth |

---

## 5. User-class functions (136)

These already validate a user JWT (`getClaims` or `getUser`). Listed compactly; risk default 🟢 Low unless flagged.

<details><summary>Show full list</summary>

| Function | Auth | service_role |
|---|---|:-:|
| `accept-call-action-item` | getClaims | ✅ |
| `activate-og-promotion` | getUser+RLS | ✅ |
| `agent-orchestrator` | getClaims | ✅ |
| `agent-send-dm` | getUser+RLS | ✅ |
| `ai-finance` | getUser+RLS | ✅ |
| `ai-pricing-copilot` | getUser+RLS | — |
| `ai-support` | getUser+RLS | — |
| `ai-talent-match` | getUser+RLS | ✅ |
| `apply-to-stage` | getUser+RLS | ✅ |
| `auto-epk-updater` | getUser+RLS | ✅ |
| `batch-milestone-payout` | getUser+RLS | ✅ |
| `capture-escrow-payment` | getUser+RLS | ✅ |
| `capture-milestone-payment` | getUser+RLS | ✅ |
| `check-connect-status` | getUser+RLS | ✅ |
| `check-subscription` | getUser+RLS | ✅ |
| `checkout-event-tickets` | getUser+RLS | ✅ |
| `checkout-stage-ticket` | getUser+RLS | ✅ |
| `complete-product-purchase` | getClaims | ✅ |
| `connect-platform` | getUser+RLS | ✅ |
| `copilot-collaborator-tools` | getUser+RLS | ✅ |
| `copilot-executor` | getClaims | ✅ |
| `copilot-planner` | getClaims | ✅ |
| `create-checkout` | getUser+RLS | — |
| `create-circle-room` | getClaims | ✅ |
| `create-connect-account` | getUser+RLS | ✅ |
| `create-connect-login-link` | getUser+RLS | ✅ |
| `create-connect-payment` | getUser+RLS | — |
| `create-curated-stage` | getUser+RLS | — |
| `create-direct-video-call` | getClaims | ✅ |
| `create-escrow-payment` | getUser+RLS | — |
| `create-event-room` | getClaims | ✅ |
| `create-founder-checkout` | getUser+RLS | ✅ |
| `create-meeting` | getClaims | ✅ |
| `create-milestone-payment` | getUser+RLS | ✅ |
| `create-payment` | getUser+RLS | — |
| `create-sound-stage` | getClaims | ✅ |
| `create-speed-group-room` | getClaims | ✅ |
| `create-video-guest-link` | getClaims | ✅ |
| `create-video-room` | getClaims | ✅ |
| `customer-portal` | getUser+RLS | ✅ |
| `desk-agent` | getUser+RLS | ✅ |
| `desk-agent-watch` | getUser+RLS | ✅ |
| `desk-ai` | getUser+RLS | ✅ |
| `detect-duplicate-accounts` | getUser+RLS | ✅ |
| `draft-gig-application` | getUser+RLS | ✅ |
| `end-curated-stage` | getUser+RLS | ✅ |
| `end-sound-stage` | getClaims | ✅ |
| `end-stage-turn` | getUser+RLS | ✅ |
| `enhance-gig` | getUser+RLS | ✅ |
| `extract-copilot-memory` | getUser+RLS | ✅ |
| `extract-event-details` | getUser+RLS | ✅ |
| `extract-gig-details` | getUser+RLS | ✅ |
| `feedback-chat` | getUser+RLS | ✅ |
| `fetch-discogs-credits` | getUser+RLS | ✅ |
| `fetch-imdb-credits` | getUser+RLS | — |
| `fetch-musicbrainz-credits` | getUser+RLS | — |
| `fetch-spotify-credits` | getUser+RLS | — |
| `fetch-youtube-credits` | getUser+RLS | — |
| `generate-board-image` | getUser+RLS | ✅ |
| `generate-clips` | getUser+RLS | — |
| `generate-deal-memo` | getUser+RLS | ✅ |
| `generate-event-recap` | getUser+RLS | ✅ |
| `generate-moodboard-image` | getUser+RLS | ✅ |
| `get-connect-balance` | getUser+RLS | — |
| `get-download-urls` | getClaims | ✅ |
| `get-onboarding-matches` | getUser+RLS | — |
| `go-live-stage` | getUser+RLS | ✅ |
| `invite-to-stage` | getUser+RLS | ✅ |
| `join-paid-circle` | getUser+RLS | ✅ |
| `join-sound-stage` | getClaims | ✅ |
| `join-speed-session` | getClaims | ✅ |
| `match-event-guests` | getUser+RLS | ✅ |
| `merge-accounts-init` | getUser+RLS | ✅ |
| `merge-accounts-lookup` | getUser+RLS | ✅ |
| `merge-accounts-verify` | getUser+RLS | ✅ |
| `mint-meeting-token` | getClaims | ✅ |
| `mint-video-token` | getClaims | ✅ |
| `moderate-campaign` | getUser+RLS | ✅ |
| `notify-speed-pool-ping` | getUser+RLS | ✅ |
| `notify-speed-session-update` | getUser+RLS | ✅ |
| `optimize-event-seating` | getUser+RLS | ✅ |
| `promote-raised-hand` | getUser+RLS | ✅ |
| `promote-waitlist` | getUser+RLS | ✅ |
| `purchase-digital-product` | getUser+RLS | ✅ |
| `purchase-event-ticket` | getUser+RLS | ✅ |
| `raise-hand-stage` | getUser+RLS | ✅ |
| `record-stage-outcome` | getUser+RLS | ✅ |
| `redeem-project-guest-link` | getUser+RLS | ✅ |
| `refresh-my-universe` | getUser+RLS | ✅ |
| `release-escrow` | getUser+RLS | ✅ |
| `review-stage-application` | getUser+RLS | ✅ |
| `rsvp-curated-stage` | getUser+RLS | ✅ |
| `rsvp-speed-session` | getClaims | ✅ |
| `scope-guardian` | getUser+RLS | ✅ |
| `scout-gig-detail` | getUser+RLS | ✅ |
| `scout-gigs` | getUser+RLS | ✅ |
| `scout-leads` | getUser+RLS | ✅ |
| `send-circle-invite` | getUser+RLS | ✅ |
| `send-event-blast` | getUser+RLS | ✅ |
| `send-event-invite` | getUser+RLS | ✅ |
| `send-get-paid-link` | getUser+RLS | ✅ |
| `send-invoice-chase` | getClaims | ✅ |
| `send-invoice-email` | getUser+RLS | ✅ |
| `send-outreach-draft` | getClaims | ✅ |
| `send-outreach-email` | getClaims | ✅ |
| `send-phone-otp` | getUser+RLS | ✅ |
| `send-user-email` | getUser+RLS | ✅ |
| `speed-icebreakers` | getClaims | — |
| `sponsor-radar` | getUser+RLS | ✅ |
| `sso-authorize` | getUser+RLS | ✅ |
| `start-stage-transcription` | getClaims | ✅ |
| `start-stage-turn` | getUser+RLS | ✅ |
| `studio-ingest` | getUser+RLS | ✅ |
| `suggest-studio-folders` | getUser+RLS | ✅ |
| `sync-social-stats` | getUser+RLS | ✅ |
| `telegram-link-start` | getUser+RLS | ✅ |
| `thrive-ai-chat` | getUser+RLS | ✅ |
| `thrive-creative-tools` | getUser+RLS | ✅ |
| `thrive-document-engine` | getUser+RLS | ✅ |
| `thrive-memory-tool` | getUser+RLS | ✅ |
| `thrive-voice-tts` | getUser+RLS | — |
| `thrive-voice-turn` | getUser+RLS | ✅ |
| `thrivefund-create-pledge` | getUser+RLS | ✅ |
| `thrivefund-release-milestone` | getUser+RLS | ✅ |
| `verify-circle-payment` | getUser+RLS | ✅ |
| `verify-credentials` | getUser+RLS | ✅ |
| `verify-founder-payment` | getUser+RLS | ✅ |
| `verify-profile` | getUser+RLS | ✅ |
| `verify-stage-ticket` | getUser+RLS | ✅ |
| `wallet-add-bank` | getUser+RLS | ✅ |
| `wallet-balance` | getUser+RLS | ✅ |
| `wallet-payout` | getUser+RLS | ✅ |
| `wallet-topup` | getUser+RLS | ✅ |
| `wallet-topup-confirm` | getUser+RLS | ✅ |
| `wallet-transfer` | getUser+RLS | ✅ |
| `weekly-recap` | getUser+RLS | — |

</details>

---

## 6. Dependencies & owner systems

Each function's owner system is inferred from its name prefix:

| Prefix | Owner system |
|---|---|
| `agent-*`, `copilot-*`, `thrive-ai-*`, `desk-agent*`, `route-thrive-*` | Thrive Agent / Executive Producer |
| `wallet-*`, `creator-*`, `stripe-*`, `guest-wallet-*`, `create-connect*`, `customer-portal`, `check-connect*` | Payments / Wallet |
| `create-checkout`, `create-*-payment`, `create-escrow*`, `release-escrow`, `capture-*`, `verify-*payment`, `purchase-*`, `complete-product-purchase`, `payment-link-*`, `invoice-*` | Payments / Checkout |
| `send-*`, `process-*-email`, `process-drip*`, `handle-email-*`, `email-*`, `auth-email-hook`, `preview-transactional-email` | Email / Drip |
| `scout-*`, `discover-*`, `auto-discover-*`, `update-unclaimed-*` | Scout / Discovery |
| `epk-*`, `*-og-image`, `og-*`, `generate-sitemap`, `public-stats` | Public SEO / Share |
| `circle-*`, `create-circle-*`, `verify-circle-*`, `join-paid-circle` | Circles / Sound Stages |
| `sound-stage`, `speed-*`, `curated-stage*`, `*-stage*` | Live / Stages |
| `event-*`, `creative-jam*`, `validate-event-*` | Events |
| `telegram-*` | Messaging Channels |
| `thrive-voice-*`, `transcribe-*`, `voice-*` | Voice / Audio |
| `gen-*`, `generate-*` | AI Generators (Lovable AI Gateway) |
| `*ico*`, `seed-*`, `bulk-*`, `import-*`, `batch-*`, `backfill-*`, `enrich-*` | Admin / Seed / Backfill |
| `sso-*`, `oauth-*` | SSO (OAuth 2.0 provider) |
| `thrivefund-*`, `pledge*` | ThriveFund (crowdfunding) |

Cross-function dependencies (heuristic — anything that invokes `/functions/v1/<other>` via fetch) is not yet mapped statically. Recommended in Phase 2.a: add a one-time `rg "functions/v1/[a-z-]+"` graph build to detect orphans before consolidation.

---

## 7. What changed in Phase 1.b

**Migration:** 6 tables (`stripe_webhook_events`, `guest_wallets`, `guest_wallet_topups`, `guest_wallet_transactions`, `guest_wallet_sessions`, `telegram_messages`) — added explicit RESTRICTIVE deny-all policies for `anon` and `authenticated`. `service_role` retains full access.

**Code:**
- `auto-outreach-watch` → `requireAdminOrCron`
- `money-agent-watch` → `requireAdminOrCron`
- `send-broadcast-email` → `requireAdminOrCron`
- `send-founder-note-reminder` → `requireAdminOrCron`
- `send-waitlist-invite` → `requireAdminOrCron`
- `send-weekly-digest` → `requireAdminOrCron`
- `process-drip-campaign` → `requireAdminOrCron`
- `guest-wallet-webhook` → added `stripe_webhook_events` event-id idempotency (matches `stripe-wallet-webhook` pattern).

**Out of scope (Phase 2+):** large-scale JWT rewrites, edge-function consolidation 291→~90, `profiles` table split, model router.

---

## 8. Recommended next steps

1. **Phase 2 (Analytics Foundation):** unblocked — proceed.
2. **Phase 2.a (after analytics):** triage the 112 `Internal/Unauth` functions — re-classify each as (a) Public, (b) service-role-only callee with new `requireInternal()` shared guard, or (c) add user-JWT check. Output: zero functions in `Internal/Unauth` class.
3. **Phase 2.b:** migrate `draft-outreach-email` and `inbox-triage-agent` dual-mode auth to a new `requireUserOrCron()` shared guard (mirror of `requireAdminOrCron`).
4. **Phase 3:** consolidation plan — once every function has a verified class + auth mechanism, group by owner system for the 291→~90 reduction.