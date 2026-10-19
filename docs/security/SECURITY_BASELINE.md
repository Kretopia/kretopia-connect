# Security baseline

Facts below are from the repo and read-only catalog queries on production, 2026-10-19. Secret **values** are never recorded. Severity: **P0** fix now, **P1** this sprint, **P2** backlog.

## 1. RLS and grants
- **P0, closed 2026-10-19: project takeover.** `projects` UPDATE policy "Users can update accessible projects" is `created_by = auth.uid() OR user_has_project_access(...)` with no `WITH CHECK`, and `authenticated` can UPDATE `created_by`, so any accepted collaborator (guest and client roles included) could make themselves owner. Migration M0a (`docs/roadmap/schema-impact-report.md`, file `supabase/migrations/20261019120000_guard_project_created_by.sql`) was approved and applied: trigger `trg_guard_project_created_by` rejects a changed `created_by` for any signed-in caller. Verified: a member's takeover attempt raised `projects.created_by is immutable`, owner unchanged. The policy itself still has no `WITH CHECK` (other columns remain member-editable); tighten in M1. Closed since the October report: self-accept role pin (trigger `trg_guard_project_collaborator_self_update`), `match_copilot_memories` (no `anon` or `authenticated` EXECUTE).
- 0 public tables without RLS. 11 `INSERT ... WITH CHECK (true)` intake policies (`analytics_events`, `client_error_logs`, `event_analytics_events`, `event_share_clicks`, `site_analytics`, `newsletter_subscribers`, `email_unsubscribes`, `guest_rsvps`, `circle_guest_rsvps`, `partner_signups`, `partner_submissions`). Intended, but unbounded: add rate limiting or a size cap. **P2**
- **`call_transcripts` UPDATE** (policy "creator can update own transcript", `created_by = auth.uid()`): the `authenticated` role holds UPDATE on **every column**, including `recording_id`, `created_by`, `project_id`, `call_kind`, `call_id`, `participants`. Consequences: a creator can point their row at another project (injecting an entry into that team's Recordings) or at another recording id, and `get-recording-link` then mints a Daily link for it (it authorises on `created_by`, then trusts `recording_id`). Needs a victim's recording UUID, so not trivially exploitable. **P1**. Fix, not applied: remove client UPDATE on those columns (column grants), keep service-role writes. Needs a written schema-impact report and explicit approval; no SQL is included on purpose.
- 183 SECURITY DEFINER functions are executable by `anon`. The 25 sensitive ones sampled check `auth.uid()` or an admin role and pin `search_path`; six no-argument ones are trigger functions. Known oracle: `is_meeting_member(meeting, user)` answers membership to anonymous callers. Revoke `anon` on non-public RPCs. **P2**
- Transcript visibility for meeting, event, and stage calls is host-only by design (migration `20260915100000`). Do not widen without a product decision.

## 2. Storage
- 12 public buckets (avatars, campaign-media, email-assets, event-photos, feedback-screenshots, listing-images, location-images, location-photos, media, opportunities, partner-logos, portfolio). `feedback-screenshots` can contain personal data: make it private or scrub on upload. **P1**
- Two private buckets named `database_export_*` hold data dumps. Confirm contents, who can read them, and delete or move offline. **P1**
- Private: `meeting-recordings`, `payment-proofs`, `dispute-evidence`, `project-files`, `message-attachments`, `deal-memos`, `product-files`, `import-uploads`, `board-assets`, `outreach-media`. Recording playback goes through `get-recording-link` (Daily access link, `valid_for_secs=3600`); the last link is also cached in `call_transcripts.recording_url` and is readable by anyone who can SELECT the row. Authorised viewers only, but treat it as a bearer URL. **P2**
- Daily recordings live in Daily's storage, retention placeholder 90 days (`_shared/recordingRetention.ts`), no purge deployed (needs migration `20260915110000` first).

## 3. Webhooks
| Webhook | Signature | Freshness | Idempotency | Gap |
|---|---|---|---|---|
| `daily-recording-webhook` | HMAC (timestamped or raw body) | 900 s (timestamped form only) | one row per `recording_id` in code | Raw-body form has no age bound; production copy predates the freshness check until redeployed. No unique index. |
| `stripe-marketplace-webhook`, `stripe-wallet-webhook`, `guest-wallet-webhook` | Stripe HMAC, `_shared/stripeSignature.ts` | tolerance | `stripe_webhook_events` ledger | Ledger has 0 rows in production: confirm in the Stripe dashboard that events reach and succeed. |
| `telegram-webhook` | `secret_token` header | none | upsert on `update_id` | Always answers 200 by design. |
| `handle-email-suppression` | HMAC | yes | upsert | none found |
| `integration-oauth-callback` | signed `state` | not reviewed | none | Review `verifyState` expiry and replay. |

## 4. Edge Function authorisation and input
- JWT verification is configured per function in the dashboard; `supabase/config.toml` lists one. A CLI deploy resets it: always set it explicitly (`DEPLOYMENT_RUNBOOK.md`). **P1**
- Unauthenticated URL fetchers without the shared SSRF guard (`_shared/ssrf.ts` is used by one function): `fetch-og-data`, `fetch-portfolio-data`, `fetch-youtube-playlist`. They can be pointed at internal addresses. **P0/P1**
- 21 public service-role functions (OG images, sitemap, payment-link and invoice info, unsubscribe, `lookup-auth-providers`, `validate-event-promo`, `production-detail`, `redeem-project-share`): confirm each returns only what its token or public link entitles. `lookup-auth-providers` can enumerate accounts. **P1**
- AI endpoints without a session were closed here (`generate-match-explanation`, `generate-ice-breakers`); 27 functions have rate limiting, the rest do not. **P2**
- 500 responses across most functions echo `error.message`. Rule in `RELIABILITY_RULES.md`; fix per function when touched. **P2**
- CORS is `*` on all functions; acceptable with bearer auth, not for cookie auth.
- Sentry Replay records text and media unmasked (`SENTRY_PLAN.md`). **P1**

## 5. Secrets at risk (names only)
`SUPABASE_SERVICE_ROLE_KEY` (used by nearly every function; one leak bypasses all RLS), `CRON_SECRET` (rotated 2026-10-06 after a leak), `DAILY_API_KEY` (account-wide: every room and recording), `DAILY_WEBHOOK_HMAC_SECRET`, `STRIPE_SECRET_KEY_*` and Stripe webhook secrets, `LOVABLE_API_KEY` (AI spend), `TELEGRAM_API_KEY`, `SUPABASE_ACCESS_TOKEN` (deploy), `SENTRY_AUTH_TOKEN`. Rotate on any exposure; never paste values into chat, issues, or logs.

## 6. Order of work
0. ~~M0a project takeover~~ done 2026-10-19. 1. SSRF guard on the three fetchers. 2. `call_transcripts` column grants (approval). 3. `database_export_*` buckets. 4. Private `feedback-screenshots`. 5. Branch protection and CI (`CI_POLICY.md`). 6. Unique index on `call_transcripts.recording_id`. 7. Revoke `anon` EXECUTE on non-public RPCs. 8. Rate limits on intake tables. 9. Replay masking. 10. Per-function error-body cleanup.

No new migration is drafted in this change: the one clear exploit (M0a) was already drafted in `schema-impact-report.md` and has now been applied with approval; the `call_transcripts` change is described in prose until approved.
