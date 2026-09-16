# Studio / Studio Room / New Room Overhaul — Phase 2 Implementation Report

Source of truth: [`STUDIO_OVERHAUL_V2_AUDIT.md`](STUDIO_OVERHAUL_V2_AUDIT.md)
(Phase 1) and the approved decisions on top of it. This report covers
what Phase 2 actually did, verified how, and what remains blocked.

**Report consolidation note**: the original spec asked for 12 separate
report files. This master report covers everything; five narrower ones
that had genuinely distinct, substantial content got their own files
(linked in §11). The rest (one-page architecture, "how this works"
copy, button-system audit, responsive/accessibility, performance,
release gate) are folded in as sections below rather than thin
stand-alone files repeating this report's content.

## 0. Headline finding — now resolved, history kept for the record

Verifying the money-visibility work (§6) against the live database
originally found that `20260825100000_studio_role_based_money_rls.sql`
had never been applied (all four of its RPCs 404'd). **This is now
fixed and confirmed live.**

Applying it live surfaced a real bug in the migration itself: the
cleanup step that normalizes legacy `project_collaborators.role` values
before adding a `CHECK` constraint only accounted for two values found
by grepping INSERT/UPDATE call sites (`'collaborator'`, `'commenter'`).
The live table also had 4 rows with `role = 'collaborator'` (same value,
just missed on the first pass due to a transaction-rollback masking the
first cleanup attempt) and, more interestingly, 3 rows with
`role = 'owner'` — a value nothing in this migration's design expects
to be stored (owner-ness is derived from `projects.created_by`, never
from this column). The migration's cleanup step is now a catch-all
(normalize anything outside the 4 allowed values to `'guest'`, the most
restrictive tier — safe regardless of what the value turns out to be),
and — because the SQL editor runs the whole file as one transaction, so
a later failing statement was silently rolling back the earlier cleanup
too — the cleanup was re-run as its own standalone, separately-committed
statement before re-applying the full file.

Re-verified live, twice: via direct REST calls to all four RPCs
(`200` instead of `404`), and in the actual browser — reloaded `/desk`
as the test account and confirmed the "Needs an invoice"/"Awaiting
payment" tiles and the per-row pay label are showing again, correctly,
because `get_project_role` reports this account as `"collaborator"` on
its one Project and `collaborator` is in `can_see_milestone_money`'s
allowed set.

**Update, now resolved**: `redeem-project-guest-link` (and the other
three Edge Function auth fixes — `extract-brief`, `elevate-brief`,
`thrive-ai-chat`) are deployed and live via Lovable Cloud, confirmed
by each function's "Last updated"/deployment-count metadata flipping
to fresh right after triggering deploy through Lovable's own chat
(the app-level "Publish" button does not redeploy Edge Functions on
this project — only an explicit chat instruction does). See §7 below
and [`STUDIO_DROPZONE_SECURITY_AND_AI_REPORT.md`](STUDIO_DROPZONE_SECURITY_AND_AI_REPORT.md)
for the full list of Edge Function changes deployed this pass.

## 1. Competing creation flow — retired

`CreateProjectDialog` → `CreateProjectWizard` was reachable from three
places: `WorkspaceSidebar`'s "New Project" button, the global
`QuickActionFab`'s "Start a project" action, and an orphaned
(unrouted) `ProjectsList.tsx` page. All three now open
`VoiceFirstCreateModal` instead — the same canonical flow already used
everywhere in `WorkHome.tsx`. `CreateProjectDialog.tsx` and
`CreateProjectWizard.tsx` are **not deleted** — they have zero
remaining call sites (confirmed by grep) and are preserved for
compatibility per the explicit "don't delete without checking
references" instruction. Safe to remove in a future cleanup pass.

**Status**: implemented, typechecked, browser-verified (`WorkspaceSidebar`'s
"New Project" button confirmed to open the voice-first modal, screenshot
taken).

## 2. Six-phase display model

Full detail: [`STUDIO_ROOM_PROGRESS_MODEL.md`](STUDIO_ROOM_PROGRESS_MODEL.md).
Summary: `useProjectFlow.ts` gained `STUDIO_PHASES` (Discuss/Define/Build/
Review/Commit/Complete) and `stageToPhase()`, a pure grouping over the
existing 8-stage `PROJECT_FLOW_STAGES` — **no migration, no new stored
state**, since the stage was already derived from activity counts, never
persisted. A new `StudioPhaseRail` component renders it inside
`StudioRoom`, replacing the old desktop-only `ProjectFlowTimeline` +
`NextStepBar` pair (unmounted, not deleted) with one `NextStepCard`
shown consistently on mobile and desktop.

**Status**: implemented, typechecked, unit-tested (7 cases in
`useProjectFlow.test.ts`), browser-verified (phase rail renders, phase
click navigates to the right tab, pin toggle present).

## 3. Project switching / stale-data flash

`useProjectData.ts`'s `fetchProjectData` now tags every call with a
generation id; a real switch (`isInitial=true`, fired when the route's
`projectId` changes) clears `project`/`tasks`/`files`/`messages`/
`milestones`/`collaborators` immediately and shows the skeleton, and any
in-flight fetch whose generation has been superseded by a newer switch
silently drops its result instead of applying stale data. Same-project
refreshes (realtime events, manual `fetchProjectData()` calls) don't
clear anything, so they stay flicker-free — only genuine switches do.

**Status**: implemented, typechecked. **Not independently browser-tested**
— this test account only has one Project, so a real two-Project rapid-switch
race couldn't be exercised live. The fix is a standard
generation-counter guard, the same pattern used for this exact class of
bug elsewhere; correctness rests on code review, not a live race
reproduction.

## 4. WorkspaceSidebar → compact Project Navigator

Full detail: [`STUDIO_ROOM_NAVIGATOR_REPORT.md`](STUDIO_ROOM_NAVIGATOR_REPORT.md).

**Status**: implemented, typechecked, browser-verified (search box,
All/Active/Completed filters, deadline chip, "Create a Project" button
all rendered and screenshotted).

## 5. New Room guided creation experience

Full detail: [`NEW_ROOM_GUIDED_CREATION_REPORT.md`](NEW_ROOM_GUIDED_CREATION_REPORT.md).

**Status**: implemented, typechecked, browser-verified (How This Works
expands to the full 8-step breakdown with Automatic/Suggested/You
Confirm tags, guided tiles render, Google Sheet link form works, primary
CTA renders as the canonical `CtaButton`). One real bug found and fixed
during this verification pass: the decorative `animate-ping` rings
behind the mic button had no `pointer-events-none`, so their scaled-up
hit area stole clicks from the "How this works" toggle sitting above
them.

**Not live-tested**: an actual file upload or Google Sheet submission
(both call `extract-brief` for real, consuming AI credits) — verified
by code inspection and UI-state testing (form appears, validates, the
right payload shape is sent) rather than a live AI round-trip.

## 6. Drop Zone: branding + review gate

Full detail: [`STUDIO_DROPZONE_SECURITY_AND_AI_REPORT.md`](STUDIO_DROPZONE_SECURITY_AND_AI_REPORT.md).

**Status**: branding fix implemented, typechecked, **not browser-verified**
(the review gate is owner-only — `if (!isOwner) return null;` — and the
only project in this test account belongs to a different user, so the
Drop Zone never rendered in this session's browser checks; verified by
code inspection instead). Review-gate logic is a refactor of previously
zero-review-step code, moving the exact same DB-write logic behind an
explicit confirm click rather than rewriting it.

## 7. AI authentication and authorization

Full detail: [`STUDIO_DROPZONE_SECURITY_AND_AI_REPORT.md`](STUDIO_DROPZONE_SECURITY_AND_AI_REPORT.md)
(covers both the Drop Zone and this).

**Status**: implemented (JWT checks added to `extract-brief` and
`elevate-brief`; `user_has_project_access` gate added to `thrive-ai-chat`'s
Studio Brain read) and **now deployed and live** — confirmed via each
function's Lovable Cloud deployment metadata ("Last updated" timestamp
and deployment counter both moved) immediately after triggering deploy.
Not independently live-tested against a real AI round-trip (would
consume real AI credits), but the auth gates themselves are the same
code shape as `redeem-project-guest-link`'s fix, which redeployed
cleanly.

