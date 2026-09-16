# Studio Loose Projects Carousel — QA (Phase 5)

Scope: `src/components/project/studio/LooseProjectsCarousel.tsx` (new), `src/components/project/studio/studioCardHelpers.ts` (new), `src/components/project/studio/StudioCardsGrid.tsx`, `src/pages/WorkHome.tsx`. Commit `bd62119d`.

## What changed

- **New `LooseProjectsCarousel` component** replaces the plain grid previously used to render "loose" (unfoldered) Studio projects at the bottom of the folder view in `WorkHome.tsx`'s `CreatorWorkHome`.
- Built on the same embla-based `Carousel`/`CarouselContent`/`CarouselItem`/`CarouselPrevious`/`CarouselNext` + `CarouselPositionDots` primitives already established by `CastingCallsRail.tsx` — no new dependency, same `opts={{align:"start", dragFree:true, duration: reducedMotion?0:20}}` convention.
- **Priority sort**: active-status projects first, then most-recently-updated — both real, existing fields (`status`, `updated_at`). The single most-active project (`i === 0 && status === "active"`) is labeled "Most active" so the ordering is explained, not left implicit. No fabricated scores.
- Each card shows: status pill, title, client/description, folder or mood label, updated-at, invoice/pay status — the same fields the old grid showed, same drag-to-folder and long-press-to-move interactions (touch long-press via `onPointerDown`/`onPointerUp`/`onPointerMove` with a 450ms threshold, matching the old grid's implementation).
- Empty state ("Nothing loose right now") and loading state (spinner + "Loading your loose projects…") — both real, not silently blank.

## Refactor: `studioCardHelpers.ts`

Exporting `moodAccent`, `STATUS_PILL`, `PAY_DOT`, `PAY_LABEL`, `StudioProject`, and `monogram` directly from `StudioCardsGrid.tsx` (a component file) alongside the `StudioCardsGrid` component itself tripped `react-refresh/only-export-components` — a real regression against this codebase's "zero new lint issues" standard, since a file should export only components for Fast Refresh to work cleanly. Fixed by moving all five into a new non-component module, `studioCardHelpers.ts`, which both `StudioCardsGrid.tsx` and `LooseProjectsCarousel.tsx` now import from. `StudioCardsGrid.tsx` re-exports the `StudioProject` type only (`export type { StudioProject }`) for backward compatibility with any existing type-only imports — type-only exports don't trip the Fast Refresh rule.

## What did not change

- `projects` table schema, `studio_folder_id`, folder drag-and-drop logic, invoice status computation — untouched.
- The two other `StudioCardsGrid` call sites in `WorkHome.tsx` (the hero+grid view for accounts with no folders, and the inside-a-folder view) — untouched, still using `StudioCardsGrid` as before.
- `onNewProject`/`hideHero` props were dropped from the loose-projects call site only because `LooseProjectsCarousel` doesn't need them (no hero card, no "create project" empty state inside this specific branch — the page-level empty/create-project affordances live elsewhere in `WorkHome.tsx` and are unaffected).

## Verification

- `npx tsc --noEmit -p .` — clean.
- `npx eslint` on all four touched/new files — the `react-refresh/only-export-components` warnings are gone; only pre-existing `any` errors remain (2 total, confirmed via `git stash` diff to exist at the same relative positions before this change). **Zero new lint issues.**
- `npm run build` — succeeds.
- `npm run test -- --run` — 62/62 tests passing (no test coverage exists for this component specifically; verification is typecheck/lint/build + live browser).
- **Live verification** on `/desk` with a real authenticated account: page renders correctly (1 active project, folders, "Unfiled · 0 projects" count), no new console errors. This account currently has 0 unfiled projects, so `LooseProjectsCarousel`'s non-empty rendering branch was not visually exercised in this pass — the empty-state and loading-state paths were verified by code review (both are simple, static-content early returns with no data-dependent logic to regress). The surrounding page and the two other `StudioCardsGrid` call sites render with no regression, confirming the swap didn't break anything upstream or downstream.

## Follow-up (optional)

A live visual pass with an account that has 2+ unfiled projects would confirm the carousel's scroll/drag/keyboard-nav/position-dots behavior and the "Most active" badge placement end-to-end. Not blocking — the component reuses a carousel pattern already live-verified elsewhere in the app (`CastingCallsRail`), and the data-shaping logic (`sorted` via `useMemo`) was reviewed directly against the same fields the old grid used.
