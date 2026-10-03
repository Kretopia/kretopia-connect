# Kreto execution guard: MVP (Gate 3, two functions)

> **DO NOT RELY ON THIS AS A FULLY SAFE EXECUTION SYSTEM YET.** Two edge functions are gated and one screen shows recorded state. Everything else that can act externally is unchanged, and there is no idempotency, timeout, stop or reconciliation.

## What is implemented

- **Guard rule** (`supabase/functions/_shared/executionGuard.ts`, pure, no network): an action may execute only if its `orch_actions` row belongs to the caller, has `status = 'approved'`, and has an `orch_approvals` record by the caller with decision `approved` or `edited`. Any `rejected`, `revoked` or `cancelled` record on the same action blocks it. Missing or unreadable data counts as not approved (fail closed).
- **Gated functions (2):**
  - `agent-send-dm` (sends a direct message as the user): every call needs an approved action.
  - `send-outreach-draft` (sends a drafted email through the user's Gmail): calls that carry agent markers (`_agent_action_id` / `_source`, as `agent-orchestrator` sends for `send_outreach_email`) need an approved action for that same draft, and go to the previewed recipient only. A person pressing Send in the app (`ApprovalsHub`, `Intel`, `InvoiceChaseDrawer`) sends no markers and is treated as their own approval; they may still override the recipient.
  - When the rule fails, nothing is sent and the response is `{ ok: false, executed: false, needs_approval, reason, error, draft }` with the draft, using HTTP 428 (needs approval), 403 / 404 (wrong owner, unknown action, different draft) or 409 (already executed, revoked). A failed approvals lookup returns 503 and sends nothing.
- **Behaviour change:** an action already `executed` is no longer accepted, so a past action id can no longer replay a DM. The orchestrator approves (status `approved` plus an approvals row) before calling the handler, so the normal approve-then-send path is unchanged.
- **UI** (`KretoTab.tsx`, existing "Recent proposed actions" list): each row shows `Run: <orch_runs.status> · Approval: <state>`, read from existing columns. Missing run data shows "Unknown", and an executed action without an approval record shows "No approval record".

## What is still missing

- **Other external senders are not gated:** `send-invoice-chase` (its `send=true` hand-off reaches `send-outreach-draft` with no agent markers), `copilot-executor` (plan-level approval only), and the `desk-agent` tools `add_collaborator`, `send_message_to_collaborator` and `start_video_call`, which run without approval. `start_video_call` is also auto-run by the planner.
- **Caller-asserted markers:** `send-outreach-draft` can only tell agent calls from person calls by markers the caller sets. A caller that omits them is treated as a person.
- **Idempotency:** no key and no compare-and-swap; if a handler is retried while the action is still `approved`, a DM or email can send twice.
- **States:** no `outcome_unknown`, `partially_completed`, `queued` or working `cancelled`; a timeout or hard kill is recorded as `failed` by reconcile.
- **Reconcile:** no scheduled reconcile job in any migration, and runs are not finalised after approval.
- **Enforcement:** users can still insert their own `orch_runs` / `orch_approvals`, so these records are forgeable; the guard trusts them. Strict RLS on them needs a migration (see `schema-impact-report.md`).
- **Display only:** the UI strip describes recorded state; it does not prove an action is safe, and it is shown for every tool, although only `send_dm` and agent-initiated `send_outreach_email` are enforced.
- **Tests:** unit tests for the rule are in a separate follow-up PR; there is no two-party or end-to-end test of either gated function.
