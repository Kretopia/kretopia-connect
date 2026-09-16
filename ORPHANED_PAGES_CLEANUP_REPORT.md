# Orphaned Marketplace/Explore Pages — Cleanup Report

Follow-up to a finding from `IMAGE_LOADER_ROLLOUT_REPORT.md`: `src/pages/Marketplace.tsx` and `src/pages/Explore.tsx` were unreachable — `/marketplace`, `/market`, and `/explore` are all `<Navigate>` redirects to other routes, and neither page was rendered anywhere else.

## Status: `IMPLEMENTED`, `TYPECHECKED`, `BUILD_PASSED`, `RUNTIME_CONFIRMED`.

## What was verified before deleting anything

Traced every file these two pages exclusively depended on, not just the pages themselves:

- **`src/pages/Marketplace.tsx`** — not imported anywhere, not even as a dead `lazy()` reference in `App.tsx`. Fully orphaned.
- **`src/pages/Explore.tsx`** — imported once (`const Explore = lazy(() => import("./pages/Explore"))`, `App.tsx:158`) but never used in any `<Route>` — a dead import, not just a dead route.
- **`src/components/marketplace/ListingCard.tsx`** — used only by `Marketplace.tsx`. Orphaned by extension.
- **`src/components/marketplace/SellerDashboard.tsx`** — used only by `Marketplace.tsx`. Orphaned by extension.
- **`src/components/marketplace/CreateListingDialog.tsx`, `ListingImageUpload.tsx`, `ProductFileUpload.tsx`** — checked and **kept**. `CreateListingDialog` is also imported by `src/components/profile/DigitalProductsSection.tsx`, a separate component outside this cleanup's scope. (Note: `DigitalProductsSection.tsx` itself appears to have no callers either — a separate, pre-existing orphan unrelated to Marketplace/Explore, not touched here since it wasn't part of what was asked.)
- Checked for stray references in `vite.config.ts`, `plugins/`, `public/sitemap.xml`, and test files — none found.

## What was deleted

- `src/pages/Marketplace.tsx`
- `src/pages/Explore.tsx`
- `src/components/marketplace/ListingCard.tsx`
- `src/components/marketplace/SellerDashboard.tsx`
- The dead `const Explore = lazy(...)` import line in `src/App.tsx`

## What was deliberately kept

The three `<Navigate>` redirect routes (`/market` → `/opportunities`, `/marketplace` → `/opportunities`, `/explore` → `/nearby`) were **not** removed — they're what makes this a safe cleanup rather than a breaking one. Anyone with an old bookmark or external link to these paths still lands somewhere useful instead of hitting a 404.

## Verification

- `npx tsc --noEmit -p tsconfig.app.json` — clean.
- `npm run build` — clean; precache entry count dropped from 349 to 348 (one fewer route chunk), consistent with removing the `Explore` lazy import.
- `RUNTIME_CONFIRMED`: navigated to `/marketplace` and `/explore` directly in the dev server — both redirect correctly (`/opportunities` and `/nearby` respectively), no console errors, no broken module references.

## Deployment steps required

None. Frontend-only, no migration, no edge function.
