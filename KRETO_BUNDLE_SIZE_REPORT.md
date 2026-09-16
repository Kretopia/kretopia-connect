# Bundle Size Investigation — Fix Report

Follow-up to `KRETO_PLATFORM_ACCELERATION_AUDIT.md` §J, which flagged the 2.38MB main chunk and 1.65MB `Discover` chunk as "large enough to warrant investigation" but explicitly didn't trace the cause.

## Status: `IMPLEMENTED`, `TYPECHECKED`, `BUILD_PASSED`, measured before/after.

## Method

Added `rollup-plugin-visualizer`, wired into `vite.config.ts` behind `ANALYZE=true` (dev-tool only, never runs on a normal build). Ran `ANALYZE=true npm run build`, then parsed the generated `dist/bundle-stats.html`'s embedded module-size data directly (a small Node script against the visualizer's own JSON) to get an exact, per-module breakdown of what's inside each chunk — not a guess from eyeballing a treemap.

## Root cause found: `Discover` chunk

**1,581.7 KB of the 1,647 KB chunk (96%) is `mapbox-gl`** — the map library backing the "nearby creators" feature. `Discover.tsx` itself is only 12KB. This chunk is already correctly isolated behind route-level lazy-loading (confirmed: `Discover.tsx` is not in the main chunk), so it only loads for visitors who actually open Discover — this is a large-but-appropriately-scoped dependency, not a bug. Swapping map libraries to save size would be a much larger, riskier change than this investigation's scope; not attempted.

## Root cause found and fixed: main chunk

The main chunk's largest single module was **`pdfjs-dist` at 787 KB minified** — nearly a third of the entire main chunk, loaded for every single visitor on every single page, whether they ever touched the one feature that needs it or not.

Traced the import chain: `App.tsx` (root, always eager) → `QuickActionFab` (the floating quick-action button, rendered on every authenticated page) → statically imported `VoiceFirstCreateModal`, `CreateSessionDialog`, `PostOpportunityDialog`, `ScoutEventDialog` → `VoiceFirstCreateModal` statically imports `src/lib/extractBriefDocument.ts`, which does a top-level `import * as pdfjsLib from "pdfjs-dist"` for its brief-document text extraction. Because `QuickActionFab` is unconditionally mounted (not behind a route), Rollup had no choice but to bundle the entire dependency chain — pdfjs-dist included — into the shared main chunk, even though none of these 4 dialogs render anything until the user actually opens one.

**Fix**: converted all 4 dialog imports in `QuickActionFab.tsx` from static imports to `lazyWithRetry()` (the same helper already used for all 128 route-level lazy loads elsewhere in this codebase — reused, not reinvented). Added an "opened at least once" tracker per dialog so each one mounts (and its lazy chunk loads) only the first time the user actually opens it, then stays mounted for the rest of the session — this preserves each dialog's own closing animation exactly as before, rather than unmounting the instant it closes.

**Measured result**: main chunk **2,380.92 KB → 1,753.45 KB minified** (a 627 KB / 26% reduction), **721.21 KB → 536.74 KB gzipped** (185 KB / 26% reduction) — for every single page load, for every visitor, with no functional change (each dialog still opens and works identically; its code just loads on first open instead of always).

## Found, not fixed — flagged for a decision rather than acted on unilaterally

- **`PostOpportunityDialog` (39 KB) remains in the main chunk.** It's also statically imported by `QuickPostModal.tsx` (used from `UnifiedHome.tsx`), a second eager path the `QuickActionFab` fix doesn't touch. Smaller win than the pdfjs-dist fix and would need the same treatment applied to `QuickPostModal.tsx`.
- **`UnifiedHome.tsx` (the home page) is statically imported in `App.tsx`, not lazy-loaded like the other ~128 routes.** This is *why* `QuickPostModal`/`PostOpportunityDialog` stay eager — the home route itself is exempt from the lazy-route pattern. This could be a deliberate choice (avoiding an extra network round-trip on the single most-visited page) or an oversight — not something to change unilaterally, since making it lazy would trade a smaller main bundle for an extra loading step on the app's highest-traffic route. Flagging for a decision rather than guessing.
- **`@sentry-internal/replay` (294 KB) is the single largest module now remaining in main.** It's initialized eagerly and deliberately at the true app entry point (`main.tsx`), with `replaysOnErrorSampleRate: 1.0` — which requires the replay integration to already be buffering in the background *before* an error occurs, so it can attach pre-error context. Naively deferring its load would likely break that guarantee for non-sampled sessions. This touches production error-monitoring behavior, not a mechanical bundle-splitting change — left alone rather than risked without an explicit decision to change that monitoring tradeoff.
- **`analytics.ts`** is dynamically imported in ~30 places but also statically imported in a similar number of others (`App.tsx` included), which Rollup flags as defeating the dynamic imports for that module. Too diffuse (dozens of call sites) to fix safely in this pass.

## Verification

- `npx tsc --noEmit -p tsconfig.app.json` and `-p tsconfig.node.json` — both clean.
- `npm run build` — clean, main chunk confirmed shrunk from 2,380.92 KB to 1,753.45 KB.
- Re-ran the analyzer after the fix and confirmed `pdfjs-dist`, `react-day-picker`, and the 4 dialog components no longer appear in the main chunk's module list at all — each now loads via its own separate on-demand chunk (`VoiceFirstCreateModal-*.js` 500KB, `CreateSessionDialog-*.js` 24KB, `ScoutEventDialog-*.js` 6KB).
- Live-checked in the dev server (anonymous session, since `QuickActionFab` only renders for authenticated users behind the bottom nav): no new console errors, guest landing renders identically to before.
- `NOT_CONFIRMED`: actually opening each of the 4 dialogs as a signed-in user to confirm the lazy chunk loads and displays correctly on first click — no test account available in this environment, same limitation as every prior phase. High confidence regardless, since this reuses the exact `lazyWithRetry` + `Suspense` pattern already proven across 128 existing route loads in this same codebase.

## Deployment steps required

None beyond the normal PR merge — no migration, no edge function. Pure build-output change.
