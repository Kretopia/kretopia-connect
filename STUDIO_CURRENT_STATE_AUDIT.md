# Studio Current-State Audit

**Status: `BLOCKED_ROLE_VISIBILITY` — do not proceed to implementation before reading §7.**

This is the required baseline audit (Feature Bible §3) for the Studio/Desk
overhaul (`/desk`, `/desk/:id`). It is code-only research — nothing in
this document was written or applied to the database. Every claim below
is grounded in an actual file:line citation gathered by direct code
reading (three parallel research passes), not from the internal Feature
Bible's own "what is live" claims, which are treated as claims to verify,
not facts. Where the Bible's claim and the code diverge, that divergence
is called out explicitly.

**Headline finding, before anything else**: the research turned up
multiple concrete, exploitable security gaps in the current Studio —
not theoretical, not "could be hardened someday." §7 lists five of them
with exact reproduction paths. Per the Feature Bible's own instruction
("Be conservative with permissions, files, AI, credits, invoices and
money") and this engagement's standing rule from prior security passes
this session, **no new Studio feature work should land before these are
addressed**, and nothing here has been fixed yet — this document is the
audit, not the fix.

---

## 0. Baseline command results (Feature Bible §3)

Run against the current `feature/activation-priority-plan` branch,
clean working tree except one pre-existing unrelated local diff
(`supabase/functions/mcp/index.ts`, an auto-generated dependency-version
bump untouched by this or prior audits this session):

| Command | Result |
|---|---|
| `npm run typecheck` | **Clean.** 0 errors. |
| `npm run test -- --run` | **Clean.** 83/83 tests passing (8 test files). |
| `npm run build` | **Clean.** Builds successfully; one pre-existing bundle-size warning (`ThriveDesk`, `Discover`, and the main `index` chunk all exceed 500kB post-minification — a performance note, not an error, tracked further in §11). |
| `npm run lint` | **Not clean: 9,498 errors, 912 warnings**, overwhelmingly `@typescript-eslint/no-explicit-any` inside `supabase/functions/**` (Deno edge functions), plus a handful of `prefer-const` and one `no-require-imports` in `tailwind.config.ts`. This is pre-existing, repo-wide technical debt — confirmed not introduced by this or the prior sessions' work (git tree was clean before this audit began). Not specific to Studio; not re-litigated here. |

Git baseline: branch `feature/activation-priority-plan`, up to date with
`origin/feature/activation-priority-plan` at audit start, no divergence.

---

## 1. Routing

Defined in `src/App.tsx`.

| Route | Element | Line |
|---|---|---|
| `/desk` | `WorkHome` (project list/home — **not** the Studio itself) | `src/App.tsx:366` |
| `/desk/projects` | Redirects to `/desk` | `src/App.tsx:367` |
| `/desk/:projectId` | `ThriveDesk` — **this is the Studio** | `src/App.tsx:370` |
| `/desk/:id/thrive/generate` | `ThriveGenerate` | `src/App.tsx:371` |
| `/desk/:projectId/crew` | `EventCrewMode` — **not wrapped in `ProtectedRoute`**, unlike every other `/desk/*` route | `src/App.tsx:424` |
| `/desk/join/:token` | `JoinGuestStudio` — authenticated guest-link redemption | `src/App.tsx:448` |
| `/guest/:token` | `GuestStudio` — separate, no-login-required guest portal | `src/App.tsx:440` |
| `/dashboard` | Redirects to `/desk` | `src/App.tsx:538` |

`ThriveDesk` is lazy-loaded (`src/App.tsx:86`). In-Studio tabs (today,
messages, tasks, files, vault, brief, approvals, assets, board, ai,
contracts, scope, finance, notes, call_sheet, run_of_show, roll_call,
split_sheet, exchange, revisions) are local React state
(`src/pages/ThriveDesk.tsx:40`), not URL-driven, except `?section=sponsors`
(`ThriveDesk.tsx:85-92`) and a one-time `?payment=success|cancelled`
read (`ThriveDesk.tsx:99-120`, already audited for browser-state-trust
issues in this session's earlier escrow work — confirmed safe, it only
shows a toast, never mutates payment state from the URL).

**Note on `/desk/:projectId/crew` being unprotected**: every other
`/desk/*` route is wrapped in `ProtectedRoute`; this one is not. Whether
`EventCrewMode` performs its own auth check internally was not verified
in this pass — flagged as a follow-up item, not confirmed as a gap.

---

## 2. Component map

### Top-level shell — `src/pages/ThriveDesk.tsx` (376 lines)
Left project-switcher sidebar (`WorkspaceSidebar`) + header
(`SimpleProjectHeader` + `ProjectSettingsMenu`) + desktop-only lifecycle
timeline (`ProjectFlowTimeline` + `NextStepBar`), then either
**`StudioRoom`** (the `today` tab, which is the default on both mobile
and desktop — `ThriveDesk.tsx:53`) or **`DeskTabContent`** (tool router
for every other tab), plus a desktop-only `WorkspaceQuickPanel` rail. A
global `⌘K` `DeskCommandPalette` and `VoiceCommandSheet` are also mounted.

### Tab router — `src/components/project/DeskTabContent.tsx`
One tool component per tab (all cited lines from this file): `messages`→`SimpleProjectChat`(90), `tasks`→`TasksWorkspace`(104), `files`→`FileBrowser`(117), `vault`→`VaultTab`(124), `brief`→`BriefHub`+`DeliverablesBoard`(137-138), `approvals`→`ApprovalWorkflows`(144), `assets`→`CreativeAssetLibrary`(149), `board`→`CreativeBoard`(153), `ai`→`StudioAICreate`(157), `contracts`→`ContractsList`(161), `scope`→`ScopeGuardian`(165), `finance`→`FinanceHub`(173-187), `notes`→`CorkBoard`("Cork Board" = **The Pad**, 190-199), plus `call_sheet`/`run_of_show`/`roll_call`/`split_sheet`/`exchange`/`revisions` workflow sub-tabs (201-253).

### "Studio Room" — `src/components/project/studio/StudioRoom.tsx` (626 lines)
The default landing surface. A single scrolling, drag-reorderable widget
board composing: `VibeHeader`, `BriefDropZone` (the unified ingest point
— every drop routes through `studio-ingest`, per in-code comment at
line 224), `ImportedSourcesCard`, `StudioOutcomeComposer` (owner-only,
238), `BrandVaultChip` + `StudioBrainPanel` (owner-only, 241-247),
`BriefSection`, `DeliverablesSection`, `PadPreviewSection`,
`ProductionPrepSection`, `WorkSection`, `MoneySection`,
`MilestoneStrip`, `RequestPaymentCard`, `PeopleSection`,
`WrapProjectCard`, `AddCreditSection`, `CallHistorySection`, plus
workspace-type-conditional sections for Podcast/Content/Campaign/Music/
Modeling and a large Event block (9 sub-components). Desktop-only:
draggable two-column layout persisted to `localStorage` per project
(line 316). `useDeskAgentWatch(isOwner ? project?.id : null)` (line 108)
is wired in here, owner-only.

### Confirmed-existing AI/workflow surfaces (Bible claims cross-checked against code)

| Feature Bible claim | Verified in code? | Where |
|---|---|---|
| "Studio Brain" | **Yes** | `src/components/project/studio/StudioBrainPanel.tsx`, tables `studio_facts`/`studio_entities`, fed by `studio-ingest` edge function |
| "Scope guardian" | **Yes** | `src/components/project/ScopeGuardian.tsx`, `scope` tab, `scope-guardian` edge function |
| "Drift detection" | **Yes, not a separate feature** — it's the "Scope Check" tab inside Scope Guardian (`checkScopeDrift()`, `ScopeGuardian.tsx:135-145`) | same file |
| "Milestone generation" | **Yes** | Scope Guardian's "Generate Milestones" tab, `createMilestonesFromResult`, `ScopeGuardian.tsx:154` |
| "Wrap automation" | **Partial** — manual, one-tap, confirm-then-notify only. No scheduled/automatic trigger. | `src/components/project/studio/WrapProjectCard.tsx` (see §9) |
| "Role-aware invites... guest access gating so clients never see Money or Kreto" | **Partially true, with a serious caveat** — the UI gate (`useStudioRole`) works; the RLS layer underneath it does not enforce the same distinction (see §7, finding 1) | `src/hooks/useStudioRole.ts`; RLS across all `supabase/migrations/*.sql` |
| "`desk-agent-watch` reads project chat and state and proposes actions unprompted" | **Exists, but "unprompted" is misleading** — it is client-invoked (page mount / chat-burst debounce), owner-only, tier-gated. Nothing runs server-side independent of an open browser tab. | `supabase/functions/desk-agent-watch/index.ts`, `src/hooks/useDeskAgentWatch.ts` |
| "Deliverables board with moodboard thumbnails" | **Yes** | `src/components/project/DeliverablesBoard.tsx` (1144 lines) |
| "Voice-to-task capture" | **Yes** | `BriefSection.tsx`'s voice recording → `extract-brief` edge function → bulk insert into `project_tasks` |
| "Public Studio recap pages" | **Yes, exists — but its RLS is broader than its own field allowlist** (see §7, finding 4) | `src/pages/StudioRecap.tsx`, `get_public_studio_recap` RPC |
| Versioned brief document | **No — confirmed absent** | see §5 |

### Dead / orphaned code found (worth noting under "duplicate/broken functionality")
- `src/components/project/ActivityTimeline.tsx` (313 lines) — builds a
  unified activity feed from messages/tasks/milestones/files, but has
  **zero importers anywhere in the app**. Fully dead code.
- `src/components/project/mobile/MobileProjectHub.tsx` — imported in
  `ThriveDesk.tsx:19` but never referenced in that file's JSX. Dead
  import, superseded by `StudioRoom` now serving both mobile and
  desktop.
- `src/components/project/ProjectNotes.tsx` — a full note browsing/
  editing UI over `project_notes`, has **no importers**. The
  `project_notes` *table* is actively written to (by `BriefDropZone`,
  `VoiceCommandSheet`, `SmartBriefBuilder`) and read for AI context, but
  there is currently no user-facing way to browse those notes in the
  Studio — the component that would provide that exists and is unused.
- Two other, apparently-superseded presence implementations exist
  (`src/components/project/ProjectPresence.tsx`,
  `src/components/project/CollaborativeWorkspace.tsx`) — neither is
  imported by `StudioRoom.tsx`; `useStudioPresence` is the one actually
  wired into `/desk/:id`. Not traced further since not live, but they
  follow the same unauthenticated-channel pattern as the live one (§7
  finding 5) if they're ever reused.
- `src/components/desk/WrapMyWeekSheet.tsx` — a real, separate feature
  easily confused with project "wrap": a voice-first **weekly client
  recap** tool (aggregates 7 days of activity into a draft update email
  + invoice line items via the `weekly-recap` edge function). Not
  project completion. Naming collision risk for anyone extending "wrap"
  functionality without reading the code first.

---

## 3. Current data model

Cross-referenced against the generated `src/integrations/supabase/types.ts`
(reflects current schema post-all-migrations) plus originating
migrations where identified. 701 total migration files exist in this
repo; only Studio-relevant ones are cited.

| Table | Purpose | Key columns / notes |
|---|---|---|
| `projects` | The Studio row itself; also the brief store (`description`) and agent-brokered-deal store | `created_by`, `client_user_id`, `creative_user_ids[]`, `agent_mode`, `client_price`, `creative_payout`, `margin_type/value`, `workspace_type`, `status`, `recap_published`, `recap_token`, `recap_summary`. 14 migrations alter this table; financial columns added in `20260423202831_1f997883-...sql:2-14` |
| `project_collaborators` | Membership + invite state | `role text DEFAULT 'member'` (**no CHECK constraint** — any string accepted), `status` (`pending`→`accepted`), `agent_role` (separate column, used only during agent-mode setup) |
| `project_tasks` | Task feed (compact) + kanban (full) backing store | `status`, `priority`, `labels[]`, plus universal `external_*`/`import_*` provenance columns present on nearly every `project_*` table |
| `project_files` | Vault rows | `folder_id`, `is_link`, `link_provider` (can represent a real upload or an imported external link) |
| `project_file_folders` | Vault folder tree | self-referencing `parent_id` |
| `project_notes` | Freeform notes written by AI flows (`BriefDropZone`, `VoiceCommandSheet`, `SmartBriefBuilder`) | No browsing UI currently wired (see §2 dead code) |
| `project_messages` | Chat | `attachments`, `is_pinned`, `reply_to` (self-FK), `voice_url/duration/transcript`, plus import provenance |
| `project_deliverables` | Deliverables kanban | `status`, `moodboard`, `submission_files`, `version` (column exists, defaults to 1, **no code path increments it** — dead/placeholder column) |
| `milestones` | Payment milestones | `amount`, `status`, `escrow_status`, `payment_intent_id`, `paid_to`, `paid_at` — payment-specific mechanics already covered in depth by this session's `ESCROW_FLOW_AUDIT.md`/`ESCROW_STATE_MACHINE.md`, not re-derived here |
| `project_pins` | "The Pad" / Cork Board — sticky notes with x/y/rotation/z-index | Distinct from `project_notes` — a genuinely different table despite similar naming |
| `studio_facts` / `studio_entities` | "Studio Brain" extracted knowledge | Populated by `studio-ingest`, browsed/deleted via `StudioBrainPanel.tsx` |
| `project_guest_links` | Token-based guest invites | `guest_role`, `permissions` (JSON), `max_uses`, `expires_at`, `revoked_at` — see §7 finding 2 for why the `guest_role` distinction doesn't actually restrict access |
| `credits` | Platform-wide verified-work record | **No FK to `projects` or `milestones`** — only free-text `project_name` plus `source`/`source_id` provenance columns. Confirmed by exhaustive grep of every `ALTER TABLE public.credits` migration. |
| Other `project_*` tables found | `project_contracts` (e-signature), `project_credits` (links a project to the `credits` table for the manual "add credit" flow), `project_exchange_terms` (barter deals), `project_templates`, `project_time_entries`, `project_video_calls` | Not individually detailed; exist and are wired to their respective tabs |

---

## 4. Current role model

**Three separate, independently-computed role systems coexist** for one
Studio — this is itself worth flagging as "duplicate functionality" per
the Feature Bible's audit categories:

1. **`useProjectData`'s `userRole`** (`src/hooks/useProjectData.ts:43,131`)
   — only `"creator" | "client"`, computed as
   `created_by === userId ? "client" : "creator"`. Note the **inverted
   naming**: the project owner (who pays) is labeled `"client"`; anyone
   else (who gets paid) is `"creator"`. Feeds `MilestoneBoard`/`FinanceHub`.
2. **`useStudioRole`** (`src/hooks/useStudioRole.ts`) — the richer model:
   `"owner" | "creative" | "collaborator" | "client" | "guest"`, with a
   documented intent (lines 18-24: owner=full, client=no money visibility,
   guest=stricter than client). This is the UI-layer permission map
   (`canSeeMoney`, `canUseAI`, `canManage`, `canContribute`) actually
   used by `StudioRoom` to hide/show sections.
3. **`useAgentRole`** (`src/hooks/useAgentRole.ts`) — only active when
   `projects.agent_mode = true`: `"manager" | "client" | "creative" | "observer"`,
   derived from `agent_user_id`/`client_user_id`/`creative_user_ids[]`
   (**not** from `project_collaborators.role`). Controls
   `canSeeMargin`/`canSeeClientPrice`/`canSeeCreativePayout`.

**Critical gap**: all three of these are **frontend-only** permission
maps. None of them has a corresponding RLS enforcement layer — see §7,
finding 1. `useStudioRole`'s `canSeeMoney` gate, in particular, hides
the Money section in the UI for a "client" or "guest," but the
underlying `milestones` RLS policy does not check role at all, so the
same data is one `fetch()` call away regardless of what the UI shows.

**`project_collaborators` state machine**: `status: pending → accepted`
(flips automatically the moment the invited user opens the project,
`useProjectData.ts:109-114`). `role` defaults to `'member'` and the
standard invite dialogs (`InviteToProjectDialog.tsx`,
`InviteCollaboratorDialog.tsx`) all insert `role: 'member'` — the
special values `client`/`creative`/`guest` that `useStudioRole` checks
for are **not set by the standard invite flow**; they're set elsewhere
(agent-mode project setup) or default to generic `"collaborator"`.

**Guest access** — confirmed to exist, token-based, two redemption paths:
`project_guest_links` table minted by `GuestStudioShareDialog.tsx` with
a `viewer`/`commenter`/`contributor` preset; redeemed either at
`/guest/:token` (no login, read-mostly preview via SECURITY DEFINER
RPCs) or `/desk/join/:token` (requires auth, calls
`redeem-project-guest-link`, lands the user in the full Studio). **See
§7 finding 2 — the preset tier is not actually enforced.**

---

## 5. Tasks and briefs

**Task system**: `project_tasks`, two UI surfaces — `WorkSection.tsx`
(compact feed) and `TasksWorkspace.tsx` (full `@dnd-kit` kanban). AI
task generation exists: `BriefSection.tsx`'s "Break into tasks" posts
`projects.description` to the `extract-brief` edge function and bulk-
inserts results.

**"Brief" — no single, no versioned document exists.** Three distinct,
non-unified concepts all called "brief" in the UI:
1. `BriefSection.tsx` ("The Brief" widget) — directly overwrites
   **`projects.description`** on every save. No version history.
2. `BriefHub.tsx` ("Add a Brief" flow) — extracts *deliverables* (not
   the description) via `extract-brief`, writes to
   **`project_deliverables`**.
3. `SmartBriefBuilder.tsx` — guided Q&A/AI flow, writes to
   **`project_notes`**.

`project_deliverables.version` exists as a column but no code path
increments it — a placeholder, not functioning version tracking.
**This directly means Feature Bible §4 ("versioned brief") and this
audit's own Section 4 requirement ("Brief / Pad — versioned brief")
describe something that does not exist yet** — flagged as a real gap
to design for, not a bug to fix.

**"Pad"**: a sticky-note board (`project_pins`, x/y/rotation/z-index),
not a document. UI: `CorkBoard.tsx` (full, under the `notes` tab) and
`PadPreviewSection.tsx` (read-only 3-pin preview in Studio Room).
Unrelated to `project_notes` despite the naming similarity.

---

## 6. Current file pipeline (Vault / uploads)

**No server-side validation exists at all.** Full trace:

- Upload path: `FileBrowser.tsx:190-250` builds a path, uploads directly
  to the `project-files` Storage bucket via resumable/TUS upload
  (`src/lib/resumableUpload.ts`), then the **client itself** inserts the
  `project_files` row (`FileBrowser.tsx:219-231`). Chat attachments use
  a second, separate direct-upload path
  (`SimpleProjectChat.tsx:496-508`). **No Edge Function sits in this
  path at all** — no server ever inspects the bytes.
- **File size**: client-side only (`useFileSizeLimit.ts`,
  `fileSizeLimits.ts:21-28`; chat attachments hard-code 25MB at
  `SimpleProjectChat.tsx:489`). The only server-side enforcement is a
  *total-quota* trigger (`enforce_storage_quota()`,
  `supabase/migrations/20260506004514_...sql:82-109`) — no per-file cap,
  and the bucket has no `file_size_limit` configured.
- **MIME type / magic bytes**: not validated anywhere, client or
  server. No `allowed_mime_types` configured on the bucket. `file.type`
  is stored as unchecked advisory metadata only.
- **Quarantine / staged review**: does not exist. Zero hits for
  "quarantine" anywhere in `supabase/` or `src/`. A file is a full Vault
  member the instant the client's insert succeeds.
- **Storage RLS history** (chronological — this bucket has had a real
  incident): originally any authenticated user could read/write any
  project's files (`20250930110444...sql:171-183`); tightened to
  per-project membership (`20251022032204...sql`); **regressed to fully
  public read** for a period (`20260211055411...sql:1-16` — bucket
  flipped `public = true`, blanket read policy, no auth check at all);
  reverted (`20260419162823...sql`); current model gates on
  `user_has_project_access` (`20260420201228...sql:56-106`).
- **AI folder routing** (`route-vault-file` edge function) fires after
  upload but is not a security gate — it's an LLM call to auto-file into
  a Vault folder, running with service-role trust of the caller-supplied
  IDs; downstream blast radius is limited to reassigning `folder_id`.

This is the single most concrete, actionable gap relative to Feature
Bible §8's explicit pipeline requirement (server-issued upload ticket,
magic-byte validation, quarantine states) — none of that exists today.

