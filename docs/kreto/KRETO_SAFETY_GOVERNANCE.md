# Kreto safety and governance

Status: Phase 1 design, 2026-11-15. Read from the repository on `main`; nothing implemented or applied. Builds on `docs/security-compliance/ai-agent-governance-review.md` (AI-01 … AI-06) and the fixes merged in `Kretopia/kretopia-connect#360`. This is an internal engineering document, not a compliance statement.

---

## 1. Action risk matrix

| Category | Examples (registry tools) | Risk | Today | Target |
|---|---|---|---|---|
| Read own data | `get_project_summary`, `list_my_projects`, `recall_memory`, `weekly_money_summary`, `find_user` | none | auto | auto |
| Draft (nothing leaves the user) | `draft_outreach`, `draft_gig_application`, `draft_milestone_invoice`, `negotiate_rate`, `chase_followups` | low | auto | auto, recorded |
| Write own records | `add_credit` (self-reported), `create_task` the user named, `schedule_reminder`, `remember`, `mark_lead`, `scan_receipt` | low | auto | auto, recorded, Undo where possible |
| External research | `research_web`, `find_sponsors`, `search_scouted_gigs`, `enrich_profile`, `refresh_profile` | medium (cost, consent, injection) | auto | consent setting; sources and dates; cache |
| Change shared state | `assign_task`, `generate_milestones`, `mark_task_done` on someone else's task, `match_event_guests` (if it writes) | medium | auto | approval |
| Send a message | `send_message`, `send_message_to_collaborator`, `send_outreach_email`, `send_reminder`, `send_chase_email`, `send_triage_reply`, `send_event_invite`, `apply_to_gig` | high | approval | approval |
| Publish | `publish_credit`, `create_gig`, `create_event`, `vouch_credit`, `refresh_epk` | high | approval, except `refresh_epk` (auto) | approval |
| Invite | `add_collaborator`, `spin_up_project`, `request_vouch` | high | approval | approval |
| Initiate payment | `send_payment_link` | high | approval | approval |
| Start a call | `start_video_call` | high | approval (repo; migration pending apply) | approval |
| Change permissions | `remove_collaborator` | critical | approval + proven-approval guard | locked for agents or approval + guard (decision) |
| Delete data | `delete_project`, `forget_memory` (by Kreto) | critical | approval + guard | `delete_project` locked for agents; `forget_memory` approval |
| Charge money | `charge_card` | critical | locked | locked |

## 2. Approval matrix

| Rule (from the brief) | Mechanism | Status |
|---|---|---|
| Sending a message: approval | `requires_approval` + `orch_approvals` + execution guard; Desk path gated by `_shared/deskApproval.ts` | done (repo) |
| Publishing content: approval | registry tier | `refresh_epk` still auto: **change** |
| Changing shared project state: approval | registry tier | `assign_task`, `generate_milestones` auto: **change** |
| Inviting a user: approval | registry tier + high-stakes guard | done |
| Initiating a payment: approval | registry tier; no agent can move money | done |
| Accessing sensitive data: permission check | fail-closed project access helper; money visibility by role | partly: USER FACTS and Studio Brain loading must call the same helper for every section |
| External research: consent | none | **add** web permission (Ask / Always / Never) checked before any research tool |
| Deleting data: locked | `delete_project` is approval + guard | **change** to locked for agents (human UI keeps it) |
| Changing permissions: locked | `remove_collaborator` approval + guard | decision (`KRETO_OVERHAUL_PLAN.md` §16 item 7) |
| Safe tools auto-run | `orch_settings.auto_run_safe` default on | keep default, expose the toggle in Kreto settings |
| Inline surface shows approvals | none: proposals are dropped (G1) | **fix**: persist and render cards everywhere |

Approval semantics stay as implemented: the orchestrator claims the action with a compare-and-swap on `status = 'proposed'`, writes the approval record, then executes; edited arguments may change text but never the target (`editedArgsKeepTargets`); high-stakes handlers re-check the approval record (`evaluateExecutionGuard`), fail closed.

## 3. Audit schema

One run, many actions, each action at most one decision. Mapped onto the existing tables; additions are migrations that need approval.

| Field | Table.column | Exists |
|---|---|---|
| run id | `orch_runs.id` | yes |
| actor | `orch_runs.user_id`, `orch_actions.user_id` | yes |
| acting context (surface, project, account mode) | `orch_runs.context` (json) | partly (surface, project); add account mode |
| door | `orch_runs.source`, `orch_actions.source` (`agent_orchestrator`, `desk_agent`, `human_ui`) | yes |
| target | `orch_actions.tool_args` + `created_record_ids` | yes (after the fact); add `target_type`, `target_id` |
| input summary | `orch_runs.intent_text`, `orch_actions.preview_title/body` | yes |
| profile, effort | `orch_runs.profile`, `orch_runs.effort` | **add** |
| tools used | `orch_runs.tool_names` | yes |
| data accessed | `orch_runs.data_scopes text[]` (e.g. `passport`, `projects:<id>`, `money`) | **add** |
| external services | `orch_runs.external_services text[]` (e.g. `research`, `email`, `video`) | **add** |
| approval | `orch_approvals` (decision, edited args, time, user) | yes |
| result | `orch_actions.result` | yes |
| status | `orch_action_status`: `proposed, approved, rejected, executed, failed, auto_executed` | **add** `running, partial, cancelled, unknown` |
| timestamps | `proposed_at, decided_at, executed_at`, run `created_at/updated_at` | yes |
| error and recovery | `orch_actions.error`; recovery path derived by tool category (§7) | add `recovery` text |
| cost | Cloud `ai_model_calls` (receipt), linked by `run_id` | **add** `run_id`, `profile`, `effort` |

