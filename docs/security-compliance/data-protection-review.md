# Data Protection and GDPR Readiness Review — Kretopia

**Status:** Internal draft · readiness assessment, **not** a compliance statement
**Review date:** 2026-11-13
**Legal status:** every legal question in this document is marked **[LEGAL REVIEW REQUIRED]**. Nothing here is legal advice.
**Method:** repository inspection of client code, migrations, Edge Functions and legal content.

> **No compliance claim.** This document does not establish that Kretopia is GDPR-compliant, that any processing has a valid lawful basis, or that transfers are lawful. It identifies where evidence is missing.

## Evidence limits

- No data map was produced from production data; table names and client reads are the evidence.
- Retention is inferred from code and migrations. Where no job exists, "no retention implemented" means *not found in the repo*, not *proven absent in production*.
- Provider regions, contracts and subprocessor agreements were not inspected (no external system access).
- The published legal text is explicitly unfinished by its own authors (`docs/product/LEGAL_PUBLICATION_NOTES.md:2-26`).

**Status vocabulary:** *Implemented* = verified control in the repository; *Partial* = exists but incomplete; *Not implemented* = no control found; *Proposed* = recommended; *Out of scope* = not assessed.

---

## 1. Personal data inventory

Legend: **Retention** = implemented control found in repo; "None found" = no job/policy located.

| # | Category | Examples | Where it lives (evidence) | Purpose | Sensitivity | Retention |
|---|---|---|---|---|---|---|
| D1 | Account identity | email, auth id, provider identities | Auth provider; `profiles` (`supabase/migrations/20250930110444_40cf3801-a539-48d5-820b-23921cd189b2.sql:4-14`); `src/integrations/supabase/legacyClient.ts:18-25` | Sign-in, account | High (identifier) | None found |
| D2 | Profile / Passport | name, username, avatar, bio, headline, location, links | `profiles`, `public_profiles_safe`, public buckets (avatars/portfolio/media) | Public professional profile | High (often public) | None found |
| D3 | Contact / phone | phone number, OTP hashes | `_shared/phoneOtp.ts`, `send-phone-otp` | Verification | High | OTP TTL defined (`phoneOtp.ts` `OTP_TTL_MS`) |
| D4 | Messages | direct messages, project messages, attachments | `messages`, `project_messages`, `message-attachments` bucket | Collaboration | High (content) | None found |
| D5 | Files and media | project files, deliverables, voice notes, recordings, transcripts | `project-files`, `meeting-recordings`, `call_transcripts`, `message-attachments` | Work product, calls | High (content, possibly special category if volunteered) | Recording placeholder 90 days (`_shared/recordingRetention.ts`); transcripts none found |
| D6 | AI-generated content | drafts, bios, EPK suggestions, match explanations, memory | `epk_refresh_suggestions`, `copilot_memories`, `thrive_memory`, `studio_facts`, `ai_model_calls` | Assistance | Medium–High (derived personal data) | None found |
| D7 | Credits / work history | project credits, roles, endorsements, verification | `credits`, `verified_credits`, `credit_endorsements`, `credit_ai_verifications` | Professional record | Medium (public by design) | None found |
| D8 | Projects / collaboration | ownership, roles, invitations, deliverables, approvals | `projects`, `project_collaborators`, `project_deliverables` | Collaboration | Medium–High | None found |
| D9 | Opportunities / applications | gigs, applications, shortlists, scout results | `opportunities`, shortlist tables, `scouted_gigs` | Discovery | Medium | None found |
| D10 | Events / RSVPs | RSVP, guest lists, tickets, seating | `creative_jams`, `guest_rsvps`, ticket tables | Events | Medium | None found |
| D11 | Payments and invoices | amounts, Stripe ids, payout accounts, invoices, tax | `wallets`, `transactions`, `invoices`, `payment_history`, `creator_payout_*` | Payments | High (financial) | None found |
| D12 | Identity verification | KYC status and requirement labels (via payment provider) | `creator_wallets.kyc_status` (`supabase/migrations/20260528125850_*.sql:6`); `check-connect-status` | Payout eligibility | High | Provider-controlled |
| D13 | Agent memory / Studio Brain | extracted facts, entities, project context | `copilot_memories`, `thrive_memory`, `studio_facts`, `studio_entities`, `agent_project_context` | Personalisation | High (can capture anything said) | None found |
| D14 | MCP access | OAuth identity, tool reads | `supabase/functions/mcp/index.ts:188-195` | External assistant access | High (scope = full account read) | None found |
| D15 | Telemetry | analytics events, client errors, site analytics | `analytics_events` (1.4 M rows), `client_error_logs`, `site_analytics` | Operations | Medium (pseudonymous) | None found |
| D16 | Outreach / email | recipient lists, drafts, sends, suppression | `outreach_drafts`, email queue, `email_unsubscribes` | Communication | High | None found |
| D17 | Support / feedback | feedback chat, support messages, screenshots | `feedback-screenshots` (private), `ai-support` | Support | Medium–High | None found |

