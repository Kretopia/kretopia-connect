# Canonical Product Map

Status: Phase 1 deliverable, gated roadmap execution (see Phase 0 audit, 2026-10-02).
Purpose: map every roadmap/UI concept to the real database record it must read and write today. No schema changes are proposed here. Where current implementation contradicts the roadmap's assumed model, the mismatch is documented and the current canonical record is preserved, per the gate rule: *"preserve current canonical records; document the mismatch; do not silently migrate or replace architecture; recommend the smallest safe path."*

## 1. Work Room → Engagement

- **Canonical**: `public.projects` (core unit of work). `public.engagements` is an additive, one-row-per-project provenance record (how the project came to exist: opportunity_hire / match / direct) — not a parallel entity.
- **Rule for new code**: a Work Room is a UI lens over `projects`. Never create a second "booking"/"job" row for the same project. `location_bookings` is a distinct domain (physical venue booking) and must not be conflated with Studio engagements.
- **Gap**: none. This mapping is sound today.

## 2. Scope → ScopeVersion

- **Canonical today**: `projects.description` (free text). **No versioned scope record exists anywhere in the schema.**
- **Mismatch**: the roadmap assumes scope changes are tracked as versions that approvals bind to. `ScopeGuardian.tsx` already runs AI "scope drift" analysis against `description`, but persists nothing — its only DB write is to `milestones`.
- **Smallest safe path**: do not invent a `ScopeVersion` table in this phase. Treat `projects.description` + its `updated_at` as the de facto current scope until a dedicated migration is proposed and approved separately. Any "approve the scope" UI must say what it is actually approving (a free-text field at a point in time), not imply exact-version guarantees it cannot keep.

## 3. File → Asset / Library + version

- **Canonical today**: fragmented across three tables — `project_files` (no version column, latest-row-wins, used by Drop Zone), `project_deliverables` + `deliverable_versions` (real version history, used by Vault — the dominant, best-built path), `creative_assets` + `asset_versions` (versioned but nearly unused).
- **Mismatch**: the roadmap's "File → Asset/Library + version" assumes one file concept. There are three, and which one a given file lives in depends on which component touched it.
- **Smallest safe path**: do not merge these tables in Phase 1. New UI work should prefer `project_deliverables` + `deliverable_versions` (it is the only one with a working version history and approval linkage). Drop Zone (`project_files`) remains the intake buffer; document to engineering that it is not currently promoted into the versioned store automatically.

## 4. Client approval → target + reviewer + timestamp + authority

- **Canonical today**: `project_deliverables.status` (pending/in_review/approved) + `reviewed_by` + `reviewed_at` + `review_note`, on the same row as the content being approved.
- **Gap**: the approval does **not** bind to the deliverable's `version` column or any content hash. `DeliverablesBoard.tsx`'s `removeSubmission` path can change `file_url`/`submission_files` on an already-approved row without resetting `status`. This directly violates the canonical rule *"a material change invalidates a prior approval."*
- **Smallest safe path for this phase**: do not redesign the approval model. The safe wiring fix applied below adds a guard so that changing submission files on a deliverable whose `status` is `approved` forces it back to `submitted` — preserving the existing schema, just closing the silent-drift hole with existing columns.

## 5. Contribution → person + role + engagement + evidence + confirmation

- **Canonical today**: `credits` is the user-facing display table, but it is a flat, free-text claim (`project_name TEXT`, not FK'd to `projects`; `role TEXT` free text) with no confirming-authority field. The actual person+role+engagement+evidence+confirmation shape the roadmap wants already exists as `project_credits` (real `project_id` FK, `assigned_by`, `status`, `confirmed_at`) — but it is only wired into one narrow UI path (`ConfirmCreditBanner.tsx`).
- **Mismatch**: most of the app reads/writes the weaker `credits` table directly, bypassing the stronger `project_credits` link entirely. A separate `verified_credits` table (OAuth-imported external credits) exists in schema with zero UI usage.
- **Smallest safe path**: do not merge tables. Any new "Passport contribution" surface must read through `project_credits` where a row exists, falling back to the unverified `credits` claim with an explicit "self-reported, unconfirmed" state — never presenting a flat `credits` row as if it carries `project_credits`-level confirmation.

## 6. Agent run → `orch_*` record

- **Canonical today**: `orch_runs` / `orch_actions` / `orch_approvals` is the intended single model (trigger, tool calls, risk level, approval decision, outcome) and is the only one with stale-run reconciliation.
- **Mismatch**: three other, non-unified mechanisms exist in parallel — `agent_proposals` (used by `desk-agent-watch`, `money-agent-watch`, `surface-agent-watch`), `copilot_plans` (used by `copilot-planner`/`copilot-executor`), and a legacy `agent_goals`/`agent_actions` pair (mostly dead, one 3-row preview strip still reads `agent_actions` in `KretoTab.tsx`). None share a `run_id` or common schema.
- **Smallest safe path**: all new Kreto work in this roadmap must write to `orch_*` only. Do not add a fourth mechanism. Reconciling the existing three into `orch_*` is a separate, larger migration to propose later — out of scope for Phase 1.

## 7. Payment → invoice / payment / provider receipt

- **Canonical today**: `invoices` (client-facing billing, status string only) + `payment_history` (carries the real `payment_intent_id`, FK'd to invoice/milestone). Creator payout/escrow is a distinct, separate schema (`creator_wallets`, `creator_payouts` with a real `stripe_payout_id`). This split is intentional and reasonable, not fragmentation of one concept.
- **Trust boundary already enforced correctly today**: `invoices.status = 'paid'` is set server-side only, inside the Stripe webhook handler, using the service-role client. A separate, explicitly audited manual/offline path (`confirm_invoice_paid_manually`) exists for bank-transfer/cash attestations and requires a payment-method note.
- **Gap**: history shows this enforcement was silently bypassable for a period (table-level grant did not follow a column-level `REVOKE`) — fixed, but the same bug class recurred four times across different tables. No new fix proposed here; flagged for the security sweep in a later phase.

## 8. Workspace ownership → person / company / workspace boundary

- **Canonical today**: the only real, enforced boundary is `project_collaborators`, scoped per project via `user_has_project_access()`. `organizations` / `organization_members` exist in schema (added 2026-09-12) but are explicitly inert — no RLS policy references `org_id`, and there is no UI to create or manage an organization.
- **Rule for new code**: do not build or claim any "Company Studio" / org-wide feature against `organizations` until it is actually wired into RLS and has a real membership UI. Until then, per-project `project_collaborators` is the only real access boundary, and a room member must never be treated as having company-wide access.

---

## Safe wiring fixes applied in this phase

1. Deliverable version-drift guard (`src/components/project/DeliverablesBoard.tsx`, `removeSubmission`): resetting `status` to `submitted` when submission files change on an already-`approved` deliverable, using only the existing `status` column — closes the silent post-approval content-drift gap described in §4.
2. Checked for missing `.catch()` on fire-and-forget public async calls (`DirectMessageDialog.tsx`, `ApplyToOpportunityDialog.tsx`, `UnifiedHome.tsx`) and for UI implying a live Calendar/Drive/WhatsApp connection that doesn't exist (`ChatHeader.tsx`, `MeetupManage.tsx`, `SpeedSession.tsx`). Every call site checked already handles its own failures and no UI falsely claims a live external connection — no change needed in the files reviewed; this was not an exhaustive codebase-wide sweep.
3. No schema migration. No new AI provider. No runtime behavior change outside item 1.
