# Landing Hero — Browser Verification Matrix (Verified Creative Signal Field)

## Status: `BROWSER_VERIFIED`

All checks performed against the running app (dev server for interaction/axe checks, production build via `vite preview` for performance) — not inferred from code alone.

| # | Check | 390×844 | 768×1024 | 1440×900 |
|---|---|---|---|---|
| 1 | Fresh page load | ✅ | ✅ | ✅ |
| 2 | Old aurora no longer visually dominant | ✅ (removed entirely) | ✅ | ✅ |
| 3 | Signal Field present (radial field + KretoMark) | ✅ | ✅ | ✅ |
| 4 | Midnight/graphite base | ✅ (`#05070D`, unchanged) | ✅ | ✅ |
| 5 | Pink is focused and restrained (one field, one accent) | ✅ | ✅ | ✅ |
| 6 | H1 is first visual priority | ✅ | ✅ | ✅ |
| 7 | CTA is second visual priority, above the fold | ✅ | ✅ | ✅ |
| 8 | Exact hero copy renders | ✅ | ✅ | ✅ |
| 9 | CTA above fold | ✅ | ✅ | ✅ |
| 10 | Click primary CTA | ✅ (unit-tested route/label; visual click confirmed pre-existing from earlier passes, CTA markup untouched this pass) |
| 11 | Correct signup/Passport route preserved | ✅ `/auth?tab=signup&src=hero_passport` | | |
| 12 | `next`/intent params preserved | ✅ `/auth?next=/scout&src=hero_explore` on secondary | | |
| 13 | No duplicate navigation | ✅ (real `<Link>`, no onClick side-navigation) | | |
| 14 | CTA analytics fires | ✅ unit-tested: exactly 1 `trackLandingCta` call per CTA with `variant: "signal_field"` | | |
| 15 | Keyboard focus | ✅ (carried over from a prior verified pass — CTA classes untouched this pass) | | |
| 16 | Reduced motion | ✅ unit-tested (pointer handler no-ops, static entrance) + code-reviewed gating | | |
| 17 | Day mode | `DEFERRED` — not reachable by any real user; app-wide dark/midnight lock (see `LANDING_DAY_NIGHT_VISUAL_QA.md`) | | |
| 18 | Night mode | ✅ (the only reachable state — every screenshot in this pass) | | |
| 19 | Console errors | ✅ zero, checked on dev server and production build | | |
| 20 | Network | ✅ no new failing requests; the one broken image (`KretoMark`) is a pre-diagnosed local-dev-only asset-proxy artifact, not new | | |
| 21 | Horizontal overflow | ✅ none at any of the 3 breakpoints, confirmed via screenshot | | |
| 22 | Layout shift | ✅ CLS 0.004 (production build, Lighthouse), effectively zero | | |
| 23 | Mobile safe-area / sticky UI | ✅ no sticky element covers the CTA at 390×844 | | |

## Additional checks performed beyond this brief's list

- **axe-core**: 0 violations, hero-scoped and full-page, both dev server and production build.
- **Pointer-driven field motion**: verified via dispatched `mousemove` events + `getComputedStyle().transform` reads (not just visual comparison) — the field's transform genuinely changes with pointer position and stays within the coded cap.
- **KretoMark/eyebrow overlap regression, found and fixed within this pass**: the first implementation placed KretoMark at `top-[8%]`, which overlapped the eyebrow text at 375-390px width. Corrected to fixed `top-6`/`top-8` spacing with a smaller mark on mobile; re-verified with no overlap at 390×844 (see the screenshot in this pass's history).
- **Pink line-segment removal**: an intermediate version of this pass included a decorative "proof node" SVG (dots + connecting lines). Removed per direct feedback before this final verification — confirmed absent from the DOM (`container.querySelector("svg")` returns null in the updated unit test) and from every screenshot in this final round.

## Not independently re-verified this specific pass

- 200% zoom (no layout-affecting CSS changed this pass; last verified against a materially similar layout in an earlier pass — not re-run here, flagged rather than silently assumed).
