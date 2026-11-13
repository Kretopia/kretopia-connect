# AI and agent governance review

Status: internal working document, 2026-11-13. Source-level review; no agent capability was enabled or changed. Tool names and risk tiers are reconstructed from the repository's migrations (`orch_tool_registry` inserts and updates); production's registry may differ and should be read before acting on §2.

## 1. Agent inventory

| Agent / door | Code | Triggered by | What it can do | Approval model |
|---|---|---|---|---|
| Kreto orchestrator | `supabase/functions/agent-orchestrator` | the user in Kreto chat | plans with the AI gateway; runs `safe_auto` tools at once; proposes `requires_approval` tools; refuses `locked` | per action: `orch_actions` row → `orch_approvals` decision → execution; `safe_auto` runs automatically unless the user's `orch_settings.auto_run_safe` is off (default on, index.ts ~1273) |
| Copilot planner and executor | `copilot-planner`, `copilot-executor` | the user | multi-step plans; each step is a registered tool | per plan: an explicit `approved` decision is required (no default); plan must belong to the caller; each step's tool must be registered, enabled and not locked, with the registered handler (`_shared/approvalHardening.ts`); one run per plan (compare-and-set) |
| Desk agent (Studio) | `desk-agent` | the user in a project's Desk | `create_task`, `mark_task_done`, `send_message_to_collaborator`, `schedule_reminder`, `draft_invoice`, `draft_quote`, `start_video_call`, `add_credit` run **immediately**; `add_collaborator` and `remove_collaborator` are queued for approval | none for the immediate tools (gap, see §4); daily tier limit and a rate limit |
| Watchers | `desk-agent-watch`, `money-agent-watch`, `surface-agent-watch`, `auto-outreach-watch`, `desk-daily-nudge`, `ep-daily-briefing` | cron (shared secret) or the user's session | write proposals (`agent_proposals`), drafts (`outreach_drafts`) and notifications; no sending found | the user acts on a proposal; `desk-agent-watch` must stay disabled on the legacy backend (AGENTS.md) |
| Studio Brain | `studio-ingest` and extraction | uploads and project activity | extracts facts and entities into `studio_facts`, `studio_entities`; the Desk agent reads them, marking low-confidence facts as unverified | none needed (internal records) |
| Memory | `thrive-memory-extract` | service role only | writes `thrive_memory` | none; no user control (gap) |
| MCP server | `src/lib/mcp` (bundled into `supabase/functions/mcp`) | external MCP clients with the user's OAuth token | five read-only tools: search creators, own Passport, own studios, scouted gigs, own credits | read-only; RLS applies through the user's token |
| Content and matching AI | e.g. `compose-magazine-article`, matching and ice-breaker functions, `transcribe-call`, public web search | the user or the service role | generate text, rank people, transcribe | no side effects beyond their own records; public web search is behind a server-side activation switch and an atomic quota (AGENTS.md) |

## 2. Tool and permission matrix

From the registry (25 `requires_approval`, 34 `safe_auto`, 1 `locked`):

| Tier | Tools | Concern |
|---|---|---|
| `locked` (never runs) | `charge_card` | none |
| `requires_approval` | `add_collaborator`, `remove_collaborator`, `apply_to_gig`, `archive_project`, `delete_project`, `create_event`, `create_gig`, `create_project`, `spin_up_project`, `draft_invoice`, `draft_quote`, `send_payment_link`, `negotiate_rate`, `publish_credit`, `vouch_credit`, `request_vouch`, `recycle_pitch`, `rsvp_to_event`, `send_chase_email`, `send_dm`, `send_event_invite`, `send_message`, `send_message_to_collaborator`, `send_reminder`, `send_triage_reply` | Correct tier. Enforced on the orchestrator and copilot paths; **not** on the Desk path for `send_message_to_collaborator` and `draft_invoice` |
| `safe_auto` with side effects on shared state | `create_task`, `assign_task`, `mark_task_done`, `schedule_reminder`, `start_video_call`, `chase_followups`, `mark_lead`, `generate_milestones`, `match_event_guests`, `generate_event_cover`, `add_credit`, `enrich_profile`, `refresh_profile`, `refresh_epk` | Several change what other project members see (`assign_task`, `create_task`, `mark_task_done`, `start_video_call` posts a join link, `generate_milestones`). Under the brief's rule ("modify shared project state requires explicit approval or narrowly scoped authorisation") these should be re-tiered or narrowly scoped: see §4 |
| `safe_auto` read-only or own-records | `find_user`, `list_my_projects`, `get_project_summary`, `search_creators`, `search_scouted_gigs`, `rank_creators`, `research_web`, `summarize_opportunities`, `score_applicants`, `analyze_profile_url`, `suggest_missing_credits`, `weekly_money_summary`, `scan_receipt`, `triage_message`, `ask_clarification`, `draft_*` | Fine |

