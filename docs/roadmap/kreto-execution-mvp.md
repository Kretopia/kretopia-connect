# Kreto execution guard: MVP (Gate 3, three gated actions)

> **DO NOT RELY ON THIS AS A FULLY SAFE EXECUTION SYSTEM YET.** Three actions are gated and one screen shows recorded state. Everything else that can act externally is unchanged, and there is no idempotency, timeout, stop or reconciliation.

## What is implemented

- **Guard rule** (`supabase/functions/_shared/executionGuard.ts`, pure, no network): an action may execute only if its `orch_actions` row belongs to the caller, has `status = 'approved'`, and has an `orch_approvals` record by the caller with decision `approved` or `edited`. Any `rejected`, `revoked` or `cancelled` record on the same action blocks it. Missing or unreadable data counts as not approved (fail closed).
- **Gated actions (3):**
  - `agent-send-dm` (sends a direct message as the user): every call needs an approved action.
  - `desk-agent` tool `add_collaborator` (gives a person project access and notifies them): the model's tool call no longer adds anyone. It runs only if the request carries an `_agent_action_id` whose action is approved, owned by the caller, has the caller's approvals record, and is for this exact person and project (one add per request). Otherwise nothing is added and a `proposed` `orch_actions` row is queued for the user's Approve tap, the same way `remove_collaborator` already worked. Executing that approval goes through `agent-orchestrator` to `copilot-collaborator-tools`. An invalid person id or a failed lookup adds no one.
  - `send-outreach-draft` (sends a drafted email through the user's Gmail): calls that carry agent markers (`_agent_action_id` / `_source`, as `agent-orchestrator` sends for `send_outreach_email`) need an approved action for that same draft, and go to the previewed recipient only. A person pressing Send in the app (`ApprovalsHub`, `Intel`, `InvoiceChaseDrawer`) sends no markers and is treated as their own approval; they may still override the recipient.
  - When the rule fails, nothing is sent and the response is `{ ok: false, executed: false, needs_approval, reason, error, draft }` with the draft, using HTTP 428 (needs approval), 403 / 404 (wrong owner, unknown action, different draft) or 409 (already executed, revoked). A failed approvals lookup returns 503 and sends nothing.
- **Behaviour change:** an action already `executed` is no longer accepted, so a past action id can no longer replay a DM. The orchestrator approves (status `approved` plus an approvals row) before calling the handler, so the normal approve-then-send path is unchanged.
- **UI** (`KretoTab.tsx`, existing "Recent proposed actions" list): each row shows `Run: <orch_runs.status> · Approval: <state>`, read from existing columns. Missing run data shows "Unknown", and an executed action without an approval record shows "No approval record".

## What is still missing

- **Other external senders are not gated:** `send-invoice-chase` (its `send=true` hand-off reaches `send-outreach-draft` with no agent markers), `copilot-executor` (plan-level approval only), and the `desk-agent` tools `send_message_to_collaborator` (posts to project chat as the user) and `start_video_call` (creates a Daily room), which still run without approval. `start_video_call` is also auto-run by the planner. `copilot-collaborator-tools` itself still adds a collaborator for any caller that reaches it directly as the project owner.
- **Caller-asserted markers:** `send-outreach-draft` can only tell agent calls from person calls by markers the caller sets. A caller that omits them is treated as a person.
- **Idempotency:** no key and no compare-and-swap; if a handler is retried while the action is still `approved`, a DM or email can send twice.
- **States:** no `outcome_unknown`, `partially_completed`, `queued` or working `cancelled`; a timeout or hard kill is recorded as `failed` by reconcile.
- **Reconcile:** no scheduled reconcile job in any migration, and runs are not finalised after approval.
- **Enforcement:** users can still insert their own `orch_runs` / `orch_approvals`, so these records are forgeable; the guard trusts them. Strict RLS on them needs a migration (see `schema-impact-report.md`).
- **Display only:** the UI strip describes recorded state; it does not prove an action is safe, and it is shown for every tool, although only `send_dm`, agent-initiated `send_outreach_email` and `desk-agent`'s `add_collaborator` are enforced.
- **Tests:** unit tests for the rule are in a separate follow-up PR; there is no two-party or end-to-end test of either gated function.
