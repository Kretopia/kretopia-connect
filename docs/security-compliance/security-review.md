# Security Review — Kretopia

**Status:** Internal draft · evidence-based review · **not** a certification, audit or production-readiness statement
**Review date:** 2026-11-13
**Scope:** repository `Kretopia/kretopia-connect` at the reviewed commit, its Supabase migrations, Edge Functions, client code and CI configuration.
**Out of scope:** live infrastructure probing, penetration testing, log review, provider dashboards, secret values, production database verification, mobile store configuration review beyond the repo file.

## How to read this document

| Label | Meaning |
|---|---|
| **Implemented** | Verified in the repository. Absence of a live-system check is noted. |
| **Partial** | Control exists but does not cover the stated surface. |
| **Proposed** | Recommended remediation, not present. |
| **Out of scope** | Not assessed in this review. |

Severity: **P0** = exploitable now, direct money/ownership/data integrity impact, or an irreversible action; **P1** = material risk that needs a fix this cycle; **P2** = hardening/hygiene.

### Evidence limits (read before relying on any finding)

1. Control effectiveness was **not** verified against the deployed system. Repo state has historically exceeded deployed state (`docs/platform/REPO_AUDIT.md:14-16`; `docs/security/SECURITY_BASELINE.md:1-6`).
2. `verify_jwt` is configured in the provider dashboard for all but one function; it is **not** auditable from the repo (`supabase/config.toml:1-3`).
3. Migration headers are unreliable. At least one file says "PREPARED, NOT APPLIED" while a later migration states it is live (`supabase/migrations/20260825100000_studio_role_based_money_rls.sql:4` vs `supabase/migrations/20260910130000_*.sql:9-11`).
4. Cron job definitions live only in the production database (`docs/platform/REPO_AUDIT.md:26-28`).
5. No dynamic testing, fuzzing, auth-matrix execution or penetration test was performed. No claim is made that these findings are complete.

---

## 1. Findings

### 1.1 Authentication and authorisation

#### SEC-01 · **P0** · Client can create its own wallet row with an arbitrary balance
- **Files:** `supabase/migrations/20250930110718_317c2f4c-5455-4bfa-a91f-54b9282081b8.sql:34-36` (INSERT policy), `supabase/migrations/20260823223419_43def0af-be27-4a94-892e-2e8b0ad37eef.sql:4-6` (revokes UPDATE/DELETE only), `src/components/WalletCard.tsx:33-36` (client inserts `credits: 10`).
- **Current behaviour:** `wallets` has `CREATE POLICY "Users can insert their own wallet" … WITH CHECK (auth.uid() = user_id)`. The hardening migration revokes `UPDATE, DELETE` but never `INSERT`. The browser insert proves the path is live.
- **Risk:** any authenticated user can insert a wallet row with an arbitrary `balance` (`wallets.balance` is `numeric`, `…:8`). `wallet_balance` reads that row and `wallet_debit` spends it. This is a direct path to minted balance, then `wallet-transfer` / `wallet-payout` to move value out. It also allows a duplicate/poisoned wallet row per user.
- **Minimal remediation:** `REVOKE INSERT ON public.wallets FROM anon, authenticated;` create wallets through a `SECURITY DEFINER` trigger/RPC at profile creation; keep wallet reads client-side only.
- **Acceptance test:** as user A, `POST /rest/v1/wallets` with `{"user_id":"<A>","balance":999999}` returns 403; a new account still has exactly one wallet with balance 0; `wallet-transfer` of an amount above server-derived balance is rejected by `wallet_debit`.
- **Rollback:** re-granting INSERT restores the pre-fix (vulnerable) state; no data migration is needed.

#### SEC-02 · **P0** · Client can fabricate payment transaction rows
- **Files:** `supabase/migrations/20250930110718_317c2f4c-5455-4bfa-a91f-54b9282081b8.sql:47-49`.
- **Current behaviour:** `"Users can create their own transactions" FOR INSERT WITH CHECK (auth.uid() = user_id)`; `amount`, `type`, `status` are caller-supplied (`…:18-19`).
- **Risk:** users can create `status='completed'`, `type='payment_received'` rows with any amount. Any report, invoice reconciliation, dispute review or credit decision that reads `transactions` is unreliable. Combined with SEC-01 it produces a plausible-looking money trail.
- **Minimal remediation:** revoke client INSERT/UPDATE/DELETE; write `transactions` only from service-role payment paths and `SECURITY DEFINER` ledger functions.
- **Acceptance test:** client insert returns 403; after a Stripe test top-up the only new row is created by the webhook/confirm path; no client code references `from('transactions').insert`.