Server-side authority for the highest-stakes tools that several doors reach (`remove_collaborator`, `delete_project`) is shared in `_shared/agentAuthority.ts`: an agent may run them only with a proven, already-approved action (`_shared/executionGuard.ts`, fail closed).

## 3. Data ingress and egress

| Direction | What | Where in code | Notes |
|---|---|---|---|
| In | User prompts, project chat, tasks, briefs, documents, call transcripts, Studio Brain facts, profile data | `desk-agent` (context load ~449-491), orchestrator | Untrusted content is wrapped with an injection-defence clause in several functions (`_shared/promptIsolation.ts`); apply it everywhere project or web text enters a prompt |
| In | Web pages and search results | Firecrawl, public web search | Treated as untrusted; ranking may only use supplied sources (AGENTS.md) |
| Out: model providers | The prompt: user text plus project context (names, tasks, chat excerpts, facts, money figures for invoices) | AI gateway (model ids in `_shared/aiModels.ts`) | Personal data of project members and clients reaches the providers behind the gateway. Needs: a processor agreement, a no-training commitment, a region decision, and minimisation (send ids and roles, not emails) |
| Out: email | Chase emails, outreach, invitations, notifications | `send-transactional-email`, `send-invoice-chase`, Gmail through the user's connection | Agent paths draft; sending is a separate approved action |
| Out: messages | Project chat and DMs | `desk-agent` (immediate), orchestrator (approved) | Gap on the Desk path |
| Out: payments | Payment links, invoices | `send_payment_link` (approval), `draft_invoice` (draft only), `charge_card` locked | No agent can move money |
| Out: storage and database | Tasks, notes, credits, projects, proposals, memory | service role inside functions | Every write should be attributable to a run and an action (§5) |
| Out: video | Call rooms and join links | `create-video-room` | Desk path posts the link without approval |

## 4. Approval requirements

Rule from the brief, applied to the code: an agent action that sends a message, publishes content, modifies shared project state, invites people, spends money or accesses sensitive data needs either the user's explicit approval of that action, or an authorisation scoped narrowly enough that the user's own request names it.

