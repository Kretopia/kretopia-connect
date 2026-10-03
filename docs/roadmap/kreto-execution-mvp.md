# Kreto execution guard: MVP (Gate 3, one function)

> **DO NOT RELY ON THIS AS A FULLY SAFE EXECUTION SYSTEM YET.** One edge function is gated and one screen shows recorded state. Everything else that can act externally is unchanged, and there is no idempotency, timeout, stop or reconciliation.

## What is implemented

- **Guard rule** (`supabase/functions/_shared/executionGuard.ts`, pure, no network): an action may execute only if its `orch_actions` row belongs to the caller, has `status = 'approved'`, and has an `orch_approvals` record by the caller with decision `approved` or `edited`. Any `rejected`, `revoked` or `cancelled` record on the same action blocks it. Missing or unreadable data counts as not approved (fail closed).
- **Gated function:** `agent-send-dm` (sends a direct message as the user). When the rule fails it sends nothing and returns `{ ok: false, executed: false, needs_approval, reason, error, draft }` with the draft, using HTTP 428 (needs approval), 403 / 404 (wrong owner, unknown action) or 409 (already executed, revoked). A failed approvals lookup returns 503 and sends nothing.
- **Behaviour change:** an action already `executed` is no longer accepted, so a past action id can no longer replay a DM. The orchestrator approves (status `approved` plus an approvals row) before calling the handler, so the normal approve-then-send path is unchanged.
- **UI** (`KretoTab.tsx`, existing "Recent proposed actions" list): each row shows `Run: <orch_runs.status> · Approval: <state>`, read from existing columns. Missing run data shows "Unknown", and an executed action without an approval record shows "No approval record".

## What is still missing

- **Other external senders are not gated:** `send-outreach-draft` (no compare-and-swap, recipient overridable), `copilot-executor` (plan-level approval only), and the `desk-agent` tools `add_collaborator`, `send_message_to_collaborator` and `start_video_call`, which run without approval. `start_video_call` is also auto-run by the planner.
- **Idempotency:** no key; if the handler is retried while the action is still `approved`, the DM can send twice.
- **States:** no `outcome_unknown`, `partially_completed`, `queued` or working `cancelled`; a timeout or hard kill is recorded as `failed` by reconcile.
- **Reconcile:** no scheduled reconcile job in any migration, and runs are not finalised after approval.
- **Enforcement:** users can still insert their own `orch_runs` / `orch_approvals`, so these records are forgeable; the guard trusts them. Strict RLS on them needs a migration (see `schema-impact-report.md`).
- **Display only:** the UI strip describes recorded state; it does not prove an action is safe, and it is shown for every tool, although only `send_dm` is enforced.
- **Tests:** no committed tests and no two-party test; the rule was checked only with a throwaway unit test.