#### SEC-03 · **P1** · `generate-sitemap` is an unguarded service-role function
- **Files:** `supabase/functions/generate-sitemap/index.ts:6,15-24`.
- **Current behaviour:** creates a service-role client and reads `profiles` with no `requireUser`, `requireServiceRole`, `requireAdminOrCron` or `publicPerimeter` call.
- **Risk:** anonymous, unmetered invocation of a service-role query. Impact is bounded (the returned data is already public metadata) but it enables profile enumeration and cost/DoS pressure, and it is the only function with no control at all.
- **Minimal remediation:** require `x-cron-secret` (or an admin session) at the top of the handler, and cache the generated document.
- **Acceptance test:** unauthenticated request without the cron secret returns 401; authenticated non-admin returns 403; the scheduled job still returns 200.
- **Rollback:** revert the handler guard; no schema change.

#### SEC-04 · **P1** · `auto-epk-updater` accepts an arbitrary `user_id` without authentication
- **Files:** `supabase/functions/auto-epk-updater/index.ts:101-114`.
- **Current behaviour:** `let userId = body.user_id; if (!userId) { …verify bearer… }`. Supplying `user_id` skips authentication entirely; the service-role client then reads that user's profile/credits and writes `epk_refresh_suggestions`.
- **Risk:** any caller can trigger AI spend on another account and write suggestion rows into it (integrity and cost abuse). This is a straightforward server-side authorisation bypass.
- **Minimal remediation:** always derive `userId` from a verified bearer; if the cron/service path is needed, require `x-cron-secret` and pass the user in a signed/internal-only field.
- **Acceptance test:** request with only `{"user_id":"<victim>"}` and no Authorization returns 401; with a user token for A and `{"user_id":"B"}` the write targets A or is rejected; cron path with the secret still succeeds.

#### SEC-05 · **P1** · `verify_jwt` state is not reproducible from the repository
- **Files:** `supabase/config.toml:1-3`; `.github/workflows/deploy-edge-functions.yml:1-50`; stale comments at `supabase/functions/redeem-video-guest-link/index.ts:11`, `supabase/functions/transcribe-call/index.ts:6`, `supabase/functions/event-og-image/index.ts:3`, `supabase/functions/epk-og-image/index.ts:4`.
- **Current behaviour:** only one function has an entry; the deploy workflow takes `verify_jwt` as a manual boolean and deploys function-by-function. Every other function's gateway setting lives in the dashboard.
- **Risk:** a function that forgets an in-code guard is anonymously reachable after any deploy that resets or mis-sets the flag. The repo cannot prove the current exposure of ~320 functions.
- **Minimal remediation:** enumerate every function in `config.toml` with an explicit `verify_jwt`, and add a CI check that a new function directory has an entry plus an imported guard (`guard.ts`, `admin-guard.ts`, `publicPerimeter.ts`, `aiPerimeter.ts`, or `callerAuth.ts`).
- **Acceptance test:** `supabase functions list`-equivalent config diff shows 0 unlisted functions; CI fails on a new function without a guard import or config entry.

#### SEC-06 · **P1** · AI usage limits are counted but not enforced by default
- **Files:** `supabase/functions/_shared/aiRateLimit.ts:32-35,45-55`; partial coverage (see AI review).
- **Current behaviour:** `DEFAULT_DAILY_CAP = -1` and the file states every wired call site uses `-1`. The gate records usage and fails closed on RPC error, but never denies for volume.
- **Risk:** an authenticated account can drive unbounded model spend; the reservation/receipt machinery only covers a handful of features.
- **Minimal remediation:** set a real per-feature cap per tier, keep `-1` only behind an explicit allowlist, and add a global daily spend ceiling. Do not enable new autonomous capabilities to do this.
- **Acceptance test:** the (N+1)th call in 24 h returns 429 with `Retry-After`; the ledger row shows `allowed=false`; a spend alarm fires when the global ceiling is crossed.

