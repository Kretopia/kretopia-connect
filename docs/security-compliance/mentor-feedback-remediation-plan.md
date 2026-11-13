# Mentor Feedback — Remediation Plan

**Prepared for:** Jim Pelzcar (mentor review)
**Date:** 2026-11-13
**Status:** Evidence-based plan · **no application code, schema, payments or autonomous capability was changed in producing it**
**Companion documents:** `security-review.md`, `data-protection-review.md`, `ai-agent-governance-review.md`, `payments-credits-ip-review.md`, `terms-and-ip-draft.md`, `sbom-plan.md`, `technical-design-document.md`

> **What this document is not.** It is not a security certification, a GDPR compliance statement, a legal opinion, or a claim of production readiness. No penetration test was performed. No external system was accessed. Findings describe the repository at the reviewed commit; the deployed system may differ (see §2).
>
> **Sharing:** prepared for the mentor and named advisers. It describes unfixed vulnerabilities with file paths; do not attach it to public fundraising material. Use Appendix A of `technical-design-document.md` for external audiences.

**Status vocabulary:** *Implemented* = verified in the repository; *Partial* = exists but does not cover the stated surface; *Proposed* = recommended, not present; *Out of scope* = not assessed.

---

## 1. Status at a glance

| # | Mentor concern | What we found | Status | Priority |
|---|---|---|---|---|
| 1 | Overlap with Substack | Kretopia has a Spotlight/Magazine publishing surface (articles, newsletter capture, broadcast email) but its core is Passport + project collaboration + payments. Publishing is a supporting surface, not the product. | **Assessed** | P2 (positioning, not code) |
| 2 | PII / email collection, GDPR readiness, incident response | ~17 personal-data categories, no retention schedule found, account deletion is broken, no terms/privacy acceptance record, no cookie consent. An incident runbook exists but has no breach-notification decision tree. | **Materially incomplete** | **P0** |
| 3 | Credits and collaboration; Stripe; money laundering | "Credit" means three different things. A signed-in client can create its own wallet and transaction rows with arbitrary values. Refunds/disputes are notification-only. No sanctions or AML monitoring; KYC is delegated to the payment provider. | **Materially incomplete** | **P0** |
| 4 | Ownership and IP; host retains IP; retention; host-only acceptance | Terms assert platform IP and user content ownership, but work-product ownership between users is a blank contract field. Any project member can accept a deliverable. No project retention/export rule. | **Gap** | **P0** (acceptance) / P1 (drafting) |
| 5 | Collaboration terms and conditions | A contract builder exists with `work_for_hire`/`collaboration` labels but no clause text, no IP assignment, no moral-rights waiver. | **Draft outline provided** | P1 |
| 6 | SBOM | No SBOM exists. Two lockfiles. Edge Functions import 11 version specifiers of the same SDK, including a floating tag. No dependency scanning in CI. | **Missing** | P1 |
| 7 | Container configuration and detailed design documentation; PDF for fundraisers | No container exists (static host + managed functions + native wrapper), so the equivalent baseline is hosting headers, edge config and mobile transport. A technical design document and a sanitised external summary are now written. | **Documented** | P1 |
| 8 | AI usage: product reliance, database maintenance, Claude Code | 119 of 323 server functions call an AI gateway (~37%); AI is assistive and does not move money. Database migrations are manual and drift from production. Claude Code is a development tool only, not a runtime dependency. | **Assessed** | P1 (cost) |
| 9 | Agents: permissions, model-data capture, monitoring, drift, automation | Approval binding covers 3 high-stakes tools and is caller-asserted. No general audit table. Some AI output is auto-published (challenges, discovered Passport data, moderation closures). Memory has no retention. MCP is read-only but unaudited. | **Materially incomplete** | **P0** |
| 10 | Penetration testing / external audit | Never performed. No evidence of any third-party test. | **Not done** | P1 (procurement) |
| 11 | Agent ingress and egress | Ingress: user text, files, scraped web, email, project data, MCP. Egress: model provider, email, push, DB writes, storage, external APIs. **No egress allowlist.** | **Mapped, controls partial** | P1 |
| 12 | MagicJack / VoIP relevance | No PSTN or MagicJack integration. Voice is in-browser recording/transcription; phone verification uses SMS OTP. There is no telephony dependency to secure. | **Not applicable** | — |

