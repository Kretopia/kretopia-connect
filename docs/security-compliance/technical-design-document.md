# Technical Design Document — Kretopia

> ## INTERNAL DRAFT — NOT FOR EXTERNAL DISTRIBUTION
> This document describes internal architecture and known weaknesses. It is **not** a production-readiness statement, a security certification, or a complete design record. A sanitised summary suitable for fundraisers is in Appendix A; share only that appendix externally.

**Version:** 0.1 (draft) · **Date:** 2026-11-13
**Scope:** current implemented system as found in `Kretopia/kretopia-connect`.
**Excluded:** live infrastructure identifiers, credentials, project references, provider account details, and any secret value.

## Evidence limits

- Describes the repository, not verified production state. Deployment drift is documented in `docs/platform/REPO_AUDIT.md:14-16`.
- No capacity, latency or availability measurements were taken.
- Third-party contract terms and regions were not inspected.

---

## 1. System architecture

```
                    ┌───────────────────────────────┐
                    │  Browser SPA (React 18 + Vite)│
                    │  PWA / Capacitor iOS+Android  │
                    └───────────────┬───────────────┘
                                    │  HTTPS (publishable key + user JWT)
              ┌─────────────────────┼──────────────────────┐
              │                     │                      │
      ┌───────▼────────┐   ┌────────▼─────────┐   ┌────────▼─────────┐
      │ Managed Postgres│   │ Edge Functions   │   │ Object storage   │
      │ + RLS + Auth    │◄──┤ (Deno, ~323)     ├──►│ public + private │
      │ + Realtime      │   │ service role     │   │ buckets          │
      └───────┬─────────┘   └───┬──────┬───────┘   └──────────────────┘
              │                 │      │
              │                 │      └────────► AI gateway ──► model provider
              │                 ├───────────────► Payments provider (checkout, Connect, webhooks)
              │                 ├───────────────► Email provider / SMTP
              │                 ├───────────────► Video/call provider
              │                 ├───────────────► Search & scraping provider, public feeds
              │                 └───────────────► Social/music/film APIs
              │
       ┌──────▼──────────┐
       │ Scheduled jobs  │  (defined in the database, not the repo)
       └─────────────────┘
```

**Layers**
- **Client:** single-page React app, static build, installed as a PWA and wrapped by Capacitor. Talks to Postgres/Auth/Storage directly with the publishable key plus the user's JWT, and to Edge Functions for privileged work.
- **Data:** managed Postgres with row-level security on every public table; Auth; Realtime; object storage with a mix of public and private buckets.
- **Compute:** Deno Edge Functions. Most run with the service-role key, so **authorisation is per-function**, not RLS.
- **Scheduling:** database-scheduled HTTP jobs. The job list is not in the repo.
- **Integrations:** payment, email, video, AI gateway, search/scraping, and social/music APIs.

**Design consequence:** there are two authorisation models in one system (RLS for direct client access, per-function checks for service-role functions). This is the single most important fact for reviewing security: a missing check in a function is equivalent to a missing RLS policy, but is not visible in the database.

---

## 2. Data flows

| Flow | Path | Trust boundary | Controls today |
|---|---|---|---|
| DF1 | Client → Postgres/Storage (direct) | Untrusted client | RLS + grants; publishable key only |
| DF2 | Client → Edge Function | Untrusted client | Per-function: JWT, perimeter, cron secret, or none |
| DF3 | Edge Function → Postgres/Storage | Trusted service role | None at the database layer; per-function checks only |
| DF4 | Edge Function → payment provider | Third party | Server-side amounts, idempotency keys |
| DF5 | Payment provider → webhook | Third party | HMAC + timestamp tolerance + event ledger |
| DF6 | Edge Function → AI gateway | Third party | Session check, partial rate limits, partial prompt isolation |
| DF7 | Edge Function → email | Third party | Shared policy for some paths; direct provider calls bypass it |
| DF8 | Edge Function → external search/scrape | Untrusted content in | SSRF guard on fetchers; content then enters prompts |
| DF9 | Agent → any of DF3–DF7 | Semi-trusted automation | Approval binding (partial), post-hoc audit (best effort) |
| DF10 | MCP client → Edge Function | Third-party assistant | OAuth bearer, read-only tools |
| DF11 | Client → error monitoring | Third party | Masked replay, disabled without a DSN |