**Immediate observation:** the platform holds at least 17 categories of personal data with no retention job found for any of them, and no single record of processing. **Out of scope:** whether each category is necessary and proportionate — **[LEGAL REVIEW REQUIRED]**.

---

## 2. Data flows

Arrows describe the path observed in code, not a contractual transfer chain.

| Flow | From → To | Data | Mechanism / evidence | Notes |
|---|---|---|---|---|
| F1 | Web/mobile client → Database | All user-entered data | Supabase JS with publishable key; RLS (`src/integrations/supabase/legacyClient.ts:18-25`) | Direct PostgREST access; RLS is the only boundary for reads/writes |
| F2 | Client → Edge Functions | Form input, files, tokens | `supabase.functions.invoke` | Edge functions use service role, bypassing RLS |
| F3 | Edge Functions → Database | Any table | Service-role client (264 functions) | Authorisation is per-function, not RLS |
| F4 | Edge Functions → File storage | Avatars, project files, recordings, generated images | Storage SDK; private and public buckets | Public buckets are world-readable by URL |
| F5 | Edge Functions → Stripe | Email, amount, metadata, Connect account data | Stripe SDK / Checkout / webhooks | Card data never touches Kretopia servers **[confirm]** |
| F6 | Stripe → Edge webhooks | Payment, refund, dispute, payout events | Signed webhooks + event ledger | Refund/dispute paths are notification-only (see payments review) |
| F7 | Edge Functions → Email provider | Address, name, message content | Resend (`RESEND_API_KEY` in 17 functions) plus Gmail SMTP paths | Several functions call Resend directly, bypassing the shared email policy |
| F8 | Edge Functions → AI gateway | Prompts incl. profile text, project text, files, search results | 119 gateway call sites; provider is Google Gemini via a gateway (`_shared/aiModels.ts:13-27`) | Retention/training terms with the provider not verified here **[LEGAL REVIEW REQUIRED]** |
| F9 | Edge Functions → External data sources | Search queries, profile URLs | Firecrawl, public job feeds, music/film APIs, social APIs | Outbound content may include user-supplied URLs |
| F10 | Kreto agents → Database / messages / email / payments | Any data the agent reads; DMs; proposals | `agent-orchestrator`, `desk-agent`, `agent-send-dm` | No general audit table (see AI review) |
| F11 | MCP server → client assistant | Profile, studios, scouted gigs, credits | OAuth bearer; read-only tools (`supabase/functions/mcp/index.ts:19-183`) | Third-party assistant receives account data |
| F12 | Client → Sentry | Errors; replay masked | `src/lib/sentryInit.ts:5-13` | Replay masks text/inputs and blocks media; DSN empty in current build |
| F13 | Integrations → Kretopia | OAuth tokens, imported platform data | `integration-oauth-*`, `connect-platform` | Tokens are high-value; storage and revocation not assessed here |
| F14 | Kretopia → Analytics | Page/feature events | `analytics_events`, `site_analytics` | No cookie consent component found in `src/` |

**Transfer note:** the providers used (database/hosting, payments, email, AI, video, search) are likely to process data outside the user's country. No transfer mechanism, region inventory or data-processing agreement is recorded in the repo. **[LEGAL REVIEW REQUIRED]**

---

## 3. Gaps

### 3.1 Retention and deletion

| ID | Severity | Gap | Evidence | Risk |
|---|---|---|---|---|
| DP-01 | **P0** | Account deletion is non-functional. Both settings surfaces call `supabase.auth.admin.deleteUser(user.id)` from the browser, which requires the service role and cannot succeed with the publishable key. | `src/pages/Settings.tsx:437-441`; `src/components/profile/SettingsTab.tsx:182-186` | The UI tells users their account and data are permanently deleted when they are not. Erasure requests are not honoured; this is a direct data-subject-rights failure and a misrepresentation. |
| DP-02 | **P1** | Deletion, even if it ran, is single-record: there is no orchestrated erasure across storage objects, messages delivered to other users, agent memory, AI receipts, transcripts, analytics, or backups. | No delete/export function under `supabase/functions/`; cascade reliance is asserted in a client comment (`SettingsTab.tsx:180`) | Incomplete erasure; residual copies in buckets, memory tables and third-party systems. |
| DP-03 | **P1** | No retention schedule for any category in §1. Memory, transcripts, analytics and outreach have no expiry job. | `docs/platform/AUDIT_TRAIL_DESIGN.md:5`; no retention job found | Indefinite storage; growing breach blast radius. |
| DP-04 | **P1** | Full database exports are retained inside the same project with no retention or documented purpose. | `docs/security/SECURITY_BASELINE.md:2` (two `database_export_*` buckets, ~158 MB) | Duplicate copy of all personal data in the blast radius of the primary system. |
| DP-05 | **P1** | Recording retention is a code placeholder (90 days) with no deployed purge. | `_shared/recordingRetention.ts`; `SECURITY_BASELINE.md:2` | Call recordings/transcripts outlive the stated period. |