#### SEC-07 · **P2** · In-memory rate limiting is non-binding
- **Files:** `supabase/functions/_shared/rate-limiter.ts` (called out at `supabase/functions/_shared/aiRateLimit.ts:12-15`).
- **Current behaviour:** the module is documented as ineffective across recycled isolates; the DB-backed limiter is the real control.
- **Risk:** any endpoint wired only to the in-memory limiter is effectively unlimited.
- **Minimal remediation:** delete the in-memory limiter or mark it non-security; route all limits through `consume_ai_feature_call`.
- **Acceptance test:** grep shows no security-relevant caller of the in-memory limiter.

#### SEC-08 · **P2** · Two functions return `Access-Control-Allow-Origin: *`
- **Files:** `supabase/functions/auth-email-hook/index.ts:86`, `supabase/functions/public-digital-presence/index.ts:9`.
- **Current behaviour:** the shared helper is a strict allowlist (`supabase/functions/_shared/guard.ts:17-34`); these two bypass it.
- **Risk:** low with bearer auth and no cookies, but inconsistent and easy to copy.
- **Minimal remediation:** use `corsFor(req)` in both.
- **Acceptance test:** responses to a disallowed `Origin` carry no `Access-Control-Allow-Origin` header.

#### SEC-09 · **P1** · Agent approval markers are caller-asserted
- **Files:** `supabase/functions/_shared/agentActionBinding.ts:74-150`, `supabase/functions/_shared/agentDmBinding.ts:75-150`, `supabase/functions/send-outreach-draft/index.ts:83-88` (documents the limitation), `supabase/functions/_shared/agentAuthority.ts:11-16`.
- **Current behaviour:** the binding checks that stated approval matches the target, but a caller that simply omits the marker is not gated. High-stakes authority covers exactly three tools (`add_collaborator`, `remove_collaborator`, `delete_project`).
- **Risk:** an agent function invoked outside the orchestrator can perform a lower-risk write (message, RSVP, credit vouch) with no approval record and no durable audit row. See AI review P0 findings.
- **Minimal remediation:** move enforcement to the write, not the caller: require an approval id in the table's RLS/RPC path for agent-attributed writes, and record intent before mutation.
- **Acceptance test:** calling the agent function directly with a marker-free body still yields a `denied` audit row and no state change.

### 1.2 Supabase RLS policies

**Implemented baseline (verified):** 383 `CREATE TABLE` statements in `supabase/migrations/`, with `ENABLE ROW LEVEL SECURITY` present (391 enable statements) and no `DISABLE ROW LEVEL SECURITY`. Project-ownership escalation has an applied trigger guard (`supabase/migrations/20261019120000_guard_project_created_by.sql`), plus payer-column (`…20261020130000_guard_project_payer_columns.sql`) and owner-column (`…20261021100000_guard_project_owner_columns.sql`) guards. `profiles` server-managed columns are revoked for UPDATE at `supabase/migrations/20260823223419_43def0af-be27-4a94-892e-2e8b0ad37eef.sql:32-45`.

#### SEC-10 · **P1** · Any project member can approve a deliverable
- **Files:** `supabase/migrations/20260211050740_2b17af3e-4996-4240-ae28-67ead2901bea.sql:110-119`.
- **Current behaviour:** SELECT/INSERT/UPDATE on `project_deliverables` all use `user_has_project_access(project_id, auth.uid())`; approval is a status field writable by any member. Only delete is submitter-scoped.
- **Risk:** the party delivering can accept its own work, or a guest can accept on the client's behalf. This undermines acceptance evidence and any downstream payment/escrow decision.
- **Minimal remediation:** add an approver RPC that checks `get_project_role` for `client`/owner (or an explicit `approver_id`), and revoke direct UPDATE of approval columns.
- **Acceptance test:** a `creative`/`guest` member updating `status` to accepted is rejected; the owning client succeeds; an audit row records both attempts.

#### SEC-11 · **P1** · `project_credits` attribution can be self-asserted
- **Files:** `supabase/migrations/20260307132546_7189ba72-0d31-4815-8d4e-b390cfef5afa.sql:21-38`.
- **Current behaviour:** INSERT requires only `assigned_by = auth.uid()`; it does not require `user_has_project_access`. The credited user can self-confirm.
- **Risk:** any authenticated user can create a role attribution against any existing project id, polluting Passport credits until confirmed. This is attribution integrity, not money.
- **Minimal remediation:** require `user_has_project_access(project_id, auth.uid())` on INSERT and keep the confirmation step.
- **Acceptance test:** a non-member insert returns 403; an accepted member insert succeeds and remains `pending` until confirmed.

