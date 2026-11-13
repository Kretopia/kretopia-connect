# AI and Agent Governance Review — Kretopia

**Status:** Internal draft · **not** an AI safety certification or compliance statement
**Review date:** 2026-11-13
**Scope:** Kreto, agent orchestration, tools, memory, Studio Brain, watchers, the MCP server, and AI-generated actions.
**Method:** repository inspection only. No agent was executed. No autonomous capability was enabled or changed.

## Evidence limits

- Agent behaviour under adversarial prompting was **not** tested. Prompt-injection conclusions are based on whether untrusted text is wrapped, not on exploit attempts.- Model-provider data-retention and training terms were not inspected. **[LEGAL REVIEW REQUIRED]**
- Production cron definitions are not in the repo (`docs/platform/REPO_AUDIT.md:26-28`), so the live schedule of watchers cannot be confirmed.
- Approval enforcement was reviewed in code paths, not exercised end-to-end.

**Status vocabulary:** *Implemented* = verified in the repository; *Absent* = no control found in the repository; *Proposed* = recommended, not present; *Out of scope* = not assessed.

---

## 1. System summary

- **One model provider path:** Google Gemini through an AI gateway (`supabase/functions/_shared/aiModels.ts:13-27`); 119 files reference the gateway.
- **Tool execution is data-driven:** `orch_tool_registry` rows decide handler and `risk_level` (`safe_auto` / `requires_approval` / `locked`) at `supabase/functions/agent-orchestrator/index.ts:39,703-719`. A registry row is an executable-capability grant that is not code-reviewed.
- **Guard modules:** `executionGuard.ts:48-86` (fail-closed approval evaluation), `agentActionBinding.ts:74-150` (target binding + 30-min freshness), `agentDmBinding.ts:75-150` (recipient + exact text), `agentAuthority.ts:71-168` (three high-stakes tools), `approvalHardening.ts:12-108` (reservation-key stripping, immutable targets).
- **Approval binding is caller-asserted.** `_shared/agentAuthority.ts:11-16` states it covers exactly three tools; `send-outreach-draft/index.ts:83-88` states the gate "gates well-behaved agent callers, not a caller that omits them".
- **Audit is after-the-fact and best-effort.** `recordExecutedAction` writes after the mutation and swallows failures (`agentAuthority.ts:194-255`). There is no general `audit_events` table (`docs/platform/AUDIT_TRAIL_DESIGN.md:1-8`).

---

## 2. Agent and tool inventory

`Approval` = is a human approval record required in the write path. `Audit` = is a durable record written for the action.

