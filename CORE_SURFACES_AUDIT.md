# Core Product Surfaces V2 — Phase 0 Audit

Charter: "Kretopia — Core Product Surfaces V2 — Today, Studio, Scout and Passport," executed on `feature/activation-priority-plan`, continuing directly from the Landing Page V2 work already committed on this branch.

## Baseline gates

- `git status` — clean except the pre-existing, untouched `supabase/functions/mcp/index.ts` modification present since before this session's charters began.
- `npx tsc --noEmit -p .` — clean, zero errors.
- Build/lint/test baselines are unchanged from the last full run this session (62/62 tests, clean build, no new lint issues) — re-verified per-phase as each change lands, not re-run wholesale here since nothing has changed yet.

## Route confirmation

- `/` → `DefaultRoute` → `UnifiedHome.tsx`. For authenticated users this is **Today** (the `{user && (...)}` branch, lines 484–605). The guest branch is `KretopiaLanding` — a different, already-redesigned surface (Landing V2 charter) — out of scope here.
- `/desk` → `WorkHome.tsx`, `ProtectedRoute`-wrapped. Branches on `account_type`: `CreatorWorkHome` (individual — **Studio**, in scope) vs `BrandWorkHome` (company — out of scope, same pattern as Charter C's earlier scoping decisions).
- `/scout` → `Scout.tsx`, not `ProtectedRoute`-wrapped (public route).
- `/profile` → `Profile.tsx`, `ProtectedRoute`-wrapped. Branches on account type: company → `CompanyProfileView` (out of scope), individual → `PassportHero` + supporting sections (**Passport**, in scope).

## Critical pre-work finding: Share Passport is already correctly wired

Traced `onShare={handleShare}` (`Profile.tsx:537`, the individual/creator branch) → `ProfileDialogs.tsx` → `PassportShareSheet` (`defaultOpen={isShareDialogOpen}`) — **the centered Liquid Glass modal with WhatsApp/LinkedIn/X/Instagram/Email/Copy/QR built in the previous charter's Phase 8 is already the modal this button opens.** The separate `ShareProfileDialog` component only renders in the company-account branch (`Profile.tsx:380`, a different, out-of-scope surface) — it is not a competing or stale share flow for the individual Passport.

This means Phase 1's "Share Passport CTA" work in this charter is **styling-only**: the button at `PassportHero.tsx:310-313` currently renders `bg-[hsl(var(--signal-teal))] text-black` — despite the CSS variable's name, `--signal-teal` is defined as `327 100% 59%` (`src/index.css:75`), i.e. the actual brand pink `#FF2DA1`, not teal. This is the "loud pink fill" the charter wants replaced with a neutral dark Liquid Glass style. The modal itself needs no changes.

## Surface-by-surface classification

### Today (`UnifiedHome.tsx` authed branch, 636 lines total, 14 sections)

| # | Section | Verdict | Why |
|---|---|---|---|
| 1 | `FeaturePageHeader` | **KEEP** | Already the shared header system; title "Today. / Your command center for right now." is already close to the charter's "What are we moving forward today?" intent — will retitle, not rebuild. |
| 2 | `ThrivePromptHero` | **KEEP, becomes entry point of TodayCommandCenter** | Real conversational intent router — exactly the charter's "Searchbar"/primary-action surface. |
| 3 | `TodayThreeCards` | **MERGE into TodayCommandCenter** | Already the "≤3 cards" glanceable summary — becomes the command center's priority-1/2 rows rather than a separate block. |
| 4 | `KretoTip` | **MERGE into TodayCommandCenter** | Contextual whisper — folds into the "recommended next action" surface. |
| 5 | `UpcomingSessionsCard` | **MOVE TO SECONDARY PANEL** | Real, self-hiding data; belongs in "today's schedule" priority tier, not a standalone top-level card. |
| 6 | `SoundStagesSection` | **MOVE TO SECONDARY PANEL** | Same — "today's schedule" tier, already self-hides when empty. |
| 7 | `SpeedTonightCard` | **MOVE TO SECONDARY PANEL** | Same tier as above. |
| 8 | "People for you" rail | **CONVERT TO CAROUSEL** | Currently a manual `overflow-x-auto` flex row, not the real `Carousel` primitive — opportunities tier, and a good candidate for the established `Carousel`/`CarouselPositionDots` pattern already used elsewhere (`LooseProjectsCarousel`, Studio's collaborators rail). |
| 9 | `DailyBriefingCard` | **MOVE TO SECONDARY PANEL** | Real EP-briefing data; supporting-information tier. |
| 10 | `SurfaceProactiveCards` | **MERGE into TodayCommandCenter's action list** | Real `agent_proposals` data — this *is* the "recommended next action" data source the charter describes; should feed the command center's priority-2 tier directly rather than rendering as its own separate card block. |
| 11 | `DuplicateAccountBanner` | **KEEP as-is** | Security/account-integrity banner, already conditionally hidden — not a candidate for merging into a content carousel. |
| 12 | `GetStartedChecklist` | **KEEP as-is** | Onboarding-specific, already conditional on completion %. |
| 13 | `<details>` "More from today" (MorningPulse/ApprovalsHub/ScoutedGigsSection/MoneyBrief/TrendingLane) | **KEEP structure, feed priority ordering** | This collapsible is already the right instinct (compact by default, expandable) — becomes the command center's "supporting information" tier 6, not rebuilt. |
| 14 | `PushNotificationPrompt` | **KEEP as-is** | Cooldown-gated system prompt, unrelated to page content architecture. |

**Data preserved, none deleted**: every Supabase table/RPC/edge-function listed in the full audit (`profiles`, `credits`, `opportunities`, `agent_proposals`, `invoices`, `project_tasks`, `scouted_gigs`, `speed_session_rsvps`, `speed_sessions`, `ep_daily_briefings`, `outreach_drafts`, `expenses`, `credit_vouches`, `projects`, `get_unread_message_count` RPC, etc.) continues to be read by the same components — `TodayCommandCenter` is a **layout/priority wrapper**, not a data-fetching rewrite.

### Studio (`WorkHome.tsx` → `CreatorWorkHome`, 813 lines)

| Surface | Verdict | Why |
|---|---|---|
| Title/header | **KEEP** | `FeaturePageHeader` already correct ("Studios. / Your project rooms, run end to end."). |
| "New project" entry (`VoiceFirstCreateModal`) | **REBUILD (Phase 3)** | Charter explicitly targets this — current headline "What are you making?" / "Pick the kind of room — or just speak" doesn't match the charter's guided, staged flow. Real rebuild target, not a copy tweak. |
| Folder navigation (`StudioFoldersBar`) | **KEEP** | Real CRUD against `studio_folders`, drag-and-drop filing — functioning, not duplicated elsewhere. |
| `LooseProjectsCarousel` / `StudioCardsGrid` | **KEEP** | Already correctly implemented in the prior charter (carousel for unfoldered projects when folders exist, grid fallback otherwise) — no changes needed here. |
| No left sidebar currently exists | **NEW — StudioControlRail (Phase 4)** | Charter asks to "replace the current left sidebar" but none exists today; this is net-new navigation infrastructure, to be added without removing any existing single-column content — the rail is additive, existing sections stay reachable. |
| "Session & Activity" / "Casting & Collaborators" `SectionCard` blocks | **MOVE TO SECONDARY PANELS under StudioControlRail** | Real data (`SoundStagesRail`, `SpeedTonightCard`, `TodayStrip`, `MyPendingInvitations`, `CastingCallsRail`, `RecentRecordingsRail`, collaborators carousel) — reorganized under the new rail's sections, not deleted. |
| Collaborators carousel (`get_project_people` RPC) | **KEEP** | Already the real `Carousel` primitive with reduced-motion support — reference pattern, not a rebuild target. |

### Scout (`Scout.tsx`, 132 lines)

| Surface | Verdict | Why |
|---|---|---|
| `FeaturePageHeader` + tutorial | **KEEP** | Already shared-system correct from the prior charter's Phase 1+6 work. |
| 3-tab structure (For You / Shortlist / Open Gigs) | **KEEP structure** | Real, functioning, URL-synced. |
| First viewport is a feed, not one dominant opportunity | **CONVERT primary tab content** | Charter wants "one strongest opportunity... why it matches... apply/save/dismiss... one next recommended action" as the first viewport, with secondary opportunities in a carousel. `ScoutedGigsSection` (652 lines, out of this audit's read-depth) is the actual feed component — Phase 5 work scoped to Scout.tsx's presentation layer plus a light pass on `ScoutedGigsSection`'s top-of-feed treatment, not a rewrite of its data logic. |
| Secondary nav links (Circle/Talent Scout) | **KEEP** | Real, functioning cross-links. |

### Passport (`Profile.tsx` + `PassportHero.tsx` + `HoloCard.tsx`)

| Surface | Verdict | Why |
|---|---|---|
| `FeaturePageHeader` title | **VERIFY/FIX centering (Phase 1)** | Charter requires centered, one-line-when-possible. Current `FeaturePageHeader` renders left-aligned by default (matches Scout/Studio/every other route) — this is a **Passport-specific deviation** the charter explicitly asks for, not a shared-component change (must not regress the other 15+ routes using the same header). |
| `HoloCard` + `PassportHero` (3D card) | **KEEP as the dominant surface** | Already exactly what the charter wants — real 3D tilt, real data, real Passport Strength meter, real trust signals. No rebuild needed. |
| Share Passport button | **RESTYLE ONLY (confirmed above)** | Pink fill → neutral dark Liquid Glass. Modal itself (`PassportShareSheet`) already correct, unchanged. |
| `KretoActionCenter` | **KEEP** | Already the "one personalized next action" surface the charter asks for. |
| `TrustOpportunityCenter` | **KEEP** | Already a merged, compact section (per its own docstring, merges three older components). |
| `ProfileContentSections` (Credits/Reviews/CoSigns/Skills/ICDBTimeline/WorkWithMe/RateCard/Availability/BookingWindows) | **KEEP, no changes** | Real business data and flows — charter's "supporting sections" requirement is already satisfied structurally; not a card-wall (each is a distinct, real data type, not a duplicate stat). |

## Do-not-touch confirmation

No RLS, authentication, payment-processing, migration, or secret-handling code exists in any file classified above. `handleShare`, `PassportShareSheet`'s Supabase-free share-link generation, and every data-fetching hook listed are *consumed*, not modified structurally — only presentation-layer wrapping (Today), a scoped rebuild (Studio New Room), new navigation chrome (Studio control rail), presentation reordering (Scout), and CSS/className changes (Passport Share button, Passport header centering) are in scope.

## Phase 4 correction: the "overloaded left sidebar" is on `/desk/:projectId`, not `/desk`

Phase 0's audit only covered `/desk` (`WorkHome.tsx` → `CreatorWorkHome`), which has no left sidebar at all — a single-column layout. The charter's Phase 4 description ("overloaded left sidebar," "replace with StudioControlRail") describes `ThriveDesk.tsx` (`/desk/:projectId`, the individual project workspace), a distinct route not in the charter's explicit test list but clearly the intended target based on the description matching its actual layout.

Investigated `ThriveDesk.tsx` (376 lines) directly: it already has —
- `WorkspaceSidebar` — a collapsible left project switcher (persists open/closed state in `localStorage`, mobile overlay + `-translate-x-full`/desktop `lg:w-0` collapse, real project list with status dots, active-project highlighting).
- `StudioToolBar` — a compact breadcrumb-style tool switcher (`← Studio / {Tool} ▾`) whose own code comment says it "*Replaces the busy horizontal tab strip with a clean, focused header*" — i.e. a prior pass already did the exact consolidation this charter's Phase 4 asks for. Tool list is dynamically resolved per workspace/deal type via `resolveTabs()`, with unread-count badges on Tasks/Messages.
- `WorkspaceQuickPanel` — a collapsible right-side quick-info rail (`w-80`, `xl:` only), independent toggle.
- `ProjectFlowTimeline` + `NextStepBar` — a real per-project stage timeline (e.g. Discussion → Scope & Brief → Tasks → Work Upload → Review & Approval → Agreement) with one clear next-action CTA, shown in the "Studio Room" (pinned-stage) view.

This is a real, working, already-consolidated navigation system — not a stray sidebar needing replacement. Building a new `StudioControlRail` component here would **duplicate** this system, directly violating the charter's own "avoid duplicated navigation" rule. Live-verified at `/desk/:projectId`: sidebar toggle works, flow timeline and next-step bar render with real project data (stages, "Kick off the conversation" next action), no console errors introduced.

**Decision: Phase 4 requires no new component.** The charter's specific asks (collapse on mobile, project switcher, active-route context, unread indicators, keyboard accessible, avoid duplicated navigation, expandable panels instead of showing everything at once) are already satisfied by the existing `WorkspaceSidebar`/`StudioToolBar`/`WorkspaceQuickPanel`/`ProjectFlowTimeline` combination. No code change made for this phase — this finding itself is the deliverable, following the same evidence-first approach used for Admin and EPK in the prior charter.

## Plan for phases 1–9

Proceeding phase-by-phase, committing after each, starting with Phase 1 (Passport — the lowest-risk, most explicitly-scoped work: header centering + Share CTA restyle, both pure presentation changes with an already-correct data/modal layer underneath).

## Phase 5 finding: Scout's opportunity feed already implements the "one dominant match + carousel" pattern

Read `ScoutedGigsSection.tsx` (652 lines) in full — the component this audit's Phase 0 pass didn't go deep enough into. Its default (no `limit` prop) render path, used by `Scout.tsx`'s "For You" tab, already implements almost exactly what the charter's Phase 5 asks for:

- **One strongest opportunity first** (lines ~417-481): `gigs[0]` (list is queried `order("fit_score", { ascending: false })`, so index 0 is genuinely the best match, not an arbitrary pick) rendered as a distinct hero card — "Strongest match" badge, title, fit-score badge, company/location/remote line, a "Why this fits you" reasoning block driven by real `fit_reason` data, and three real actions (View full brief, Save, Dismiss).
- **Secondary opportunities in a real carousel, not a grid** (lines ~484-499): `gigs.slice(1)` rendered in a `Carousel`/`CarouselContent`/`CarouselItem` with real `CarouselPrevious`/`CarouselNext` (glass variant) and `CarouselPositionDots` — the same established pattern used elsewhere (Today's "People for you", Landing's chapter carousels).
- **Consistent shared chrome**: `Scout.tsx` already uses `FeaturePageHeader` with a real tutorial (`SCOUT_TUTORIAL`), matching Today/Studio/Passport.
- A separate `limit`-prop render path (used for compact embeds, e.g. a "More from today" rail) intentionally skips the hero treatment — correct, since a compact embed shouldn't repeat a full hero card.

**Two genuine, scoped gaps found and fixed** (not a rebuild):

1. The strongest-match hero card didn't surface compensation/budget when available, despite the charter asking for "budget where available." Added a `compensation` segment to the card's company/location line — but discovered live that some rows store the literal string `"Not specified"` instead of `null`, which would have shown as noise. Added a `hasRealCompensation()` guard (regex-filters `"not specified"/"unspecified"/"n/a"/"tbd"/"none"/"unknown"/"-"`) used both on the new hero-card line and the existing detail-modal "Comp" row, so placeholder strings never render as if they were real data.
2. `SCOUT_TUTORIAL` (`tutorialContent.ts`) had 4 steps that merged "save or dismiss" and "apply" into one step ("Save or apply") and never mentioned that applying is Passport-informed (the existing `draftLetter` flow already drafts a cover letter from the user's real Passport/history via the `draft-gig-application` edge function — this was true before this change, just not stated in the tutorial). Split into the charter's exact 5 steps: Discover an opportunity → See why it matched → Save or dismiss → Apply with your Passport → Move into a project. Live-verified via the "How Scout works" modal — all 5 steps render correctly with the updated copy.

Explicitly **not** added: a "deadline" field. `expires_at` exists on `scouted_gigs` but is used purely as an internal listing-expiry TTL, not a sourced application deadline — surfacing it as "Deadline: [date]" would fabricate information the source posting never stated, which the charter explicitly prohibits ("never fabricate... deadline").

**Decision: no `ScoutedGigsSection` rebuild, no new component.** Verified live at `/scout` (authenticated): hero card renders with a real gig ("Pitching Forum x MTN Presentation Open Call", 85% fit, real fit_reason, Bali/Indonesia location), secondary carousel present, tutorial shows all 5 updated steps, no console errors introduced (only the pre-existing baseline 401/404 noise from unrelated Supabase calls). `npx tsc --noEmit`, `eslint` on both changed files, `npm run build`, and `npm run test -- --run` (62/62) all pass.

## Phase 7 finding: responsive sweep passes at 375/768/1440px on all four surfaces — no code changes needed

Live-tested Passport (`/profile`), Today (`/`), Studio (`/desk`), and Scout (`/scout`) at 375px (mobile), 768px (tablet), and 1440px (wide desktop), all authenticated. `document.documentElement.scrollWidth === clientWidth` (no horizontal overflow) confirmed at every breakpoint on every surface.

- **Passport**: title ("Passport. Your work, verified.") wraps to a clean 2-line centered block at 375px and resolves to a single centered line by 768px — matches "centered, one-line-when-possible." The 3D Creative Passport card renders stably with no clipping at any width; at 1440px the layout stays centered/focused rather than stretching wide, consistent with "one dominant surface, not a sprawling grid."
- **Today**: greeting headline, subtitle, tutorial trigger, and the Kreto prompt panel with its searchbar are all above the fold at 375px — no card overload before the first scroll. No overflow at any width.
- **Studio**: `/desk` index (folders, "New project," studio rooms list) reflows cleanly at all three widths with no overflow. (The nested `/desk/:projectId` workspace's control-rail mobile behavior — `WorkspaceSidebar` collapsing to an overlay — was already live-verified in the Phase 4 finding above; not repeated here since that route isn't in the charter's Phase 0 test-route list.)
- **Scout**: at 375px the strongest-match hero card stacks vertically (image above, title/reasoning/actions below) with View full brief/Save/Dismiss all reachable without horizontal scroll. At 768px+ it correctly switches to the side-by-side `sm:flex` layout. No overflow at any width.

**Decision: no code changes required for Phase 7.** The responsive behavior across all four surfaces was already correct — a byproduct of the mobile-first Tailwind patterns and the earlier Phase 1 title-centering fix — so this phase closes as a verification-only pass.

## Phase 8 finding: accessibility fixes (duplicate H1, keyboard access) + one performance fix (duplicate query); lazy-load suggestion declined

Delegated a scoped read-only audit against the four surfaces for the charter's Phase 8 accessibility/performance rule. Most of the surface area was already correct (Radix-based `Dialog` for all modals with focus-trap/Escape/aria handled automatically, gigs fetched in one batched query with lazy image loading, `HoloCard` is pure CSS/transform with no canvas/3D library needing lazy-load, `CreatorWorkHome`'s own clickable rows already use real `<button>` elements). Two real accessibility issues and one real performance issue were found and fixed:

1. **Two H1s on `/profile`**: `FeaturePageHeader` already renders the page's title as an `<h1>`, but `PassportHero.tsx` independently rendered the user's display name as a second `<h1>`. Changed to `<h2>` — `FeaturePageHeader`'s title remains the page's sole H1. Live-verified: `document.querySelectorAll('h1')` now returns exactly one element on `/profile`.
2. **Scout gig cards unreachable by keyboard**: both `ScoutedGigsSection.tsx`'s standard `renderGigCard` and the "strongest match" hero card were bare `onClick`-only `<div>`s with no `role`, `tabIndex`, or keyboard handler — a mouse-only interaction. Added `role="button"`, `tabIndex={0}`, an `onKeyDown` handler (Enter/Space triggers the same `openDetail`), a descriptive `aria-label`, and a `focus-visible` ring. Live-verified the hero card now reports `role="button"`, `tabIndex=0`, and the expected label via `document.querySelector`.
3. **Duplicate `profiles` query on Today**: `UnifiedHome.tsx` fired two separate `supabase.from("profiles").select(...)` queries for the same `user_id` in the same `Promise.all` — one for a narrow 4-column select, one for the full `PROFILE_SELECT` column list. Confirmed `PROFILE_SELECT` is a strict superset of the narrow query's columns, so the narrow query was pure waste. Removed it; both `profile` and `profileFull` state now come from the one remaining query. Live-verified Today still renders correctly (greeting, Kreto prompt panel, Next Move/Opportunity/Money Signal cards) with no console regressions.

**One suggestion investigated and declined**: the audit flagged that `UnifiedHome` (the `/` route) isn't wrapped in `React.lazy()` unlike every other route. This is a defensible existing choice, not a bug — `/` is the very first route nearly every visitor hits (both the guest landing and the authenticated Today view), and lazy-loading the entry route would add a network round-trip (fetch the route chunk, then render) with no benefit, since that code has to load immediately regardless. Lazy-loading pays off for less-frequently-visited deep routes, which is exactly how the rest of the app already uses it. No change made.

**Also investigated and correctly out of scope**: the audit initially flagged several keyboard-inaccessible clickable `<div>`s in `WorkHome.tsx` (stat tiles, "Active Listings" rows, "Find Talent" card). Traced these to `BrandWorkHome` (the company/brand account branch, lines 109-351) — not `CreatorWorkHome` (the actual Studio surface in scope for this charter, lines 352-787), which was already confirmed to use real `<button>` elements throughout. No change made there, consistent with this charter's established company-branch-out-of-scope boundary.

`npx tsc --noEmit`, `eslint` diff-check on all three changed files (33 pre-existing problems before and after, zero new), `npm run build`, and `npm run test -- --run` (62/62) all pass.

## Phase 6 finding: shared tutorial/animation architecture already reused correctly; two narrow offscreen/reduced-motion gaps fixed

Delegated a scoped read-only audit across the four core surfaces' full component trees (Today/`UnifiedHome.tsx`, Studio/`WorkHome.tsx`+`ThriveDesk.tsx`, Scout/`Scout.tsx`+`ScoutedGigsSection.tsx`, Passport/`Profile.tsx`+`PassportHero.tsx`+`HoloCard.tsx`) against the charter's Phase 6 rule (reuse `TutorialStepper`/`FeatureTutorialPanel` only, no separate per-route animation systems, purposeful motion only, stop offscreen, respect reduced-motion, static fallbacks).

**Confirmed compliant, no changes needed:**
- All four surfaces route through the same shared stack: `FeaturePageHeader` → `FeatureAITutorial` → `TutorialStepper`. No bespoke tutorial system found anywhere; a prior `OnboardingTour` was already removed in favor of this (`src/App.tsx`).
- Nearly every `animate-*` usage found across the four trees is purposeful (loaders, skeletons, live/unread/availability status dots) rather than decorative, and a global `@media (prefers-reduced-motion: reduce)` rule in `src/index.css` already collapses native CSS animation durations app-wide as a baseline safety net.
- No layout-shift risk found — all animations use `transform`/`opacity`/`filter`, not properties that trigger reflow.
- `HoloCard.tsx`'s pointer-tracked 3D tilt already correctly disables itself under `prefers-reduced-motion` and on non-hover/touch devices.

**Two genuine, narrow gaps found and fixed:**
1. `HoloCard.tsx`'s two decorative infinite CSS animations (`ai-ambient-breathe` ambient glow, `ai-scan-line` scan sweep) had no offscreen-pause mechanism — they kept animating indefinitely even when the card scrolled out of view. Added an `IntersectionObserver` on the card's existing tilt-tracking ref and set `animationPlayState` to `paused`/`running` based on visibility. Live-verified at `/profile`: both elements report `animationPlayState: "running"` in view and `"paused"` after scrolling the card fully offscreen.
2. `HeroPhoneCarousel.tsx` (the guest landing hero's rotating product-screen carousel) had a `setInterval` auto-rotate and Framer Motion screen-transition that never checked `useReducedMotion()` — a real violation of "respect reduced-motion settings," and Framer Motion's WAAPI-driven transitions aren't covered by the global CSS media-query safety net (that only catches native CSS `animation`/`transition`). Fixed by gating the interval (skips entirely when reduced motion is on, leaving the carousel on its first screen — the dot controls below still allow manual stepping) and setting the Framer Motion transition duration to 0 with no enter/exit offset when reduced motion is on, matching the pattern already used by every `Carousel` component in this codebase (`duration: reducedMotion ? 0 : 20`).

`npx tsc --noEmit`, `eslint` on both changed files, `npm run build`, and `npm run test -- --run` (62/62) all pass.