| Gap | Where | Proposal (needs approval: agent behaviour change) |
|---|---|---|
| G-1 | Desk agent posts AI-written chat messages (`send_message_to_collaborator`, `desk-agent/index.ts:686-700`) | Queue as an `orch_actions` proposal with a preview, exactly as this function already does for `remove_collaborator`; post only after approval |
| G-2 | Desk agent starts a call and posts the join link (`start_video_call`, 779-785) | Same as G-1 |
| G-3 | Desk agent creates, completes and schedules tasks immediately | Decide: keep immediate (the user's own instruction names the task) but record each as an executed `orch_actions` row, or require approval. Recommended: keep immediate, record it, and show an undo |
| G-4 | `safe_auto` tools that change shared state run automatically on the orchestrator path | Re-tier `assign_task`, `start_video_call`, `generate_milestones`, `match_event_guests` to `requires_approval`, or set `auto_run_safe` off by default for shared projects |
| G-5 | Desk agent writes no per-action record for what it executed; its run receipt is best effort | Write one `orch_actions` row per executed tool (status `executed`, `executed_at`, result) inside the same request |

## 5. Audit requirements

What every agent action should carry, and what exists:

| Field | Orchestrator (`orch_runs`, `orch_actions`, `orch_approvals`) | Copilot (`copilot_plans`) | Desk agent |
|---|---|---|---|
| Durable run id | yes (`orch_runs.id`) | yes (`copilot_plans.id`) | best-effort `orch_runs` row |
| Actor | `user_id` | `user_id` | `user_id` |
| Target | after the fact (`created_record_ids`) | inside step results | no |
| Input summary | `intent_text`, `tool_args`, `preview_title`, `preview_body` | steps and args | `agent_project_context.tool_calls` |
| Result and error | `result`, `error` | per-step `result`, failure reason | in the response only |
| Status | `proposed`, approved, executed, failed | `proposed`, `running`, `succeeded`, `failed`, `cancelled` | run status only |
| Approval record | `orch_approvals` (decision, edited args, time) | the request's explicit decision (not stored separately) | for collaborator tools only |
| Tamper resistance | users can read and insert, not change (`orch_actions` has no client write policy) | **owner can update and delete** the plan | n/a |
| Retry and recovery | `reconcile_stale_orch_runs` (service only) | halts on failure; no resume | none |
| Idempotency key per side effect | no | no (one run per plan only) | no |

Proposed (P1-3 and P1-4 in the remediation plan): one append-only `audit_events` log (designed in `docs/platform/AUDIT_TRAIL_DESIGN.md`) written by every door, with run id, actor, target type and id, tool, input summary (hashed or truncated, no secrets), result summary, status, error, approval reference, idempotency key, attempt count. Needs a migration.

## 6. Drift, abuse, cost, retry and recovery controls

| Control | Exists | Gap |
|---|---|---|
| Prompt-injection defence | `_shared/promptIsolation.ts` used in several functions | Not applied everywhere project or web text enters a prompt; add a test that lists AI functions without it |
| Tool allow-list | registry checked by copilot executor and orchestrator; locked and disabled tools refused | Desk agent has its own list (fine) but bypasses the registry tier |
| Model drift | model ids centralised in `_shared/aiModels.ts` | No evaluation set for agent behaviour; add a small fixed set of prompts whose expected tool choice is checked before a model change |
| Abuse and cost | per-user limits on many AI functions (`_shared/aiPerimeter.ts`), Desk daily limit, Kreto Cloud ledger with reservations and receipts (AGENTS.md), public web search quota | 8 signed-in AI functions without any limiter (remediation plan P1-2); no global spend alarm documented |
| Retries | executor halts on failure; stale-run reconciliation | No `outcome_unknown` state; a timeout after a send can lead to a second send on retry |
| Recovery | plans can be cancelled before running; tools can be disabled in the registry (kill switch per tool) | No undo for executed actions; document the per-tool kill switch in the incident plan (done in `data-protection-review.md` §6.4) |
| Human visibility | approval cards in the UI; proposals | Weekly review below |

## 7. Agent action-log review process

Weekly, by the technical lead, 30 minutes. Read-only queries against the agent tables (run them in the database console with a read-only role; adapt names to production):

1. **Side effects without approval.** Executed actions whose tool is `requires_approval` and that have no positive approval:

   ```sql
   select a.id, a.tool_name, a.user_id, a.executed_at
   from orch_actions a
   join orch_tool_registry t on t.tool_name = a.tool_name and t.risk_level = 'requires_approval'
   where a.executed_at > now() - interval '7 days'
     and not exists (select 1 from orch_approvals p where p.action_id = a.id and p.user_id = a.user_id and p.decision in ('approved', 'edited'));
   ```
   Expected: zero rows. Any row is a SEV-2 incident.
2. **Desk agent activity.** Runs from the Desk door and the tools they used (`orch_runs` where the intent is a Desk run; `agent_project_context.tool_calls`): look for message and call tools, unusual volume per user, and failures.
3. **Failures and stuck runs.** Runs in `running` or `pending` for over an hour; failed actions grouped by tool and error.
4. **Volume and cost.** Actions per user per day; AI calls and spend per user from the Cloud ledger; outliers above ten times the median.
5. **Registry drift.** Any change to `orch_tool_registry` (new tools, tier changes, enabled flags) since last week, compared with the reviewed list in §2.
6. **Locked tools.** Any attempt to run `charge_card` or a disabled tool (refusals in function logs).

Record each review (date, reviewer, findings, actions). Escalate per `data-protection-review.md` §6 when an action ran without the approval it needed, an agent reached data it should not, or spend jumps.