| Agent / function | Purpose | Data accessed | External services | Permissions | Approval | Audit | Retry | Cost control | Failure path | Drift / abuse risk |
|---|---|---|---|---|---|---|---|---|---|---|
| `agent-orchestrator` (`index.ts:628-778`) | Plan and execute tools | Plans, projects, collaborators, messages | Gemini, internal functions | Service role; **impersonation via `x-internal-user-id`** (`:628-639`) | Yes for `requires_approval`; `safe_auto` runs without (`:281`) | `orch_actions` / `orch_approvals` / `orch_runs` | CAS claim; rollback to `proposed` on failure (`:773-778`) | No per-run budget; model call unmetered | Returns proposal state | Registry row can grant capability; service-key caller can act as any user with no session |
| `desk-agent` (`index.ts:419-1080`) | Studio operator assistant | Tasks, messages, invoices, credits, project context | Gemini, `create-video-room`, copilot functions | Service role after JWT + AI cap | **Only collaborator mutations** (`:887-918`) | `orch_runs`; no audit for task/message/invoice/credit writes | Not specified | 100/day-class cap (`:425-444`) | Error returned | Can write invoices/credits and messages without approval |
| `copilot-planner` (`:36-212`) | Draft a plan | Project context | Gemini | Service role after JWT | N/A (inert plan) | `copilot_plans` | — | None | Plan not stored on failure | Low (no execution) |
| `copilot-executor` (`:241-316`) | Execute plan steps | Plan, registry | Internal functions | Service role after JWT | Registry risk check (`:294-304`), plan ownership (`:266,279,312`) | Plan status only | CAS claim (`:309-310`) | None | Step error surfaced | Registry row is the boundary |
| `copilot-collaborator-tools` (`:312-514`) | Membership + project ops | Collaborators, messages, projects | — | Service role | `authorizeHighStakesAction` for add/remove/delete only (`_shared/agentAuthority.ts`) | After-the-fact `recordExecutedAction` | Best-effort | None | Partial failure not rolled back | Project delete/archive is destructive and audit can be lost |
| `agent-send-dm` (`:89-224`) | Send a DM as the user | Recipient, message text | Push, email | Service role after JWT | **Yes** — bound recipient and text, CAS claim (`:89-118,163-174`) | Reverts claim on failure (`:190-191`) | Manual retry needed | None | Claim released | Text/recipient binding is strong; audit still post-hoc |
| `agent-rsvp-event` (`:10-58`) | RSVP on the user's behalf | Event, ticketed flag | — | Anon-key client with user JWT | **No approval check** | **None** | None | None | Error returned | Agent can change event state without approval record |
| `agent-vouch-credit` (`:10-29`) | Endorse a credit | Credit id | — | `requireUser` | **No approval check** | **None** | None | None | Error returned | Reputation manipulation without audit |
| `agent-send-dm` / `send-outreach-draft` | Outbound email | Recipient, draft | Email provider | Service role / user | Bound when marker present | Partial | — | Per-actor budget in `send-outreach-email:180-192` | Error surfaced | Marker-free call bypasses binding |
| `create-agent-proposal` | Store a proposal | Proposal text | — | JWT | N/A | `agent_proposals` | — | None | — | Low |
| `desk-agent-watch` | Propose actions on a schedule | Project data | Gemini | `requireAdminOrCron` | Produces proposals only | `agent_proposals` (`:258-259`) | — | None | Silent cron | **Held disabled** (`AGENTS.md`; `docs/security/phase5/LOT4_ACTIVATION_BATCH1.md:14`) |
| `surface-agent-watch` | Surface signals | Project/surface data | Gemini | Cron/admin | Proposals only | `agent_proposals` | — | None | Silent cron | Proposal quality only |
| `money-agent-watch` | Flag money issues | Payments, milestones | Gemini | Cron/admin | Proposals only | `agent_proposals` (`:109,171`) | — | None | Silent cron | Reads financial data |
| `inbox-triage-agent` | Classify inbox | Messages | Gemini | Cron/admin | Classification only | `inbox_triage_classifications` (`:155`) | — | None | Silent cron | Reads message content |
| `auto-outreach-watch` | Draft outreach | Prospect/profile data | Gemini, email | Cron/admin | Draft only; send is separate | Draft rows | — | None | Silent cron | Reads third-party data |
| `auto-resolve-disputes` (`:26-49`) | Resolve stale credit disputes | Credit rows | — | Cron/admin | **No approval** | Status update only | — | None | Silent cron | **Reassigns `credits.user_id` automatically** |
| `gig-moderator` (`:166-214`) | Moderate listings | Opportunity text | Gemini | Cron/admin | **No approval** — AI decision applied | `gig_moderation_log` | — | None | Unknown | Auto-closes a real user's listing |
| `generate-challenges` (`:225-252`) | Create challenges | Profile/theme data | Gemini | Cron/admin | **No approval** | Row insert | — | None | Unknown | Publishes `status:"active"` content attributed to a real user |
| `scout-gigs` (`:487,581-593`) | Discover gigs | Public feeds, profile | Firecrawl, feeds | Cron/user + `gateAiCall` | **No approval** — publishes into the user's feed | `scout_runs` | Upsert | Gated (`:487`) | Degraded feed | Unmoderated external content shown as opportunities |
| `auto-discover-creatives` (`:374-402`) | Enrich Passport | Other users' profiles | External sources | Cron/admin | **No approval** | None | — | None | Partial writes | **Writes credits/awards/badge into other users' profiles** |
| `verify-credit` (`:53-151`) | Assess a credit | Credit evidence | Gemini | User (ownership re-derived from DB) | N/A | `credit_ai_verifications`, `ai_confidence` | — | None | Writes confidence only | Good: does not flip the verified badge |
| `auto-epk-updater` (`:101-114`) | Suggest EPK refresh | Profile, credits | Gemini | **Unauthenticated when `body.user_id` supplied** | No | Suggestion rows | — | Daily counter | Error | Cross-user AI spend + writes |
| `moderate-opportunity` (`:75-118`) | Moderate a listing | Listing text | Gemini | — | N/A | Verdict | — | None | **Fail-open: error ⇒ published** | Unsafe content can ship on provider failure |

