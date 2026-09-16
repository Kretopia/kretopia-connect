# Studio Overhaul — Current-State Audit

Branch: `edit/edt-42e7faa6…` (fork of main after `9220afb22`). Clean tree at audit time apart from this change.

## Routes
- `/desk` → `src/pages/WorkHome.tsx` (`CreatorWorkHome` for individuals, `BrandWorkHome` for `account_type='company'`).
- `/desk/:id` → `StudioRoom.tsx` (+ `WorkflowShell` for deep tools).
- No route, deep link, table or storage key was renamed in this pass.

## Component tree (Studio home, before)
FeaturePageHeader → KretoTip → active-count badge → voice pill button → big "New project" button →
StudioFoldersBar → (`Loose projects` heading + `LooseProjectsCarousel`) **or** ("Your studio rooms" + `StudioCardsGrid`) →
SectionCard "Session & Activity" → SectionCard "Casting & Collaborators".

## Data flow
- `fetchProjects()` — one `projects` select (RLS-scoped) + one `invoices` select `in(project_id)` → `invoicesByProject` map (`paid | invoiced | unsent`).
- `fetchFolders()` — `studio_folders` for the user.
- Recent collaborators — `get_project_people` RPC over the 5 most recent projects, deduped client-side.
- No new query was added by this overhaul; the dashboard is computed from the same two result sets.

## Creation entry points
`VoiceFirstCreateModal` (page CTA, DeskCommandPalette `onVoiceCreate`, WorkspaceSidebar via `CreateProjectDialog`→`CreateProjectWizard`).

## Button / CTA sources of truth
- `src/components/ui/button.tsx` — every variant routes through `.btn-glass` (commit `f66b8e399`).
- Landing CTA — `src/components/landing/BottomCTASection.tsx`: `<Button size="lg" className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-semibold group shadow-md">`.
- Navbar — `src/components/Navbar.tsx`; the two "Get Started" CTAs were swept from `cta-primary` → `btn-pink-gradient` (`ce4fc827b`) → `btn-glass btn-glass-primary` (`f66b8e399`).

## Known issues found
1. "Loose projects" user-facing wording (2 files).
2. Card-wall layout: two competing list renderers (carousel vs grid) for the same data.
3. Creation CTA was a bespoke `btn-glass` block, not the canonical landing CTA.
4. Navbar inherited the CTA glass sweep it was never meant to get.
5. Page copy used "room" as the product noun.

## Status
implemented · typechecked · unit-tested · browser verified (authenticated `/desk`).
