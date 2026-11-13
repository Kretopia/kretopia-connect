# Security review (source level)

Status: internal working document, 2026-11-13. A reading of the repository at `main` (13f51619b): front end, 323 edge functions, 107 shared modules, 801 SQL migrations. No live testing, no attack on any system, no production queries. Where the repository's migrations may not match the legacy production backend, the finding says to verify first. This review does not replace an external audit or a penetration test (§6), and it does not say the platform is secure or production-ready.

Risk: **High** (exploitable by a signed-in user for money, impersonation or private data), **Medium** (needs conditions, or limited impact), **Low**.

## 1. What is already in place

- **Row-level security** on every public table (`SECURITY_BASELINE.md` §1, production check of 2026-10-19).
- **Money and trust columns closed to clients**: invoice status and payment fields (`20260904180000`, `20260910190000`), milestone status (`20260824100000`), wallet updates and deletes (`20260823223419`), transfers and top-ups (`20260804103153`, `20260910150100`), payment-link counters (`20260913120000`), creator wallets and payouts (`20260823223419`), profile verification and subscription fields (`20260904150000`), credit verification escalation (`guard_credit_verification_escalation`, `20260812071205`, `20261028130000`).
- **Project ownership**: a collaborator cannot change `projects.created_by` (trigger, applied 2026-10-19) or the payer fields (M6, applied 2026-10-20). Functions that use the service role check access through `_shared/projectAccess.ts` (owner or accepted collaborator only, unknown roles treated as guest, errors deny), used by 12 functions; others check through the caller's own row access.
- **Stripe webhooks** verify the signature on the raw body with Stripe's verifier and its timestamp tolerance, refuse events from the other mode (`_shared/stripeEnv.ts`), and claim the event id in a ledger before acting (`_shared/webhookLedger.ts`); covered by tests and, from this change, pinned by `src/lib/__tests__/security/stripeWebhookControls.test.ts`.
- **Agent execution** is fail-closed on the main paths (`_shared/executionGuard.ts`, `_shared/approvalHardening.ts`, `_shared/agentAuthority.ts`); the one card-charging tool is locked.
- **Client bundle** carries only public configuration (backend URL, publishable key, project id, VAPID public key, site URL, Sentry DSN); the only JWT in tracked files is the publishable (anon) key. Pinned from this change by `src/lib/__tests__/security/clientSecretsGuard.test.ts`.
- **SSRF guard** on server-side URL fetchers (`_shared/ssrf.ts`), constant-time secret comparison, cron functions behind a shared secret, admin functions behind `requireAdmin`, public endpoints behind `publicPerimeter` rate limits (102 of 323 functions call a limiter or perimeter).
- **Sentry** masks text and inputs and blocks media.

## 2. Findings

