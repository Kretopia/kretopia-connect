# Landing Hero — Motion & Accessibility Report

## Status: `IMPLEMENTED`, `TYPECHECKED`, `UNIT_TESTED`, `BROWSER_VERIFIED`

## Motion system

| State | Behavior |
|---|---|
| Idle | Signal field sits at rest (no continuous filter/blur animation, no pulsing, no strobing). Word-by-word entrance reveal plays once on load, then stops. |
| Hover/pointer move | The field's center offsets a small, capped amount (`±24px` horizontal, `±14px` vertical) toward the cursor, spring-smoothed (`stiffness: 40, damping: 22`) so it settles rather than snapping. This is the field's *only* interaction — one layer responding, not several independent layers drifting (the prior aurora's four independently-drifting curtains are gone). |
| Pointer leave | Field eases back toward center (pointer values reset to `0.5, 0.5`, same spring). |
| CTA hover/press | Unchanged from the existing canonical button states — brightness lift + soft shadow on hover, scale-down on active, immediate (no navigation delay, no fake loading). |
| Reduced motion | The pointer-move handler early-returns (`if (reducedMotion) return`) before ever calling `.set()` on the motion values, so the field never receives an offset — it renders at its static rest position. The entrance word-reveal collapses to an instant, non-animated show (`variants: { hidden: {}, show: {} }`). No drifting, no pulse, content is immediately present either way. |

No layout properties are animated — only `transform` (`x`/`y` via framer-motion, which composites via CSS transform) and the pre-existing `opacity`/`filter: blur()` on the entrance reveal. No `width`/`height`/`margin`/`top`/`left` animation anywhere in the file. No `will-change` was added — not needed at this element count.

## Accessibility — verified via axe-core, not assumed

- **axe-core, fresh run this pass**: 0 violations on the hero, both on the dev server and the production build.
- **Exactly one `<h1>`** — asserted in the new unit test suite.
- **All decorative layers carry `aria-hidden`**: vignette, signal-field wrapper, KretoMark wrapper, coordinate grid, bottom dissolve — asserted via a unit test counting `[aria-hidden="true"]` elements (≥5).
- **CTAs are semantic links** with accessible names matching their visible text exactly (`getByRole("link", { name: ... })` in tests, which fails if the accessible name diverges from the visible label).
- **No pointer interception**: every decorative layer is also `pointer-events-none`, confirmed by reading each layer's className; the only elements that receive pointer events are the two real CTA links and the section root itself (which only reads pointer position, never blocks a click from reaching the CTAs beneath it in the stacking order).
- **No flashing/strobing**: the field's only opacity/color values are static; nothing cycles rapidly.
- **Focus remains visible**: unchanged CTA classes from a prior verified pass (real two-ring `box-shadow` focus indicator, confirmed via computed style on an actual `Tab` keypress, not a browser-default outline).
- **Content survives visual-layer failure**: every background layer is purely decorative and absolutely positioned behind the content column; if any failed to load (e.g., the KretoMark image, which is confirmed broken in local dev — see `LANDING_HERO_VISUAL_OVERHAUL_REPORT.md`), the headline, copy, and both CTAs remain fully readable and functional. Confirmed directly: the KretoMark asset *is* broken in this local environment throughout every screenshot in this pass, and the hero has remained fully usable regardless.

## Not independently re-verified this pass (carried over from a prior, still-valid check)

- **200% zoom** and **Day-mode contrast**: not re-tested in this specific pass. Day mode is not reachable by any real user today (the app is hard-locked to dark/midnight theme app-wide, documented in `LANDING_DAY_NIGHT_VISUAL_QA.md`), so it remains `DEFERRED` rather than fabricated. 200% zoom was not re-checked this pass since no layout-affecting CSS changed (only background-layer content) — flagged as a gap to close in the next full browser-verification pass if a stricter guarantee is needed, not silently assumed passing.