#### SEC-12 · **P2** · Some RLS-enabled tables have no policy
- **Files:** `supabase/migrations/**` (requires a catalogue-level check to enumerate; this review did not run one).
- **Current behaviour:** tables with RLS enabled and no policy are deny-all to client roles; reachable only by service role or `SECURITY DEFINER`.
- **Risk:** not a leak, but silently empty reads if the app expects client access. Requires an intentionality check.
- **Minimal remediation:** record the intended audience per table; add policies only where the app reads them client-side.
- **Acceptance test:** an inventory exists and matches client reads used in `src/`.

#### SEC-13 · **P2** · Two public views run without `security_invoker`
- **Files:** `supabase/migrations/20261029130000_expire_stale_external_gigs.sql:18` (`public_external_listings`), `supabase/migrations/20251005045632_723bee42-755a-47e5-9792-2ee38c0fdcc0.sql:9,24` (`review_requests_public`).
- **Current behaviour:** views run as owner; underlying RLS is bypassed; safety rests on the column list.
- **Risk:** adding one sensitive column to either view exposes it to all readers.
- **Minimal remediation:** set `security_invoker = true` (or add an explicit guard view over a restricted function).
- **Acceptance test:** with `security_invoker`, a signed-in non-participant querying another user's row returns 0 rows.

#### SEC-14 · **P1** · Anonymous intake tables are unbounded
- **Files:** 11 `WITH CHECK (true)` intake policies; documented at `docs/security/SECURITY_BASELINE.md:13`.
- **Current behaviour:** analytics, client-error, RSVP, newsletter, partner and unsubscribe inserts accept anonymous rows with no rate limit in the database.
- **Risk:** storage/cost abuse and dataset pollution; one prior incident produced 87% of 1.4 M analytics rows from 90 looping sessions.
- **Minimal remediation:** per-IP/per-session limiter in the insert path, row-size caps, and a retention job.
- **Acceptance test:** a burst above the cap returns 429 and writes no row; retention removes rows older than the policy.

### 1.3 Edge Functions and API routes

There are **323** function entry points under `supabase/functions/`, **264** files referencing a service-role key, and **290** creating a client. Guard adoption (verified by import grep): `guard.ts` in 300 files, `requireAdminOrCron` in 47, `publicPerimeter` in 35, `requireAiCaller` in 33, `requireUser` in 21, `requireServiceRole` in 4.

**Implemented pattern:** `callerAuth.ts:13-56` classifies service / user / anonymous and correctly documents that gateway `verify_jwt` only proves "a valid JWT", not a session. `requireUser` verifies via `auth.getUser` (`guard.ts:43-51`); `requireServiceRole` is constant-time (`guard.ts:63-68`); AI callers are validated against the account backend with no fallback (`aiPerimeter.ts:7-24`).

#### SEC-15 · **P1** · No CI guarantee that a function ships with a guard
- **Files:** `.github/workflows/ci.yml:1-56` (typecheck, lint, test, build only); `.github/workflows/deploy-edge-functions.yml:30-50`.
- **Current behaviour:** deploy accepts a free-text function list and a JWT boolean. Nothing checks authorisation.
- **Risk:** guard coverage is a convention, not a control, across 323 entry points.
- **Minimal remediation:** CI job that fails when `supabase/functions/*/index.ts` imports none of the perimeter modules, with an explicit allowlist file for public endpoints.
- **Acceptance test:** a dummy function with no guard import fails CI; adding it to the allowlist with a stated reason passes.

#### SEC-16 · **P2** · Cron surface is not auditable from the repo
- **Files:** `docs/platform/REPO_AUDIT.md:26-29`; `supabase/migrations/20261020180000_prune_cron_run_details.sql:9-13`.
- **Current behaviour:** 21–23 jobs exist only in the production database; commands embed secrets; no job reports its outcome.
- **Risk:** a job can call an unguarded function and no reviewer can see it; silent failures look like success.
- **Minimal remediation:** define jobs in versioned SQL with secrets from a managed source, and have each job write a success/failure row.
- **Acceptance test:** a clean environment can recreate the job list from the repo; a failed job raises an alert.