**Append-only.** Today users may insert `orch_runs` and `orch_approvals` rows, owners may update or delete `copilot_plans`, and delete `agent_project_context` (G7). Target:
- Only the service role writes `orch_runs`, `orch_actions`, `orch_approvals`; decisions go through the orchestrator's decision endpoint only.
- `copilot_plans`: no client update or delete; status changes by the executor only.
- `agent_project_context`: no client delete (decision; it is a turn log).
- Chat history (`ai_conversations`, `ai_messages`) stays deletable by its owner as a privacy right; it is not the audit trail.
- Users read their own audit (`SELECT` policies stay).

## 4. Ingress and egress map

| Direction | What | Through | Control |
|---|---|---|---|
| In | Prompt, attachments | composer → `thrive-ai-chat` | size limits, attachment policy (`kretoAttachmentPolicy.ts`) |
| In | USER FACTS, memories, Studio Brain, history | server loaders | context selector; permission check per section; effort caps |
| In | Project chat, documents, web results | loaders, research tools | `promptIsolation.ts` wrapper; never executable |
| In | Voice audio | `thrive-voice-turn` | seconds counted per day |
| Out | Prompt + selected context | AI gateway (server only) | metered (receipt), gated (allowance, envelope) |
| Out | Research queries | research provider (server only) | consent; cache; source + date stored; provider never named in UI or errors |
| Out | Messages, emails, invites | send tools | approval |
| Out | Call rooms | video provider via `create-video-room` | approval |
| Out | Payment links | payment provider via `send-get-paid-link` | approval; `charge_card` locked |
| Out | MCP | five read-only tools with the user's token | RLS applies |
| Out | Public pages | `refresh_epk`, `publish_credit`, `create_gig`, `create_event` | approval |

## 5. Drift detection

| Signal | How | Alert when |
|---|---|---|
| Registry drift | weekly diff of `orch_tool_registry` (tier, enabled, handler) against the reviewed list in `KRETO_OVERHAUL_PLAN.md` §7 | any change not in a reviewed migration |
| Silent upgrades | count of runs where the served tier > the effort ceiling | any |
| Estimate error | daily `|estimate − receipt| / receipt` per profile | median > 30% |
| Unsettled receipts | `ai_model_calls.status = 'usage_missing'` count | > 0 for an hour (already blocks calls) |
| Route mix | share of runs per profile and effort | a sudden shift (> 2× week over week) |
| Refusals | denials by reason (`allowance`, `budget`, `plan`, `consent`) | spikes |
| Model retirement | preview ids in `aiModels.ts` | a retirement notice; swap one constant |
| Behaviour | fixed evaluation set of prompts with expected answer shape and tool choice, run before any model swap | any regression |
| Brand | test scanning UI strings for provider names and banned self-descriptions | any match (CI) |

## 6. Retry safety

- Reads and drafts retry once on transient errors.
- **Sends never retry automatically.** A timeout after a send marks the action `unknown` and tells the user to check before sending again.
- Every side effect carries the action id as its idempotency key; handlers refuse a second execution of an action already `executed` (the guard's existing `already_executed` check).
- Planner turns stay capped at 3; tool calls per request capped by effort.
- Watchers are idempotent per day per user (one proposal of a kind per window).

## 7. Failure recovery

| Failure | User sees | Recovery |
|---|---|---|
| Model busy or errored | "Kreto Vision is busy right now. I answered with Kreto Pulse." or "I couldn't answer that. Nothing was changed." | retry; lower effort |
| Allowance exhausted | the quota notice with the reset time | wait, or Quick on Signal |
| Action failed | status Failed, the reason in plain words, what did and did not change | Retry (reads/drafts), Edit and approve again (sends) |
| Partial plan | status Partial, completed steps listed, remaining steps listed | Resume remaining steps (new approval) |
| Unknown outcome | status Unknown: "I can't confirm this was sent. Check before sending again." | open the target (thread, inbox) |
| Approval record missing | the action stays proposed; "I couldn't record your approval, so nothing ran." | approve again (existing 503 path) |
| Web research failed | answer from Kretopia data only, labelled | retry research |

## 8. Monitoring plan

- **Daily** (automated): unsettled receipts, envelope usage, denials by reason, estimate error, route mix, failed and unknown actions by tool.
- **Weekly** (technical lead, 30 minutes): the drift report (A6) proposed in `docs/security-compliance/ai-agent-governance-review.md`, plus: any executed `requires_approval` action without a positive approval record (must be zero), silent-upgrade count (must be zero), registry drift, top spenders against their weekly allowance, research cache hit rate.
- **Before any model or prompt change**: run the evaluation set; compare tool choices and refusal behaviour.
- **Incident trigger**: an action ran without the approval its tier requires, a provider name appeared in the UI, or spend exceeded the envelope. Follow the incident-response plan template (§4) in `docs/security-compliance/data-protection-review.md`.
