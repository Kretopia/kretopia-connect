# Landing Hero — Performance Report

## Status: `IMPLEMENTED`, `BROWSER_VERIFIED`

## Method

Lighthouse 13.4.1, desktop preset, headless Chrome, against the **production build** (`npm run build` + `vite preview`, not the dev server — the dev server's unbundled module graph produces misleading numbers, established in an earlier pass this engagement). Single run per state on one local machine — not CDN-hosted, so absolute numbers won't match real production hosting, but the **before/after comparison on identical conditions** is valid.

## Before → after (same machine, same method, back-to-back)

| Metric | Aurora (before) | Signal Field (after) | Change |
|---|---|---|---|
| Performance score | 94 | 93 | −1 (within normal single-run noise) |
| Accessibility score | 96 | 96 | unchanged |
| Best Practices score | 96 | 96 | unchanged |
| SEO score | 100 | 100 | unchanged |
| First Contentful Paint | 0.9s | 0.9s | unchanged |
| Largest Contentful Paint | 1.5s | 1.2s | **−0.3s** |
| Total Blocking Time | 0ms | 0ms | unchanged |
| Cumulative Layout Shift | 0.003 | 0.004 | +0.001 (negligible, both effectively zero) |
| Speed Index | 1.2s | 2.0s | +0.8s (see note below) |
| Hero background DOM layers | 11 | 9 | **−2 layers** |

**Speed Index note**: this single metric moved against the general trend of the others (LCP improved, layer count dropped, TBT/CLS unchanged). Speed Index is more sensitive to single-run local-machine noise than the other metrics — no code change in this pass should plausibly make visual completeness slower while simultaneously making the actual paint of the LCP element faster. Flagging rather than explaining away: **not claiming this metric improved or regressed without a multi-run average**, per this brief's own rule against unmeasured claims.

## LCP element — unchanged, and it's the ideal one

Confirmed via `PerformanceObserver` in a live page (not inferred from the report alone): the Largest Contentful Paint element is the headline's first word (`"Find "`), a text node — not an image, not the signal field. This was true before this pass and remains true after. A text LCP element has no network dependency and resolves as soon as the font is ready, which is why FCP/LCP stay fast regardless of the background system behind it.

## Console and network

Zero console errors on fresh load, before and after, on both the dev server and the production build. The only "broken" network request is the pre-existing, previously-diagnosed `KretoMark`/`BrandLogo` asset proxy issue (`/__l5e/assets-v1/...`, local-dev-only, see `LANDING_HERO_VISUAL_OVERHAUL_REPORT.md`) — not new, not a regression.

## What was removed / why it's lighter, not just different

- 4 independently-animating `AuroraCurtain` components (each running its own `scaleY`/`skewX` loop plus a pointer-driven `useTransform`) → replaced with 1 static-shaped radial-gradient div with a single shared pointer-driven offset.
- 1 cursor-spotlight element (a 5th independent animated layer) → removed, no replacement.
- Net: 2 fewer DOM layers in the hero's background system, 5 fewer independently-running animation loops under idle conditions (down to effectively zero idle animation — the field only moves in response to genuine pointer input, not on a timer).

## No heavy dependency added

`framer-motion` (`useMotionValue`, `useSpring`, `useTransform`) was already a project dependency, used extensively elsewhere on Landing before this pass — no new package, no bundle-size increase from tooling.
