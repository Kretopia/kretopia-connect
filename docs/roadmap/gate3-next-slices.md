# Gate 3: next slices

Status as of 2026-10-03. Gated so far: `agent-send-dm`, and `send-outreach-draft` for agent-initiated calls. See `kreto-execution-mvp.md`. Not a safe execution system yet.

## Senders still ungated

- `desk-agent` tools `add_collaborator`, `send_message_to_collaborator`, `start_video_call`: execute immediately, no approval (the registry says `requires_approval`; only the orchestrator honours it).
- `start_video_call` is registered `safe_auto`, so the planner also runs it inline (creates a Daily room, posts the link to project chat).
- `send-invoice-chase` with `send=true`: hands off to `send-outreach-draft` with no agent markers, so the new gate treats it as a person.
- `copilot-executor`: plan-level approval only; no compare-and-swap; concurrent approves can double-send.
- `send-outreach-draft` person path: no compare-and-swap, so two concurrent sends can both go out.
- `agent-vouch-credit`, `agent-rsvp-event`: thin RPC wrappers, no gate.
- `telegram-webhook` reject branch: sets `rejected` unconditionally and can overwrite `approved` mid-execution.
- `agent-orchestrator` planner: `auto_run_safe = false` is bypassed for inline `safe_auto` tools, and the action then stays `proposed`, so approving it runs the tool twice.

## Execution states and plumbing still missing

- `queued` is never written; `cancelled` has no writer; `partially_completed` and `outcome_unknown` do not exist.
- No timeout on the orchestrator's `executeAction` and planner fetches; a hard kill leaves the action `approved` until reconcile marks a possibly-sent action `failed`.
- Reconcile is not scheduled in any migration; its only trigger is a self-heal at the start of a new intent, and it skips `awaiting_approval`.
- No stop or cancel; no retry policy.
- Runs are not finalised after approval; `orch_runs` has no `completed_at`.
- `orch_approvals` insert errors are unchecked in the orchestrator.
- Two writers use columns that do not exist: `agent-orchestrator` (`orch_actions.agent_kind`) and `desk-daily-nudge` (`orch_runs.intent` / `.reasoning`).

## Migrations required (propose first, apply only with approval)

- **Non-forgeable approvals:** revoke client INSERT/UPDATE on `orch_runs`, `orch_actions`, `orch_approvals`; record decisions through a `SECURITY DEFINER` function that sets the approver from `auth.uid()`; stop users editing `orch_settings.daily_action_limit`.
- **Approval bound to content:** store the exact approved arguments (or a hash) on the approval, and compare them at execution.
- **Real idempotency:** `orch_actions.idempotency_key` (unique), attempt count and provider request id; handlers refuse a key they have already completed.
- **States:** add `outcome_unknown`, `partially_completed` (and a working `cancelled`) to the action/run enums; add `orch_runs.completed_at`.
- **Reconcile:** schedule the reconcile job and make it cover `awaiting_approval` and `approved`.

## Smallest safe next code-only slice (Monday, 3 files, no schema)

- Make `desk-agent` stop executing `add_collaborator`, `send_message_to_collaborator` and `start_video_call` directly: reuse its existing `remove_collaborator` pattern to insert a `proposed` `orch_actions` row (existing columns) and return "needs approval" to the user.
- Files: `supabase/functions/desk-agent/index.ts`, `docs/roadmap/kreto-execution-mvp.md`, and one test or doc update.
- Do not touch: schema, `orch_*` structure, model calls or routing.
