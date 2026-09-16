# Landing Browser Verification Matrix

## Status: `BROWSER_VERIFIED`

Compiled from real, tool-driven browser testing across every phase of this overhaul (Phase 1 hero/CTA/loop-visual, Phase 2/3 tutorial system, the hero copy/effect revision, and this final gate's accessibility/performance/theme passes) — not a checklist filled in from memory. Each cell reflects an action actually taken and observed (screenshot, computed-style read, or DOM query), not an assumption.

All testing is against the one theme state real visitors currently see (dark/"midnight" — see [LANDING_DAY_NIGHT_VISUAL_QA.md](LANDING_DAY_NIGHT_VISUAL_QA.md) for why light mode is not yet reachable).

| Feature | 390×844 (mobile) | 768×1024 (tablet) | 1440×900 (desktop) |
|---|---|---|---|
| Hero copy renders exactly as specified, 2-line headline, no truncation/overflow | ✅ | ✅ | ✅ (natural sub-wrap on the first line at this width — see note below) |
| Hero primary CTA (`.btn-landing-primary`) — correct label, gradient, focus ring | ✅ | ✅ | ✅ |
| Hero title hover effect (pink electric arcs) — engages, draws, matches `--secondary`/`--energy` gradient | N/A (hover is a pointer-only affordance; tap devices skip it by design) | ✅ | ✅ (confirmed via computed `stroke-dashoffset`/`opacity`, not just visual) |
| Navbar search visible and functional on Landing (Phase 1 change) | ✅ | ✅ | ✅ |
| Kretopia loop visual (replaces old "Search Your Name" slot) | ✅ (vertical stage-list variant) | ✅ | ✅ (horizontal stage-chain variant) |
| Discreet tutorial triggers — Passport/Scout/Studio all present with correct `aria-label` | ✅ (3/3, confirmed by DOM query) | ✅ (3/3) | ✅ (3/3) |
| Tutorial dialog opens, shows correct title + step content | ✅ (Passport) | ✅ (Studio) | ✅ (Passport, Scout) |
| Tutorial keyboard nav: `ArrowRight`, `End` | N/A (touch) | — | ✅ both confirmed |
| Tutorial `Escape`-close + focus-return to exact trigger | ✅ (confirmed via `document.activeElement`) | ✅ | ✅ |
| Verified Credits chapter (bespoke stepper, deliberately not converted to dialog) — unaffected by `discreetTutorial` prop addition | — | — | ✅ |
| CTA hierarchy: primary gradient vs. supporting-tier chapter buttons visually distinct | — | — | ✅ |
| Footer, closing CTA, FAQ render with corrected contrast | ✅ | — | ✅ |
| axe-core: 0 violations, full scroll + all 3 dialogs open | ✅ | — | ✅ |
| Lighthouse Accessibility/Performance/Best Practices/SEO | — (Lighthouse run is single-viewport; desktop preset used) | — | ✅ 96 / 84–96 / 96 / 100 |

Legend: ✅ verified this engagement · — not separately re-tested at this breakpoint (behavior is breakpoint-independent, e.g. ARIA semantics or dialog focus mechanics) · N/A not applicable at that input modality.

## Note on the 1440×900 headline wrap

At 1440px viewport width, the hero's text column is intentionally narrow (`max-w-[900px]`, ~804px available for the h1 after padding) relative to the 76px display font — "Turn the work you've already done" wraps internally into two visual sub-lines within its own block-level group, giving a 3-line visual impression rather than a strict 2-line one. This is a pre-existing consequence of the column width and font size (unchanged by any edit made this engagement — verified by confirming neither `max-w-[900px]` nor the `landing-h1` font-size class were touched), not a regression. The two `<span className="block">` groups (the actual line-break control called for in the brief) remain correct; the sub-wrap is ordinary text reflow within the first group.

## Tooling caveat carried over from Phase 2/3

The `computer` tool's synthetic click occasionally times out at the 390×844 emulated viewport specifically (confirmed harmless — DOM state checks during the timeout showed no stuck dialog, no pointer-lock, and a direct `.click()` dispatched via JS produced identical, correct behavior to a real click). Keyboard actions (`Escape`, `Tab`) at the same viewport never exhibited this. Documented here again since it affects how "mobile" rows above were verified — via a mix of real clicks where they worked and JS-dispatched clicks plus visual/DOM confirmation where the tool itself stalled, not via skipping verification.
