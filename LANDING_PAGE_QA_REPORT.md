# Landing Page QA Report — Search-First Optimization

Branch: `feature/creative-passport-rearchitecture`. Scope: the guest landing page hero (`/` for a signed-out visitor → `KretopiaLanding` → `KretopiaHero`) and the shared `UnifiedSearchDropdown` it now uses. The nine editorial chapters below the hero (Manifesto, five feature chapters, Meet Kreto, Closing, Footer) were intentionally left untouched, per the audit's scope decision.

## Commits

| Commit | Summary |
|---|---|
| `7ea897ba` | `docs: landing page audit — search-first optimization, before state` |
| `2f48c691` | `UX: landing hero — search-first rewrite (Phases 1-4)` |
| `5d22f7cf` | `UX: landing hero — reduced-motion support + mic/clear touch targets (Phases 5-7)` |
| `65cbed8d` | `UX: landing hero — WCAG AA contrast fix + search submit button label (Phase 8)` |

Files changed across the charter: `src/components/landing/KretopiaHero.tsx` (rewritten), `src/components/search/UnifiedSearchDropdown.tsx` (three small shared-component fixes), plus `LANDING_PAGE_AUDIT.md` and this report. No schema, RLS, auth, or payment changes. No push to `main` — every commit landed and pushed on `feature/creative-passport-rearchitecture` only.

## What changed

**Hero copy and hierarchy.** Replaced the old "Welcome to Kretopia. Where creativity lives." headline and its three-read-step preamble ("Begin" eyebrow → "Search your name." sub-heading → body paragraph → input) with the charter's exact specified hierarchy: eyebrow "Kretopia Creative Passport," headline "Search your name. / Find your *next opportunity*.," one line of supporting copy, then the search surface immediately after — no marketing copy sits between the headline and the input.

**Search.** The hero's old hand-rolled `<input>` (no voice, no suggestions, no states, and a stale doc-comment falsely claiming otherwise) is gone. The hero now renders the app's real global search, `<UnifiedSearchDropdown variant="hero" onQuerySubmit={onSearchSubmit} />` — same debounced/cancelled queries, same voice pipeline, same keyboard nav and result states used everywhere else in the app. Three example-search chips ("Ethan Auguste," "Event Producer in Bali," "Creative Director") sit below it as optional starting points, not competing CTAs.

**Layout.** The portrait image moved from between the headline and the search (blocking it) to below the search (supporting it). On mobile this means the entire hero — eyebrow through trust line — fits in one viewport with zero scrolling; the portrait is the first thing below the fold, not above it.

**A real theme bug, caught before shipping.** The hero is always dark (`#05070D`, independent of the app's light/dark setting), but the app defaults new visitors to *light* theme and `UnifiedSearchDropdown`'s input reads theme-aware CSS variables. Without intervention this would have rendered near-black text on a near-black background. Fixed by scoping the dropdown in `<div className="dark">`, which correctly cascades the `.dark`-scoped variables to just that subtree — confirmed live (white input text, correct placeholder color).

**Reduced motion.** The hero's five `framer-motion` entrance blocks (eyebrow, headline, subcopy, search, portrait) were not covered by the app's global `prefers-reduced-motion` CSS rule — that rule only collapses CSS transitions/`@keyframes`, and framer-motion's `initial`/`animate` props move via inline styles, untouched by it. Wired in the existing `useReducedMotion` hook (already used by six other components in the codebase) so every block skips `initial` and renders directly in its final state when the user has motion reduced.

**Two accessibility bugs found during QA, fixed in the shared search component** (so every surface that uses `UnifiedSearchDropdown` — navbar, `/search`, credit database, landing — benefits, not just this hero):
- The mic and clear buttons measured 14×14px with zero padding, under the WCAG AA 24px touch-target minimum. Added a CSS hit-slop pseudo-element (`before:absolute before:-inset-2.5`) to both, expanding the tap target to ~34×34px without moving the visible icon. Verified via `elementFromPoint` that a click 6px outside the visible icon now correctly resolves to the button.
- The icon-only submit button had no `aria-label` at all — a screen reader would announce it as bare "button." Added `aria-label="Search"`.

**One measured contrast fix.** Computed actual WCAG contrast ratios (not eyeballed) for every low-opacity text element against the hero's `#05070D` background. Two were under the 4.5:1 AA minimum for normal text: the "Discover your creative record" label (45% white → 4.498:1) and the "Free. No card. Built for creators." trust line (40% white → 3.73:1). Both bumped to 55% opacity (matching the eyebrow's existing value), now 6.25:1. No visible brightness jump.

## What was verified but not changed