Personal-data categories and retention are catalogued in `data-protection-review.md`.

---

## 3. Authentication and authorisation

### 3.1 Authentication
- **Implemented:** email/password and OAuth through the managed auth provider; a `@username` login path resolves username → email in a server-side function and returns session tokens only, never the email, with atomic rate limiting (per `AGENTS.md` and the username-auth function).
- **Implemented:** guest access for shares, invoices, payment links and guest wallets uses unguessable tokens with bounded checks.
- **Client:** session persisted by the Supabase client; the publishable key is embedded in the bundle (public by design).

### 3.2 Authorisation
- **RLS:** enabled on all public tables; policies are owner-scoped or access-predicate-scoped (`user_has_project_access`, `get_project_role`).
- **Function perimeter:** `requireUser`, `requireServiceRole`, `requireAdminOrCron`, `publicPerimeter`, `requireAiCaller` (`supabase/functions/_shared/`).
- **Caller classification:** `callerAuth.ts` distinguishes service / user / anonymous; it documents that gateway JWT verification proves only "a valid token", not a signed-in user.
- **Role model:** project roles `member | client | creative | guest`; pending invites explicitly do not grant access.
- **Known weaknesses:** see §9 and `security-review.md` (client-writable wallet/transaction rows; unguarded sitemap; auth bypass in one AI updater; no CI guard coverage).

---

## 4. Project and company boundaries

| Boundary | Rule | Evidence |
|---|---|---|
| Project access | Creator, match participant, or accepted collaborator | `20261009090200_studio_pending_invitees_and_collaborator_writes.sql:38-63` |
| Pending invite | No access | same |
| Project owner | `created_by`, immutable via API | `20261019120000_guard_project_created_by.sql` |
| Commercial columns | Owner/service only | `20261020130000`, `20261021100000` |
| Deliverable acceptance | **Any accepted member** (gap) | `20260211050740_*.sql:116` |
| Company/workspace | An org workspace layer exists; it is **not** project ownership | `20260912130000_minimal_org_workspace_layer.sql:42` |
| Cross-project isolation | Enforced by predicates and per-function checks, not by database-level tenancy | — |

**Design intent (per `AGENTS.md`):** Company Studio reuses the same project workspace with additive hiring actions, so projects, invitations and permissions must remain identical across Creator and Company modes. There is no separate tenant boundary to review.

---

## 5. Payment architecture

```
Client ──► create-checkout / create-invoice-checkout / create-payment-link-checkout
              │  (server resolves Price ID / stored amount)
              ▼
        Payment provider Checkout  ──► provider webhook (HMAC + ledger)
                                          │
                                          ▼
                    orders / milestones / wallets / entitlements
                                          │
                    wallet_debit / wallet_credit (SECURITY DEFINER, service role only)
                                          │
                                          ▼
                             payouts via connected accounts
```

| Concern | Design | Status |
|---|---|---|
| Amount integrity | Server-side price/amount lookup | Implemented |
| Duplicate payment | Stripe idempotency keys + webhook ledger | Implemented |
| Escrow | Milestone rows with CAS state transitions | Implemented |
| Balance integrity | `wallet_debit`/`wallet_credit` are service-role only | **Partial** — client can still INSERT a wallet/transaction row |
| Payout eligibility | Connected-account `payouts_enabled` | Implemented |
| Refund/dispute | Notification only | **Gap** |
| Reconciliation | Receipt-based for AI cost only | **Gap** for payments |
| Fee model | Hardcoded rates in the webhook | Partial |

