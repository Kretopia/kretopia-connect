# Kreto overhaul plan

Status: Phase 1 output (read-only audit), 2026-11-15. No code, schema or configuration was changed. Everything below was read from the repository on `main` at `9a5f494b6`; production can differ, and every item marked **verify in production** must be read there (read-only) before it is acted on.

Companion documents: `KRETO_MODEL_PROFILES.md` (model and effort system), `KRETO_SAFETY_GOVERNANCE.md` (risk, approval, audit).

---

## 1. Current-state map

### 1.1 Request path today

```
Composer (InlineKretoChat on /kreto, or ThriveAgentFab)
  └─ thrive-ai-chat (edge function)
       ├─ identity: user session (or service role + explicit user id for trusted internal callers)
       ├─ gates: consume_copilot_message (per-tier daily count) → gateAiCall("kreto_message", 1)
       │         → gateAiCall("kreto_tokens", estimate)   [Cloud reservation ledger, commit/release]
       ├─ context: loadCopilotContext → USER FACTS; copilot memories (≤20, by embedding); thrive_memory;
       │           studio_facts (≤40) + studio_entities (≤25) for the project; last 40 raw turns of the thread
       ├─ route: isShortAsk (< 200 chars and no document words) ? fast model, 400 tokens : stronger model, 800 tokens
       ├─ model call through measuredModelFetch (provider receipt → credits in ai_model_calls)
       └─ reply may contain ONE <action>{intent}</action> or ONE <plan>{goal}</plan>
            ├─ FAB: intent → agent-orchestrator (classifier + ≤3 planner turns) → orch_runs/orch_actions
            │        safe_auto tools run at once (unless orch_settings.auto_run_safe = false);
            │        requires_approval → AgentApprovalCard → decideAgentAction → execute
            │   plan → copilot-planner → CopilotPlanCard → copilot-executor (whole-plan approval)
            └─ Inline (/kreto): tags are stripped, the proposal is DROPPED, and the user is told
                 "open Kreto from the bottom navigation to review and approve it" (nothing is waiting there)
```

### 1.2 What exists and works

| Area | What is there | Evidence |
|---|---|---|
| Model constants | One file of model ids; Kreto surfaces use the fast and stronger "flash" tiers, a lite tier for routing/autocomplete, a pro tier in `sponsor-radar` | `supabase/functions/_shared/aiModels.ts` |
| Output caps | Three named `max_tokens` tiers (200 / 500 / 600) for short labels, drafts, small JSON | `_shared/aiLimits.ts` |
| Cost ledger | Every gated call writes a receipt (`ai_model_calls`), priced in workspace credits from a cached catalog (`ai_model_pricing`); calls without a receipt stay `usage_missing` and block further gated calls until reconciled | `_shared/measuredModelFetch.ts`, `_shared/providerUsage.ts`, `drizzle/migrations/0007_provider_usage_receipts.sql` |
| Reservation gate | `try_reserve_ai_credit` → per-user per-feature allowance + global daily envelope (0.167 credits/day, the measured peak), then `commit_ai_credit` / `release_ai_credit` | `_shared/aiRateLimit.ts:88-210`, `drizzle/migrations/0003_ai_credit_ledger_gate.sql` |
| Gated Kreto features | `kreto_message` (30/day, est. 0.006 credits, 800 max output), `kreto_tokens` (60,000/day), `kreto_autocomplete`, `match_generation`, `scout_scan`, `attachment_parse` | `0003_ai_credit_ledger_gate.sql:55-62` |
| Tier caps | Daily message caps per subscription tier (free 30 … founder unlimited); Premium not enforced, so a fixed safety ceiling applies to everyone | `thrive-ai-chat/index.ts:331-347`, `_shared/premiumSwitch.ts` |
| Generic AI limiter | `consume_ai_feature_call` per feature, but every call site uses `-1` (count only) | `_shared/aiRateLimit.ts:32-80` |
| Voice | Seconds counted per day (`consume_voice_seconds`); the cap does not refuse while Premium is off | `thrive-voice-turn/index.ts:115-129` |
| Voice/brand rules in the prompt | First person, no emoji, no hedging, ≤120 words, never "AI", never claim an action happened, anti-hallucination on USER FACTS | `thrive-ai-chat/index.ts:562-595` |
| Tools | 64 tools in 13 domains in the repository's registry: 36 `safe_auto`, 27 `requires_approval`, 1 `locked` (§7). You cited 66: **verify in production** | computed from every migration writing `orch_tool_registry` |
| Approval execution | Orchestrator claims the action (compare-and-swap), records the approval, then executes; high-stakes tools re-check the approval record; Desk messages and call links now wait for approval (merged in `Kretopia/kretopia-connect#360`) | `agent-orchestrator/index.ts:735-800`, `_shared/executionGuard.ts`, `_shared/deskApproval.ts` |
| Memory | Durable: `copilot_memories` (user can view, add, delete at `/copilot-memory`) and `thrive_memory` (written by `thrive-memory-extract`); project: `studio_facts`/`studio_entities`; conversation: `ai_conversations`/`ai_messages` | `src/pages/CopilotMemory.tsx`, `thrive-ai-chat/index.ts:371-520` |
| Watchers | All propose, none execute: proposals, notifications, leads (§1.4) | per-function grep |
| MCP | Five read-only tools: `get_my_passport`, `list_my_credits`, `list_my_studios`, `list_scouted_gigs`, `search_creators` | `src/lib/mcp/tools` |
| Quota UI | One line under the composer from the server's overview: messages left, tokens left, reset at midnight UTC, "This backend's ceiling N% remaining" | `src/components/kreto/KretoQuotaIndicator.tsx`, `src/hooks/useAiAllowance.ts` |