---

## 7. Security risks — the section to read first

Five concrete, reproducible findings. None of these were fixed as part
of this audit — this is the "understand before you touch it" pass the
Feature Bible itself requires (§3: "Do not rewrite working functionality
before understanding its dependencies").

### Finding 1 — No role-based RLS anywhere in Studio
`project_collaborators.role` is a free-text column with **no CHECK
constraint** (confirmed by grep across all 701 migrations — no
`role ... CHECK` constraint exists for this table). Every RLS policy on
every Studio table (`projects`, `project_tasks`, `project_files`,
`project_messages`, `milestones`, `studio_facts`/`studio_entities`)
grants access based solely on **membership**
(`user_has_project_access`/`is_project_member`), never on `role`.
Grepped for `pc.role`/`collaborators.role =` inside any `USING`/
`WITH CHECK` clause — zero matches anywhere.

**Concrete consequence**: a "guest" or "client" role — which the
frontend's `useStudioRole` hook deliberately hides the Money section
from (`canSeeMoney: owner only`) — sees the **exact same
`milestones.amount`/`paid_to`/`paid_at`/`escrow_status` data** as the
owner at the RLS layer, one direct REST call away. The UI hint is not a
security boundary.

### Finding 2 — Guest-link tier is decorative, not enforced
`GuestStudioShareDialog.tsx` offers three tiers (`viewer`/`commenter`/
`contributor`) with a `permissions` JSON. But
`supabase/functions/redeem-project-guest-link/index.ts:88-103` inserts
**every** redemption with `status: "accepted"` regardless of tier —
and since (per Finding 1) RLS never reads `role` or the permissions
JSON, a "viewer"-tier guest ends up with full
`user_has_project_access`, identical to a paid collaborator: same
`milestones` SELECT, same `projects` UPDATE rights. **This is a real
privilege-escalation path** from "casual guest link" to "sees payment
amounts, can edit project financial fields."

Compounding this: `user_has_project_access`
(`20260427234910_c02c82e1-...sql:29`) treats `status IN ('accepted',
'pending')` as sufficient — so even a merely-*invited*, not-yet-accepted
user can `UPDATE` the full `projects` row, including `client_price`,
`creative_payout`, `margin_type/value`, because Postgres RLS is
row-level, not column-level, and the UPDATE policy has no column
restriction.

### Finding 3 — `scope-guardian` IDOR
`supabase/functions/scope-guardian/index.ts` verifies the caller's JWT
but **never checks the caller has any relationship to the `projectId`
they pass in** (lines 44-68 fetch via service-role client with zero
membership check). Any authenticated user who knows or guesses another
user's project UUID can retrieve that project's title, description,
status, and **all milestone amounts**. Independently corroborated by a
pre-existing audit already in this repo,
`AI_AUTOMATION_AUDIT.md:346-363`, which documents the identical pattern
— and additionally flags `verify-credit` for the same missing-ownership-check
shape (not independently re-verified line-by-line this pass).

### Finding 4 — Public Studio-recap RLS is broader than its own allowlist
The `get_public_studio_recap` RPC (`20260612214115_...sql:47-135`) is
carefully built — it returns a real allowlist (no `amount`, no
`paid_to`, no financial fields). But the **table-level RLS policy that
shipped in the same migration** undermines it entirely:

```sql
CREATE POLICY "Anyone can view published recaps"
ON public.projects FOR SELECT TO anon, authenticated
USING (recap_published = true);
GRANT SELECT ON public.projects TO anon;
```

No token check, full-row grant. Since the Supabase anon key is
necessarily public (embedded in the frontend bundle), any client can
skip the token-gated RPC and query
`projects.select('*').eq('recap_published', true)` directly — exposing
`client_price`, `creative_payout`, `margin_type/value`,
`client_user_id`, `agent_user_id`, `video_room_url`, and every other
column on any published project, to anyone, unauthenticated, with no
token required.

### Finding 5 — Presence channel is unauthenticated
`useStudioPresence.ts:36-38` subscribes to
`studio-room:${projectId}` **without `private: true`**, so it never
goes through Supabase Realtime Authorization. Neither of the two
Realtime-authorization migrations in this repo
(`20260505045503...sql`, `20260803090817...sql`) scope to
project/studio-room topics — they only apply to `private: true`
channels. **Consequence**: any authenticated client that knows a
`project_id` (visible directly in the `/desk/:projectId` URL) can
subscribe to that channel from the browser console without ever having
been added to `project_collaborators`, and can (a) see the full name,
avatar, and online status of everyone currently viewing that project,
and (b) send an arbitrary "knock" broadcast that pops a toast on any
member's screen — the knock handler only checks
`data.to_user_id !== currentUser.id`, not sender legitimacy
(`useStudioPresence.ts:46-54`).

### Two additional, lower-severity items worth carrying into remediation planning
- **@mention chat can invite/escalate arbitrary platform users.**
  `SimpleProjectChat.tsx`'s mention autocomplete searches *all*
  platform users, not just project members, and picking a non-member
  actively inserts a new `pending` `project_collaborators` row
  (`inviteExistingUserToProject`, lines 218-258) or invites by email
  (`inviteByEmailFromMention`, 260-307). This is possible for **any
  accepted collaborator, not just the owner**, because the INSERT RLS
  on `project_collaborators` was loosened from owner-only to "any
  accepted member" in `20260505123546_8fdaec85-...sql:6-23`. May be
  intended product behavior (fast team-building) rather than a bug —
  flagged for a product decision, not asserted as a vulnerability.
- **Storage-object RLS and table RLS disagree on `pending` status.**
  `project_files`/`project_messages` table RLS requires
  `status = 'accepted'`, but the Storage-object policy on
  `project-files` uses `user_has_project_access`, which also accepts
  `pending`. Net effect: a merely-invited (not yet accepted) user
  cannot query `project_files` rows via the DB, but *can* list/download
  raw Storage objects for that project directly.

---

## 8. Current AI behavior (Edge Functions)

| Function | Behavior | Writes or proposes? | Auth/membership check |
|---|---|---|---|
| `desk-agent` ("Kreto") | Main conversational project agent — create/complete tasks, chat, draft invoices/quotes, add credits, video calls, add/remove collaborators, hand off multi-step goals | Mixed: simple tools write directly (no confirm); `draft_invoice`/`draft_quote` always land as `status:'draft'`, never auto-sent; 3+ step goals go through `copilot-planner`'s approve-then-execute flow | JWT + `user_has_project_access` — correctly scoped |
| `desk-agent-watch` | Background suggestion watcher — 5 proposal kinds: `draft_invoice`, `schedule_followup`, `next_milestone`, `wrap_project`, `collab_nudge` | Proposal-only, writes to `agent_proposals`, never mutates project/milestone/credit data itself | JWT + strict owner-only check + subscription-tier gate |
| `studio-ingest` | "Studio Brain" — classifies dropped files/links/voice into structured facts/entities | Writes directly to `studio_facts`/`studio_entities`, no confirmation step (but see below — writing structured *facts*, not project state, is a materially lower-risk write than money/access) | JWT + explicit owner-or-collaborator membership check — correctly scoped |
| `scope-guardian` | Brief risk analysis, milestone-schedule generation, scope-drift detection | Proposes only — actual `milestones` insert happens client-side after explicit "Add to Project" | JWT verified, **membership NOT checked** — see §7 finding 3 |
| `copilot-planner` | Decomposes multi-step goals into an approve-then-execute plan | Writes `copilot_plans` row as `status:'proposed'`; UI requires tap-to-approve | JWT verified via `getClaims`; no deep membership check, but returns a plan not project internals, so lower exposure than scope-guardian |
| `copilot-executor` | Executes an approved plan | Executes directly once invoked, but only the caller's own plans (`.eq("user_id", userId)`), and only `proposed`/`approved` status | JWT verified; correctly scoped to caller's own plans |
| `copilot-collaborator-tools` | Backs find/list/add/remove-collaborator tools | Writes directly | Delegates the original `Authorization` header, so ordinary `project_collaborators` RLS applies |
| `route-vault-file` | Auto-files an unfoldered upload into a Vault folder | Writes `folder_id` only | Service-role trust of caller-supplied IDs, no independent membership re-check (low blast radius) |
| `verify-credit` | AI-assisted credit verification | Not deep-audited this pass | Pre-existing repo audit (`AI_AUTOMATION_AUDIT.md:350-352`) flags the same missing-ownership-check pattern as scope-guardian |
| `route-studio-outcome`, `route-studio-post`, `suggest-studio-folders`, `generate-studio-copy`, `generate-studio-image`, `credits-ai-insights`, `enrich-credits`, `desk-ai`, `desk-daily-nudge` | Exist, named consistently with Studio/credits AI features | Not individually code-read this pass | Not verified this pass — flagged for follow-up |

**Required flow compliance** (Feature Bible §6: "AI analyzes → proposes
→ user reviews → confirms → system writes → activity receipt"): mostly
followed. The one function that writes without any user-facing confirm
step, `studio-ingest`, writes to a read/delete-only knowledge panel
(`StudioBrainPanel.tsx`) rather than authoritative project state —
lower risk than a milestone/credit/invoice write, but still worth a
product decision on whether extracted facts should also be
review-gated before being usable as AI context elsewhere.

---

## 9. Current payment/credit references

- **Milestones**: payment-status mechanics (escrow, capture, Stripe
  webhook flow) are already fully audited in this session's
  `ESCROW_FLOW_AUDIT.md`, `ESCROW_STATE_MACHINE.md`, and
  `KREPAY_ESCROW_RELEASE_GATE.md` — not re-derived here. Status
  transitions correctly route through server-side RPCs
  (`update_milestone_workflow_status`, `confirm_milestone_paid_offline`)
  per `MilestoneBoard.tsx:130-141,182-189`.
- **Wrap → credits/invoices is entirely manual.** `WrapProjectCard.tsx`'s
  "Wrap project" action only sets `projects.status = 'completed'` and
  notifies collaborators — it does not create a credit, invoice, or
  milestone. `AddCreditSection.tsx` (shown only when
  `status === 'completed'`) just navigates to a prefilled manual credit
  form. No automated drafting exists anywhere in code, and no internal
  doc claims otherwise (checked `AI_AUTOMATION_AUDIT.md`,
  `FEATURE_AUDIT.md` and found no such claim) — so this is a confirmed
  absence of a feature, not a doc/code contradiction.
- **One real server-side auto-write exists**: `desk-agent`'s `add_credit`
  tool inserts a `credits` row directly (`verification_status:
  'self_reported'`, `source: 'thrive_agent'`) with no secondary
  confirmation — but only when the user explicitly asks Kreto to log a
  credit in that chat turn, not from any automatic trigger.
- `credits` has **no FK to `projects` or `milestones`** — confirmed by
  exhaustive migration grep. Credits and Studio projects are only
  loosely linked (`project_credits` join table, free-text
  `project_name`), a design constraint worth surfacing if "auto-draft
  credits at wrap" is built later.

---

## 10. Migration requirements

No migration is proposed or applied by this audit. Any remediation of
§7's findings will require migrations to:
1. Add role-aware RLS predicates (or a dedicated permission-check
   function) to `milestones`, `projects`, and other financial columns —
   likely requires column-level grants/RPCs following the same pattern
   already established and applied for wallet/milestone hardening
   earlier this session (`20260824100000_milestones_privilege_hardening.sql`).
2. Fix `redeem-project-guest-link` to actually persist and enforce the
   guest tier, and/or scope RLS checks to read it.
3. Add a membership check to `scope-guardian` (and audit/verify
   `verify-credit`).
4. Either remove the blanket `anon`/`authenticated` SELECT grant on
   `projects` for `recap_published = true` (routing all public recap
   reads through the RPC instead) or narrow the policy to only the
   RPC's own allowlisted columns.
5. Move `useStudioPresence` to a `private: true` channel with a
   corresponding Realtime Authorization policy scoped to project
   membership.

Per this engagement's standing rule, none of these will be applied
without separate, explicit preparation (exact SQL, preflight/postflight
queries) and manual user approval — consistent with how every prior
migration this session was handled.

---

## 11. Testing gaps

- Zero of the 83 currently-passing tests touch Studio-specific RLS,
  role visibility, guest-link tiers, presence scoping, or the
  scope-guardian/recap findings above — the passing test suite says
  nothing about §7's findings one way or the other.
- No existing test exercises the file-upload pipeline's absence of
  server-side validation (§6).
- No existing test covers the three-role-system inconsistency (§4).
- Bundle-size warning on `ThriveDesk`/`Discover`/main `index` chunks
  (>500kB minified each) is pre-existing and unmeasured against a
  performance budget — flagged for §15/§Performance work, not
  characterized further here.

---

## Final status

`BLOCKED_ROLE_VISIBILITY`. Per the Feature Bible's own release
criteria, none of adaptive-workspace-type work, Brain-context hardening,
drop-zone security work, or anything else in this spec should be
considered for implementation until finding 1 (no role-based RLS) and
its two direct consequences (findings 2 and 4) are addressed — building
new Studio surfaces on top of a permission model that doesn't actually
enforce the roles the frontend claims to enforce would compound the
problem, not fix it. Findings 3 and 5 are independent, also serious, and
should be fixed regardless of scope decisions on the rest of the spec.

Next document per the Feature Bible's own required sequence:
`STUDIO_INFORMATION_ARCHITECTURE.md` — but per §3's explicit instruction
("do not rewrite working functionality before understanding its
dependencies") and this audit's own findings, the more urgent next step
is a scoped remediation plan for §7 specifically, presented for
approval before any new feature-shaped work begins.