### 1.4 File and guest access

**Implemented (verified):**
- `get-download-urls` authenticates with `auth.getClaims`, checks `marketplace_orders.buyer_id`, rejects unpaid/refunded states, and restricts paths to a fixed product-file helper (`supabase/functions/get-download-urls/index.ts:43,69-90`).
- `redeem-project-share` is service-role + `publicPerimeter`, bounds token length, throttles the password step per IP+token, and checks `can_approve`/`can_download` before signing URLs (`supabase/functions/redeem-project-share/index.ts:66-92`).
- The `project-files` bucket was made private and its public-read policy dropped (`supabase/migrations/20260419162823_1325a5e9-1e15-42fe-a157-8d0a7d521efd.sql:3-7`).
- Guest wallet tables have RLS enabled and no client policies (`supabase/migrations/20260509004356_9010e1fc-2b03-41f8-a613-05d3d5c36197.sql:46-49`).

#### SEC-17 · **P2** · Guest video link is not single-use
- **Files:** `supabase/functions/redeem-video-guest-link/index.ts:30-79`.
- **Current behaviour:** expiry is enforced (`:52-57`), but `used_at` is only stamped when null and an already-used token still mints a new meeting token.
- **Risk:** a leaked guest link is reusable within its expiry window, bounded only by a 10/min per-IP perimeter.
- **Minimal remediation:** reject when `row.used_at` is set (or allow a defined grace count) and rotate on reissue.
- **Acceptance test:** second redemption returns 410; first returns 200.

#### SEC-18 · **P2** · Public bucket for AI-generated images
- **Files:** `supabase/functions/generate-gig-cover/index.ts:101` (and the other `generate-*-image` functions).
- **Current behaviour:** generated images are written to public buckets and returned as public URLs.
- **Risk:** user-influenced generated content is publicly addressable and outside the private-file access model.
- **Minimal remediation:** write to a private bucket and serve through signed URLs or a CDN path with an explicit public flag.
- **Acceptance test:** a newly generated image URL is not fetchable without a signature.

### 1.5 Stripe webhooks

**Implemented (verified):**
- HMAC verification with timestamp tolerance in a pure, testable module (`supabase/functions/_shared/stripeSignature.ts:1-50`).
- Event ledger claimed **before** processing and released on non-2xx failure, with the failure mode documented (`supabase/functions/_shared/webhookLedger.ts:25-43`; used at `supabase/functions/stripe-wallet-webhook/index.ts:15-39` and `supabase/functions/stripe-marketplace-webhook/index.ts:46-80`).
- Compare-and-set escrow transitions so duplicates cannot double-capture (`supabase/functions/stripe-marketplace-webhook/index.ts:194-267`).
- Deterministic Stripe idempotency keys on checkout/transfer paths (`create-checkout/index.ts:84-86`, `wallet-payout/index.ts:54,60`).

#### SEC-19 · **P1** · Refund and dispute events are notification-only
- **Files:** `supabase/functions/stripe-marketplace-webhook/index.ts:749-783`.
- **Current behaviour:** `charge.refunded` and dispute branches log "manual reconciliation required, no automatic DB write" and notify. There is no refund/dispute state machine, ledger or operator tooling.
- **Risk:** paid state can remain true after a refund; entitlement, payout and reporting drift; no auditable resolution. Materially relevant to the mentor's money-laundering/chargeback question.
- **Minimal remediation:** persist refund/dispute events to a ledger table, mark the order/milestone, and block new payouts against disputed amounts. Manual approval for the reversal itself.
- **Acceptance test:** a Stripe test refund produces a `refunded` order state and a ledger row; payout for that milestone is blocked; replaying the event is idempotent.

#### SEC-20 · **P1** · Several payment lifecycle events have no handler
- **Files:** `supabase/functions/stripe-marketplace-webhook/index.ts` (event switch), `supabase/functions/check-subscription/index.ts`.
- **Current behaviour:** no `customer.subscription.*`, `invoice.payment_failed`, `payout.failed`, `charge.dispute.closed`, or `radar.early_fraud_warning` handling is present.
- **Risk:** failed renewals, failed payouts and resolved disputes leave the database in a stale state; fraud signals are not acted on.
- **Minimal remediation:** add handlers that record state and notify; no automatic money movement.
- **Acceptance test:** a test `payout.failed` marks the payout failed and notifies; a `dispute.closed` (won) clears the block.