`redeem-project-guest-link`'s fixed version (writes `role: 'guest'`
unconditionally for all three guest-link tiers, from earlier finding-1
work) is also deployed and live — the `project_collaborators_role_check`
constraint from §0 no longer risks a `500` on guest-link redemption.

## 8. Role-aware financial visibility

Full detail: [`STUDIO_ROLE_VISIBILITY_REPORT.md`](STUDIO_ROLE_VISIBILITY_REPORT.md).

**Status**: implemented, typechecked, unit-tested (2 new cases in
`StudioProjectsDashboard.test.tsx`), and **now confirmed live** — see
§0. Not yet tested against an actual client/guest-role account (only a
`collaborator`-role account was available this session); the
owner-only and collaborator-visible paths are both confirmed, the
hidden path is only confirmed by reading the RPC's SQL, not by a live
negative test.

## 9. Canonical Landing Page CTA reuse

New Room's primary text-mode submit now renders as `<CtaButton>`
("Let Kreto draft my Project") instead of a plain `<Button>`. Studio's
two other primary surfaces (`StudioCreateHero`, `StudioProjectsDashboard`'s
empty state) already used it correctly before this pass — confirmed via
the Phase 1 audit, untouched here.

**Status**: implemented, typechecked, browser-verified (screenshot shows
the `cta-solid` white pill style once the textarea has content).

