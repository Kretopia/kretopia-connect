# Repo audit

Scanned 2026-10-19 on `main` @ `6693b982d`. Read-only: repo code, migrations, and (SELECT only) production catalog facts. No secrets read. Severity: **P0** exploitable or data-losing now, **P1** wrong behaviour under failure, **P2** hygiene.

## 1. Stack
- React 18.3, Vite 5.4, TypeScript, Tailwind + shadcn/ui, PWA (Workbox `generateSW`). Built and hosted by Lovable.
- Supabase JS `^2.116`, 315 Edge Functions (Deno) + 76 `_shared` modules, 778 migrations.
- Realtime video: Daily (`@daily-co/daily-js` 0.89). Payments: Stripe. Errors: `@sentry/react` 10.17 (browser only).
- Tests: vitest 3.2, about 190 files / 1,878 tests, 36 failing on `main` (7 files, listed in `CI_POLICY.md`).
- Scripts: `dev`, `build`, `build:dev`, `lint`, `preview`, `typecheck` (`tsc -p tsconfig.app.json`), `test` (`vitest run`).
- Two lockfiles, both unusable outside Lovable: `package-lock.json` is stale (supabase-js 2.58.0 vs `^2.116.0`), `bun.lock` resolves from Lovable's private registry. **P1**

## 2. Topology and deploy path
- Production database and functions: the legacy Supabase project (`vite.config.ts` `FORCE_LEGACY_BACKEND = true`). `supabase/config.toml` `project_id` is the empty Lovable Cloud project. **P1** (a CLI deploy that trusts config.toml hits the wrong project)
- Frontend ships only on Publish in the Lovable "Kretopia Connect" project. Edge functions ship only by manual paste into the Lovable "kretopia-app" project. Migrations are applied by hand.
- Consequence: `main` and production drift. Verified 2026-10-19: production lacks `call_transcripts.recording_deleted_at` (migration `20260915110000` never applied); production `get-recording-link` was an older copy without the hardened access rule. **P1**
- Before this change there was no `.github/`: no CI, no branch protection, no deploy automation.

## 3. Edge Functions
- Only `supabase/config.toml` entry: `preview-transactional-email` (`verify_jwt = false`). Every other function's JWT setting lives in the dashboard and is not readable from the repo; a CLI deploy resets it. **P1**
- Webhooks: `daily-recording-webhook`, `stripe-marketplace-webhook`, `stripe-wallet-webhook`, `guest-wallet-webhook`, `telegram-webhook`, `handle-email-suppression`; OAuth return: `integration-oauth-callback`.
- Signature checks: present on all webhooks above (Stripe: `_shared/stripeSignature.ts` with a timestamp tolerance; Telegram: `secret_token` header; OAuth return: signed `state`). Freshness window: Daily 900 s, email suppression, Stripe tolerance.
- Idempotency: Stripe has a ledger (`stripe_webhook_events`, `_shared/webhookLedger.ts`; 0 rows in production on 2026-10-19: no Stripe event has reached it). Daily: one `call_transcripts` row per `recording_id` enforced in code only (no unique index). Telegram: upsert on `update_id`.
- Cron-called functions use `requireAdminOrCron` (`x-cron-secret` or admin session).

## 4. Crons (production `cron.job`, names and schedules only; commands not read: they embed secrets)
21 active jobs: `ai-discovery-morning/evening` (06:00, 18:00), `challenge-deadline-reminders` (6 h), `auto-rotate-challenges` (2 h), `process-outreach-queue-daily`, `process-scheduled-campaigns` (5 min), `daily-enrich-incomplete-profiles`, `thrivefund-auto-finalize` (15 min), `auto-resolve-disputes-daily`, `weekly-universe-scan`, `desk-daily-nudge`, `gig-moderator-daily` (03:00), `daily-scout-gigs` (07:00), `daily-match-digest-08utc`, `inbox-triage-agent-every-10min`, `auto-outreach-watch-every-6h`, `money-agent-watch-daily`, `stage-reminders` (15 min), `speed-session-reminders-every-2-min`, `speed-session-autocancel-every-5-min`, `speed-session-recap-hourly`, `event-reminders-every-15-min`.
- The one `cron.schedule` in the migrations (`reconcile-stale-orch-runs`) is not among the production jobs; all 21 production jobs exist only in the database and cannot be rebuilt from the repo. **P1**
- No job reports failure anywhere: pg_cron records an HTTP call, not the function's outcome.

## 5. Critical DB paths
- Money: `milestones`, `invoices`, `wallet_transfers`, `stripe_webhook_events`.
- Recordings: `call_transcripts` (canonical), `call_action_items`; `meeting_recordings` exists with 0 rows and no reader or writer (orphan).
- Identity and access: `profiles`, `public_profiles_safe` (view), `project_collaborators`, `meeting_participants`.
- Credits and Passport: `credits`, `credit_endorsements`, `credit_ai_verifications`.
- Telemetry: `analytics_events` (1.4 M rows), `site_analytics`, `client_error_logs` (656 rows, last one today), `import_audit_log`. No general audit table.