**Design principle to preserve:** no agent initiates a payment or payout today. Keep it that way.

---

## 6. AI and agent architecture

```
User / cron / MCP
      │
      ▼
Edge Function (session or cron secret)
      │
      ├─► requireAiCaller / rate gate / budget  (partial coverage)
      ├─► prompt assembly (+ promptIsolation at ~24 sites, missing at ~40)
      ├─► AI gateway ──► model provider
      │
      ├─► plan / proposal tables (inert)
      └─► tool execution
             ├─ approval binding (3 high-stakes tools; caller-asserted otherwise)
             ├─ service-role database writes
             ├─ email / push
             └─ post-hoc audit (best effort)
```

| Component | Role | Status |
|---|---|---|
| Kreto | Conversational assistant with resources/attachments | Implemented |
| Orchestrator | Plans and executes registry tools | Implemented; approval partial |
| Copilot planner/executor | Project planning and step execution | Implemented |
| Desk/Surface/Money/Inbox watchers | Scheduled proposals | Implemented; produce proposals only |
| Auto-resolution + moderation | Background state changes | Implemented; **no human approval** |
| Memory / Studio Brain | `copilot_memories`, `thrive_memory`, `studio_facts`, `agent_project_context` | Implemented; no retention |
| MCP server | Five read-only tools over OAuth | Implemented; unaudited |
| Cost metering | Measured receipts for 4 features; default cap unlimited | Partial |

Full inventory and P0 gaps: `ai-agent-governance-review.md`.

---

## 7. Security controls (summary)

| Control | Status | Reference |
|---|---|---|
| RLS on all public tables | Implemented | §3 |
| Owner/payer column guards | Implemented | §4 |
| Shared edge perimeter helpers | Implemented | `_shared/guard.ts` |
| Constant-time secret comparison | Implemented | `guard.ts:53-68` |
| JSON schema + 64 KB body cap | Implemented | `guard.ts:70-105` |
| SSRF-safe fetching | Implemented on fetchers | `SECURITY_BASELINE.md:4` |
| Webhook HMAC + tolerance + ledger | Implemented | `_shared/stripeSignature.ts`, `webhookLedger.ts` |
| Payment entitlement checks | Implemented | `get-download-urls:69-90` |
| Private buckets for deliverables/recordings | Implemented | `20260419162823_*.sql:3-7` |
| Error masking helper | Implemented, unevenly applied | `guard.ts:121-126` |
| Sentry replay masking | Implemented | `src/lib/sentryInit.ts:5-13` |
| General audit trail | **Missing** | `AUDIT_TRAIL_DESIGN.md` |
| Per-function JWT inventory | **Missing** | `config.toml:1-3` |
| Release SBOM | **Missing** | `sbom-plan.md` |

---

## 8. Monitoring and incident response

**Today:** browser error monitoring with masked replay and an optional DSN; Edge Function logs in the provider console; a documented severity model, first-15-minutes procedure, rollback, playbooks and escalation (`docs/platform/INCIDENT_RUNBOOK.md:1-40`); backup/recovery guidance; no uptime probe, no webhook-failure alert, no cron alert, no server-side error tracking, no audit table.

**Target (proposed):**
1. Structured function logs with a correlation id; forward errors to the monitoring tool.
2. Alerts on webhook 5xx, cron failure, payment reconciliation gaps, and anomalous service-role use.
3. `audit_events` as the primary investigation record (see `AUDIT_TRAIL_DESIGN.md`).
4. A rehearsed restore drill and a breach decision tree (`data-protection-review.md` §4).
5. A per-release SBOM and deployed-function manifest.

---

## 9. Known gaps (consolidated)