**Overall:** the platform has a real security baseline (RLS everywhere, shared edge guards, signature-verified webhooks, idempotent money paths) and a small number of high-impact gaps concentrated in wallet integrity, agent approval/audit, data-subject rights, and supply-chain visibility. The gaps are fixable without redesign.

---

## 2. Evidence and limits

- **Basis:** repository inspection on 2026-11-13: `src/`, `supabase/functions/`, `supabase/migrations/`, `drizzle/migrations/`, `scripts/`, `.github/`, `docs/`, `package.json`, `vite.config.ts`, `capacitor.config.ts`.
- **Not done:** penetration testing, dynamic testing, production database queries, provider dashboards, log review, secret inspection, package installation, external network access.
- **Known drift:** the repo has historically been ahead of or behind production (`docs/platform/REPO_AUDIT.md:14-16`). `supabase/config.toml` points at a different project than the live backend (`vite.config.ts:43`; `docs/platform/REPO_AUDIT.md:14`). Every finding marked "implemented" means *verified in the repository*, not verified live.
- **Severity:** P0 = exploitable now or direct integrity/rights impact; P1 = material, fix this cycle; P2 = hardening.

---

## 3. Mentor concerns in detail

### 3.1 Substack overlap
**Finding:** the product includes a Magazine/Spotlight surface (`src/pages/Magazine.tsx`, `src/pages/Spotlight.tsx`), newsletter capture and broadcast email (`send-broadcast-email`, `newsletter_subscribers`). The core loop is different: a professional Passport, project collaboration with roles and deliverables, opportunity discovery, events, and payment/escrow tooling.
**Assessment:** overlap is at the "publish an article and email subscribers" edge, not the product centre. Substack is a publishing-and-subscription business; Kretopia is a work-and-collaboration platform where publishing is one surface.
**Action:** state this positioning explicitly in the fundraising narrative; don't market newsletter features as the product. Effort: small (copy/positioning). **Out of scope:** competitive strategy analysis.

### 3.2 PII, GDPR readiness, incident response
**Findings:**
- Personal data spans at least 17 categories (account, profile, messages, files, recordings/transcripts, AI memory, payments, KYC status, telemetry, outreach, MCP) — inventory in `data-protection-review.md` §1.
- **P0:** account deletion calls `supabase.auth.admin.deleteUser` from the browser (`src/pages/Settings.tsx:439`; `src/components/profile/SettingsTab.tsx:184`). It cannot succeed with the publishable key, yet the UI reports permanent deletion.
- No retention schedule found for any category; no general audit table; no terms/privacy acceptance record; no cookie consent.
- An incident runbook exists (`docs/platform/INCIDENT_RUNBOOK.md`) with severity, rollback, playbooks and escalation, but no personal-data breach decision tree, notification templates, or breach register.
**Not claimed:** GDPR compliance. Lawful basis, controller identity, transfer mechanisms and notification deadlines all require legal review.

### 3.3 Credits, collaboration, Stripe, money laundering
**Findings:**
- Three unrelated concepts share the word "credit": portfolio attribution (`credits`), a never-spent wallet integer (`wallets.credits`), and AI usage allowance. Users purchase a role/job or a service, not a fungible currency.
- **P0:** the `wallets` INSERT policy survives hardening (`supabase/migrations/20250930110718_*.sql:34-36`; revokes at `20260823223419_*.sql:4-6` cover UPDATE/DELETE only), and the client itself inserts wallet rows (`src/components/WalletCard.tsx:33-36`). Any signed-in user can set an arbitrary balance. `transactions` INSERT is also client-open (`:47-49`).
- Payment creation is otherwise well-controlled: server-resolved prices/amounts, idempotency keys, signature-verified webhooks with a dedupe ledger and compare-and-set escrow transitions.
- **Gaps:** refunds and disputes are notification-only (`stripe-marketplace-webhook/index.ts:749-783`); no reconciliation job; no sanctions/AML monitoring; KYC is delegated entirely to the payment provider; country gating exists only for bank linking (8 countries).
- **Assessment:** the money-movement surface (top-up → transfer → payout, plus escrow and invoices) is exposed to layering and chargeback abuse. Current controls are provider-default KYC plus a per-transfer limit. That is not an AML programme. Legal/regulatory characterisation is required.

