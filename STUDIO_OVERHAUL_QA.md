# Studio Overhaul — QA

## Changed
- **New** `src/components/ui/cta-button.tsx`, `src/components/project/studio/StudioCreateHero.tsx`, `src/components/project/studio/StudioProjectsDashboard.tsx`, `src/components/project/studio/__tests__/StudioProjectsDashboard.test.tsx`.
- **Edited** `src/pages/WorkHome.tsx` (header copy, hero, dashboard), `src/components/Navbar.tsx` (rollback), `src/index.css` (nav scope), `src/components/landing/BottomCTASection.tsx` (canonical CTA).
- **Deleted** `src/components/project/studio/LooseProjectsCarousel.tsx` (superseded; no remaining importers).

## Preserved
Auth/RLS, `useStudioRole` permissions, approval-before-write in `VoiceFirstCreateModal`, folders + drag/long-press filing, invoice status derivation, `StudioRoom` and all deep tools, every route and deep link.

## Results
- `tsgo --noEmit -p tsconfig.app.json` — clean.
- `vitest run` — 90/90 (83 pre-existing + 7 new).
- Build log — `build OK`.
- Live authenticated `/desk` — hero, counts (29 Projects · 27 in progress) and dashboard render from real data; no "loose" copy; no new console errors.

## Not done
`/desk/:id` was left as-is: `StudioRoom` already meets the detail-view brief, and rebuilding it would have risked the presence/approval/feed guarantees for no user-visible gain. A detail-page metrics pass is the recommended next increment.