- **Search states** (empty/typing/found/no-result/error) — already fully built in `UnifiedSearchDropdown`; live-tested by typing "Gabriel" and observing the real "Searching the creative universe" loading state.
- **Voice search** — clicking the mic button fired a genuine `getUserMedia` request, confirmed via an explicit sandbox notice that it was blocked only by the browser-pane sandbox, not faked or auto-triggered. The permission-gated integration is real; full end-to-end recording was not testable in this environment.
- **Placeholder text contrast** (~3.02:1) — measured and found borderline low, but this is pre-existing shared input styling used across the whole app, not something this charter introduced or that the charter's phases named. Left as-is; flagged below as a follow-up rather than changed under this narrower scope.
- **The `GuestBanner` floating "Claim your credits" toast** — appears bottom-right on scroll/delay. Confirmed via source read (`src/components/GuestBanner.tsx`) that it's a pre-existing, unrelated, dismissible global component, not part of the hero and not positioned above the search — out of scope.
- **Hero portrait `loading="lazy"`** — the pre-rewrite audit flagged this as needing a `fetchpriority="high"` hint (it was above-the-fold then). After the Phase 1-2 reorder moved the portrait below the search, it's no longer the LCP candidate, so `loading="lazy"` is now the *correct* choice. No change made; audit note superseded by the rewrite itself.

## Breakpoint testing

All six required breakpoints tested live via forced reload, as a genuinely signed-out guest:

| Breakpoint | Result |
|---|---|
| Desktop 1280×800 | Clean. Hero centered, no overflow. |
| Desktop 1440×900 | Clean. |
| Wide 1920×1000 | Content stays constrained to `max-w-[1100px]` and centered — doesn't stretch awkwardly. |
| Mobile 375×812 | Entire hero (eyebrow → portrait top) fits in one viewport, zero scroll. |
| Mobile 390×844 | Same — clean. |
| Mobile 430×932 | Same — clean. |

## Accessibility testing

- **Keyboard navigation**: tabbed through search input → mic button → submit button → example chips; every stop showed a visible focus ring (screenshots confirmed).
- **Escape**: closes the search results/loading dropdown while preserving typed text; does not reopen on refocus (`suppressReopenRef` in the shared component).
- **Touch targets**: measured via DOM `getBoundingClientRect()`, not estimated. Mic/clear buttons fixed (see above); example chips (30px tall) and nav/submit buttons (36px) already clear the 24px AA minimum.
- **Contrast**: computed via the actual WCAG relative-luminance formula against real rendered colors, not estimated. Headline (20:1), subcopy (8.48:1), accent pink on dark bg (5.89:1) all pass comfortably. Two fixed as above.
- **Screen-reader labels**: mic ("Search by voice"), clear ("Clear search"), and now submit ("Search") all have explicit `aria-label`s.

## Console / network

A `SectionCard is not defined` / `WorkHome.tsx` error appeared in the console during this session but is a stale HMR buffer artifact from an unrelated, non-mounted route (confirmed gone after a forced reload) — not a regression from this charter's changes, and this route isn't reachable from the guest landing page. A handful of background 400/404 network calls (likely analytics/telemetry pings for unauthenticated sessions) were observed but are pre-existing and unrelated to search/hero functionality; not investigated further as out of scope for this pass.

## Verification methodology

Every commit: `npx tsc --noEmit -p tsconfig.app.json` clean, `npx eslint` on changed files diff-checked against a `git stash` baseline (zero new errors each time — the two pre-existing `UnifiedSearchDropdown.tsx` baseline issues, an `any` type and a `useEffect` dependency warning, are unchanged from before this charter), `npm run build` succeeded. All functional claims above (search states, voice permission gating, keyboard nav, touch targets, contrast ratios) were confirmed by direct browser testing or DOM measurement in this session, not assumed.

## Known limitations / not done this charter

- Placeholder text contrast (~3.02:1) in the shared search input is borderline low but out of this charter's narrower scope (pre-existing, spans every surface using `UnifiedSearchDropdown`, not named by the charter's phases). Worth a dedicated pass if the team wants full placeholder-contrast compliance app-wide.
- Full end-to-end voice recording (actual transcription round-trip) could not be tested — the browser-pane sandbox blocks real microphone capture. The permission-gated wiring was confirmed real, not the full pipeline.
- `OneWedgeLanding.tsx` and the `isWedge` dead-code flag noted in the Phase 0 audit remain unremoved — flagged, not in scope for a copy/hierarchy/accessibility charter.
- No performance measurement tooling (Lighthouse, Web Vitals) was run in this session — no performance-improvement numbers are claimed anywhere in this report, per the charter's explicit constraint.