### 3.4 Ownership and IP
**Findings:**
- Terms assert platform IP (`src/content/legal/terms.ts:233-247`) and user content ownership with an operational licence (`:106-120`).
- **Not established anywhere:** who owns work product between users; how pre-existing work is handled; whether the host alone may modify settings and accept deliverables; project retention after an engagement.
- Any accepted project member can update a deliverable, including its approval status (`supabase/migrations/20260211050740_*.sql:110-119`).
- The contract builder offers `work_for_hire` and `collaboration` as labels with free-text sections but no IP clause text (`src/components/project/contracts/ContractBuilder.tsx:26-49`).
- No terms-acceptance record exists, and there is no contributor licence agreement.
**Recommended default (for legal review):** the host/client retains project IP unless a written agreement says otherwise; contributors retain pre-existing work and grant a project licence; acceptance is host-only.

### 3.5 Collaboration terms and conditions
A seven-part draft outline is provided in `terms-and-ip-draft.md`: project ownership, contributor IP, confidentiality, acceptable use, liability, termination, dispute handling. Every clause is marked **draft — requires legal review**. The outline also lists the product changes needed to make each clause true.

### 3.6 SBOM
**Findings:** no SBOM; two lockfiles (`package-lock.json`, `bun.lock`, plus a legacy `bun.lockb`); CI uses `npm install` rather than `npm ci`; Edge Functions use remote URL imports with no import map or Deno lockfile and **11 `@supabase/supabase-js` version specifiers**, including a floating `@2`; no Dependabot, no advisory scanning, no secret scanning in CI; `public/version.json` is `{"version":"dev"}`.
**Plan:** `sbom-plan.md` — pin and consolidate Edge imports, one lockfile + `npm ci`, CycloneDX SBOM per release (web/edge/native), Dependabot + OSV scanning, release manifest with commit SHA and artifact hash, provenance. Containers are not applicable today; the equivalent baseline is documented.

### 3.7 Container configuration and design documentation
**Findings:** there is no Dockerfile or container image. The system is a static web build on managed hosting, Deno Edge Functions on managed compute, and a Capacitor mobile wrapper. The mentor's concern maps to three real configuration surfaces:
1. **Edge runtime** — per-function JWT flags live in the provider dashboard, not the repo (`supabase/config.toml:1-3`).
2. **Static hosting** — CSP is minimal (`index.html:5` sets only `object-src`, `base-uri`, `upgrade-insecure-requests`); no `_headers`/`_redirects` in `public/`.
3. **Mobile wrapper** — remote `server.url` and `cleartext: true` (`capacitor.config.ts:7-9`).
**Deliverables:** `technical-design-document.md` (internal) with Appendix A as a sanitised, shareable summary for fundraisers. Export to PDF from that appendix only; the main body is marked internal.

### 3.8 AI usage
**Findings:**
- **How much relies on AI:** 119 of 323 Edge Functions call the AI gateway (~37% of server entry points). AI is assistive: drafting, summarisation, discovery, matching, moderation, memory. It is **not** in the authentication, ledger or payment-authorisation path, and no agent can initiate a payment or payout today.
- **Database maintenance:** migrations are applied by hand and production drift is documented. Some migrations are committed but not applied. This is an operational risk, not an AI risk.
- **Claude Code:** used as a development tool. `.claude/` contains only a local dev launch config and a setting that disables a local MCP server; `AGENTS.md` documents engineering conventions. There is no Claude runtime dependency in the product. No model or IDE credential is described here.
- **Cost:** the daily AI cap defaults to unlimited (`_shared/aiRateLimit.ts:32-35`); measured receipts cover 4 features; the durable budget module has zero importers.