| Area | Gap | Severity |
|---|---|---|
| Wallet integrity | Client can INSERT its own wallet/transaction rows with arbitrary values | P0 |
| Agent publishing | Challenges, discovered Passport data, moderation closures applied without approval | P0 |
| Agent audit | No intent record; post-hoc audit can be lost | P0 |
| Account deletion | Client-side admin call; cannot succeed; UI claims success | P0 (data protection) |
| Credit taxonomy | Three "credit" meanings; one client-writable | P0 (product/legal) |
| Edge authorisation | No CI guard; JWT state not in repo; one auth bypass; one unguarded function | P1 |
| AI cost | Default cap unlimited; receipt coverage on 4 features | P1 |
| Payments | Refund/dispute notification-only; no reconciliation; missing lifecycle events | P1 |
| Acceptance | Any member can approve a deliverable | P1 |
| Attribution | `project_credits` self-assertion | P1 |
| Audit | No general audit table | P1 |
| Retention | No retention/expiry for any personal-data category | P1 |
| Supply chain | 11 supabase-js version specifiers, floating tag, no SBOM, no scanning | P1 |
| Mobile | Remote `server.url`, `cleartext: true` | P1 |
| Deployment | Repo ≠ production risk; cron not versioned | P1 |
| Hardening | CORS exceptions, error leakage, public generated images, unused in-memory limiter | P2 |

Remediation order and acceptance tests: `security-review.md` §2, `ai-agent-governance-review.md` §7, `payments-credits-ip-review.md` §8, `data-protection-review.md` §5, `sbom-plan.md` §3.

### 9.1 Prioritised remediation list

**P0** — wallet/transaction server-only writes; server-side account deletion; human approval + intent-first audit for agent writes and publication; close `auto-epk-updater` auth bypass and the unguarded sitemap function; remove or scope orchestrator impersonation; refund/dispute state + host-only deliverable acceptance.

**P1** — JWT inventory and CI guard coverage; real AI caps and budget wiring; retention schedule and complete export; audit table rollout; payment lifecycle events and reconciliation; service-key rotation drill; SBOM per release; mobile transport hardening; external penetration test.

**P2** — CORS consistency, error-body cleanup, policy-less table inventory, view `security_invoker`, cron versioning, guest-link single use, private generated images, schema-drift reconciliation, observability for functions and crons.

---

## 10. Explicit non-claims

- This is not a complete design record; several behaviours are documented only in code comments.
- It does not establish production readiness, scalability, availability, security certification, or compliance.
- It does not establish that the deployed system matches this description.

---

## Appendix A — External summary (safe to share)

> **Kretopia — technical summary for partners and fundraisers**
>
> Kretopia is a web and mobile platform for creative professionals. It combines a public professional profile ("Passport"), project collaboration, opportunity discovery, events, and payment tooling in one product.
>
> **Architecture.** A React single-page application (installable as a PWA and via a mobile wrapper) talks to a managed relational database with row-level security, managed serverless functions, and object storage. Payments, email, video calling, search and AI features are delivered through established third-party providers.
>
> **Security approach.** Access is enforced at two layers: database row-level security for direct client access, and authenticated server-side checks for privileged operations. Payment webhooks are signature-verified and deduplicated. Private files are served through short-lived signed links. Sensitive error monitoring is masked.
>
> **Payments.** Users pay for defined services — subscriptions, tickets, products, invoices, and project engagements. Funds for project work can be held and released against milestones. The platform does not sell a fungible currency. Identity verification for payouts is handled by the payment provider.
>
> **AI.** AI features assist with drafting, discovery, matching and summarisation. AI output is generally presented as drafts or proposals for a person to accept. The platform is designed so that AI does not independently move money.
>
> **Current focus.** The team is closing identified gaps in payment integrity, agent approval and audit, data-subject rights, and software supply-chain visibility before expanding paid and automated features.
>
> *This summary is descriptive. It is not a security certification, a compliance statement, or a representation of production readiness.*

**Do not attach the main body of this document to external materials.**
