# Studio / Studio Room / New Room Overhaul — Phase 1 Audit

Baseline for `KRETOPIA — COMPLETE STUDIO + STUDIO ROOM + NEW ROOM OVERHAUL`.
Read-only pass. No application code was edited to produce this report.

**Repo state this audit was run against**: branch `feature/activation-priority-plan`
at `f6762551` (fast-forwarded from local `187094ef` to origin's tip — see
note at the end). Local uncommitted work from earlier this session was
stashed, not discarded (`git stash list` → `stash@{0}`).

**Headline finding**: a large share of what this spec asks for already
exists, shipped in the last few hours by parallel edits made directly in
Lovable's editor (12 commits, `gpt-engineer-app[bot]` co-authored by
`noeplantier`, timestamped `03:02–03:15` today) on top of this session's own
earlier work. The gaps that remain are narrower and more specific than the
spec's framing assumes. Each section below says what's already true, not
just what the spec wants.

---

## 1. Current Studio architecture (`/desk`)

`src/App.tsx:366` → `src/pages/WorkHome.tsx`. Branches on `profiles.account_type`:
`BrandWorkHome` (companies) or `CreatorWorkHome` (individuals — the one this
spec is about).

`CreatorWorkHome` render order: `FeaturePageHeader` (eyebrow "Studio", title
"Start with what" / accent "you're making.") → `KretoTip` → `StudioCreateHero`
(marketing hero) → `StudioFoldersBar` + `StudioProjectsDashboard` at root, or
`StudioCardsGrid` inside a folder → `SectionCard "Session & Activity"` →
`SectionCard "Casting & Collaborators"`. Modals mounted at the bottom:
`VoiceFirstCreateModal`, `DeskCommandPalette`, `VoiceCommandSheet`,
`WrapMyWeekSheet`.

This already matches the spec's required §3 STATE A order (marketing hero →
create → dashboard → activity) reasonably closely. It does **not** have a
distinct "needs-attention queue" or "how Studio works" as separate sections —
those ideas are folded into the dashboard's filter tiles and the tutorial
sheet (`STUDIO_TUTORIAL`) respectively.

## 2. Current Studio Room architecture (`/desk/:id`)

`src/App.tsx:370` → `src/pages/ThriveDesk.tsx` (376 lines). Layout: flex row
— collapsible `WorkspaceSidebar` on the left (overlay on mobile, toggled by
`sidebarOpen`), main column (header: `SimpleProjectHeader` +
`ProjectSettingsMenu`; desktop-only `ProjectFlowTimeline` + `NextStepBar`,
shown only when `activeTab === "today"`; banners for agent-mode/invite-accept/
credit-confirm; then `StudioRoom` when `isStudioRoom` else `DeskTabContent`),
right `WorkspaceQuickPanel` (shown only outside Studio Room).

`StudioRoom.tsx` itself is **not** phase-gated. It renders a
user-reorderable widget list — left column (brief, deliverables, pad, prep,
work), right column (money, milestones, request_pay, people, wrap, credit,
calls) — order persisted per-project in `localStorage` under
`thrivedesk:widgets:${project.id}`. Every widget is visible at once, subject
only to `HideableSection` per-user hide toggles. There is no "one phase
visible at a time" behavior anywhere currently.

## 3. Current New Room architecture

`src/components/project/studio/VoiceFirstCreateModal.tsx` — full-screen
custom overlay (not a Radix Dialog), modes `prompt → recording|thinking →
review`. The "Step 1 — choose a type" tab gate that used to precede the
prompt has already been removed (both by this session's earlier edit and,
independently, by the parallel Lovable edits that superseded it) — entry is
now prompt-first with tappable inspiration chips, matching the spec's core
ask in §9/§10. `HOW_IT_WORKS` (4-step strip) and `EXAMPLE_PROMPTS` per
workspace type already exist. Review step is fully editable (title, summary,
starter tasks, room type, money-involved, credit tracking, deadline, budget)
and requires an explicit "Create" tap — nothing is written until then.

**Gap**: a second, separate creation flow exists (`CreateProjectDialog` →
`CreateProjectWizard`, "legacy... 3-step wizard" per its own code comment),
reachable only from `WorkspaceSidebar.tsx`'s own "New Project" button. Every
other creation entry point in the app (hero, empty states, command palette)
already resolves to `VoiceFirstCreateModal`. This is the one concrete
"competing creation flow" the spec explicitly warns against (§5, §10G) — see
open decision #1.

## 4. Current project creation flow