#### SEC-21 · **P2** · Tracked schema and written values disagree
- **Files:** `supabase/migrations/20250930110718_317c2f4c-5455-4bfa-a91f-54b9282081b8.sql:18` vs `supabase/functions/wallet-topup-confirm/index.ts` and `supabase/functions/wallet-transfer/index.ts` (`"received"`/`"sent"`); `wallet_transfers.idempotency_key` has no defining migration in `supabase/migrations/` or `drizzle/migrations/`.
- **Current behaviour:** the CHECK constraint does not allow values the functions write; a column the functions depend on is not tracked.
- **Risk:** either the deployed schema differs from the repo (drift) or the write path fails at runtime; both undermine reconciliation.
- **Minimal remediation:** reconcile with a read-only schema diff, then add a corrective migration for the constraint/column.
- **Acceptance test:** a schema diff between migrations and production is empty; the confirm and transfer paths succeed in a test project.

### 1.6 Secrets and environment variables

**Implemented (verified):** no service-role key reaches the browser bundle. The live client reads only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (`src/integrations/supabase/legacyClient.ts:5-16`); `.env` is gitignored (`.gitignore:14,36-38`) and contains no service key; Sentry is lazy and disabled without a DSN (`src/lib/sentryInit.ts:16-40`).

#### SEC-22 · **P2** · Public backend coordinates are hardcoded in the build config
- **Files:** `vite.config.ts:23-28,43,62-68`.
- **Current behaviour:** `PUBLIC_SUPABASE_DEFAULTS` contains the URL and publishable key as literals and is selected unconditionally under `FORCE_LEGACY_BACKEND = true`.
- **Risk:** these values are public by design (they ship in every bundle), but rotation requires a code change and the repo cannot point at another environment without editing source.
- **Minimal remediation:** keep the fallback for local/dev, but read the production pair from build-time env with a CI assertion that they are present.
- **Acceptance test:** a build with no env vars fails in CI rather than silently using committed defaults.

#### SEC-23 · **P1** · Service-role concentration and no rotation schedule
- **Files:** 264 functions reference `SUPABASE_SERVICE_ROLE_KEY` (e.g. `supabase/functions/agent-orchestrator/index.ts:628-639`); secret **names** listed in `docs/security/SECURITY_BASELINE.md:5`.
- **Current behaviour:** a single key bypasses all RLS and is used by nearly every function; rotation is documented only as "rotate on exposure".
- **Risk:** one leaked key is a total confidentiality/integrity compromise. No scheduled rotation, no per-function scoping, no usage anomaly detection.
- **Minimal remediation:** document a rotation runbook with a rehearsed procedure, separate keys per trust boundary where the platform allows, and alert on service-role use from unexpected functions.
- **Acceptance test:** a rotation drill completes without downtime; the old key is rejected; an alert fires on service-role use from a non-allowlisted function.

### 1.7 Input validation

**Implemented:** shared `readJson` enforces a 64 KB body cap and a Zod schema, returning field-level 400s (`supabase/functions/_shared/guard.ts:70-105`). SSRF fetching was hardened through a shared `safeFetch` with per-redirect revalidation (`docs/security/SECURITY_BASELINE.md:4`).

#### SEC-24 · **P2** · Validation coverage is uneven
- **Files:** many handlers call `await req.json()` directly (e.g. `supabase/functions/auto-epk-updater/index.ts:103`, `supabase/functions/agent-rsvp-event/index.ts:12`).
- **Current behaviour:** no schema, no size cap beyond the platform default.
- **Risk:** malformed/oversized input reaches service-role queries; inconsistent error shapes.
- **Minimal remediation:** one schema per public/agent-mutating function, migrated opportunistically; add a lint rule banning bare `req.json()` in functions that write.
- **Acceptance test:** oversized and type-confused bodies return 400/413 consistently.

### 1.8 Error handling

**Implemented:** `safeError` returns a generic 500 and logs server-side (`supabase/functions/_shared/guard.ts:121-126`).