## 6. Functions that swallow errors
- 26 empty `catch` blocks in 24 functions; most are parse helpers, acceptable.
- `supabase.functions.invoke()` returns `{ error }` and does not throw. 23 call sites in functions; 8 ignore the result across 7 functions. **P1** Fixed in the speed-session crons and `send-credit-invite` (this change).
- Fail-open by design, left unchanged: `moderate-opportunity` (answers `flagged:false` on any error). **P1**, product decision.
- 200 with a degraded flag, left unchanged: `credits-ai-insights`, `generate-ice-breakers`, `speed-icebreakers`.
- 200 by design for provider retry semantics: `telegram-webhook`.

## 7. Functions returning success on failure (fixed here)
- `speed-session-reminders` (fatal error answered 200, `String(e)` in the body; failed emails counted as sent; unchecked "sent" flag re-notified every 2 minutes). **P1**
- `speed-session-autocancel` announced a group call without saving the change. **P1**
- `speed-session-recap` counted failed emails as sent. **P1**
- `generate-match-explanation` answered 200 with an invented score of 85. **P0** for "no fake match score".
- `send-credit-invite` reported an invite whose token was never saved.
- Recording pipeline (webhook, sync, transcribe, link): fixed in PR #225 (merged; edge code still to be deployed).
- `computeOpportunityMatch` shows 61 to 97 "match" badges from `55 + relevance * 6`: a vanity number. UI change needed; see `docs/product/OPPORTUNITY_RANKING.md`. **P1**

## 8. Missing idempotency
- `call_transcripts.recording_id`: no unique index (code-level dedupe only). Proposal in `SECURITY_BASELINE.md`, not applied.
- Reminder in-app notifications are inserted before the "sent" flag; now checked, still not transactional.
- Credit invites mint a token on first send and reuse it after; email idempotency key per credit and address.

## 9. Security, RLS, storage (production catalog, read-only, 2026-10-19)
- **P0, closed 2026-10-19: any accepted collaborator (any role) could take ownership of a project** (`projects` UPDATE had no `WITH CHECK` or guard trigger). Migration M0a (`docs/roadmap/schema-impact-report.md`) was approved and applied to production; verified. Detail in `docs/security/SECURITY_BASELINE.md`.
- `call_transcripts`: every column is updatable by its creator (`recording_id`, `project_id`, `created_by`). **P1**
- 0 public tables without RLS. 11 `INSERT ... WITH CHECK (true)` intake policies (analytics, client errors, RSVPs, newsletter, partner signup, unsubscribe); no UPDATE/DELETE/ALL `true` policy for a non-service role. Unbounded anonymous inserts are a spam and cost risk (`analytics_events` holds 1.4 M rows). **P2**
- 183 SECURITY DEFINER functions are executable by `anon`. The 25 sensitive ones sampled check `auth.uid()` or an admin role and pin `search_path`; the six without checks take no arguments (trigger functions). No exploit found; revoking `anon` on non-public RPCs is defence in depth. **P2**
- Storage: 12 public buckets (avatars, campaign-media, email-assets, event-photos, feedback-screenshots, listing-images, location-images, location-photos, media, opportunities, partner-logos, portfolio) and 12 private, including `meeting-recordings`, `payment-proofs`, `dispute-evidence`, `project-files`, `message-attachments`. Two private buckets named `database_export_*` hold data dumps: confirm their contents, policies and retention. **P1**
- 29 functions show no auth signal. 21 use the service role and are public by design (OG images, sitemap, payment-link pages, unsubscribe). Unauthenticated URL fetchers without the shared SSRF guard (`_shared/ssrf.ts` is used by one function): `fetch-og-data`, `fetch-portfolio-data`, `fetch-youtube-playlist`. **P0/P1**, not fixed here.
- Unauthenticated AI spend, fixed here: `generate-match-explanation`, `generate-ice-breakers`.
- Sentry Replay runs with `maskAllText: false`, `blockAllMedia: false` in production. **P1** privacy.

## 10. CI/CD and monitoring gaps
- No CI, branch protection, or typecheck gate before this change. Added: `ci.yml`, `deploy-edge-functions.yml` (manual).
- Sentry: browser only, `tracesSampleRate: 1.0`, no release or source maps, none in Edge Functions.
- No health endpoint, no uptime probe, no alert on cron, webhook or function failure. Logs live in the Supabase dashboard only.
- No backup or restore drill documented; no incident process. Added: `BACKUP_RECOVERY.md`, `INCIDENT_RUNBOOK.md`.

## 11. Not touched by this change
Payments, Stripe, Daily keys, Twilio, Gmail, OAuth, secrets, UI and copy, product features, any migration.