### 3.9 Agents
**Findings (P0):**
- AI output is published without review: challenges inserted `active` (`generate-challenges/index.ts:225-252`), discovered credits/awards/badge written into other users' Passports (`auto-discover-creatives/index.ts:374-402`), listings closed by AI (`gig-moderator/index.ts:190-196`).
- `desk-agent` writes tasks, project messages, invoices and credits; only collaborator changes are approval-gated (`desk-agent/index.ts:646-797,887-918`).
- No reliable audit: `agentAuthority` records after the mutation and swallows failures (`:194-255`); RSVP and credit-vouch have no approval or audit (`agent-rsvp-event/index.ts:10-58`; `agent-vouch-credit/index.ts:10-29`).
- `auto-resolve-disputes` reassigns credit ownership with no human approval (`:26-49`).
- `auto-epk-updater` skips authentication when `body.user_id` is supplied (`:101-114`).
- The orchestrator can act as any user given the service key (`agent-orchestrator/index.ts:628-639`).
- Memory (`copilot_memories`, `thrive_memory`, `studio_facts`, `agent_project_context`) has no retention or expiry.
- MCP exposes five read-only tools over OAuth, with no read audit or per-client limit.
**Foundation-model data capture:** prompts include profile, project, file and scraped content. Provider retention/training terms were not verified. **[LEGAL REVIEW REQUIRED]**
**Drift monitoring:** none. No anomaly detection, no per-agent kill switch, no action-distribution baseline.
**Recommended automation:** approval pre-check at the write, intent-first audit, deny-by-default tool registry, per-agent budget, anomaly alerting, drift report, retry guard, kill switch. **None of these enables a new autonomous capability** — they constrain existing ones.

### 3.10 Penetration testing
**Finding:** no evidence of any external security assessment. This review is static and cannot substitute for one.
**Recommendation:** procure an external penetration test after the P0 items are fixed, scoped to: auth and RLS bypass, file/share token abuse, edge function authorisation, payment webhook abuse, and agent action boundaries. Provide the testers with a staging environment and a written rules-of-engagement. **Not performed in this task.**

### 3.11 Agent ingress and egress
**Ingress:** user text/voice, uploaded files, scraped web content, inbound email, project data written by other users, MCP requests.
**Egress:** model provider, email (including several direct provider calls that bypass the shared policy), push, database writes via service role, storage (including public buckets for generated images), external search/social APIs.
**Key gap:** no egress allowlist. Any function with `fetch` can reach any host. Prompt isolation is applied at ~24 call sites and missing at ~40, including `desk-agent`, `inbox-triage-agent`, `money-agent-watch`.

### 3.12 MagicJack / VoIP
**Finding:** no MagicJack, SIP, PSTN or telephony integration exists. Voice features are browser recording plus transcription; phone verification uses an SMS OTP provider (`send-phone-otp`), with hashed OTPs and a TTL. There is no VoIP infrastructure Kretopia operates or must harden.
**Action:** none. Document the distinction so the question is closed rather than re-asked.

---

## 4. Top 5 P0 actions

### P0-1 · Make wallet and transaction integrity server-only, and publish the credit taxonomy
- **Why:** a signed-in user can create a wallet row with an arbitrary balance and fabricate transaction rows; the product also uses "credit" for three different things. This is the single highest-risk item for a payments platform.
- **Exact files / systems:**
  - `supabase/migrations/20250930110718_317c2f4c-5455-4bfa-a91f-54b9282081b8.sql:34-36,47-49` (policies)
  - `supabase/migrations/20260823223419_43def0af-be27-4a94-892e-2e8b0ad37eef.sql:4-6` (existing revokes)
  - `src/components/WalletCard.tsx:33-36` (client insert)
  - Wallet/grant system: `wallets`, `transactions` tables and grants; `wallet-balance`, `wallet-topup-confirm`, `wallet-transfer`
  - Product copy for credit taxonomy; `payments-credits-ip-review.md` §1 and §8
- **Effort:** small for the revoke + server-side creation; medium for the taxonomy and copy alignment across surfaces.
- **Dependencies:** a read-only schema check in production to confirm current grants; a migration path approved per the project's migration rules; finance/legal sign-off on the credit description. Blocks nothing else, and should block every new payment feature.
- **Acceptance criteria:**
  1. An authenticated client POST to the wallets endpoint with a chosen balance returns 403.
  2. A client insert into transactions returns 403.
  3. A new account has exactly one wallet, balance 0, created server-side.
  4. `wallet_credit`/`wallet_debit` remain service-role only.
  5. Every user-facing surface distinguishes "project credit (role)", "wallet balance", and "AI usage".
- **Rollback:** restore the prior grants/policies; no data migration is required. The taxonomy copy is independent and can be reverted separately.