### MCP server (`supabase/functions/mcp/index.ts`)

| Tool | Read/Write | Data | Evidence |
|---|---|---|---|
| `search_creators` | Read | Public creator profiles | `:19-45` |
| `get_my_passport` | Read | Caller's profile | `:56-76` |
| `list_my_studios` | Read | Caller's projects | `:88-112` |
| `list_scouted_gigs` | Read | Caller's scouted gigs | `:124-149` |
| `list_my_credits` | Read | Caller's credits | `:161-183` |

- **Implemented:** all five tools carry `readOnlyHint: true` and `openWorldHint: false` except `list_scouted_gigs`; auth is OAuth with `authenticated` audience (`:188-195`); the client uses the caller's JWT so RLS applies.
- **Absent:** no write/action tools, no approval surface, no per-client rate limit, no audit of MCP reads, and a single `authenticated` scope with no per-tool granularity. A connected assistant can read the whole Passport/Studio surface.
- **Risk (P1):** third-party assistants become an unmonitored read channel for personal data. See the data-protection review, D14.

---

## 3. Ingress and egress map

| # | Ingress | Path | Controls | Gap |
|---|---|---|---|---|
| I1 | Free-text user input (chat, prompts, voice) | `kreto-*`, `thrive-*`, `desk-*`, `feedback-chat` | `requireAiCaller`; some `promptIsolation` | No global prompt-injection classifier; isolation uneven |
| I2 | Uploaded files and images | `kreto-resources`, `studio-ingest`, image generators | Private bucket for attachments | OCR/vision content is trusted as instructions in some paths |
| I3 | External web content | `scout-*`, `import-*`, `fetch-*`, `analyze-profile-url` | SSRF guard on fetchers | Scraped text is the largest untrusted channel; not wrapped in ~40 call sites |
| I4 | Email/inbox content | `inbox-triage-agent`, `draft-lead-reply` | Cron/admin | Message bodies passed raw to the model |
| I5 | Project data written by other users | `desk-agent`, `copilot-*` | Project access check | A collaborator can plant instructions the agent later reads |
| I6 | MCP client requests | `mcp` | OAuth | Read-only, unaudited |

| # | Egress | Path | Controls | Gap |
|---|---|---|---|---|
| E1 | Model provider | 119 gateway call sites | `requireAiCaller` (35 files), rate gate (partial) | Prompt content includes personal/project data; provider retention not verified |
| E2 | Email | Resend (17 functions), Gmail SMTP | `send-user-email` relationship proof + preferences; `transactionalEmailPolicy` | Direct Resend calls bypass policy and suppression: `verify-brand-credit:109`, `send-waitlist-invite:91`, `send-invoice-email:81`, `verify-guest-opportunity:144`, `guest-wallet-session:74` |
| E3 | Push | `send-push-notification` | Service key or session + relationship (`:38-69`) | — |
| E4 | Messaging (DM) | `agent-send-dm` | Bound recipient/text | Post-hoc audit |
| E5 | Payments | Milestone/escrow functions | Auth + DB amounts | Agents do not currently initiate payments; `desk-agent` writes invoices |
| E6 | Database writes | ~all agent functions via service role | Per-function checks | No RLS backstop; no intent record |
| E7 | File storage | Private attachments; **public generated images** | Private buckets mostly | `generate-gig-cover:101` and peers write public objects |
| E8 | External search/scrape | Firecrawl, job feeds, social/music APIs | SSRF guard on fetchers | No egress allowlist; any function with `fetch` can reach any host |