| ID | Area | Finding | Evidence | Risk | Remediation |
|---|---|---|---|---|---|
| S-1 | Authorisation (money) | A user without a wallet row can insert one with any `balance` and `credits` | `20250930110718_*.sql:34-36` (INSERT policy checks only `user_id`); INSERT never revoked; `WalletCard.tsx:33-37` creates missing wallets from the browser; `wallet-transfer` spends `wallets.balance` | High (verify in production) | Remediation plan A-1: trigger forcing balance 0 for API roles. Needs approval |
| S-2 | Authorisation (integrity) | The receiver of a message can rewrite its text, sender and receiver | `20250930141941_*.sql:29-31`; no `WITH CHECK`, no column grant | High (verify in production) | A-2: restrict client UPDATE to read-state columns. Needs approval |
| S-3 | Agent authorisation | The Desk agent posts AI-written chat messages and call links, and edits tasks, without per-action approval; the registry marks the message tool `requires_approval` | `desk-agent/index.ts:686-700`, `779-785`; `_shared/agentAuthority.ts` header | High | A-3: route through the existing propose, approve, execute flow. Needs approval |
| S-4 | Payment state | Manually recorded payments are stored as `paid`, like provider-verified ones; a project member may be able to insert an already-paid invoice if `20261015100000` is not applied | `20261015100000_invoices_provider_reference.sql` header ("Not applied by anyone"); `confirm_invoice_paid_manually` (`20260812071205_*.sql:490`) | High until verified | A-4: apply the reviewed migration; label manual payments. Needs approval |
| S-5 | Webhooks | The event ledger fails open on a non-duplicate insert error | `_shared/webhookLedger.ts` (`"unrecorded"` → process anyway) | Medium | A-5: answer 500 so Stripe retries. Needs approval |
| S-6 | Rate limiting / cost | 8 signed-in AI functions have no limiter or credit check; 31 more to verify | list in the remediation plan, P1-2 | Medium | Adopt `requireAiCaller` |
| S-7 | Error handling | 25 functions return raw `error.message` | `grep -rlE 'JSON\.stringify\(\{ *error: *(e|err|error)(\?)?\.message' supabase/functions` | Medium (information disclosure) | `safeError` from `_shared/guard.ts` when touched |
| S-8 | Authorisation (SQL helper) | `user_has_project_access()` admits pending invitees | `_shared/projectAccess.ts` header | Medium | Use an accepted-only predicate in policies on private data |
| S-9 | Audit | Agent plan history is editable and deletable by its owner | `copilot_plans` policies (`20260502152223_*.sql:22-34`) | Medium | Append-only log (P1-3) |
| S-10 | Agent retries | No idempotency key per side effect, no "outcome unknown" | `_shared/executionGuard.ts` header | Medium | P1-4 |
| S-11 | Account enumeration | `lookup-auth-providers` can tell whether an email has an account | `SECURITY_BASELINE.md` §4 | Medium | Generic answer, rate limit |
| S-12 | Webhooks | Daily recording webhook's raw-body form has no age bound | `SECURITY_BASELINE.md` §3 | Low | Require the timestamped form |
| S-13 | Ledger integrity (display) | Users can insert arbitrary rows into their own `transactions` history | `20250930110718_*.sql:47-49` | Low (server never trusts it) | Revoke client INSERT |
| S-14 | Supply chain | `npm install` in CI (lockfile not enforced), three lockfiles, no audit, no SBOM, floating edge-function imports (`esm.sh/...@2`) | `.github/workflows/ci.yml`; lockfiles at the root | Medium | §5 |
| S-15 | CORS | `corsFor` (`_shared/guard.ts`, used by 294 functions) reflects only Kretopia's own HTTPS origins and the editor's preview hosts (older notes saying `*` are out of date). Two functions still answer any origin: `public-digital-presence` and `auth-email-hook` | `grep -rlE "Access-Control-Allow-Origin['\"]?\s*:\s*['\"]\*" supabase/functions` | Low (bearer tokens, no cookies) | Move both to `corsFor` when touched; keep bearer-only auth |
| S-16 | Intake tables | 11 `WITH CHECK (true)` intake tables without a size cap | `SECURITY_BASELINE.md` §1 | Low | Caps or rate limits |
| S-17 | File access | Cached recording links are bearer URLs readable by anyone who can read the transcript row | `SECURITY_BASELINE.md` §2 | Low | Shorter validity, no caching |
| S-18 | Dead code | A circle's welcome DM is inserted with another user as sender; RLS rejects it | `src/pages/CircleChatView.tsx:277` | None (refused) | Remove or move server-side |

Not reviewed in depth here (scope and time): every one of the RLS policies (use `docs/security/RLS_TEST_PLAN.md`), every public service-role function's response (P1-11), the integration OAuth `state` expiry, the Cloud backend's own functions.

## 3. Payments: risks and proposed server-side controls

No payment flow was enabled or changed. What exists: Stripe Checkout and payment links (card data never reaches Kretopia), Stripe Connect payouts that require `payouts_enabled` on the connected account (`wallet-payout`), wallet-to-wallet transfers with amount validation, an idempotency key and daily and monthly limits (`check_transfer_limit`), atomic debit and credit functions callable only by the service role, refunds, disputes and transfer reversals handled by the marketplace webhook, a manual "paid" record for invoices settled outside Stripe.

| Risk | Where it shows | Proposed control |
|---|---|---|
| Money laundering through wallet transfers (pay in by card, transfer to another member, pay out) | `wallet-transfer`, `wallet-payout` | Hold period on funds before payout; velocity rules per account and per pair of accounts; flag circular transfers; payouts only to the same person who was verified by Stripe Connect; keep transfer limits server-side (they are) |
| Sanctions | onboarding of connected accounts | Rely on Stripe Connect's checks for payees; do not allow payouts from wallets whose holder has no verified connected account (already true); document it |
| Fraud with stolen cards | top-ups, payment links | Stripe Radar rules; delay availability of top-up funds; refund to the original card only |
| Duplicate payments | webhook redelivery; double taps | Ledger dedupe (exists); idempotency keys on transfers (exists); fix the fail-open case (A-5) |
| Self-declared payment shown as settled | `confirm_invoice_paid_manually` | A-4: provider reference column and a visible "recorded by the issuer" label |
| Currency mixing | `wallet-transfer` comment: the wallet has one balance, and every currency label other than TTD counts in the same bucket | Store a currency on each wallet and refuse transfers in another currency, or convert explicitly with a recorded rate |
| Reconciliation | wallets, top-ups, transfers, payouts, Stripe balance | Daily job comparing the sum of wallet balances with ledger totals and the Stripe balance; alert on any difference; never adjust balances by hand without a recorded reason |
| Client-created balances | S-1 | A-1 |

