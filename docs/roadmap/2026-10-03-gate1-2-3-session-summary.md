# 2026-10-03: Gates 1-3 session summary

Code-evidenced only. Nothing was deployed or tested against the live backend, and there is no two-party or RLS test. No migration was added or applied. See `kreto-execution-mvp.md`, `gate3-next-slices.md`, `schema-impact-report.md`.

## PRs (all merged)

- #49 Gate 1: fail-closed project access helper on six service-role functions; `redeem-project-share` bound to the link's project; permission map and schema impact report.
- #50 Tests for the access helper (17).
- #51 Gate 2: deliverable dialog shows which files an approval covers and when it no longer applies (display only).
- #52 Tests for the approval validity rule (6).
- #53 Gate 3: execution guard, `agent-send-dm` gated, run and approval status on the Kreto page.
- #54 Gate 3: `send-outreach-draft` gated for agent-initiated calls; next-slices doc.
- #55 Tests for the execution guard (19).
- #56 Gate 3: `desk-agent` `add_collaborator` gated.
- Earlier, #38-#48: model registry, timeouts and token caps (cost guardrails only).

## Now gated

- Membership proof (owner or accepted collaborator): `desk-ai`, `thrive-document-engine`, `copilot-planner`, `project-og-image`, `start-stage-transcription`, `sync-daily-recordings`.
- Link scope: `redeem-project-share` (deliverable and file must belong to the link's project).
- Approval proof: `agent-send-dm`, `send-outreach-draft` (agent-initiated only), `desk-agent` `add_collaborator`.
- Display only, not enforcement: approval validity (`DeliverablesBoard`), run and approval status (`KretoTab`).

## High-risk items still ungated

- `desk-agent`: `send_message_to_collaborator`, `start_video_call` (also auto-run by the planner).
- `copilot-executor`, `send-invoice-chase` (`send=true` hand-off), `copilot-collaborator-tools` (direct owner calls).
- `process-outreach-queue` (unguarded mass send), `scout-leads` (no auth), `generate-match-explanation` (no auth, canned 85 score).
- `telegram-webhook` reject branch, `agent-vouch-credit`, `agent-rsvp-event`.
- Money: manual "paid" is indistinguishable from provider-confirmed.
- Database (needs approved migrations): `user_has_project_access` admits `pending`; `projects.created_by` takeover; self-accept role not pinned; `match_copilot_memories` trusts a caller id; unauthenticated inserts into `share_link_approvals`; users can insert their own `orch_runs` / `orch_approvals`.
- Not built: idempotency keys, `outcome_unknown`, reconcile schedule, stop.

## Monday

- **Slice A (Gate 3, code only):** gate `send_message_to_collaborator` and `start_video_call` with the `add_collaborator` proposal pattern.
  - Files: `supabase/functions/desk-agent/index.ts`, `docs/roadmap/kreto-execution-mvp.md`.
  - Goal: no chat post and no Daily room without an Approve tap.
- **Slice B (Gate 1, code only):** auth on `scout-leads`, `requireAdminOrCron` on `process-outreach-queue`.
  - Files: `supabase/functions/scout-leads/index.ts`, `supabase/functions/process-outreach-queue/index.ts`.
  - Goal: no unauthenticated external calls or mass sends.
- **Waiting on your approval:** migrations M0a-M0c in `schema-impact-report.md`.