### 1.3 Gaps (verified unless marked)

| # | Gap | Evidence | Impact |
|---|---|---|---|
| G1 | Inline Kreto drops every proposed action and sends the user to the bottom navigation, where nothing is waiting | `InlineKretoChat.tsx:287-298` | The main `/kreto` surface cannot act; trust loss |
| G2 | Routing silently upgrades: any message ≥ 200 characters or with document words goes to the stronger model | `thrive-ai-chat/index.ts:687-693` | Violates "never silently upgrade"; cost unpredictability |
| G3 | No model, effort or response-mode choice anywhere; no per-request estimate | composer, `thrive-ai-chat` | Brief requirement unmet |
| G4 | History is injected raw: the last 40 turns every request, no summary | `thrive-ai-chat/index.ts:547-553` | Largest controllable cost driver; latency |
| G5 | Only `thrive-ai-chat` and `kreto-resources` are on the receipt ledger; `agent-orchestrator` (classifier + up to 3 planner turns), `copilot-planner`, `desk-agent`, every watcher and `sponsor-radar` (pro tier) are not | grep of `measuredModelFetch` users; `agent-orchestrator/index.ts:52-115,224-240` | Real Kreto spend per user is undercounted; no weekly view possible |
| G6 | Allowance is daily only (window key `YYYYMMDD` is hard-coded inside the gate functions); no weekly budget, no share-of-week warning | `0003_ai_credit_ledger_gate.sql:79,154` | Brief requirement unmet |
| G7 | Audit trail is not append-only end to end: users may `INSERT` their own `orch_runs` and `orch_approvals`; owners may `UPDATE`/`DELETE` `copilot_plans` and `DELETE` `agent_project_context` | final policies computed from migrations | A forged approval row cannot execute (the guard also needs the server-set `approved` status), but the record can be polluted or erased |
| G8 | Run history is split across three stores (`orch_runs`, `agent_runs`, `copilot_plans`); the activity page reads `agent_runs` and watcher outputs, not the action audit | `src/pages/AgentsActivity.tsx:26-31` | Users cannot see what Kreto actually did |
| G9 | Statuses lack `running`, `partial`, `cancelled`, `unknown` on actions (`proposed, approved, rejected, executed, failed, auto_executed`) | enum in `20260501201445` | Cannot report partial or unknown outcomes truthfully |
| G10 | Web research runs automatically (`research_web`, `find_sponsors`, `search_scouted_gigs` are `safe_auto`), stores the URL but no per-source date, has no cache, and can return a provider name in an error | `scout-leads/index.ts:70-72,225-237`; registry | Consent, cost and attribution rules unmet |
| G11 | USER FACTS reports invoices as paid from status alone, so Kreto can call an issuer-recorded payment "paid"; credits already carry an evidence level | `_shared/copilotContext.ts:77`, `creditEvidence()` | "Never claim paid unless proven" |
| G12 | Shared-state and publishing tools run without approval: `assign_task`, `generate_milestones`, `refresh_epk` (regenerates the public site), `match_event_guests`; `orch_settings.auto_run_safe` defaults to on | registry; `agent-orchestrator/index.ts:1274` | Brief approval rules unmet |
| G13 | Registry descriptions carry internal names and an untrue word ("ThriveCredit", "ThriveIN", "ThriveDesk", "Firecrawl + AI", "Draft a **verified** credit"); a missing preview falls back to the raw tool name | registry rows; `agent-orchestrator/index.ts:300` | Leaks into replies and cards |
| G14 | Quota line says "tokens" and "This backend's ceiling"; the blocked notice uses `border-white/15` (not a semantic token) | `KretoQuotaIndicator.tsx` | Brand and design rules |
| G15 | Two durable memory stores with different owners and controls (`copilot_memories` editable on a page; `thrive_memory` written by an extractor). `copilot_memory` is not defined in repository migrations: **verify in production** | `CopilotMemory.tsx:110`, `thrive-ai-chat/index.ts:390-460` | Memory controls incomplete; drift |
| G16 | Signed-in AI functions have counting but no caps (`DEFAULT_DAILY_CAP = -1`) | `_shared/aiRateLimit.ts:32` | Unbounded spend per account (also SEC-06 in `docs/security-compliance/security-review.md`) |
| G17 | Orchestrator accepts the service key plus `x-internal-user-id` to act as any user | `agent-orchestrator/index.ts:630-640` | AI-06 in the governance review; out of this plan's code scope, tracked |