What a client is buying: a role or a job on a project (a milestone, an invoice line, a ticket), each with its own status. Credits are records of work, not money (see `terms-and-ip-draft.md`).

## 4. Test plan

| Test | Type | Status |
|---|---|---|
| Client bundle carries only public configuration | static, `clientSecretsGuard.test.ts` | added, passing |
| Stripe webhooks keep raw body, signature, mode and ledger controls in order | static, `stripeWebhookControls.test.ts` | added, passing |
| Stripe signature, freshness and ledger behaviour | unit, `stripeWebhookSignature`, `webhookFreshness`, `webhookLedger`, `marketplaceWebhookScenarios`, `guestWallet` | existing |
| Agent approval guard, plan hardening, collaborator tools | unit, `executionGuard`, `copilotExecutorApproval`, `collaboratorToolsApproval` | existing |
| RLS: wallet INSERT with a balance is refused (after A-1) | SQL, run as `authenticated` in a transaction that rolls back | to add with A-1 |
| RLS: receiver cannot change message text or sender (after A-2) | SQL, as above | to add with A-2 |
| Desk agent: message and call tools create a proposal, not a post (after A-3) | edge handler test in `src/lib/__tests__/edge` | to add with A-3 |
| API-role INSERT of a paid invoice is refused (after A-4) | SQL | to add with A-4 |
| Ledger failure answers 500 and processes nothing (after A-5) | unit | to add with A-5 |
| Every AI function has a per-user limit | static, like `aiPerimeterHandlers.test.ts` | to add with P1-2 |
| Every policy on private data uses an accepted-only predicate | SQL catalog check | to add with P1-10 |

Run these in CI on every change; run the SQL tests against a staging copy of the production schema, never against production data.

## 5. Software supply chain: SBOM plan and process

**Inventory today.** Front end: Node with npm (CI runs `npm install`), 102 runtime and 26 development dependencies in `package.json`, three lockfiles at the root (`package-lock.json`, `bun.lock`, `bun.lockb`), no `engines` or `packageManager` pin. Back end: Deno edge functions importing by URL (`esm.sh`, `deno.land/std` at fixed versions in some functions, floating majors such as `@2` in others) and by `npm:` specifier with versions; six functions have their own `deno.json`. Database: SQL migrations. Deployment: front end through the editor's hosting; functions through a manual, approval-gated workflow (`deploy-edge-functions.yml`, environment `production`).

**Plan.**

1. One package manager and one lockfile: choose npm (what CI uses), delete the other two lockfiles in a reviewed change, add `packageManager` and `engines`.
2. CI uses `npm ci` (fails on lockfile drift) instead of `npm install`.
3. SBOM: generate a CycloneDX SBOM for the front end at build time (`npm sbom --sbom-format cyclonedx`, built into npm, no new dependency) and attach it to each release; for functions, generate a list of every remote import and `npm:` specifier with its resolved version (a short script over `supabase/functions`), stored with the release.
4. Vulnerability scanning: `npm audit --omit=dev --audit-level=high` in CI; GitHub Dependabot alerts on; review advisories weekly.
5. Pin edge-function imports to exact versions (no `@2`); add a test that fails on a floating version.
6. Dependency review: a new dependency needs a reason in the pull request, a licence check and an owner; remove unused ones.
7. Release verification: build from a tagged commit in CI, record the commit, the SBOM and the test results; deploy only what CI built.
8. Secret scanning: GitHub secret scanning and push protection on; the guard test from this change runs in CI.

No package was installed for this review.

## 6. External audit and penetration test

Recommended before scaling up (more users, live payouts, business clients, enterprise sales): an external security audit and penetration test covering the web app, authentication, the database policies, the edge functions, the payment flows and webhooks, file storage, and the agent tools (including prompt injection that tries to trigger tool calls). Fix this review's High findings first so the test spends its time on what is unknown. A source review like this one does not replace a test by people who try to break the running system.