#### SEC-25 · **P2** · Many functions still return `error.message` to the caller
- **Files:** documented at `docs/security/SECURITY_BASELINE.md:4`; representative pattern `supabase/functions/agent-rsvp-event/index.ts:54-58`.
- **Current behaviour:** internal error text, including provider and database messages, reaches the client.
- **Risk:** schema/provider detail disclosure that assists targeted attacks.
- **Minimal remediation:** route through `safeError`; keep a correlation id.
- **Acceptance test:** a forced database error returns `{"error":"Something went wrong"}` plus a correlation id, with the detail only in logs.

### 1.9 Logging and audit trails

**Implemented:** `stripe_webhook_events` (service-role only, RLS at `supabase/migrations/20260528125850_6b5c8803-258c-4ced-b9cc-908a22fa1308.sql:77-84`), `import_audit_log`, `creative_actions`, `orch_actions`, `client_error_logs`.

#### SEC-26 · **P1** · There is no general append-only audit trail
- **Files:** `docs/platform/AUDIT_TRAIL_DESIGN.md:1-8` (design only; `audit_events` does not exist).
- **Current behaviour:** no durable record of who read a recording, changed a credit, changed a role, or approved a deliverable.
- **Risk:** incident investigation, dispute resolution and agent accountability all lack primary evidence. This is a direct blocker for the mentor's AI-monitoring and incident-response concerns.
- **Minimal remediation:** implement the designed `audit_events` table and emit the priority actions listed in that document (recording access, credit changes, membership, webhook, admin, owner change).
- **Acceptance test:** each listed action produces exactly one `audit_events` row with actor, object, outcome and no sensitive body; client roles cannot insert/update/delete.

#### SEC-27 · **P2** · Observability covers the browser only
- **Files:** `src/lib/sentryInit.ts:16-40`; `docs/platform/REPO_AUDIT.md:68-70`.
- **Current behaviour:** Sentry is browser-only; Edge Functions log to the provider console; no uptime probe, no webhook-failure alert, no cron alert.
- **Risk:** server-side compromise or silent payment failure is noticed late or not at all.
- **Minimal remediation:** structured function logs with a correlation id, error forwarding for Edge Functions, and alerts on webhook 5xx and cron failure.
- **Acceptance test:** a injected 500 in a test function raises an alert within the agreed window.

#### SEC-28 · **P1** · Mobile build enables cleartext traffic and remote content loading
- **Files:** `capacitor.config.ts:7-9`.
- **Current behaviour:** `server.url` points at a hosted preview origin and `cleartext: true` permits non-TLS traffic.
- **Risk:** for a store-distributed build this weakens transport guarantees and ties the app to a preview host rather than production. Needs confirmation that the shipped binary uses this config.
- **Minimal remediation:** bundle the production build (`webDir`) with no remote `server.url`, set `cleartext: false`, and pin the production origin.
- **Acceptance test:** a release build makes no cleartext request and has no preview host in its config; a TLS-intercept proxy cannot read traffic.

---

## 2. Prioritised remediation list

### P0 — fix before any further payment or agent activation
| ID | Action | Files / systems |
|---|---|---|
| SEC-01 | Revoke client INSERT on `wallets`; server-create wallets | `wallets` policy + grant; `src/components/WalletCard.tsx` |
| SEC-02 | Revoke client INSERT on `transactions`; ledger-only writes | `transactions` grants; payment functions |
| AI-01…03 | Add approval + audit to agent writes and stop unreviewed AI publication | see `ai-agent-governance-review.md` |
| PAY-01 | Freeze new credit/payout activation until the credit taxonomy is documented and the wallet fixes are live | product + payment functions |

### P1 — this cycle
SEC-03, SEC-04, SEC-05, SEC-06, SEC-09, SEC-10, SEC-11, SEC-14, SEC-15, SEC-19, SEC-20, SEC-23, SEC-26, SEC-28; plus DP-01…DP-06 and AI-04…AI-09 from the companion documents.

### P2 — backlog
SEC-07, SEC-08, SEC-12, SEC-13, SEC-16, SEC-17, SEC-18, SEC-21, SEC-22, SEC-24, SEC-25, SEC-27.

---

## 3. What this review does **not** establish

- It does not establish that the deployed system matches this repository.
- It does not establish that no other vulnerabilities exist; no penetration test, fuzzing, or auth-matrix execution was performed.
- It does not establish security certification, GDPR compliance, or production readiness.
- It does not assess legal sufficiency of any control described here.