### P0-2 · Make account deletion real and truthful
- **Why:** the product tells users their data is permanently deleted; the call cannot succeed and no server-side erasure exists. This is a direct data-subject-rights failure and a misrepresentation.
- **Exact files / systems:**
  - `src/pages/Settings.tsx:437-441`
  - `src/components/profile/SettingsTab.tsx:171-190`
  - New authenticated function (proposed: `supabase/functions/delete-account/`) plus a deletion manifest covering profile, storage objects, messages, memory tables, agent context, AI receipts, transcripts and analytics; retention exceptions for payment/tax/dispute records.
  - `docs/security-compliance/data-protection-review.md` §3.1, §4
- **Effort:** small to make the UI truthful; large for complete orchestrated erasure (multiple tables, buckets and third parties).
- **Dependencies:** P0-3 audit (deletion must be audited); retention policy decision; legal review of retention exceptions. Do not promise a deletion timeline before the job exists.
- **Acceptance criteria:**
  1. Deletion requires a fresh authenticated session and explicit confirmation.
  2. The function writes an audit record and returns a deletion receipt with a timestamp.
  3. After completion, the account cannot sign in and owned storage objects are gone.
  4. Records that must be retained are listed in the receipt with the reason.
  5. The UI never reports success unless the server confirmed it.
- **Rollback:** retain a soft-delete flag for a short, documented window before hard deletion; disabling the function restores the previous (truthful) request-only flow.

### P0-3 · Require human approval and durable audit for every agent write or publication
- **Why:** agents currently publish content, modify shared project state, and change reputation without a reliable record. This is the mentor's agent concern and the task's explicit P0 criterion.
- **Exact files / systems:**
  - `supabase/functions/desk-agent/index.ts:646-797,887-918`
  - `supabase/functions/generate-challenges/index.ts:225-252`
  - `supabase/functions/auto-discover-creatives/index.ts:374-402`
  - `supabase/functions/gig-moderator/index.ts:190-196`
  - `supabase/functions/auto-resolve-disputes/index.ts:26-49`
  - `supabase/functions/agent-rsvp-event/index.ts:10-58`, `agent-vouch-credit/index.ts:10-29`
  - `supabase/functions/_shared/agentAuthority.ts:11-16,194-255`
  - New `audit_events` table + writer (design: `docs/platform/AUDIT_TRAIL_DESIGN.md`)
  - Proposed: `pending_review` states for challenges, discovered Passport data, moderation closures and dispute resolutions
- **Effort:** medium (approval pre-check + intent-first audit); medium for the review states.
- **Dependencies:** schema change approval; migration path; P0-1 must not be blocked by it. Do **not** enable new agents to satisfy it.
- **Acceptance criteria:**
  1. A marker-free direct call to an agent write yields `denied` and no state change.
  2. Every agent mutation has exactly one `audit_events` row with actor, object, outcome and no sensitive body.
  3. A failed audit insert blocks the write.
  4. Challenges, discovered Passport data, moderation closures and dispute resolutions require an approver id before becoming visible.
  5. Client roles cannot insert/update/delete audit rows.
- **Rollback:** feature-flag the approval requirement per surface; the audit table is additive and can remain while the gate is disabled. Never roll back by deleting audit rows.

### P0-4 · Close the authentication bypasses and the unguarded service-role endpoints
- **Why:** one function trusts a body-supplied user id, one has no auth at all, and the orchestrator can impersonate any user with the service key. These are direct authorisation failures.
- **Exact files / systems:**
  - `supabase/functions/auto-epk-updater/index.ts:101-114`
  - `supabase/functions/generate-sitemap/index.ts:6,15-24`
  - `supabase/functions/agent-orchestrator/index.ts:628-639`
  - `supabase/config.toml:1-3` + `.github/workflows/deploy-edge-functions.yml`
  - New CI check for guard imports
- **Effort:** small per function; medium for the JWT inventory and CI guard.
- **Dependencies:** a cron/secret inventory (jobs are not in the repo); confirmation of which internal callers legitimately use the impersonation path.
- **Acceptance criteria:**
  1. `{"user_id": "<other>"}` without a valid bearer returns 401.
  2. An unauthenticated sitemap request returns 401 unless it carries the cron secret.
  3. No path can act as a user without a session or an explicit, audited internal grant.
  4. CI fails when a new function has no perimeter import and no documented allowlist entry.
  5. `config.toml` lists every function with an explicit `verify_jwt`.