Prompt (voice→`extract-brief` or text→`extract-brief`) → review (editable) →
explicit "Create" → `projects.insert()` + task seeding +
`scaffoldProjectDefaults()` (Vault folders, starter deliverables) →
`navigate(/desk/:id)`. Draft (brief/type/money/credit/date/budget, not raw
audio) persists in `sessionStorage` per user, survives refresh, expires after
24h. `extract-brief` and its sibling `elevate-brief` are stateless AI proxies
with **no Authorization/auth check at all** — see §17 security risk #1.

## 5. Current "eight-step" model

Real name: `PROJECT_FLOW_STAGES` in `src/hooks/useProjectFlow.ts:7-16` — a
literal 8-element array: `discussion, brief, tasks, work, review, agreement,
payment, complete`. Current stage is *derived*, not stored — `deriveStage()`
(lines 62-81) infers position from activity counts (message count, brief
length, task count, etc.), not from a persisted phase column. Rendered only
by `ProjectFlowTimeline`/`NextStepBar`, desktop-only, only on the "today"
tab. This is entirely separate from `StudioRoom`'s freeform widget order
(§2) — the app currently has **two unrelated "progress" concepts** live at
once, neither of which is the DB `projects.status` column (§16).

## 6. Current sidebar architecture

`src/components/project/WorkspaceSidebar.tsx` (102 lines). Header "Studios",
section "Your Projects", rows already compact (status dot + truncated title
only, no descriptions — already matches the spec's "compact rows" ask). No
dedicated mobile drawer/sheet component of its own; mobile reuses the same
component inside a fixed-position overlay toggled by `ThriveDesk`'s
`sidebarOpen` state, rather than a bottom sheet or dedicated switcher.
Contains the second "New Project" entry point flagged in §3.

**Gap — project switching has no cancellation/clear-before-render guard**:
`useProjectData.ts` has no `AbortController` and no `cancelled` flag on its
fetch effects. `setLoading(true)` only fires on the very first load
(`if (isInitial && !project)`, line 100) — switching from an already-loaded
project to a different one shows no loading skeleton and does not clear the
previous project's title/tasks/files/messages before the new fetch resolves;
rapid switching could theoretically let an out-of-order response win. This
is the concrete version of the spec's §8 "prevent cross-project flashes"
requirement — currently unmet.

## 7. Current Drop Zone architecture

`src/components/project/studio/BriefDropZone.tsx`. Current copy: headline
**"Land it here — Thrive files it"** (line 580, leaks internal "Thrive"
branding into user-facing text — the one clear terminology violation this
audit found), subtext uses "Kreto", result panel says "Studio Brain
remembered this" — three different names for the same feature in one
component. A near-duplicate in `StudioPulseFeed.tsx:123` reads "Land it here
— Copilot files it" (also off-brand — "Copilot" isn't a name used anywhere
else in the product).

Accepts pdf/text/image/audio/csv/tsv/md/json/yaml/docx, 25MB cap (15MB
audio). Always calls `studio-ingest` (writes `studio_facts`/`studio_entities`,
membership-checked). Text-shaped documents additionally call `elevate-brief`,
whose output is **applied immediately with no review or confirmation step**
— direct writes to `projects.description`, `project_tasks`,
`project_deliverables`, `project_run_of_show`, `event_suppliers`,
`event_talent`, `project_notes`. This is a real, direct violation of the
spec's own required pipeline (§13: "...→ proposed routing → user review →
confirmation → Project update") and of §12's "Kreto must not silently...
[update Brief/Tasks/Deliverables/Moodboard/Milestones without review]" —
see open decision #4.

## 8. Current Projects / "Loose projects" model