**No egress allowlist exists.** Destination control is per-function discipline, not a platform constraint.

---

## 4. P0 gaps — actions an agent can take without explicit approval or a durable audit record

| ID | Gap | Evidence | Why P0 |
|---|---|---|---|
| **AI-01** | **Agent publishes content without review.** Challenges are inserted `status:"active"` and attributed to a real user; discovered credits/awards/badge are written into other users' Passports; AI closes real listings. | `generate-challenges/index.ts:225-252`; `auto-discover-creatives/index.ts:374-402`; `gig-moderator/index.ts:190-196` | Published, user-attributed content and reputation changes with no human gate and no durable audit. Directly contradicts "no autonomous publishing". |
| **AI-02** | **Agent mutates shared project state without approval.** `desk-agent` writes tasks, project messages, invoices and credits; only collaborator changes are gated. | `desk-agent/index.ts:646-797,887-918` | A compromised or drifting agent can alter a shared workspace and create financial records. |
| **AI-03** | **Agent actions have no reliable audit.** High-stakes audit is written after the mutation and swallows failures; RSVP and credit-vouch have no audit at all. | `agentAuthority.ts:194-255`; `agent-rsvp-event/index.ts:10-58`; `agent-vouch-credit/index.ts:10-29` | No durable record means no accountability, no drift detection, no incident reconstruction. |
| **AI-04** | **Automatic credit-ownership reassignment.** A cron rewrites `credits.user_id` with no human approval. | `auto-resolve-disputes/index.ts:26-49` | Ownership/reputation change applied by automation; the winning party may be wrong. |
| **AI-05** | **Unauthenticated cross-user AI trigger.** `auto-epk-updater` trusts `body.user_id` and skips auth. | `auto-epk-updater/index.ts:101-114` | Anyone can spend on another account and write to it. (Also SEC-04.) |
| **AI-06** | **Service-key impersonation with no session.** The orchestrator can act as any `x-internal-user-id` given the service key. | `agent-orchestrator/index.ts:628-639` | A single leaked key gains "act as any user" across agent tools, with no independent audit of the impersonation. |

**Explicitly not a P0 gap (verified):** agents cannot currently initiate a payment or payout; no agent function calls Stripe transfer/refund paths. Message sending is bound when the agent path is used. MCP is read-only. These must be preserved.

---

## 5. Cost, retry and drift controls

### 5.1 Cost (P1)
- Only 4 functions use the reservation gate (`gateAiCall`): `scout-gigs:487`, `ai-talent-match:86`, `kreto-resources:92,95`, `thrive-ai-chat:179,237,692,699`.
- Only 4 record measured receipts (`measuredModelFetch`): the same group.
- `DEFAULT_DAILY_CAP = -1` (`_shared/aiRateLimit.ts:32-35`) — counted, not enforced.
- `_shared/durableBudget.ts` has **zero importers**.
- Public AI endpoints have only per-IP perimeter (`validate-waitlist-ai:43`, `public-digital-presence:21`, `verify-profile-claim:44`).
- **Risk:** unbounded provider spend from one account or rotating IPs.

### 5.2 Retry safety (P1)
- Boundary: money functions use CAS and idempotency keys (good).
- Agent writes: `agent-send-dm` uses a CAS claim and reverts on failure; `agentAuthority` does not roll back partial work; `desk-agent` writes multiple tables with no transaction.
- **Risk:** a retried agent run duplicates messages, tasks or invoices.

### 5.3 Drift and abuse detection (P1)
- No anomaly detection on agent volume, recipients, spend, or tool mix.
- No comparison of an agent's action distribution against its stated purpose.
- No prompt-injection detection; `promptIsolation` is applied at ~24 call sites and missing at ~40, including `desk-agent:568`, `inbox-triage-agent:207`, `money-agent-watch:67`, `universal-search:253`, `auto-epk-updater:69`, `verify-credit:105`.
- No kill switch per agent; disabling requires editing the registry or the cron.