### 3.2 User export and deletion paths

| ID | Severity | Gap | Evidence |
|---|---|---|---|
| DP-06 | **P1** | "Export my data" is assembled in the browser from a subset of tables; it is not a complete subject access response and excludes files, messages, memory, agent data and payment records. | `src/components/profile/SettingsTab.tsx:121-168`; `src/pages/Settings.tsx` equivalent |
| DP-07 | **P1** | No server-side, authenticated export endpoint with a manifest, format and audit record. | Not found in `supabase/functions/` |

### 3.3 Consent and privacy notice

| ID | Severity | Gap | Evidence |
|---|---|---|---|
| DP-08 | **P1** | No terms-acceptance or privacy-notice acknowledgement record anywhere. No `terms_accepted`, version or timestamp. | grep across `src/` and migrations returns only payment-provider requirement labels |
| DP-09 | **P1** | No cookie/analytics consent mechanism found, while the privacy policy describes cookies and analytics. | no consent component in `src/`; `src/content/legal/privacy.ts:176-193` |
| DP-10 | **P1** | Privacy notice is explicitly unpublished pending decisions: controller identity, address, model-training policy, cookie inventory, deletion timeline, DPO/representative. | `docs/product/LEGAL_PUBLICATION_NOTES.md:6-26` |
| DP-11 | **P2** | AI processing is described in general terms but the notice does not state which content is sent to model providers, retention by providers, or whether it is used for training. | `src/content/legal/privacy.ts:108-131`; note at `LEGAL_PUBLICATION_NOTES.md:5` |

### 3.4 Data-subject rights

| Right | Status | Evidence |
|---|---|---|
| Access / portability | **Partial** — client-side partial JSON only | DP-06 |
| Erasure | **Not implemented** — UI path cannot succeed | DP-01 |
| Rectification | **Implemented** for profile fields (user-editable) | `ProfileEditDialog.tsx`; `profiles` UPDATE (server columns revoked) |
| Restriction / objection | **Not implemented** — no mechanism beyond contact mailbox | privacy policy contact section |
| Withdraw consent | **Not implemented** — no consent state to withdraw | DP-08/09 |
| Automated decision-making info | **Not implemented** — AI touches moderation, ranking and credit verification | `gig-moderator`, `generate-match-explanation`, `verify-credit` |
| Identity verification for requests | **Not defined** | — |

### 3.5 International transfers

No region inventory, transfer-impact assessment, or standard contractual clause record exists in the repo. Provider selection implies transfer. **[LEGAL REVIEW REQUIRED]**

### 3.6 Breach and incident response

**Implemented:** a severity model, first-15-minutes procedure, rollback, playbooks and escalation exist (`docs/platform/INCIDENT_RUNBOOK.md:1-40`).

**Gaps:**
- No personal-data breach decision tree (what triggers notification, to whom, within what period).
- No notification templates for users or a supervisory authority.
- No breach register.
- Escalation names an engineering lead and founder only; no privacy owner or DPO.
- "Legal and affected users for any personal-data exposure" has no timeline or criteria (`INCIDENT_RUNBOOK.md:35-37`).

**[LEGAL REVIEW REQUIRED]** — the applicable notification deadlines and authorities depend on jurisdiction and cannot be determined from the repo.

---

## 4. Incident-response plan template

Status: **proposed**. This extends, and does not replace, `docs/platform/INCIDENT_RUNBOOK.md`.

### 4.1 Detection
- **Sources:** provider error alerts, webhook 5xx, Sentry (browser), function logs, user reports, payment-provider notifications, dependency advisories.
- **Required additions:** alerting on Edge Function 5xx, webhook failure, cron failure, and anomalous service-role use.
- **Record at detection:** time (UTC), detector, initial signal, affected surface, suspected data categories (from §1).
- **Owner:** on-call engineer.
- **Acceptance:** every SEV1/SEV2 has a timestamped detection record within 24 h.

