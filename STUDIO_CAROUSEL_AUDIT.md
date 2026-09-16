# Studio Home — Carousel Completeness Audit (pre-Phase-8 gate)

Scope: every rail/carousel-shaped section on Studio home (`/desk`, `CreatorWorkHome` in `src/pages/WorkHome.tsx`), checked against the interactive-carousel requirements (swipe, snap, keyboard arrows, prev/next buttons, position indicator, focus management, loading/empty states, reduced motion). This is a targeted re-audit of the carousel *mechanics* specifically — not a repeat of the dead-file removal audit from the prior Phase 6 commit (`079485c9`), which already covered full-page/component orphans with its own independent-reverification discipline.

| # | Component | Routes using it | Real data / action | Duplicate? | Payment / Passport / Co-Sign / Verification / Milestone / Recording / Security? | Swipe | Snap | Keyboard arrows | Prev/Next buttons | Position indicator | Loading state | Empty state | Decision |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `SoundStagesRail` | `/desk`, `/circle` | Live `sound_stages` query + realtime subscription; join action | No — single shared component | No | Yes (native scroll) | Yes | **No** | **No** | **No** | Yes | Yes | **CONVERT** |
| 2 | `CastingCallsRail` | `/desk` | Live `opportunities` (type=casting) query + realtime; navigates to `/opportunity/:id` | No — unique | No | Yes (native scroll) | **No** | **No** | **No** | **No** | Yes | Yes | **CONVERT** |
| 3 | `RecentRecordingsRail` | `/desk` | Live `call_transcripts` query; opens `CallRecapSheet`, `WatchReplayButton` | No — unique | **Yes — Recording** (protected functionality, extra care taken) | Yes (native scroll) | **No** | **No** | **No** | **No** | Yes | Yes | **CONVERT** |
| 4 | "Recent collaborators" (inline in `WorkHome.tsx`) | `/desk` | `get_project_people` RPC aggregated across recent projects; navigates to `/profile/:id` | No — unique | No | Yes (Embla drag) | Yes | Yes (built into base `Carousel`) | **No** | **No** | N/A (self-hides) | Yes (self-hides) | **CONVERT** (lightest touch) |
| 5 | `GlassCarousel` primitive | Built in Phase 2, not consumed anywhere | N/A (reusable wrapper) | — | No | — | — | — | — | — | — | — | Reference pattern only — not force-fitted wholesale onto #1 (bespoke Headliner visual design worth preserving), its prev/next + position-dot pattern extracted into a small shared piece instead |

**No REMOVE or MERGE decisions.** Every section is unique, real-data-backed, and actively used — this is purely a CONVERT pass (add the missing interaction affordances in place), matching "prefer merging, compacting or converting before deleting."

**Critical-rule check:** #3 touches "recording" functionality explicitly named in the do-not-remove list. Conversion plan for it: replace only the outer scroll container; the data fetch, `CallRecapSheet`/`WatchReplayButton` wiring, and card content are left untouched.

## Fix applied

Added `<CarouselPrevious>` / `<CarouselNext>` (styled via the existing `variant="glass"` Button, hidden below `sm` since touch users swipe) and a live position-dot indicator (extracted into one shared `CarouselPositionDots` component so the logic isn't duplicated four times) to all four sections, replacing each bespoke manual `overflow-x-auto` div with the real Embla-backed `Carousel`/`CarouselContent`/`CarouselItem` primitives (which already carry keyboard `ArrowLeft`/`ArrowRight` support and proper `role="region"`/`aria-roledescription="carousel"` semantics — confirmed in `src/components/ui/carousel.tsx`). Existing card markup, loading state, empty state, and realtime data wiring are unchanged in all four — only the scroll/navigation mechanism changed. A shared `useReducedMotion` hook was extracted (WorkHome.tsx had one inline already) so all four honor `prefers-reduced-motion` consistently via Embla's `duration: 0` option, on top of the global CSS transition-collapse rule from Phase 2.

## Verification results

- `tsc --noEmit`: clean.
- `eslint` (diff-checked against a stash baseline on every touched file): zero new errors/warnings; pre-existing `any` counts unchanged.
- `npm run build`: clean.
- Live, in the same authenticated session used for Phase 8: `/desk` (Studio home) and `/circle` (SoundStagesRail's other consumer) both render with no crash, no console/render errors. `document.querySelectorAll('[role="region"][aria-roledescription="carousel"]')` confirms a real Embla-backed carousel region is present (not a lookalike div) with correctly-structured `role="group"`/`aria-roledescription="slide"` children.
- Prev/Next buttons: confirmed rendering on desktop, in the correct disabled state, via both a screenshot and DOM inspection.
- Mobile (375×812 viewport): Prev/Next buttons correctly hidden (`hidden sm:flex`); cards remain swipeable; no layout overlap with the bottom composer/nav.
- Loading/empty states: unchanged and confirmed still firing correctly (Sound Stages and Casting calls both showed their real empty states during this test).

**Known gap in this verification, disclosed rather than glossed over:** this test account has zero or single-item real data in every one of these four sections (0 live sound stages, 0 open casting calls, 1 recent collaborator, 0 call recordings) — so true multi-item swipe-through, keyboard Arrow-key scrolling between multiple slides, and the position-dot indicator's active state were **not observed live** with real data; there was never more than one slide available to scroll to. What's confirmed instead: the components render the genuine Embla `Carousel` primitive (not a substitute), that primitive's keyboard handling is unmodified source code already used elsewhere in the app, and the single-item edge case (buttons correctly disabled, dots correctly hidden below 2 items) behaves correctly. Multi-item behavior should be spot-checked against an account with real multi-row data before treating this as fully closed.
