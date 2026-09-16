# Studio Room Progress Model — Six-Phase Display Layer

## What changed

Added, in [`src/hooks/useProjectFlow.ts`](src/hooks/useProjectFlow.ts):

```ts
export const STUDIO_PHASES = [
  { id: "discuss", label: "Discuss" },
  { id: "define", label: "Define" },
  { id: "build", label: "Build" },
  { id: "review", label: "Review" },
  { id: "commit", label: "Commit" },
  { id: "complete", label: "Complete" },
] as const;

const STAGE_TO_PHASE: Record<ProjectFlowStageId, StudioPhaseId> = {
  discussion: "discuss", brief: "define", tasks: "build", work: "build",
  review: "review", agreement: "commit", payment: "commit", complete: "complete",
};
```

`useProjectFlow()`'s return value gained `currentPhaseId` and
`phaseStatus` (a `Record<StudioPhaseId, "complete"|"current"|"todo">`),
computed in the same `useMemo` that already derives `stageStatus`. A
phase is `"current"` if any of its stages is current, `"complete"` if
all its stages are complete, else `"todo"`.

## Legacy-to-new mapping (exhaustive)

| Stage (existing, unchanged) | Phase (new) |
|---|---|
| discussion | Discuss |
| brief | Define |
| tasks | Build |
| work | Build |
| review | Review |
| agreement | Commit |
| payment | Commit |
| complete | Complete |

## Why no migration

`currentStageId` was never a stored column — `deriveStage()` computes it
live from activity counts (message count, task count, file count,
approval/contract/invoice state) every render. The six-phase value is
one more derivation on top of that, with the same lifetime. There is
nothing to migrate, and nothing new to keep in sync with the database.

## Database reality (unchanged by this pass, flagged not fixed)

`projects.status` carries a `CHECK` constraint from the original
migration (`20250930110444`) allowing only `active/completed/paused/
cancelled`, while application code (`studioCardHelpers.ts`) already
reads/ranks `planning`/`wrapping`/`archived` — values outside that
constraint. This is unrelated to the six-phase work (nothing here
writes `projects.status`) but was re-confirmed still present during
this pass and remains unverified against the live database (no query
access). If a future pass wants to persist phase state rather than
derive it, this constraint needs resolving first.

## Transition rules / role permissions

None added or changed. Phase is a read-only display derived per-viewer
from data every viewer with room access already receives — there's no
separate authorization surface for "seeing" a phase the way there is
for money.

## Compatibility strategy

Purely additive. `PROJECT_FLOW_STAGES`, `deriveStage()`, and every
existing consumer keyed on stage ids (`StudioToolBar`, tab-navigation
targets) are untouched. `ProjectFlowTimeline.tsx` and `NextStepBar.tsx`
(the old 8-pill desktop-only display) are unmounted from `ThriveDesk.tsx`
but not deleted — see the implementation report §2 for why.

## Tests

`src/hooks/__tests__/useProjectFlow.test.ts` (new, 7 cases): every
stage maps to a phase and only ever to one of the 6 known ids; a phase
with two stages (Build, Commit) reads as `"current"` rather than
`"complete"` while only one of its stages is satisfied; `projectStatus
=== "completed"` fast-paths to phase Complete with every other phase
marked complete; a pinned stage still resolves to a valid phase.

## What's not verified

Live browser verification confirmed the phase rail renders correctly
and phase-click navigation works (screenshotted, described in the
implementation report). Not verified: the "commit complete only once
both agreement and payment clear" boundary and the "pinned stage"
override in a real browser session — both are covered by the unit
tests above, not a live click-through, since reaching those specific
activity-count combinations would require seeding real project data
this session didn't have access to create safely.