### 4.2 Containment
- Stop the entry point: revoke the affected token/secret, disable the function, pause the cron, or take the route offline.
- Preserve state before changing it (see 4.6).
- Rotate any credential that may have been exposed; confirm the old credential is rejected.
- **Do not** delete rows to "clean up" before evidence is captured.
- **Owner:** incident lead.
- **Acceptance:** containment action and time recorded; attacker/error path confirmed closed.

### 4.3 Investigation
- Establish the data set: which tables, buckets, providers, and users; use `audit_events` where available, logs otherwise.
- Determine scope by data category and by user, not by row count alone.
- Identify root cause and whether the same weakness exists elsewhere (search the repo for the pattern).
- **Owner:** incident lead + relevant domain owner.
- **Acceptance:** written scope statement with the exact queries/sources used.

### 4.4 Notification
- **Internal:** incident channel, status note within 30 minutes for SEV1 (`INCIDENT_RUNBOOK.md:15-20`).
- **Regulatory / data subjects:** decision recorded in writing with rationale and legal sign-off. Deadlines and authorities **[LEGAL REVIEW REQUIRED]**.
- **Payment provider:** notify on any payment-integrity event; follow its dispute/chargeback process.
- **Provider:** notify the hosting/database/payment/email/AI provider if the fault or exposure is theirs.
- **Acceptance:** a decision record exists even when the decision is "not notifiable", with the legal basis for that decision.

### 4.5 Escalation
| Trigger | Escalate to | When |
|---|---|---|
| Any suspected personal-data exposure | Incident lead + founder + legal counsel | Immediately |
| Payment integrity (balances, payouts, refunds) | Payment owner + founder | Immediately; no manual retries |
| Service-role or payment-provider secret exposure | Incident lead + founder; rotate first | Immediately |
| Cross-user data access | Incident lead + privacy owner | Immediately |
| Provider outage | Provider support | After 30 min if customer-impacting |

**Gap to close:** name a privacy owner/DPO equivalent and a deputy. **[LEGAL REVIEW REQUIRED]** on whether one is legally required.

### 4.6 Evidence preservation
- Snapshot logs, function invocations, webhook payloads and database rows **before** remediation where feasible.
- Record the chain of custody: who captured what, when, from where, hash where practical.
- Never paste secrets or full personal data into tickets or chat; reference record ids.
- Keep an immutable incident folder per incident.
- **Acceptance:** evidence index exists for every SEV1/SEV2.

### 4.7 Recovery
- Restore from backup only after the restore procedure has been rehearsed (`docs/platform/BACKUP_RECOVERY.md`).
- Replay webhooks from the provider only after the handler is fixed; verify the ledger released failed events.
- Reconcile payments and balances before re-enabling money paths.
- Verify the fix with the acceptance test named in the originating finding.
- **Acceptance:** service restored, data reconciled, monitoring green, no residual unauthorised access.

### 4.8 Post-incident review
- Within 5 business days: timeline, root cause, what detected it, what would have detected it sooner.
- Three actions with owners and dates; add a test or alert per root cause.
- Update `RELIABILITY_RULES.md` and this document where a control was missing.
- **Acceptance:** review published internally; actions tracked to closure.

---

## 5. Prioritised remediation list

### P0
| ID | Action | Effort |
|---|---|---|
| DP-01 | Replace client `auth.admin.deleteUser` with a server-side deletion orchestration function (authenticated, confirmed, audited). Until it ships, change the UI to a truthful "request deletion" flow. | Small (UI truth) / Medium (full deletion) |

### P1
DP-02, DP-03, DP-04, DP-05, DP-06, DP-07, DP-08, DP-09, DP-10, DP-11; plus incident-response additions in §4.1/4.4/4.5.

### P2
Complete the record of processing, provider/region inventory, and automated rights-request tracking.

---

## 6. Decisions owed (not resolvable from the repository)

1. Controller/processor roles and the contracting entity. **[LEGAL REVIEW REQUIRED]**
2. Lawful basis per processing purpose, including AI processing and outreach. **[LEGAL REVIEW REQUIRED]**
3. Whether customer content is used to train models; provider terms must be attached. **[LEGAL REVIEW REQUIRED]**
4. Retention periods per category, and whether a 30-day deletion promise can be kept. **[LEGAL REVIEW REQUIRED]**
5. Transfer mechanism and region strategy. **[LEGAL REVIEW REQUIRED]**
6. Breach notification matrix by jurisdiction. **[LEGAL REVIEW REQUIRED]**
7. Whether a DPO or EU/UK representative is required. **[LEGAL REVIEW REQUIRED]**