Hypotheses from the brief that are **already resolved on `main`**: the Desk agent's messages and call links now wait for approval and every Desk tool run is recorded (`#360`); payment provenance is labelled in the UI and the reviewed migration exists (`#360`); the Stripe ledger retry fix is merged (`#360`). Wallet and message migrations are merged but **not applied in production** until you run them.

### 1.4 Watchers

| Watcher | Trigger | Writes | Model | Metered |
|---|---|---|---|---|
| `desk-agent-watch` | user session | proposals (via shared helper) | fast | no; must stay disabled on the legacy backend (AGENTS.md) |
| `surface-agent-watch` | user session | proposals | none found | n/a |
| `money-agent-watch` | cron secret | `agent_proposals`, `notifications` | 2.5 flash | no |
| `auto-outreach-watch` | cron secret | `notifications` | none | n/a |
| `sponsor-radar` | user session | `event_sponsors`, `sponsor_leads` | pro | count only |
| `ep-daily-briefing` | user session | none found | fast | no |
| `desk-daily-nudge` | cron secret | `notifications`, proposed `orch_actions` | none | n/a |

---

## 2. File inventory

Opened in this audit (26, within the agreed budget plus one justified): `_shared/aiModels.ts`, `_shared/aiLimits.ts`, `_shared/premiumSwitch.ts`, `_shared/kretoIdentity.ts`, `_shared/providerUsage.ts`, `_shared/measuredModelFetch.ts`, `_shared/aiRateLimit.ts`, `drizzle/migrations/0003_ai_credit_ledger_gate.sql`, `thrive-ai-chat/index.ts`, `src/components/kreto/InlineKretoChat.tsx`, `src/pages/KretoTab.tsx`, `src/components/desk/ThriveAgentFab.tsx`, `agent-orchestrator/index.ts`, registry (aggregate over migrations), RLS policies (aggregate over migrations), watchers (aggregate), `src/lib/mcp/tools`, `thrive-voice-turn/index.ts`, `src/pages/CopilotMemory.tsx`, `src/hooks/useAiAllowance.ts`, `src/components/kreto/KretoQuotaIndicator.tsx`, subscription tier labels, UI copy sweep (aggregate), `scout-leads/index.ts`, `src/pages/AgentsActivity.tsx`, `_shared/copilotContext.ts` (justified: it defines USER FACTS).