"Loose projects" is **fully gone from rendered UI** — the only surviving
trace is a code comment (`WorkHome.tsx:612-614`) noting the rename already
happened, copy-only, no data migration needed. Current rendered heading is
"Projects"; the folder-less bucket is labeled "Unfiled". A regression test
already guards this (`StudioProjectsDashboard.test.tsx`, "uses Projects
terminology and never says 'Loose'").

Two different visual systems currently coexist for showing the same
`StudioProject` data: `StudioProjectsDashboard` (list, root view — status
filter tiles, search, sort, per-row "Next: ...") and `StudioCardsGrid` (card
grid, inside-a-folder view). Both independently render status pill + pay dot
+ updated-time from the same helper module but with **different empty-state
copy** between the two, and neither shows `deadline` despite it being a real
column on `projects`. `StudioProjectsDashboard`'s `canSeeMoney` prop (meant
to hide money signals from unauthorized viewers) is never actually passed by
`WorkHome.tsx` — it silently defaults to `true` always. Low real-world risk
today (this dashboard only ever renders the signed-in owner's own projects),
but it's dead/unwired code that should either be wired or removed rather
than left as a false sense of a role check.

## 9. Current navbar button source

`src/components/Navbar.tsx`. Confirmed: **none** of its buttons use
`.btn-glass` variants (`default`/`gradient`/`hero`/`lime`/`glow`/`glass`) —
every control is `ghost` or `outline`, except the two "Get Started" CTAs,
which use `variant="link"` deliberately overridden with a bespoke
`nav-btn-plain bg-primary ...` className, not any part of the Studio CTA
system. Practical implication: there is nothing to "restore" — the navbar
was never touched by the Studio CTA redesign work in the first place.

## 10. Current Landing Page CTA source

`src/components/ui/cta-button.tsx` — `CtaButton`, a thin wrapper around the
shared `Button` with a fixed `cta-solid` className and `size="lg"` default.
Its own doc comment states it's modeled on `BottomCTASection.tsx` and is
explicitly not for navbar/filters/icon-only/destructive/status controls.
Used in exactly 4 places: its own definition, `BottomCTASection.tsx` (the
actual landing-page CTA — the hero section, `KretopiaHero.tsx`, has **no**
button at all, zero CTA), `StudioProjectsDashboard.tsx`, and
`StudioCreateHero.tsx`. Studio's two primary CTA surfaces already correctly
reuse the canonical component — no work needed here per the spec's own
§17 rule.

## 11. Current role and permission model

`get_project_role()` (this session's own earlier work, already merged)
returns `owner | collaborator | client | creative | guest`, normalizing
legacy `collaborator`/`commenter` rows to `guest`. Storage: `project-files`
bucket has a documented history of flipping public/private several times
across migrations, and is **currently private**, gated by
`user_has_project_access((storage.foldername(name))[1]::uuid, auth.uid())`
on a `<projectId>/...` path convention — a sound current state. AI
authorization is uneven across functions — see §13 and §17.

## 12. Current payment visibility

Milestone/project financial RLS was hardened earlier this session (finding
1: `get_milestone_financials()`, `get_project_financials()`, role-conditional
column exposure). `canSeeMoney` gating on the dashboard is present in code
but unwired (§8). Finance action buttons (`FinanceHub.tsx` etc.) use plain
`outline`/`ghost` variants — not yet touched by any CTA redesign, which is
correct (payment actions shouldn't get the loud Studio-hero CTA treatment).

## 13. Current AI context model

Uneven authorization across the AI surface:
- `desk-agent` and `scope-guardian` (this session's earlier fix): check
  `user_has_project_access` before touching project data. `desk-agent`'s
  invoice/quote tools only ever create `status: "draft"` rows — no
  autonomous send/charge found. Collaborator add/remove is **delegated** to
  `copilot-collaborator-tools` under the caller's own JWT — that function was
  not itself read in this pass; flagged as an open item (§20).
- `studio-ingest`: has its own separately-implemented (but equivalent)
  membership check, not the shared RPC.
- `thrive-ai-chat`: reads project-scoped `studio_facts`/`studio_entities`
  with **no explicit membership check** — relies entirely on RLS on those two
  tables. Not independently confirmed in this pass that RLS actually
  enforces per-project membership there — open item.
- `elevate-brief` / `extract-brief`: **no auth check of any kind**. Lower
  real risk than it sounds because neither function persists anything
  itself (all writes happen client-side, per §7/§17), but it does mean
  anyone with the anon key can invoke Kreto's AI drafting logic directly,
  off-platform, for free.

## 14. Files that will change (once a plan is approved)

Best current guess, subject to the open decisions in §20:
`BriefDropZone.tsx` (copy fix + review-step gate), `StudioPulseFeed.tsx`
(copy fix), `elevate-brief/index.ts` + `extract-brief/index.ts` (add auth),
`WorkspaceSidebar.tsx` (creation-flow consolidation, once #1 is decided),
`useProjectData.ts` (cancellation/clear-on-switch guard), possibly
`StudioProjectsDashboard.tsx`/`StudioCardsGrid.tsx` (wire `canSeeMoney`, add
deadline, reconcile empty-state copy) if the six-phase model is pursued:
`useProjectFlow.ts`, `StudioRoom.tsx`, and a new migration touching
`projects.status`/phase representation.

## 15. Files that must not change

`src/components/Navbar.tsx` (confirmed already correct, per spec's explicit
instruction not to touch it), `src/components/ui/cta-button.tsx` and
`src/components/landing/BottomCTASection.tsx` (canonical CTA — reuse, don't
fork), `src/components/landing/KretopiaHero.tsx` (out of scope — this
overhaul is Studio, not the marketing landing page), any `supabase/functions`
already carrying this session's IDOR fixes (`scope-guardian`, `desk-agent`)
— don't regress those checks while touching adjacent code.

## 16. Database / migration impact

`projects.status` has a live `CHECK` constraint (original migration,
`20250930110444`) allowing only `active/completed/paused/cancelled` — but
application code (`studioCardHelpers.ts`) already reads/ranks additional
values `planning`/`wrapping`/`archived` that no later migration was found
widening the constraint for. **This needs a live-DB check before any phase-
model work starts** — either the constraint was already altered by a
migration this audit didn't surface, or those values are currently unwritable
and the app code paths that reference them are dead. Not verified either way
in this pass (no live DB query access available to me). Any six-phase model
(spec §6) would need its own real migration plus an explicit legacy-status
mapping table, which the spec itself anticipates
(`STUDIO_ROOM_PROGRESS_MODEL.md`).

## 17. Security risks

1. `elevate-brief` / `extract-brief` — zero auth check (§13).
2. `BriefDropZone`'s `elevate-brief` pipeline auto-applies AI output with no
   review/confirm gate — a bad or adversarial file can silently rewrite real
   project data (§7). This is the most concrete, fixable finding in the
   whole audit.
3. `thrive-ai-chat` relies on RLS alone for project-scoped reads — not
   independently confirmed sufficient (§13).
4. `canSeeMoney` unwired on the dashboard — low real risk today, but a false
   sense of a role check if left as-is (§8).
5. `projects.status` CHECK-constraint / app-code mismatch — data-integrity
   risk, needs live verification before touching (§16).
6. `copilot-collaborator-tools` (backing `desk-agent`'s add/remove
   collaborator tools) was not audited in this pass — must be checked before
   any change that could let Kreto invite collaborators with less friction,
   given the spec's explicit "must not silently invite collaborators" rule.

## 18. Test plan

One real behavioral suite exists today:
`StudioProjectsDashboard.test.tsx` (6 cases, including a "no 'Loose'"
regression guard). Zero tests exist for `VoiceFirstCreateModal`,
`StudioRoom`, `BriefDropZone`, `WorkspaceSidebar`, `ThriveDesk`, `WorkHome`.
Once a plan is approved: add tests for the New Room prompt→review→create
flow (empty/invalid input, draft persistence, explicit-confirm-required),
a Drop Zone test asserting `elevate-brief` output requires confirmation
before any DB write (once that gap is closed), and an auth-check test for
`elevate-brief`/`extract-brief` (once auth is added). Baseline gate before
any implementation: `npm run typecheck && npm run lint && npm run build &&
npm run test` — not run again in this pass since no code changed.

## 19. Browser verification plan

Once implementation is approved: dev server already running at
`localhost:8080`. Verify `/desk` hero + dashboard, `/desk/:id` sidebar +
StudioRoom + project-switching (no stale-data flash), New Room prompt→review
→create, Drop Zone review-gate, at the breakpoints listed in the spec's §20
(375×667 through 1440×900), light/dark, reduced-motion, and a real two-account
negative test for any authorization change (matching this session's existing
"real JWT, not service-role" standard).

## 20. Open product decisions (need your call before Phase 2 starts)

1. **Two creation flows coexist**: `VoiceFirstCreateModal` (everywhere in
   WorkHome/palette) vs `CreateProjectWizard` (only via `WorkspaceSidebar`'s
   own "New Project" button). Retire the wizard in favor of the modal
   everywhere, or keep both intentionally?
2. **Three unrelated "progress" concepts already exist**: the 8-stage
   `PROJECT_FLOW_STAGES` timeline, `StudioRoom`'s freeform per-user widget
   order, and the DB's plain `status` string. The spec's 6-phase model would
   be a fourth. Which becomes canonical, and how do the other three get
   folded in or removed?
3. Should the `BriefDropZone`/`StudioPulseFeed` "Thrive" → Kretopia copy fix
   ship as its own small, immediate, zero-risk change regardless of the
   larger overhaul's timeline?
4. Is `elevate-brief`'s auto-apply-with-no-review behavior something to fix
   as part of this overhaul (the spec requires it), or is it intentionally
   grandfathered for now?
5. Should `canSeeMoney` be wired up properly on the dashboard, or is the
   prop dead code to remove (current call site is always the owner's own
   view, so it may never matter in practice)?
6. Need the live `projects.status` constraint confirmed against the actual
   database before committing to any phase-model migration design (§16) —
   I don't have live query access this session; either you check it or I
   need it granted.

---

### Note on repo sync

This session's local branch was 12 commits behind origin when this pass
started, including a from-scratch, independently-driven redesign of
`VoiceFirstCreateModal.tsx` made directly in Lovable's editor (same file
this session had also just been reworking). Rather than push over that or
silently discard my in-session edits, I stashed my local working-tree
changes (`git stash` — recoverable, not deleted) and fast-forwarded onto
origin's tip, since the local history was a clean ancestor (no real merge
conflict at the commit level). Everything in this audit was read against
that current, pulled state.

**No application code was edited in this pass. Waiting for direction before
Phase 2.**