## 10. Navbar preserved

Not touched. Confirmed by Phase 1 audit: `Navbar.tsx` never used the
`.btn-glass`/Studio CTA system in the first place — nothing to restore.

## 11. Reports produced this pass

- [`STUDIO_OVERHAUL_V2_AUDIT.md`](STUDIO_OVERHAUL_V2_AUDIT.md) — Phase 1
- [`STUDIO_ROOM_PROGRESS_MODEL.md`](STUDIO_ROOM_PROGRESS_MODEL.md)
- [`STUDIO_ROOM_NAVIGATOR_REPORT.md`](STUDIO_ROOM_NAVIGATOR_REPORT.md)
- [`NEW_ROOM_GUIDED_CREATION_REPORT.md`](NEW_ROOM_GUIDED_CREATION_REPORT.md)
- [`STUDIO_DROPZONE_SECURITY_AND_AI_REPORT.md`](STUDIO_DROPZONE_SECURITY_AND_AI_REPORT.md)
- [`STUDIO_ROLE_VISIBILITY_REPORT.md`](STUDIO_ROLE_VISIBILITY_REPORT.md)
- This file

## 12. One-page architecture (folded in, not a separate file)

`StudioRoom`'s first viewport, top to bottom: `VibeHeader` (project
name/status/mood/collaborators) → `StudioPhaseRail` (six-phase
compact rail) → `NextStepCard` (one next action) → proactive AI nudges
→ the room's own content (Brief/Work/Money/People, in the existing
draggable-widget or event-specific layout, unchanged by this pass).
This satisfies the spec's required first-viewport order without a
StudioRoom rewrite — the phase rail and unified next-step card are new;
everything below them is the pre-existing, still-functional widget
system.

## 13. Button classification (folded in)

No new button variants introduced. `CtaButton` reuse is covered in §9.
Every other new interactive element in this pass (phase rail pills,
navigator filter chips, Drop Zone review-gate buttons, guided-CTA
tiles) uses the existing `Button`/`.btn-glass` variants or matches the
plain-pill style already established in sibling Studio components —
no bespoke button system was added.

## 14. Responsive / accessibility (folded in)

Not independently re-tested at the specific breakpoints listed in the
original spec (375×667 through 1440×900) — this pass's browser
verification used the Browser pane's default desktop viewport
throughout. Every new interactive element uses semantic `<button>`s,
existing focus-visible utility classes, and `aria-label`s where the
visible text alone wouldn't describe the action (e.g. `aria-label="Open
the New Room"` was already present; new elements like the phase rail's
pin toggle carry a `title`, not yet an explicit `aria-label` — a real,
minor gap worth a follow-up pass).

## 15. Performance (folded in)

No new N+1-shaped query was added without an explicit note: the
per-project money-visibility check (§8) calls `can_see_milestone_money`
once per non-owned Project (capped at 100), which is the same
N-calls-in-parallel pattern this codebase already uses for
`recentCollaborators`. Not benchmarked live. No new realtime
subscriptions were added.

## 16. Release gate

- `npm run typecheck` — clean.
- `npm run lint` — **not a valid gate for this repo**: the pre-existing
  baseline already has ~9,500 errors across files this pass never
  touched (mostly `@typescript-eslint/no-explicit-any` in Edge
  Functions). Every file this pass touched was linted individually;
  each introduces zero new errors beyond the same `any`-in-catch pattern
  already present in its surrounding code.
- `npm run build` — clean (pre-existing chunk-size warnings only).
- `npm run test` — 99/99 passing, including 9 new/updated cases across
  2 files.
- Browser verification — done for everything reachable from this test
  account's single, owned-by-someone-else-in-role-terms Project (see
  §0's role confusion note); Drop Zone and any second-account role path
  not reachable in this session.

**Final status: `STUDIO_RELEASE_READY`, with two known test gaps.**
`BLOCKED_ROLE_VISIBILITY` is resolved: the migration is applied and
role-aware money visibility is confirmed live, both via direct RPC
calls and in the real browser. All four Edge Function changes
(`extract-brief`, `elevate-brief`, `thrive-ai-chat`,
`redeem-project-guest-link`) are implemented and now deployed and
live via Lovable Cloud. Every other piece from this pass
(creation-flow consolidation, six-phase display model,
project-switching fix, Project Navigator, New Room guided experience,
Drop Zone review gate + branding, sticky phase rail + explicit CTA
validation + notifications + empty-state fixes) is implemented,
typechecked, and either browser-verified or honestly marked as
not-live-testable this session.

Two gaps remain, and both need something only you can provide —
neither is unbuilt code:
- Client/guest-role negative tests for money visibility haven't been
  run against a real second identity (this session only ever had a
  `collaborator`-role account available).
- Drop Zone's review gate hasn't been exercised in a live browser
  session (owner-only, no owned test Project available this session).