Will change in later phases (by name, not yet opened in full): `kreto-resources/index.ts` (Cloud control endpoint: overview and estimate), `copilot-planner`, `copilot-executor`, `desk-agent`, `src/lib/thriveCopilot.ts`, `src/lib/aiAllowance.ts`, `src/components/agent/AgentApprovalCard.tsx`, `src/components/kreto/KretoConversationHistory.tsx`, `src/lib/agentOrchestrator.ts`, `sponsor-radar`, `_shared/promptIsolation.ts`.

---

## 3. Model routing design (summary; full spec in `KRETO_MODEL_PROFILES.md`)

- One pure server module, `_shared/kretoProfiles.ts`: the ten Kretopia profiles, each mapped server-side to one of the configured model tiers, plus its prompt focus, context scope, tool allow-list and caps.
- One pure function, `resolveKretoRoute({ requested, effort, taskHint, contextSize, risk, quota, voice })` → `{ profile, tier, effort, caps, reason }`. Unit-tested as a table.
- Rules: the user's explicit profile always wins unless it is unavailable on their plan or unsafe for the request; then Kreto says so and offers the nearest allowed profile. **Auto** may route down to a cheaper tier, never up past the tier that the chosen effort allows. Any upgrade is a visible suggestion, never an automatic switch.
- Replaces the `isShortAsk` heuristic (G2). Default: Auto + Balanced, which costs no more than today's short-ask path.

## 4. Effort system design

Four levels (Quick, Balanced, Deep, Maximum). Each fixes, server-side, the output cap, history window, context scope, tool-call cap, planner turns, research depth and the highest model tier allowed. Effort is shown and changeable in the composer and recorded on the run. Maximum always shows its estimate and asks to confirm when it crosses the share-of-week threshold.

## 5. Context injection design

- **Context selector** in the composer: Passport, Projects (with a single selected project), Money, Scout, Match. Defaults per surface (on KrePay: Money; in a Studio room: that project). Only selected sections are loaded.
- **Minimum by default**: USER FACTS shrinks to identity, the selected sections, and counts with links for the rest. The Studio Brain loads only for the selected project, capped by effort.
- **History**: a rolling summary of the thread plus the last N verbatim turns (N by effort: 4 / 8 / 12 / 20), instead of 40 raw turns (G4). The summary is produced by the lite tier when the thread crosses a size threshold, and stored on the conversation.
- **Truth labels in context**: invoices carry provenance (provider-confirmed vs recorded by the issuer, G11); credits keep their evidence level; suggested credits are labelled suggested; company mode is a presentation mode, never ownership.
- **Permission checks before load**: project data only through the existing fail-closed project-access helper; money only for the owner or roles that see money; guests see nothing private.
- **Untrusted content** (project chat, documents, web results) always wrapped by `_shared/promptIsolation.ts`.

## 6. Memory design

- Keep three layers. Make them visible and controllable on one Kreto settings page.
- Unify durable memory onto one store behind one tool (`remember`, `recall_memory`, `forget_memory`). Which table survives is an open decision (§16).
- `remember` stays automatic but every write is shown as a small "Kreto remembered …" receipt with Undo; `forget_memory` stays `requires_approval` when Kreto proposes it, and is direct when the user deletes from settings.
- Memory never stores money figures, secrets or third-party contact details without the user's explicit "remember this".
- Studio Brain facts stay project-scoped and marked unverified until a member confirms them (current behaviour).

