# Canonical product & permission map (Gate 1)

Status: reflects `origin/main` as of 2026-10-03. Code-evidenced only; nothing here was verified at runtime or with a two-party test. Extends `canonical-product-map.md` (PR #39).

Principle: map each product concept onto an existing record through a typed adapter. No new Work Room table, no new AgentRun table, no schema rewrite.

| Product concept | Canonical record | Where current code diverges |
|---|---|---|
| **Work Room** | `engagements` (1 row per `projects` row) over `projects` as the work record. Route `/desk/:projectId`. | "Work Room" is copy only. 8 creators insert a project with no engagement (ThrivePromptHero, GroupChatPanel, ProjectTemplates, createEventStudio, agent-orchestrator, copilot-executor, desk-agent, import-run). Parallel links: `applications.studio_project_id`, `projects.match_id`, `meetings.project_id`. |
| **Booking** | `meetings` (`host_id`, `project_id`, `room_name`, `scheduled_for`). | No duration, status or cancel column. Overlap check is read-then-insert in `book-meeting` (not atomic). `location_bookings` and `create-meeting` skip conflict checks. `/calendar` route does not exist. |
| **Scope → ScopeVersion** | None. Closest: `projects` brief fields + `milestones`. | ScopeVersion is ABSENT. |
| **Deliverable / File → exact asset version** | `project_deliverables` + `deliverable_versions`; files in `project_files` / `project_file_folders`. | `deliverable_versions` has 0 writers; `version` is always 1. `creative_assets/asset_versions` is a third, unreconciled store. `project_files` has no visibility column ("Client-Shared" is a folder name). |
| **Approval → target + reviewer + authority + timestamp** | Deliverables: `status` + `reviewed_by` + `reviewed_at`. Review links: `share_link_approvals`. Agent actions: `orch_approvals`. | Approval is a mutable status, not bound to a version or content hash. `share_link_approvals` accepts anonymous inserts (`WITH CHECK (true)`). `redeem-project-share` previously approved any `deliverable_id` (now bound to the link's project and scope, this slice). |
| **Message → canonical thread** | `project_messages`. | Also `messages` and `spark_room_messages`. No audience / internal flag; every accepted member, guests included, reads all messages. |
| **Agent run → `orch_*`** | `orch_runs`, `orch_actions`, `orch_approvals`, `orch_tool_registry`. | Bypassed by `copilot_plans`, `agent_proposals`, legacy `agent_actions`. `queued`, `partially_completed`, `outcome_unknown` states absent. |
| **Payment → invoice / payment / provider receipt** | `invoices`, `payment_history`, `milestones.escrow_status`, `creator_payouts`; provider truth via `stripe-marketplace-webhook`. | Manual "paid" (issuer or payer self-report) writes the same `paid` as a provider-confirmed payment. No payout-authorisation state. |
| **Contribution → person + role + Engagement + evidence + confirmation** | `project_credits` → `credits` → `credit_evidence`. | Credits carry no `project_id` or engagement id from closeout, so they cannot earn evidence. Role copied from the access role, not `agent_role`. |
| **Workspace → personal / company boundary** | Personal: `profiles`. Company: `organizations` / `organization_members` / `org_id`. | Company tables are inert: no UI, no attach/join RPC, no RLS references `org_id`. "Company" today is profile-based. |

## Permission contract (what the guarded edge functions now enforce)

Implemented in `supabase/functions/_shared/projectAccess.ts`. Access is granted only when membership is proven from the canonical records; otherwise denied (fail-closed).

- **owner** = `projects.created_by`.
- **member** = `project_collaborators` row with `status = 'accepted'`. `pending` is NOT access. Several rows resolve to the most restrictive role.
- Roles: `member` → collaborator, `creative`, `client`, `guest`. NULL or unknown role → `guest`.
- Money visible only to owner / creative / collaborator (mirrors `can_see_milestone_money`).
- Malformed ids, missing rows and lookup errors all deny (403, or 503 on lookup failure).

Functions using it (this slice): `desk-ai`, `thrive-document-engine`, `copilot-planner`, `project-og-image`, `start-stage-transcription`, `sync-daily-recordings`. `redeem-project-share` binds `deliverable_id` / `file_id` to the link's project and scope.

## Known divergence the code guards cannot close (needs migration approval)

The database still disagrees with this contract: `user_has_project_access()` admits `pending`; `projects.created_by` is updatable by any member; the self-accept policy does not pin `role`; `match_copilot_memories` trusts a caller-supplied user id; approvals and guest revocation are not enforced in SQL. See `schema-impact-report.md`.
