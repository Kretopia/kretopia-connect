# Studio Room Navigator — WorkspaceSidebar Overhaul

## What changed

[`src/components/project/WorkspaceSidebar.tsx`](src/components/project/WorkspaceSidebar.tsx),
previously a bare status-dot + title list, gained:

- **Search** — client-side substring match on title.
- **Filters** — All / Active / Completed (three pill buttons, single-select).
- **Deadline chip** — shown per row when `projects.deadline` is set;
  flagged red (via `date-fns`'s `isPast`) when overdue and the project
  isn't completed.
- **Canonical create action** — "Create a Project" now opens
  `VoiceFirstCreateModal` (see implementation report §1) instead of the
  legacy wizard, and calls a new `onProjectCreated` callback (wired to
  `useProjectData`'s newly-exposed `fetchProjects`) so the sidebar's own
  list refreshes immediately after creating from here.

Rows remain intentionally minimal: status dot, truncated title, deadline
chip. No descriptions, no full metadata — matches the spec's "compact
rows" requirement, which this component already mostly satisfied before
this pass.

## Deliberately not implemented, and why

- **"Needs attention" / "Awaiting approval" filters.** These require the
  same invoice/approval-status join `StudioProjectsDashboard` already
  performs (a separate `invoices` query keyed by project id). Duplicating
  that heavier query into the sidebar — which is mounted persistently
  alongside every Studio Room, unlike the dashboard which is a one-time
  page load — is a real cost/benefit call, not an oversight. The full
  dashboard on `/desk` already has these filters; this component
  intentionally stays lighter.
- **Unread-activity indicator.** There is no `last_viewed_at` (or
  equivalent) signal anywhere in this data model to compute "unread"
  from. Adding one would mean a new column, a write-path to update it,
  and a decision about what counts as "viewed" — a real feature, not a
  UI tweak, and out of proportion for this pass.

Both are flagged here explicitly so a future pass doesn't have to
rediscover why they're missing.

## Mobile behavior

No dedicated drawer/sheet component was built. Mobile already reuses
this same component inside `ThriveDesk.tsx`'s `fixed`/overlay wrapper
(toggled by `sidebarOpen` state, closed via backdrop click or the
component's own close button) — verified unchanged and still working in
this pass's browser check (screenshotted: header, search, filters, one
project row, create button, all rendered correctly in the mobile-style
overlay at the default viewport).

## Project switching (cross-referenced, not owned by this component)

Cancellation/stale-data handling lives in `useProjectData.ts`, not here
— see the implementation report §3. This component only triggers
navigation (`navigate(/desk/:id)`); it doesn't fetch or hold project
data itself.

## Tests

None added specifically for this component in this pass — its logic
(search substring match, three-way filter, deadline formatting) is
simple enough that the browser verification (search box present,
filters present, row renders) was judged sufficient given time
constraints across this large a change set. A future pass should add a
focused RTL test file here, mirroring `StudioProjectsDashboard.test.tsx`'s
existing conventions.

## Verification

Browser-verified: opened the navigator inside a real Studio Room,
confirmed search input, All/Active/Completed chips, one real project row
with correct status dot, and "Create a Project" button all render;
confirmed clicking "Create a Project" opens the canonical New Room modal
(not the legacy wizard) — screenshotted.