---

## 6. Recommended automation (proposals only — do not enable new capabilities)

| # | Automation | What it does | Where it plugs in | Does not |
|---|---|---|---|---|
| A1 | **Approval pre-check at the write** | Reject an agent-attributed write unless a matching approved action row exists and is unexpired | RLS policy or `SECURITY DEFINER` RPC per table; replaces caller-asserted markers | Does not grant new tools |
| A2 | **Intent-first audit** | Insert `audit_events` with `outcome='pending'` before mutation, update to `ok`/`failed` after | `agentAuthority`, `agent-send-dm`, `desk-agent`, RSVP/vouch | Does not perform the action |
| A3 | **Deny-by-default tool registry** | New `orch_tool_registry` row starts `locked` and requires review to move to `safe_auto` | `agent-orchestrator` registry read | Does not change existing rows |
| A4 | **Per-agent daily budget** | Reserve/commit/release spend per agent and global; refuse at the ceiling | Wire the existing unused `durableBudget.ts` into `gateAiCall` | Does not change model choice |
| A5 | **Anomaly rules** | Alert on: DM volume per hour, new recipients, invoice/credit writes, spend spike, tool-mix change, cross-tenant reads | Log/metric pipeline | Does not auto-suspend without a human |
| A6 | **Drift report** | Weekly diff of agent tool usage and output types vs an allowlist per agent | Scheduled read-only job | Does not modify agent state |
| A7 | **Retry guard** | Idempotency key per agent action; refuse duplicate execution within a window | Action tables | Does not retry automatically |
| A8 | **Kill switch** | One config row/flag per agent, checked at entry | Function entry | Does not enable anything |
| A9 | **Cost + provider health dashboard** | Spend, error rate, latency, receipt reconciliation gaps | Existing usage receipts | Read-only |

---

## 7. Prioritised remediation list

### P0
| ID | Action | Effort | Acceptance |
|---|---|---|---|
| AI-01 | Require human approval before publishing challenges, discovered Passport data, and moderation closures; route all three through a `pending_review` state | Medium | No row reaches `active`/`published`/`closed` without an approver id and an `audit_events` row |
| AI-02 | Gate `desk-agent` task/message/invoice/credit writes with the same approval pre-check as collaborator changes | Medium | Marker-free direct call yields `denied`, no write |
| AI-03 | Implement intent-first audit for every agent mutation; fail closed if the audit insert fails | Medium | Every agent action has exactly one `audit_events` row; a failed audit blocks the write |
| AI-04 | Require human confirmation for `auto-resolve-disputes` ownership changes | Small | Cron creates a proposal only; a human confirms |
| AI-05 | Fix `auto-epk-updater` auth derivation | Small | `body.user_id` alone → 401 |
| AI-06 | Remove or tightly scope the `x-internal-user-id` impersonation path; log every use | Small–Medium | No path can act as a user without a session or an explicit, audited internal grant |

### P1
- Set real daily caps and a global spend ceiling (A4); wire `durableBudget`.
- Add egress allowlist for agent functions.
- Apply `promptIsolation` to all untrusted channels, starting with `desk-agent`, `inbox-triage-agent`, `money-agent-watch`.
- Add approval + audit to `agent-rsvp-event` and `agent-vouch-credit`.
- Make `moderate-opportunity` fail closed.
- Per-client rate limit and read audit for MCP.
- Stop direct Resend calls that bypass policy/suppression.
- Private storage for generated images.
- Memory retention/expiry for `copilot_memories`, `thrive_memory`, `studio_facts`, `agent_project_context`.

### P2
- Deny-by-default registry (A3), drift report (A6), retry guard (A7), kill switch (A8), dashboard (A9).
- Replace caller-asserted markers entirely once A1 ships.

---

## 8. What this review does not establish

- It does not establish that agents are safe under adversarial prompting.
- It does not establish that the deployed registry, cron schedules or approval records match the repo.
- It does not establish compliance with the EU AI Act or any AI regulation. **[LEGAL REVIEW REQUIRED]**
- It does not approve enabling any new autonomous capability.