- **Rollback:** revert the individual guard; the CI check can ship warn-only first, then blocking.

### P0-5 · Establish payment-lifecycle integrity and host-only acceptance
- **Why:** refunds and disputes do not change database state, there is no reconciliation, and any project member can accept a deliverable. Money and IP acceptance can therefore diverge from reality.
- **Exact files / systems:**
  - `supabase/functions/stripe-marketplace-webhook/index.ts:749-783` (refund/dispute)
  - `supabase/functions/stripe-wallet-webhook/index.ts`
  - `supabase/migrations/20260211050740_2b17af3e-4996-4240-ae28-67ead2901bea.sql:110-119` (deliverable approval)
  - `supabase/functions/release-escrow/index.ts`
  - New: refund/dispute ledger + reconciliation job + approver RPC
- **Effort:** medium (events + ledger), medium (reconciliation), small (approver check).
- **Dependencies:** P0-3 audit; finance sign-off on refund/dispute handling; legal review of dispute terms. Reconciliation requires provider dashboard access (out of scope here).
- **Acceptance criteria:**
  1. A test refund produces a `refunded` order/milestone state and a ledger row; replay is idempotent.
  2. A disputed amount cannot be paid out.
  3. The reconciliation job reports zero unexplained differences for a test period, or lists them explicitly.
  4. Only the host/client (or an explicit approver) can accept a deliverable; the attempt is audited.
  5. Release of escrow references an accepted deliverable or a recorded override.
- **Rollback:** disable the new handlers and reconciliation job; keep the ledger (append-only). The approver check can be relaxed to owner-or-member if product needs it, but not silently.

---

## 5. Prioritised remediation list

### P0
PAY-01 credit taxonomy · SEC-01 wallet INSERT · SEC-02 transaction INSERT · DP-01 account deletion · AI-01 unpublished-by-default · AI-02 gated shared-state writes · AI-03 intent-first audit · AI-04 human credit-dispute resolution · AI-05 `auto-epk-updater` auth · AI-06 impersonation path · SEC-03 unguarded sitemap · PAY-02 refund/dispute state · PAY-05 host-only acceptance.

### P1
SEC-05 JWT inventory + CI guard · SEC-06 AI caps · SEC-09 approval binding coverage · SEC-10/11 acceptance and attribution · SEC-14 intake limits · SEC-19/20 payment events · SEC-23 service-key rotation · SEC-26 audit table · SEC-28 mobile transport · DP-02…DP-11 retention/export/consent/notice · AI cost/egress/prompt-isolation/memory retention · PAY-03/04/06/07 · SBOM-01/02 · external penetration test.

### P2
SEC-07 in-memory limiter · SEC-08 CORS exceptions · SEC-12 policy-less tables · SEC-13 views · SEC-16 cron versioning · SEC-17 guest link reuse · SEC-18 public generated images · SEC-21 schema drift · SEC-22 build env · SEC-24 validation coverage · SEC-25 error leakage · SEC-27 observability · PAY-08/09/10 · SBOM P2 items · legal publication checklist.

---

## 6. Sequencing

1. **Week 1–2:** P0-1 (revokes + server creation), P0-4 (auth bypasses), P0-2 UI truthfulness. These are small, independent and reduce the most risk per hour.
2. **Week 2–4:** P0-3 audit foundation + approval gate for the four publishing surfaces; P0-5 refund/dispute ledger and host-only acceptance.
3. **Week 4–8:** P1 data-subject rights (retention, export, consent), AI cost controls, JWT inventory/CI guard, SBOM baseline.
4. **After P0/P1:** commission the external penetration test; prepare the legal drafts for counsel; produce the fundraiser PDF from Appendix A only.

**Do not** expand wallet, payout, messaging or agent capabilities while P0 items are open.

---

## 7. What this plan does not claim

- No GDPR compliance, security certification, production readiness or legal sufficiency.
- No finding here is a substitute for a penetration test or a legal opinion.
- The repository is not proven to match production; several "implemented" controls depend on migrations that may not be applied.
- Absence of a finding is not proof of absence.