## 7. Tool inventory

All 64 tools from the repository registry. **Risk** is the current tier. **Proposed** follows the approval matrix in `KRETO_SAFETY_GOVERNANCE.md`. Cost and latency are relative: L (lite or no model), M (one fast call), H (several calls, web, or the pro tier). Every tool must write an `orch_actions` row with run id, inputs summary, result or error.

| Domain | Tool | Handler | Risk now | Proposed | Cost/latency | Notes |
|---|---|---|---|---|---|---|
| client_followup | chase_followups | thrive-creative-tools | auto | keep auto (finds, drafts) | M | read + draft only |
| client_followup | mark_lead | inbox-triage-agent | auto | keep auto | L | own records |
| client_followup | negotiate_rate | thrive-creative-tools | approval | keep | M | draft; sending is separate |
| client_followup | send_reminder | send-notification-email | approval | keep | L | sends |
| credit | add_credit | desk-agent | auto | keep auto, show receipt | L | self-reported, own Passport |
| credit | draft_credit | desk-agent | auto | keep auto; fix description ("verified") | L | G13 |
| credit | publish_credit | verify-credit | approval | keep | L | publishes |
| credit | vouch_credit | agent-vouch-credit | approval | keep | L | public endorsement |
| event | create_event | extract-event-details | approval | keep | M | |
| event | rsvp_to_event | agent-rsvp-event | approval | keep | L | |
| event | send_event_invite | send-event-invite | approval | keep | L | sends |
| event | generate_event_cover | generate-event-cover | auto | keep auto | M (image) | cost-capped |
| event | match_event_guests | match-event-guests | auto | approval if it writes invites/lists; else keep | M | **verify** what it writes |
| gig | apply_to_gig | send-outreach-email | approval | keep | L | sends |
| gig | create_gig | enhance-gig | approval | keep | M | publishes |
| gig | draft_gig_application | draft-gig-application | auto | keep auto | M | draft |
| gig | score_applicants | ai-talent-match | auto | keep auto | M | own gig |
| gig | search_scouted_gigs | scout-gigs | auto | consent-gated (web toggle) | H | external |
| memory | forget_memory | thrive-memory-tool | approval | keep | L | |
| memory | recall_memory | thrive-memory-tool | auto | keep | L | |
| memory | remember | thrive-memory-tool | auto | keep auto + visible receipt | L | |
| money_admin | draft_milestone_invoice | desk-agent | auto | keep auto (draft only) | L | never sends |
| money_admin | scan_receipt | scan-receipt | auto | keep auto | M | own upload |
| money_admin | send_chase_email | send-invoice-chase | approval | keep | L | sends |
| money_admin | weekly_money_summary | ai-finance | auto | keep | M | read |
| opportunity | find_sponsors | sponsor-radar | auto | consent-gated; route off the pro tier unless effort ≥ Deep | H | external; most expensive tool |
| opportunity | research_web | scout-leads | auto | consent-gated; cache; source + date per item | H | external |
| opportunity | summarize_opportunities | personalized-recommendations | auto | keep | M | read |
| orchestrator | ask_clarification | inline | auto | keep | none | |
| orchestrator | send_triage_reply | inbox-triage-agent | approval | keep | L | sends |
| orchestrator | triage_message | inbox-triage-agent | auto | keep | M | |
| payment | charge_card | create-payment | locked | keep locked | — | never runs |
| payment | draft_invoice | desk-agent | approval | keep (orchestrator); Desk path runs it immediately as a draft: decide (§16) | L | |
| payment | draft_quote | desk-agent | approval | same as draft_invoice | L | |
| payment | send_payment_link | send-get-paid-link | approval | keep | L | |
| profile | analyze_profile_url | analyze-profile-url | auto | keep auto (user-supplied URL) | M | external fetch of the URL the user gave |
| profile | enrich_profile | enrich-creator-profile | auto | consent-gated; results saved unconfirmed (current) | H | external |
| profile | refresh_profile | auto-discover-creatives | auto | consent-gated; suggestions only | H | AI-01 writes into other people's Passports: **fix before enabling** |
| profile | request_vouch | send-credit-invite | approval | keep | L | sends |
| profile | suggest_missing_credits | enrich-credits | auto | keep (suggestions) | M | |
| project_manager | add_collaborator | copilot-collaborator-tools | approval | keep | L | high-stakes guard |
| project_manager | archive_project | copilot-collaborator-tools | approval | keep | L | |
| project_manager | create_project | desk-agent | approval | keep | L | |
| project_manager | delete_project | copilot-collaborator-tools | approval | **locked for agents** (brief: deleting data never auto-runs; keep human UI path) | L | |
| project_manager | remove_collaborator | copilot-collaborator-tools | approval | keep (changes permissions: consider locked for agents, §16) | L | |
| project_manager | send_message_to_collaborator | desk-agent | approval | keep | L | |
| project_manager | spin_up_project | inline_bundle | approval | keep | M | invites + DM |
| project_manager | start_video_call | desk-agent | approval | keep (migration `20261113102000` pending apply) | L | |
| project_manager | assign_task | desk-agent | auto | **approval** (changes another member's work) | L | G12 |
| project_manager | create_task | desk-agent | auto | keep auto when the user named it; record | L | |
| project_manager | find_user | copilot-collaborator-tools | auto | keep | L | read |
| project_manager | generate_milestones | scope-guardian | auto | **approval** (writes shared plan) | M | G12 |
| project_manager | get_project_summary | desk-agent | auto | keep | L | read |
| project_manager | list_my_projects | copilot-collaborator-tools | auto | keep | L | read |
| project_manager | mark_task_done | desk-agent | auto | keep auto when named; record; Undo | L | |
| project_manager | schedule_reminder | desk-agent | auto | keep | L | own reminder |
| site_epk | refresh_epk | generate-site | auto | **approval** (publishes) | M | G12 |
| talent | draft_outreach | generate-content | auto | keep | M | draft |
| talent | draft_outreach_email | draft-outreach-email | auto | keep | M | draft |
| talent | rank_creators | ai-talent-match | auto | keep | M | |
| talent | recycle_pitch | thrive-creative-tools | approval | downgrade to auto (draft only) **only if** it never sends: **verify** | M | |
| talent | search_creators | discover-creators | auto | keep | L | |
| talent | send_message | send-user-email | approval | keep | L | sends |
| talent | send_outreach_email | send-outreach-draft | approval | keep | L | sends via user's mailbox |

Consolidation candidates (no new tools): `draft_outreach` + `draft_outreach_email` (one drafting tool, two targets); `research_web` + `find_sponsors` (one research tool with a `kind`); `enrich_profile` + `refresh_profile` + `suggest_missing_credits` (one "Passport suggestions" tool that never writes without confirmation). Disable candidates pending verification: `refresh_profile` until AI-01 is fixed.

## 8. Approval matrix

See `KRETO_SAFETY_GOVERNANCE.md` §2. Summary: send, publish, invite, change shared state, initiate payment → approval; delete data, change permissions, charge → locked for agents; external research → user consent setting; sensitive data → permission check before load.

## 9. Cost-control design

1. **Meter everything**: route every Kreto model call (orchestrator, planner, desk agent, watchers, research) through `measuredModelFetch` and a gate, so receipts and allowances cover real spend (G5).
2. **Weekly window**: add a weekly credit allowance alongside the daily ones, in micro-credit units so the existing integer ledger columns fit; the gate functions take the window as a parameter instead of hard-coding the day (migration, §14).
3. **Estimate before run**: `estimate = input_tokens_est × input_rate + output_cap × output_rate` from the cached catalog for the mapped tier; return it with the share of the remaining weekly allowance.
4. **Guard**: below the confirm threshold → run; above it → the composer asks once, with the number; above the remaining allowance → hard stop with the reset time. Thresholds are configuration, not code.
5. **Cheapest sufficient by default**: Auto + Balanced; Deep and Maximum, Vision and Oracle are opt-in.
6. **Caps per request**: output tokens, history turns, context sections, tool calls, planner turns, research sources, all by effort.
7. **Caches**: research results by normalised query + location for 24 h; thread summaries; profile-URL analyses by URL hash; deterministic summaries keyed by input hash.
8. **No silent upgrades**: enforced in `resolveKretoRoute` and pinned by a test.
9. **Reconcile**: estimates vs receipts tracked daily; the receipt always wins and the estimate model is tuned from it.

## 10. UI redesign plan

- **Composer** (one row under the input, quiet until touched): profile chip, effort chip, context chips, web toggle, voice, attach, send. When the estimate crosses the threshold, one line replaces the quota line: "About 18% of what's left this week. Run it?" with Run and Change effort.
- **Response**: direct answer first; "Why" and "Sources" as collapsible rows; a separate "Kretopia data" and "From the web" label; proposed actions as the existing approval cards, inline on every surface (fixes G1); a status chip (Proposed, Running, Done, Partial, Failed, Unknown) with a recovery action on failure.
- **History**: each turn shows profile, effort, tools, sources, actions proposed, approved, completed, failed; the activity page reads the action audit (`orch_*`), not `agent_runs` only (G8).
- **Settings** (`/kreto/settings`): default profile and effort, weekly target, web research permission (Ask each time / Always / Never), memory (view, edit, delete, pause learning), voice, notifications, approval preferences (auto-run safe tools on/off), entry points to data export and account deletion only where those flows exist.
- **Quota line**: "12 of 30 messages left today · 64% of this week left · resets Monday" — no tokens, no "backend", semantic tokens only (G14).
- Design rules: semantic tokens only; no `backdrop-blur` on sticky or fixed surfaces; Kretopia type; no generic chat chrome.

## 11. API contracts (proposed)

**`thrive-ai-chat` request** (additive; unknown fields ignored by old clients and servers):

```ts
{
  messages, conversationId, surface, stream,            // existing
  profile?: KretoProfileId | "auto",                    // default "auto"
  effort?: 1 | 2 | 3 | 4,                               // default 2
  web?: boolean,                                        // default from settings; false when unset
  context?: { projectId?: string; include?: Array<"passport" | "projects" | "money" | "scout" | "match"> },
  estimateToken?: string                                // from the estimate call, required when it said needs_confirmation
}
```

**First SSE event**: `{ type: "meta", run_id, profile, effort, tier_label, estimate: { credits, pct_of_week_remaining } }`. **Last event**: `{ type: "receipt", run_id, credits, status }` (credits only when the provider receipt arrived; otherwise `status: "settling"`).

**`kreto-resources` (Cloud control endpoint)**:
- `overview` (exists): add `week: { used, cap, left, resets_at }`.
- `estimate` (new): `{ profile, effort, context, web, text_length } → { profile, effort, credits, pct_of_week_remaining, needs_confirmation, blocked, reason, estimate_token }`.

**Preferences**: `GET/PUT kreto_preferences` (default profile, effort, web permission, approval preferences), through RLS for the owner.

## 12. Database needs

| Need | Where | Change |
|---|---|---|
| Weekly allowance | Cloud | gate functions take a window kind; config rows for weekly micro-credit caps per tier |
| Run metadata | Cloud `ai_model_calls` | add `profile`, `effort`, `run_id` |
| Run metadata | legacy `orch_runs` | add `profile`, `effort`, `tools_used text[]`, `external_services text[]`, `data_scopes text[]` |
| Statuses | legacy `orch_action_status` | add `running`, `partial`, `cancelled`, `unknown` |
| Append-only audit | legacy | revoke client `INSERT` on `orch_runs`/`orch_approvals` (decisions only through the endpoint), revoke owner `UPDATE`/`DELETE` on `copilot_plans` and `DELETE` on `agent_project_context` |
| Preferences | legacy | `kreto_preferences` table (or `orch_settings` columns) |
| Research cache | legacy or Cloud | `kreto_research_cache(query_hash, kind, results, sources, fetched_at, expires_at)` |
| Thread summary | legacy | `ai_conversations.summary text`, `summary_through timestamptz` |
| Registry | legacy | re-tier tools (§7), clean descriptions (G13) |

## 13. Migration needs

Every row of §12 is a migration and needs your approval. Order: (1) additive columns and enum values; (2) preferences and cache tables; (3) Cloud gate functions with window parameter (keep the old signatures working until both backends are updated); (4) registry re-tiering and descriptions; (5) privilege revokes for append-only audit, last, after the decision endpoint is the only writer in code.

## 14. Test plan

- `resolveKretoRoute`: table test over every profile × effort × task hint; invariant "Auto never returns a tier above the effort ceiling"; explicit choice wins; unavailable choice is refused with a named alternative.
- Estimate and guard: maths against fixed pricing fixtures; thresholds (run / confirm / stop); never runs without a confirm token when required.
- Context: selector loads only the chosen sections; guests and non-money roles get no money; invoice provenance appears in USER FACTS.
- History: summary + N turns replaces raw 40; token estimate drops on a long thread fixture.
- Inline approvals: a proposed action on `/kreto` becomes a persisted proposal and renders a card (no "bottom navigation" text).
- Metering: orchestrator, planner and desk agent write receipts (in-memory DB harness used by existing edge tests).
- Audit: append-only privileges proven on a local PostgreSQL with Supabase-shaped roles (as done for `#360`).
- Brand guard: a test that scans user-facing strings for provider names, "AI-powered", "assistant", "chatbot", "copilot" and internal prefixes.
- Only the relevant files run; no full suite unless asked.

## 15. Rollout plan

1. Server accepts the new fields, ignores them behind a server constant (`KRETO_PROFILES_ENABLED = false`); defaults reproduce today minus the silent upgrade.
2. Shadow mode for a week: route decisions and estimates logged next to receipts; no enforcement.
3. Enable profiles and effort in the UI for founders, then everyone; weekly guard warns only.
4. Enforce the weekly hard stop after estimates are within an agreed error of receipts.
5. Each step: functions pasted into `kretopia-app` (shared files first), app published after merge; nothing deployed without your go.

## 16. Risks and open product decisions

**Risks**: estimates drift from receipts (mitigated by reconciliation); changing the gate functions touches every gated call (keep old signatures, test on local PostgreSQL); the legacy/Cloud split means the orchestrator may need the Cloud control endpoint to reach the ledger (**verify** which backend each function writes to); preview model ids can retire (single constants file); more controls add friction (defaults stay one-tap); web results are prompt-injection vectors (isolation wrapper, no tool execution from web text).

**Decisions needed from you**:
1. Weekly allowance per tier (in credits) and the confirm threshold (built at 25% of what's left today, configurable; switches to the week once a weekly allowance is set) and hard-stop rule.
2. Which profiles each tier may use (suggest Free: Signal, Pulse, Echo, Studio, Scout; paid: all; Oracle opt-in for paid only).
3. Default effort (suggest Balanced) and whether Maximum always confirms.
4. Keep Kreto Forge? For creatives it fits structured outputs (decks, rate cards, JSON layouts) better than code; suggest renaming its use to "structured work" or dropping it.
5. Which durable memory store survives (`copilot_memories` or `thrive_memory`). Until decided, both are visible and deletable on the memory page (Kretopia/kretopia-connect#364); unifying them is a migration.
6. Desk path `draft_invoice`/`draft_quote`: keep immediate drafts (never sent) or require approval.
7. `remove_collaborator` and `delete_project` for agents: keep approval, or lock for agents and leave them to the human UI.
8. Web research default: Ask each time (suggested) or Off.
9. Chat history: keep user deletion of conversations (privacy) while the action audit stays append-only (suggested).
