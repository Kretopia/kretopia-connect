# Performance Report

Section 14 of the Global Typography, UX/UI and AI-Powered Motion Overhaul. Compiled 2026-08-21 on branch `feature/activation-priority-plan`.

## Methodology

Two kinds of measurement, both real, neither simulated:

1. **Bundle size, before/after this overhaul** — built the codebase at `ca3e7c47` (the commit immediately before this overhaul's own first commit, `287a99f4`) in an isolated `git worktree`, and compared it against the current `HEAD` build. Both builds ran with the identical, unchanged `node_modules` (confirmed `package.json`/`package-lock.json` have zero diff across that range), so the comparison isolates exactly what this overhaul's own code changes did to bundle weight.
2. **Live Core Web Vitals and runtime behavior** — measured directly against the running dev server via the real `PerformanceObserver`/`Performance` APIs in-browser (paint timing, LCP, layout-shift, long-task entries), not estimated. Dev-server numbers aren't production numbers (no CDN, no production minification differences, localhost latency), but they're real measurements, not guesses, and are valid for relative before/after and regression checking.

## 1. Bundle size — before/after this overhaul

| Metric | Baseline (`ca3e7c47`) | Current (`HEAD`) | Delta |
|---|---|---|---|
| Total `dist/` size | 15 MB | 15 MB | ~0 |
| All JS chunks (raw) | 10,812 KB | 10,844 KB | +32 KB (+0.3%) |
| JS chunk count | 310 | 312 | +2 |
| Main `index` chunk (critical path, every route) | 1,915.74 kB / gzip 580.65 kB | 1,915.79 kB / gzip 580.72 kB | +0.05 kB raw / +0.07 kB gzip — negligible |
| `ThriveDesk` chunk (Studio, where `AutopilotProjectGuide` lives) | 1,230.58 kB / gzip 324.75 kB | 1,245.86 kB / gzip 328.50 kB | +15.28 kB / +3.75 kB gzip |
| PWA precache manifest | 319 entries, 10,433.76 KiB | 321 entries, 10,457.49 KiB (before the font fix below; 10,451.02 KiB after) | +17.26 KiB net |

This overhaul added a real amount of new functionality — a shared typography component system, `FixedProgressiveCard`, `AutopilotProjectGuide` (a substantial new multi-step component), a new edge function, motion tokens — for **0.3% total JS growth**, and the growth landed almost entirely in the one chunk that actually gained new code (`ThriveDesk`/Studio), not the critical-path `index` chunk every visitor downloads. That's the direct, measured result of building shared, reused components (`Heading.tsx`, `FixedProgressiveCard.tsx`) rather than one-off per-page code.

## 2. A real, previously-undiscovered font-loading defect found and fixed

Measuring live font-loading behavior (`document.fonts`, matching Section 14's "font loading" requirement) surfaced something `TYPOGRAPHY_SYSTEM.md` had missed: **`document.fonts` listed `Instrument Serif` and `Work Sans` as loaded families on the landing page**, despite `TYPOGRAPHY_SYSTEM.md` documenting Instrument Serif as already removed. Network inspection traced it to `src/main.tsx`, which unconditionally imported 6 `@fontsource` CSS files (`instrument-serif/400`, `instrument-serif/400-italic`, `work-sans/400`, `/500`, `/600`, `/700`) — a completely separate, self-hosted font-loading path from the `index.html` Google Fonts `<link>` that was cleaned up earlier this session. Six real HTTP requests, on every single page load, app-wide.

Confirmed both are genuinely unused before removing anything: `Work Sans` has zero references anywhere in `src/` outside this import; `Instrument Serif`'s only other mentions are a code comment explaining why it's overridden and an unrelated placeholder string in a text input (`BrandVaultEditor.tsx`, `placeholder="e.g. Instrument Serif"` — example text for a free-form font-name field, not a real dependency on the font being loaded).

**Fixed**: removed all 6 imports from `src/main.tsx`. Live-verified: `document.fonts` now lists only `Inter` and `Satoshi`; the 6 `@fontsource` network requests no longer fire; the landing page screenshots pixel-identical before and after (expected — neither font was ever actually painted). Precache manifest dropped from 10,457.49 KiB to 10,451.02 KiB. The `@fontsource/instrument-serif` and `@fontsource/work-sans` npm packages themselves were left in `package.json` — removing the now-dead runtime import is the actual performance win; pruning the unused dependency declarations too is a separate, slightly higher-risk change (touches the lockfile) not done in this pass.

## 3. Live Core Web Vitals (dev server, real measurement)

| Page | FCP | LCP | CLS |
|---|---|---|---|
| Landing (guest) | 184–252ms | 236ms (LCP element: the hero title's accent span) | 0 |
| Today (dashboard) | 204ms | not captured (session expired mid-measurement, see below) | 0 |

All real numbers from a local dev server — expect production numbers to be higher due to network latency and no CDN, but these confirm nothing is grossly broken (a 236ms LCP or a multi-second one would look identical in relative terms on this metric if something were badly wrong; nothing here suggests it is). CLS of exactly 0 on both pages measured is a genuinely good sign given this overhaul touched typography (a classic CLS source via font swap) and added a new scroll-driven component.

## 4. `FixedProgressiveCard` scroll performance — the highest-risk surface this overhaul added

A scroll-position-driven animation (Section 7, `useScroll`/`useTransform`) is exactly the kind of feature that commonly causes main-thread jank if implemented naively (e.g. via scroll-event listeners that trigger React re-renders). Set up `PerformanceObserver`s for `longtask` and `layout-shift` before scrolling, then performed a real, incremental scroll (via the browser's native scroll/wheel input, not a single `scrollTo` jump) through the entire ~1,335px pinned range of the landing page's `ClosingCTASection` and into the footer beyond it.

**Result: zero long tasks, zero layout shifts**, for the entire scroll pass. This confirms Framer Motion's `useTransform` is doing what it's supposed to — writing directly to element style outside React's render cycle — rather than the six content slots' reveal animation forcing synchronous layout work or component re-renders on every scroll tick.

## 5. Not covered this pass

- **Authenticated-page metrics** (Today, Hire Talent, Passport, Verified Credits, Studio beyond the one Today FCP reading) — the browser session's auth token expired mid-measurement (`"Auth session missing!"` from a direct `getUser()` check), matching this whole engagement's established pattern of periodic session expiry. Per this session's standing rule, credentials are never entered by Claude — re-authenticating requires the user to sign back in, which wasn't requested mid-task for a non-blocking measurement pass. Only the guest-accessible landing page (the single most performance-critical page — it's the first-time-visitor/conversion-funnel entry point) got full Core Web Vitals coverage.
- **Production-network conditions** — no CDN, no realistic latency/bandwidth throttling; all numbers are dev-server-local. Relative comparisons (before/after, does anything look broken) are valid; absolute numbers are not representative of real-world user experience.
- **INP** (Interaction to Next Paint) — not measured; requires sustained real user interaction sampling that a scripted pass doesn't naturally generate.
- **Route-transition timing** — not measured (e.g. Today → Studio navigation latency).
- **Duplicate API call audit** — not systematically checked this pass.
- **Re-render / observer / listener cleanup audit** — not systematically checked; the one component most likely to need it (`AutopilotProjectGuide`, with several `useEffect`s and Supabase realtime-adjacent patterns) wasn't specifically profiled for excess re-renders.
- **Image loading** — not measured this pass; `loading="lazy"` is present on the image usages already read during earlier work this session (`ChapterSection.tsx`, `CreditsBoard.tsx`), but no systematic sweep or measurement was done here.

## Verification

`npm run typecheck`: only the single pre-existing baseline error (`StudioAICreate.tsx`, unrelated), unchanged. `npm run build`: clean. `npm run test`: 68/68 passing, unchanged. Landing page screenshotted before and after the font-import removal — pixel-identical.
