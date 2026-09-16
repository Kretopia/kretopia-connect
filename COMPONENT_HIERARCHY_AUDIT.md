# Kretopia — Component Hierarchy & Information Architecture Audit

Scope: read-only audit of the live source for the core-loop routes plus Admin, Auth, Landing, and Public Passport. No source files were modified. All file paths are relative to the repo root (`/Users/noeplantier/thrivein-new-beta`). Line numbers reflect the state of the files at audit time and will drift as the code changes.

Method: each page's actual `.tsx` was read in full; one level of child-component imports was followed wherever the page delegated its primary or secondary surface to a component (e.g. `FeaturePageHeader`, `TodayCommandCenter`, `ThrivePromptHero`, `KretoActionCenter`, `LiveCallsPanel`, `EPKFooterCTA`). Claims are cited to file + line.

---

## Summary table

| Route | File(s) | Primary goal | Major issues found | Severity |
|---|---|---|---|---|
| Today | `src/components/home/UnifiedHome.tsx` | Give a signed-in user one screen answering "what should I do right now" | 3 (duplicate H1/greeting, dense collapsed "More from today" drawer, guest/auth branch complexity) | minor |
| Studio (list) | `src/pages/WorkHome.tsx` | Show/create project rooms ("Studios") and jump into one | 2 (two near-identical dashboards forked by account type; empty-state CTA duplicated in two places) | minor |
| Studio (room) | `src/pages/ThriveDesk.tsx` | Work inside one specific project room | 1 (no real error state distinct from not-found; otherwise clean) | minor |
| Scout | `src/pages/Scout.tsx` + `ScoutedGigsSection.tsx` | Find a gig (or pivot to hiring/collaborating) | 2 (three cross-links out of the page compete with the tabs; "Scan now" async action has weak progress feedback beyond a timer) | minor |
| Passport | `src/pages/Profile.tsx` + `PassportHero.tsx` | See and strengthen your one verified creative record | 3 (next-action shown twice — PassportHero + KretoActionCenter; five stacked entry banners before the hero; AI entry point duplicated in concept with KretoTip elsewhere) | moderate |
| Kreto | `src/pages/KretoTab.tsx` + `InlineKretoChat.tsx` | Talk to the AI Executive Producer and act on real account context | 1 (page reimplements the FeaturePageHeader pattern inline instead of reusing the shared component) | minor |
| Messages | `src/pages/Messages.tsx` | Read/send messages to a connection | 0 — clean 3-tier layout (list / thread / empty state) | none |
| SoundStages/Circle | `src/pages/Circle.tsx` + `LiveCallsPanel.tsx` | Join or start a live session, or find people | 2 (duplicate "Stages" heading — H1 in header, H2 "SOUND STAGES" one screen below; Match/Network/Browse are sheets, not visibly distinguished from the live content underneath) | minor |
| Admin | `src/pages/Admin.tsx` | Internal ops console for the team | 1 (System tab mixes destructive/expensive bulk actions — broadcast email, AI discovery, ODOS import — with no confirmation step) | minor (internal tool, but flagged) |
| Landing (skim) | `src/components/landing/kretopia/LandingBelowFold.tsx` | Explain the product loop to a signed-out visitor | — | not scored (skim only, per instructions) |
| Auth | `src/pages/Auth.tsx` | Sign in or sign up | 1 (two parallel signup paths — "claim" flow and "classic" wizard — behind a small text toggle, easy to miss) | minor |
| Public Passport | `src/pages/HandleResolver.tsx` + `src/pages/CreatorEPK.tsx` | Let an outside visitor see one creator's public press kit and act (claim/hire/connect) | 2 (unclaimed-profile "Claim" CTA duplicated: mid-page banner + sticky footer; no "Message" CTA for signed-in non-owner visitors) | moderate |

No route was found to have fabricated/placeholder data standing in for real Supabase queries (see per-route "Data source" notes) except where explicitly called out as social-proof simulation on the guest landing hero (out of the 13-point scope, noted under Today/general below).

---

## Today — `src/components/home/UnifiedHome.tsx`

**1. Primary goal:** Give a signed-in user a single screen that answers "what's my next move, my top opportunity, and my money signal today."

**2. Primary component(s):** `TodayCommandCenter` (`src/components/home/TodayCommandCenter.tsx`) is the layout shell; inside it, `entry={<ThrivePromptHero/>}` (the AI composer, `src/components/home/ThrivePromptHero.tsx`) and `nextAction={<TodayThreeCards/>}` (`src/components/home/TodayThreeCards.tsx`) together form the dominant surface — UnifiedHome.tsx:501-509.

**3. Secondary component(s):** `schedule` slot (UpcomingSessionsCard, SoundStagesSection, SpeedTonightCard, UnifiedHome.tsx:510-517), `opportunities` slot (a "People for you" carousel built inline, UnifiedHome.tsx:518-570), and a collapsed `<details>` "More from today" drawer holding MorningPulse, ApprovalsHub, ScoutedGigsSection, MoneyBrief, TrendingLane (UnifiedHome.tsx:588-600).

**4. Duplicated components / redundant cards:** The page's `FeaturePageHeader` renders an `<h1>` "What are we moving forward today?" (UnifiedHome.tsx:493-499, via `FeaturePageHeader` title/accentTitle props, `src/components/features/FeaturePageHeader.tsx:77-85`). Immediately below it, `ThrivePromptHero` renders its own `<h1>` with nearly identical copy: "What are we / moving forward today?" (`src/components/home/ThrivePromptHero.tsx:324-328`). Two literal `<h1>` elements with the same sentence stacked back-to-back on one page.

**5. Hidden but important actions:** The "More from today" block (Pulse, Approvals, Scouted gigs, Money brief, Trending) is entirely behind a native `<details>` disclosure (UnifiedHome.tsx:588-600) — collapsed by default. Approvals in particular (`ApprovalsHub`) can represent agent actions awaiting the user's sign-off; burying pending-approval affordances behind a closed accordion under a card grid is worth flagging even though `TodayThreeCards`' "Next Move" card (`src/components/home/TodayThreeCards.tsx:131-146`) does surface the same approval count up top as a shortcut.

**6. Conflicting CTAs:** None found — the composer (ThrivePromptHero) and the three tap-targets (TodayThreeCards) route to different destinations and don't duplicate a single action.

**7. Data source:** Real Supabase queries throughout — `profiles`, `credits`, `opportunities`, `public_profiles_safe`, `creative_jams`, `connections` (UnifiedHome.tsx:204-289, 440-444), plus an edge function `get-onboarding-matches` for AI-ranked creator recommendations (UnifiedHome.tsx:410-421). One deliberately-simulated element exists but is guest-only and outside the 13-point scope requested (signed-in Today has no fabricated data): `ACTIVITY_TEMPLATES` (UnifiedHome.tsx:94-99) drives a rotating "X just claimed a credit…" ticker seeded from real first names (`activityNames`, UnifiedHome.tsx:386) — the names are real but the specific claimed action per tick is templated, not a real event feed. This ticker is part of the guest landing surface, not the authenticated Today view described in this section.

**8. Loading state:** Present. `ThrivePromptHero` and `TodayThreeCards` each self-manage their own fetch and render nothing (return `null`) until data resolves rather than a skeleton (`TodayThreeCards.tsx:106`); the guest landing path has an explicit `aria-busy` placeholder while auth resolves (UnifiedHome.tsx:477, 481). No single top-level skeleton for the whole Today surface — components pop in independently rather than a coordinated loading state, which is a deliberate choice per the code comment at UnifiedHome.tsx:487-490 ("don't wait for the profile fetch").

**9. Error state:** No explicit error UI for the dashboard-data fetch (UnifiedHome.tsx:200-402) — failures fall through silently (`.catch(() => {})` at UnifiedHome.tsx:397, and unguarded `await` elsewhere). A failed fetch presents as an empty section rather than a distinguishable error state.

**10. Empty state:** Handled per-component — e.g. `SoundStagesSection` returns `null` when `count === 0` (UnifiedHome.tsx:106-107); the "People for you" carousel only renders `opportunities` when `featuredCreators.length > 0` (UnifiedHome.tsx:519). No fabricated placeholder data found standing in for empty real data.

**11. AI-assisted behavior:** `ThrivePromptHero` is the AI entry point — free text or voice is routed via the `route-thrive-intent` edge function to one of: new Studio creation, People search, Gigs search, outreach/summarize/chat (opens Copilot), or Passport (`ThrivePromptHero.tsx:220-273`). Workspace creation (`create_workspace`) is a real side effect (inserts a row into `projects`, ThrivePromptHero.tsx:245-253) triggered directly from natural language with no separate confirmation step — the insert happens as soon as the router returns `create_workspace`. A "Plan mode" toggle exists (ThrivePromptHero.tsx:380-394) that defers to the Copilot's approval flow ("Thrive will wait for your approval before each step," line 399), but Plan mode is opt-in and off by default, so the default path can create a new project workspace from a single AI-routed message without an explicit "create this?" confirmation screen.

**12. Responsive behavior:** No obvious breakage. Grids and flex rows use `sm:`/`lg:` responsive variants throughout (e.g. UnifiedHome.tsx:500 `max-w-5xl px-4 sm:px-6`, the People-for-You carousel is `w-44` per-card inside a `Carousel` rather than a fixed-width row, UnifiedHome.tsx:533-536).

**13. Hierarchy classification:**
- Tier 1 (Primary surface): ThrivePromptHero + TodayThreeCards — correctly dominant.
- Tier 2 (Secondary): Schedule (UpcomingSessions/SoundStages/SpeedTonight) and Opportunities (People for you) — correctly subordinate, appear below the primary block.
- Tier 3 (Contextual actions): The "More from today" disclosure — correctly de-emphasized, though see finding #5 on Approvals.
- Tier 4/5 (Optional/background): No debug IDs or raw status enums rendered on this page.
- **Violation:** the duplicate `<h1>` (finding #4) is a Tier-1-vs-Tier-1 collision — two elements claiming the exact same "this is the page's main heading" role stacked within ~100px of each other.

---

## Studio — `src/pages/WorkHome.tsx` (list) and `src/pages/ThriveDesk.tsx` (room)

### WorkHome.tsx (`/desk`)

**1. Primary goal:** Show a creator's (or brand's) project rooms and let them create or open one.

**2. Primary component(s):** For individuals, the "New project" CTA button (WorkHome.tsx:540-557) followed immediately by `StudioCardsGrid` / `LooseProjectsCarousel` (project rooms). For companies (`BrandWorkHome`), the four-stat row (Posted/Active/Hired/Rating, WorkHome.tsx:221-241) plus the "Active Listings" `Widget`.

**3. Secondary component(s):** `StudioFoldersBar` (folder navigation), `SectionCard title="Session & Activity"` (SoundStagesRail, SpeedTonightCard, TodayStrip, MyPendingInvitations, WorkHome.tsx:687-704), `SectionCard title="Casting & Collaborators"` (CastingCallsRail, RecentRecordingsRail, recent-collaborators carousel, WorkHome.tsx:709-757).

**4. Duplicated components / redundant cards:** `WorkHome` forks entirely into two independent dashboard implementations — `BrandWorkHome` (WorkHome.tsx:110-350) and `CreatorWorkHome` (WorkHome.tsx:353-782) — selected by `account_type` (WorkHome.tsx:785-809). This isn't a bug, but it is two parallel, hand-maintained "studio home" layouts rather than one shared shell with role-specific slots — the "one dominant card" consolidation pattern used elsewhere (KretoTab, Passport) isn't applied here; each branch reinvents its own header/stat-row/CTA stack. Within `BrandWorkHome`, the empty-state CTA "Post your first opportunity" (WorkHome.tsx:246-251, inside the Active Listings widget) duplicates the always-visible "Post a Gig" button in the bottom action grid (WorkHome.tsx:316-319) — same action, offered in two places on the same screen when there are zero active listings.

**5. Hidden but important actions:** None found — folder drag-and-drop and the "New project" CTA are both visible by default.

**6. Conflicting CTAs:** None found within a single render path — the "New project" CTA (individual) and the stat cards/widgets each route to distinct places.

**7. Data source:** Real Supabase — `opportunities`, `applications`, `company_reviews` for BrandWorkHome (WorkHome.tsx:126-178); `projects`, `invoices`, `studio_folders`, and the `get_project_people` RPC for CreatorWorkHome (WorkHome.tsx:382-462).

**8. Loading state:** Present and honest — a dedicated `WorkHomeSkeleton` component with a `variant` prop (studio/hiring/shell) renders proportioned skeleton blocks matching the eventual layout (WorkHome.tsx:6-34), used at WorkHome.tsx:193, 465, 804.

**9. Error state:** None explicit — Supabase errors are not surfaced to the user in either branch (e.g. `fetchProjects().catch(() => setLoading(false))`, WorkHome.tsx:423 — a failed fetch just stops the loading spinner and shows an empty list, indistinguishable from "you have no projects").

**10. Empty state:** Honest — "Post your first opportunity" copy only shows when `activeOpps.length === 0` (WorkHome.tsx:244-251); the individual side has no fabricated placeholder projects.

**11. AI-assisted behavior:** `VoiceFirstCreateModal` (voice-to-project creation) and the "Just talk — Kreto's listening" button (WorkHome.tsx:515-535) both create real project rows from natural language. Neither is audited here at the sub-component level (out of the given file list), but the entry points are clearly labeled as Kreto/voice-driven rather than disguised as manual forms.

**12. Responsive behavior:** No obvious breakage — grids use `grid-cols-1 sm:grid-cols-2` / `grid-cols-4` patterns; the recent-collaborators row uses a `Carousel` rather than a fixed-width flex row.

**13. Hierarchy classification:** Tier 1 (New project CTA / stat row) is correctly dominant; Tier 2 (Session & Activity, Casting & Collaborators) correctly subordinate via `SectionCard`. No background/technical state (raw IDs, enums) is rendered at this tier — project `status` values like "active"/"open" only appear as styled badges, not raw strings, except in `BrandWorkHome`'s Past Listings row where `<Badge>{opp.status}</Badge>` prints the raw DB enum value verbatim (WorkHome.tsx:308) — a very minor Tier-5-leaking-into-Tier-2 instance, low severity since it's a short label inside a de-emphasized "Past Listings" card.

### ThriveDesk.tsx (`/desk/:projectId`)

**1. Primary goal:** Work inside one specific project room — brief, tasks, files, milestones, payment, chat.

**2. Primary component(s):** `StudioRoom` when `activeTab === "today"` (the default/"Studio Room" view, ThriveDesk.tsx:302-312); `DeskTabContent` for all other tabs (ThriveDesk.tsx:314-328).

**3. Secondary component(s):** `WorkspaceSidebar` (project list, collapsible), `ProjectFlowTimeline` + `NextStepBar` (desktop-only, ThriveDesk.tsx:262-271), `WorkspaceQuickPanel` (desktop-only right rail, ThriveDesk.tsx:341-359), `AgentModeBanner`, `ProjectInviteAcceptBanner`, `ConfirmCreditBanner` (contextual banners, ThriveDesk.tsx:286-298).

**4. Duplicated components / redundant cards:** None found — the Studio Room / tab-content split is mutually exclusive (`isStudioRoom ? <StudioRoom/> : <DeskTabContent/>`, ThriveDesk.tsx:302-329), and the flow timeline + quick panel are both explicitly hidden while in Studio Room (`!isStudioRoom &&`, lines 274, 332, 341) so they don't compete with it.

**5. Hidden but important actions:** None found at this level — `ProjectSettingsMenu` in the header is the one menu-gated surface, which is appropriate for settings-class actions.

**6. Conflicting CTAs:** None found.

**7. Data source:** Real Supabase via `useProjectData(projectId)` (tasks, files, messages, milestones, collaborators — ThriveDesk.tsx:35-38) and `useProjectFlow`/`useProjectFlowExtras` for flow-stage computation.

**8. Loading state:** Present and honest — a proportioned skeleton (header/tab-strip/body blocks, ThriveDesk.tsx:156-185) rather than a spinner-only state.

**9. Error state:** The only distinct non-happy-path state is "Studio not found" (ThriveDesk.tsx:188-205), shown when `!project` — this covers both "doesn't exist" and "no access" with one message and a "Go Back" button. There is no separate state for a genuine fetch/network error (e.g., Supabase unreachable) versus a legitimately missing/unauthorized project — both collapse to the same "Studio not found" copy, which could mislead a user with a real connectivity problem into thinking the project was deleted.

**10. Empty state:** Handled inside `StudioRoom`/`DeskTabContent` (not in the audited file) — the page-level shell itself has no fabricated placeholder content.

**11. AI-assisted behavior:** `AgentModeBanner` surfaces when `agent_mode` is true (ThriveDesk.tsx:286, via `useAgentRole`) — visibly labeled as agent-related; not further audited here since `AgentModeBanner`'s internals are outside the given file list.

**12. Responsive behavior:** No obvious breakage — the layout is `flex-col lg:flex-row` (ThriveDesk.tsx:208), sidebar is `fixed … lg:relative` with a mobile overlay backdrop (lines 210-220), and the right Quick Panel is explicitly `hidden xl:block` (line 342) rather than being squeezed onto mobile.

**13. Hierarchy classification:** Clean — Tier 1 (StudioRoom/DeskTabContent) dominates; Tier 2 (sidebar, flow timeline) is visually subordinate and collapsible; Tier 3 (settings menu, banners) appropriately contextual. No violations found.

---

## Scout — `src/pages/Scout.tsx` + `src/components/opportunity/ScoutedGigsSection.tsx`

**1. Primary goal:** Find a gig that fits the user's profile (with adjacent paths to hiring talent or finding collaborators).

**2. Primary component(s):** The active tab's content — `ScoutedGigsSection` (default "For You" tab, Scout.tsx:122), `ShortlistedGigs`, or `OpportunitiesFeed`, depending on `tab` state (Scout.tsx:31-38, 122-124). Within `ScoutedGigsSection`, the single "Strongest match" hero card (ScoutedGigsSection.tsx:427-495) is the true dominant element when gigs exist.

**3. Secondary component(s):** The tab strip + two "leave the page" links (Circle, Talent Finder — Scout.tsx:86-104), `SurfaceProactiveCards`, `KretoTip`, and the horizontal carousel of remaining gigs (ScoutedGigsSection.tsx:498-513).

**4. Duplicated components / redundant cards:** None found — the "strongest match" hero and the carousel of the rest are explicitly `gigs[0]` vs `gigs.slice(1)` (ScoutedGigsSection.tsx:427, 502), so no gig is shown twice.

**5. Hidden but important actions:** "Tune scout preferences" (`ScoutPreferencesDialog`) is a small ghost button next to "Scan now" (ScoutedGigsSection.tsx:364-371) — reasonably visible, not buried in an overflow menu. Nothing else hidden.

**6. Conflicting CTAs:** Inside the FeaturePageHeader's `tabs` slot, the tab strip (Scout sections) sits directly above two more links styled as plain text — "Looking for collaborators? Open Circle" and "Hiring? Open Talent Scout" (Scout.tsx:86-104). These are deliberately de-styled ("not styled as tabs" per the inline comment at Scout.tsx:85) but they still sit in the same visual cluster as the primary tab control and offer two more "leave this page" destinations right next to the three in-page tabs — a mild competing-navigation pattern rather than a true conflicting-CTA (no two buttons trigger the same action).

**7. Data source:** Real Supabase (`scouted_gigs`, `scouted_gig_actions`, ScoutedGigsSection.tsx:107-121) plus real edge functions for the AI-driven parts: `scout-gigs` (manual scan, line 149), `scout-gig-detail` (enrichment, line 206), `draft-gig-application` (cover-letter drafting, line 220). A dedicated filter (`isThin`, lines 122-136) actively suppresses low-quality/placeholder-looking scraped listings (generic URLs, empty descriptions) rather than showing them — a good-faith effort to avoid fabricated-feeling data reaching the user. `PLACEHOLDER_COMPENSATION` regex (line 49) also prevents rendering literal "N/A"/"TBD" strings as if they were real compensation data.

**8. Loading state:** Present and honest — a `Skeleton`-based placeholder matching the eventual grid shape (ScoutedGigsSection.tsx:342-350), plus a distinct "scanning" state with an elapsed-time counter while the `scout-gigs` edge function runs (lines 388-396).

**9. Error state:** Present — `scanNow()` surfaces a destructive toast on edge-function error (ScoutedGigsSection.tsx:155-158) and a distinct "gated" (rate-limit) toast (lines 159-162). Enrichment failures inside the detail dialog silently leave `full_description` unset rather than erroring, falling back to `description` or "No additional details available" (line 572) — an honest fallback, not a misleading one.

**10. Empty state:** Honest — "No scouted gigs yet. Tap Scan now…" (ScoutedGigsSection.tsx:398-401), no fabricated gig cards.

**11. AI-assisted behavior:** Fit scoring/reasoning ("Why this fits you," fit_score/fit_reason) is AI-generated and clearly labeled with a Sparkles icon and explanatory copy (ScoutedGigsSection.tsx:310-318, 471-478). Cover-letter drafting via `draft-gig-application` is explicitly a user-initiated "Draft" button (line 610) — it populates an editable `Textarea` (line 620) rather than auto-sending anything; the actual "apply" action is a separate, explicit click (mailto or apply-URL button, lines 628-640) and "I applied" is a manual self-report (line 641). No AI action here fires a side effect without a user click.

**12. Responsive behavior:** No obvious breakage — grids are `grid-cols-1 sm:grid-cols-2` (loading skeleton, line 345), the strongest-match card is `sm:flex` for side-by-side image+content only above the `sm` breakpoint (line 434), and carousels use `basis-[85%] sm:basis-[60%]` fractional sizing rather than fixed pixel widths.

**13. Hierarchy classification:** Tier 1 (tab content, strongest-match card) dominant; Tier 2 (tab strip) correctly subordinate; Tier 3 (Tune/Scan actions, cross-links) contextual. No background/technical state leaks — `source`/`source_name` values are always rendered through friendly icons and "via {name}" copy, never as raw enum strings.

---

## Passport — `src/pages/Profile.tsx` + `src/components/passport/PassportHero.tsx`

**1. Primary goal:** See your one verified creative record (Creative Passport) and know what to do next to strengthen it.

**2. Primary component(s):** `PassportHero` (Profile.tsx:511-538) — explicitly documented in its own file header as "the ONE dominant Passport surface" replacing a prior two-hero pattern (`PassportHero.tsx:43-52`).

**3. Secondary component(s):** `KretoActionCenter` ("Block 1 of 2," Profile.tsx:540-546), `TrustOpportunityCenter` ("Block 2 of 2," Profile.tsx:554-558), and `ProfileContentSections` inside the "Hire Me" section (Profile.tsx:582-593).

**4. Duplicated components / redundant cards:**
- **Next-action shown twice.** `PassportHero` renders "one intelligent next action" as a single link using `standing.nextActions[0]` (PassportHero.tsx:98, 327-338, comment explicitly says "One intelligent next action"). Immediately below it, `KretoActionCenter` renders `standing.nextActions` **as a full list** (`KretoActionCenter.tsx:85-99`, `.map()` over the entire array) — which includes the same `nextActions[0]` already shown in the hero. In practice, the single highest-priority next action can appear twice on the page: once as PassportHero's one link, once again as the first row of KretoActionCenter's list.
- **Five stacked entry surfaces before the hero.** Before `PassportHero` even renders, the page stacks: `PassportKretoEntry` (AI entry card, Profile.tsx:463), `ClaimContinueBanner` (Profile.tsx:466), `DiscoveriesInbox` (Profile.tsx:470-476), plus the conditional `justRevealed` reward banner (Profile.tsx:421-460). Each is individually well-motivated and self-hides when not applicable, but a first-time visitor with a freshly-claimed profile could see up to four banner-style blocks before reaching the actual Passport card.

**5. Hidden but important actions:** None found — Share, QR, and EPK-download are all one tap from the hero (PassportHero.tsx:310-325), and "Preview public Passport" / "Private dashboard" links sit directly below the hero (Profile.tsx:561-576).

**6. Conflicting CTAs:** None found on the hero itself — Share is the one primary action, QR/EPK-download are clearly secondary icon buttons (`variant="outline"` icon-only, PassportHero.tsx:319-324).

**7. Data source:** Real Supabase throughout, via `ProfileContext`/`useProfileData` (profile, credits, reviews, awards, pressLinks — Profile.tsx:53-67) and a real `computeStanding()` calculation from actual credit/co-sign/completion counts (Profile.tsx:483-508), not mocked numbers.

**8. Loading state:** Present and honest — `SkeletonProfile` (Profile.tsx:310-318).

**9. Error state:** Only a bare "Profile not found" centered message (Profile.tsx:320-328) — no distinct network/error state versus "this profile genuinely doesn't exist."

**10. Empty state:** Honest — sections like `strongestCredits` and `topSkills` in `PassportHero` simply don't render when empty (PassportHero.tsx:255, 284) rather than showing placeholder cards.

**11. AI-assisted behavior:** Two separate AI entry points exist on this one page: `PassportKretoEntry` ("Audit my Passport," Profile.tsx:463) and the `KretoPassportBuilder` dialog that applies drafted bio/skills only after explicit user confirmation (`applyBuilderResult`, Profile.tsx:118-139 — "Kreto's drafted bio/skills only after the user explicitly confirms them … never auto-published," per the inline comment). This confirmation-gating is a good pattern. However, having both `PassportKretoEntry` (Passport-specific AI card) and the generic `KretoTip` pattern used elsewhere (Today, Scout, Circle) as parallel "talk to Kreto" entry points is a minor conceptual duplication across the app — noted here and in Cross-cutting patterns below.

**12. Responsive behavior:** No obvious breakage — container is `max-w-3xl` with `px-3 sm:px-4 md:px-6` (Profile.tsx:417), the "Strongest credits" mini-grid inside PassportHero is `grid-cols-2` at all sizes (PassportHero.tsx:260) which is fine given it only ever holds 2 items.

**13. Hierarchy classification:** Tier 1 (PassportHero) is correctly the visually dominant card (cover image, avatar, holo-card treatment). **Violation:** the duplicated next-action (finding #4) means a piece of Tier-1 content (the single most important next step) is effectively repeated inside a Tier-3 "contextual actions" block (KretoActionCenter), diluting the "one intelligent next action" promise the hero's own code comment makes.

---

## Kreto — `src/pages/KretoTab.tsx` + `src/components/kreto/InlineKretoChat.tsx`

**1. Primary goal:** Talk to the AI Executive Producer (Kreto) directly, with real account context (Passport, top Scout match, recent proposed actions) surfaced alongside the conversation.

**2. Primary component(s):** `InlineKretoChat` (KretoTab.tsx:138) — explicitly commented as "Primary surface — the live thread, answered right here on the page."

**3. Secondary component(s):** "Or start with" quick actions grid (KretoTab.tsx:141-156, explicitly commented "visually quieter than the primary CTA above"), and the live-context cards (Passport snapshot, Top Scout match, Recent proposed actions — KretoTab.tsx:164-219).

**4. Duplicated components / redundant cards:** None found in data terms — each context card sources a different query and none repeats another's content.

One structural inconsistency worth flagging: every other audited feature page (Today, Studio, Scout, Passport, Circle) uses the shared `FeaturePageHeader` component for its hero (eyebrow/title/accentTitle/subtitle/tutorial). `KretoTab.tsx` instead hand-rolls an equivalent hero inline (KretoTab.tsx:113-135) with its own grid texture, pill eyebrow, and `<h1>` — visually consistent with `FeaturePageHeader`'s output but implemented as a second, parallel copy of the same pattern rather than reusing the component (the file's own comment at KretoTab.tsx:110-112 acknowledges it's deliberately parallel because Kreto is "deliberately dark regardless of theme," same as Auth). This is a maintainability/consistency note, not a user-facing defect.

**5. Hidden but important actions:** None — quick actions and context cards are all visible without scrolling past a fold or opening a menu.

**6. Conflicting CTAs:** None — the composer is the only "start a conversation" affordance; quick-action buttons and context cards route into `ask()` (seeding the same composer, KretoTab.tsx:73) or navigate elsewhere, never both.

**7. Data source:** Real Supabase — `profiles`, `scouted_gigs`, `agent_actions` (KretoTab.tsx:83-97). Chat itself streams via `streamCopilot`/`thriveCopilot` (`InlineKretoChat.tsx:4, 43-58`), a real streaming call, not canned responses.

**8. Loading state:** Present — `loadingContext` shows a spinner + "Loading your context…" row (KretoTab.tsx:159-162) while the three context queries resolve; `InlineKretoChat` shows a spinner + "Kreto is thinking…" per in-flight assistant message (InlineKretoChat.tsx:87-91).

**9. Error state:** `InlineKretoChat`'s `onError` callback writes the error string directly into the assistant bubble if no content has streamed yet (InlineKretoChat.tsx:50-56) — visible to the user, not silently dropped, though it surfaces as an assistant-styled message rather than a distinct error affordance (no retry button).

**10. Empty state:** Honest — Passport/Scout/Actions context cards each only render when their respective query returns data (`passport &&`, `gig &&`, `actions.length > 0`, KretoTab.tsx:165, 188, 202); no placeholder values shown when a user has no scouted gigs or no recent actions.

**11. AI-assisted behavior:** This entire page is the AI surface. Labeling is explicit ("AI Executive Producer" pill, KretoTab.tsx:118; agent name/role copy, lines 126-131). A closing disclosure states the safety model plainly: "Anything that could affect other people, spend money, or send something on your behalf waits for your approval first — [Kreto] only acts on its own for safe, reversible steps" (KretoTab.tsx:222-226) — this is a strong, user-visible confirmation-model statement, one of the clearest in the audited set.

**12. Responsive behavior:** No obvious breakage — quick actions grid is `grid-cols-1 sm:grid-cols-2` (KretoTab.tsx:143), context cards are `grid-cols-1 sm:grid-cols-2` (line 164), and the title uses `useFitTitleOneLine` to auto-scale rather than a fixed font size that could overflow on narrow screens (lines 74-76, 120-128).

**13. Hierarchy classification:** Clean single-primary-surface pattern, matching the "one primary card + quick actions + live context" model referenced in the task brief. No violations found.

---

## Messages — `src/pages/Messages.tsx`

**1. Primary goal:** Read and send messages within an existing connection, or start/manage a group chat.

**2. Primary component(s):** The active conversation pane — either `GroupChatPanel` or the thread view (`ChatHeader` + message list + `MessageComposer`, Messages.tsx:219-302).

**3. Secondary component(s):** `ConversationListPanel` (list of conversations/tabs, Messages.tsx:197-217) — hidden on mobile once a conversation is open (`hidden={!!(selectedConversation || selectedGroup)}`, line 198), consistent with a standard master-detail responsive pattern.

**4. Duplicated components / redundant cards:** None found.

**5. Hidden but important actions:** None found — "Start project," "View profile," reply, and voice-note actions are all inline in the header/composer, not tucked in overflow menus at this level.

**6. Conflicting CTAs:** None found.

**7. Data source:** Real Supabase via `useConversations`, `useChatMessages`, `useSendMessage` hooks (Messages.tsx:63-75) plus `useOnlinePresence`/`useTypingStatus` for live presence/typing.

**8. Loading state:** Present — `conversationsLoading` is passed straight through to `ConversationListPanel` (Messages.tsx:204).

**9. Error state:** Toast-based — e.g. group-invite join failures surface a destructive toast with the actual error message (Messages.tsx:120-123). No silent failures observed in this file.

**10. Empty state:** Present and honest on both axes: no conversation selected shows a dedicated "Your Messages" panel with the Messages tutorial rather than a blank pane (Messages.tsx:303-315); an open conversation with zero messages shows `EmptyChatState` plus contextual `IceBreakers` (lines 235-243, 255-261) instead of fabricated message history.

**11. AI-assisted behavior:** None on this page beyond `IceBreakers` (conversation-starter suggestions) — not a generative/agentic action, just static/contextual suggested openers; no confirmation concern since selecting one only fills the composer (line 241) rather than sending anything.

**12. Responsive behavior:** No obvious breakage — the whole layout is `pb-20 lg:pb-0` (mobile bottom-nav clearance) and the list/thread split uses the `hidden` prop pattern described above rather than a fixed-width side-by-side layout that would overflow on mobile.

**13. Hierarchy classification:** Clean. No background/technical state rendered (no raw conversation IDs, no raw status enums visible in this file).

---

## SoundStages/Circle — `src/pages/Circle.tsx` + `src/components/circle/LiveCallsPanel.tsx`

**1. Primary goal:** Join or start a live "Sound Stage" session, or reach Match/Browse/Network to find people (Circle.tsx's own comment: "Sound Stages is the main page," Circle.tsx:187).

**2. Primary component(s):** `LiveCallsPanel` (Circle.tsx:232, rendered when `user` is present and the profile-visibility gate passes) — inside it, `SoundStagesRail` is called out as "the headliner" (LiveCallsPanel.tsx:193-194).

**3. Secondary component(s):** The centered Match/Browse/Network button row (Circle.tsx:191-224) opening `Sheet` overlays; the "Kreto-powered" invite card (Circle.tsx:241-260); inside `LiveCallsPanel`, the "Curated Stages" rail and "Call sheet" section (LiveCallsPanel.tsx:265-284).

**4. Duplicated components / redundant cards:** The page header (`FeaturePageHeader`) renders `<h1>` "Stages. Where creators meet, live." (Circle.tsx:179-185). One screen below it, `LiveCallsPanel` renders its own large heading: `<h2 className="text-3xl sm:text-4xl font-black italic …">SOUND STAGES</h2>` with an "On Air Now" eyebrow (LiveCallsPanel.tsx:167-191) — the same page concept ("Stages"/"Sound Stages") is announced twice in two different heading styles within the first viewport-and-a-half. This mirrors the Today page's duplicate-H1 pattern (see Cross-cutting patterns).

**5. Hidden but important actions:** None found — Match/Browse/Network and Go Live/Schedule are all visible buttons, not menu-gated.

**6. Conflicting CTAs:** None found — "START STAGE" (instant) and "Or schedule a Speed Session" (scheduled) are visually differentiated as primary vs. text-link secondary (LiveCallsPanel.tsx:198-261), not two competing same-weight buttons.

**7. Data source:** Real — `profiles`, `credits` (visibility gate, Circle.tsx:83-98), `connections`+`profiles` (Network sheet, lines 100-122), `public_profiles_safe` (Browse sheet, lines 128-146). `LiveCallsPanel` uses real edge functions (`join-sound-stage`, `end-sound-stage`) and Daily.co room URLs, not simulated rooms.

**8. Loading state:** Present in the Browse sheet (skeleton grid, Circle.tsx:347-352) and Network/connections (`connectionsLoading` passed to `ConnectionList`, line 322). `LiveCallsPanel`'s own rails (`SoundStagesRail`, `CuratedStagesRail`, `CallSheetUpcoming`) are outside the given file list and not further audited.

**9. Error state:** Toast-based for stage-join failures with the real error message (LiveCallsPanel.tsx:113-119) and for invalid join-links (lines 138-144).

**10. Empty state:** Honest — Browse sheet shows "No creators match your filters yet." rather than fabricated cards (Circle.tsx:353-356); Network sheet shows `InviteCircleCard` only when `connections.length === 0` (line 317) rather than an empty grid.

**11. AI-assisted behavior:** The "Kreto-powered" invite card (Circle.tsx:241-260) states plainly that "Kreto drafts the invite and picks who's worth reaching out to first" — labeled as AI-assisted; opens `InviteDialog` for the user to review before sending (not audited at that sub-component level, but the entry point itself doesn't send anything directly).

**12. Responsive behavior:** No obvious breakage — sheets are `w-[96vw] sm:w-[520px]` etc. (responsive width caps), Browse grid is `grid-cols-2` (fine for a sheet-constrained width), main content container is `px-3 sm:px-4`.

**13. Hierarchy classification:** Tier 1 (LiveCallsPanel) is dominant; Tier 2 (Match/Browse/Network row) correctly subordinate as a compact pill row rather than large cards. **Violation:** the duplicate heading (finding #4) is a Tier-1-vs-Tier-1 collision, same class of issue as Today.

---

## Admin — `src/pages/Admin.tsx`

**1. Primary goal:** Internal team console for user/trust management, growth operations, finance ops, and system-level bulk actions.

**2. Primary component(s):** The active `TabsContent` panel, selected via the grouped `TabsList` (Admin.tsx:406-427) — e.g. `UsersTab`, `VerificationTab`, `ScoutFunnelTab`.

**3. Secondary component(s):** The four-card overview row (Total users / Pending verifications / Unclaimed profiles / Pending transfers, Admin.tsx:377-399) which also double as jump-links into the corresponding tab (`onClick={() => setActiveTab(jumpTo)}`, line 382).

**4. Duplicated components / redundant cards:** None found structurally — each tab is a distinct, non-overlapping surface.

**5. Hidden but important actions:** Nothing is menu-gated; however, several high-blast-radius actions live inside the flat "System" tab alongside routine settings, with no distinct confirmation step beyond the button click itself: "Send Broadcast" emails **all users** (Admin.tsx:239-272, 818-834 — button is enabled as soon as subject+body are non-empty, no "are you sure, this goes to N users" step), "Import ODOS Members" (scrapes + writes real profile data, lines 274-308), and three tiers of "AI Creative Discovery Agent" runs that import profiles (lines 310-346, 601-656). These are appropriately admin-gated by the `user_roles` check (lines 191-236), but within the admin surface itself there's no secondary confirmation for the broadcast-email action specifically, which is the one with direct, immediate, hard-to-undo user-facing impact (an email lands in every user's inbox).

**6. Conflicting CTAs:** None found — each card has one primary action.

**7. Data source:** Real Supabase — `profiles`, `verification_requests`, `manual_bank_transfers` counts for the overview row (Admin.tsx:160-165), all fetched in parallel with a shared error flag.

**8. Loading state:** Present — a full-page spinner while checking admin access (Admin.tsx:349-354), a separate `overviewLoading` skeleton-pulse per overview card (lines 387-388), independent of the admin-access check.

**9. Error state:** Present and honest — `overviewError` disables the jump-buttons and shows "Couldn't load the overview counts — the tabs below still work." (Admin.tsx:400-404) rather than silently showing zeros or fabricated numbers. Individual admin actions (broadcast, ODOS import, AI discovery) all have try/catch with destructive toasts showing the real error message (e.g. lines 298-307, 336-345).

**10. Empty state:** N/A at this shell level (results lists like `odosResults`/`discoveryResults` are conditionally rendered only `&& .length > 0`, e.g. lines 536, 697).

**11. AI-assisted behavior:** "AI Creative Discovery Agent" (Admin.tsx:590-656) explicitly runs autonomously ("runs twice daily automatically," line 598) and, when triggered manually, imports new profiles into the platform directly (`imported`/`enriched` counts, no per-profile review-and-confirm step visible in this file — it's a bulk fire-and-collect-results pattern, appropriate for an internal admin tool but notably different from the confirm-before-publish pattern used for AI-drafted content elsewhere, e.g. Passport's `KretoPassportBuilder`).

**12. Responsive behavior:** No obvious breakage — overview grid is `grid-cols-2 lg:grid-cols-4` (Admin.tsx:377), tab groups wrap via `flex flex-wrap gap-1.5` (line 413), summary stat grids inside System tab use `grid-cols-2 sm:grid-cols-5`/`sm:grid-cols-6` (lines 511, 668).

**13. Hierarchy classification:** Tier 1/2 split (overview cards vs. tab content) is reasonable for an internal tool. No raw technical state (UUIDs, enum values) is rendered at Tier-1 prominence — status badges use styled `<Badge>` treatments, not bare strings, throughout the System tab result lists.

---

## Landing (skim only) — `src/components/landing/kretopia/LandingBelowFold.tsx`

Per the task brief, this route received a structural skim only, not the full 13-point breakdown. `LandingBelowFold` is the guest-only continuation of the landing page below the hero: a `SearchTutorialSection`, then one `ChapterSection` per core-loop stage (Passport → Verified Credits → Trust → Product Loop → Scout → Match → Studio → Kreto → Creative Universe → Community → For Organisations → Closing CTA → Footer), each following one repeated structural pattern per the file's own header comment: "image → numbered title → explanation → an interactive tutorial immediately below it" (LandingBelowFold.tsx:8-13). Chapter numbering is centralized via `chapterRoman()` from a single registry file rather than hand-maintained per section, which avoids a class of drift bug (renumbering chapters would otherwise require hand-patching every section). The component is lazy-loaded/deferred to keep the hero+search bar on the critical path (per its own top-of-file comment), which is a sound performance-conscious structural choice.

---

## Auth — `src/pages/Auth.tsx`

**1. Primary goal:** Sign an existing user in, or get a new user signed up (with an invite/claim-aware fast path).

**2. Primary component(s):** The active `TabsContent` — `SignInForm` or the signup flow (Auth.tsx:524-621).

**3. Secondary component(s):** `AuthBrandingPanel` (left column marketing panel), `OAuthQuickButtons`, `FunnelStepper` (progress indicator, Auth.tsx:468), `ForgotPasswordDialog`/`WaitlistForm` dialogs.

**4. Duplicated components / redundant cards:** None in the rendering sense, but the signup path itself forks into two independent flows behind a small text toggle: `signupMode === "claim"` renders `UniversalClaimFlow` + OAuth buttons (Auth.tsx:568-596), while `signupMode === "classic"` renders the full `SignUpWizard` (lines 600-619). Switching between them is a small text link ("Use email & password instead" / "← Back to one-tap claim," lines 589-596, 610-618) rather than a visible tab or toggle — functionally two different signup UIs live on the same tab, distinguished only by a low-emphasis text link.

**5. Hidden but important actions:** The classic-signup fallback (email/password without the claim flow) is reachable only via that small text link, which could be considered "hidden" for a user who doesn't want the claim/search flow and doesn't notice the link.

**6. Conflicting CTAs:** None found — the two signup modes are mutually exclusive render branches, not two buttons on screen at once.

**7. Data source:** Real Supabase Auth (`supabase.auth.signInWithPassword`, `signUp`, `updateUser` — Auth.tsx:236, 340, 412) plus real `profiles`/`connections`/`discovered_credits`/`notifications` writes for onboarding-routing and auto-connect (lines 113-161, 176-218).

**8. Loading state:** Present — `loading` state disables submit and is passed to `SignInForm`/`SignUpWizard`/`PasswordResetForm` (Auth.tsx:37, 476, 525-533, 601-609); OAuth buttons have their own `googleLoading`/`appleLoading` flags.

**9. Error state:** Present and detailed — sign-in errors are classified by message content into specific user-facing copy (invalid credentials, email not confirmed, network error, rate-limited, other — Auth.tsx:241-267) rather than one generic "something went wrong" message; same pattern for sign-up errors (lines 353-370).

**10. Empty state:** N/A (form-based page, not a data list).

**11. AI-assisted behavior:** None directly on this page — `UniversalClaimFlow` (referenced but not in the audited file list) is where the credit-search/claim AI behavior lives; Auth.tsx itself is a pure auth/routing shell around it.

**12. Responsive behavior:** No obvious breakage — the branding panel is implicitly hidden below `lg:` (right column is `w-full lg:w-1/2`, Auth.tsx:428, implying `AuthBrandingPanel` occupies the other half only at `lg:` and up); the form column becomes `lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto` only at desktop widths, so mobile gets normal in-flow scrolling rather than a fixed/sticky panel that could clip content.

**13. Hierarchy classification:** Tier 1 (active form) dominant; Tier 2 (branding panel, OAuth row) subordinate. The claim/classic fork (finding #4) is a mild Tier-1-ambiguity: two different "primary form" experiences share one Tier-1 slot with low-visibility switching between them, but this is a minor UX note rather than a hierarchy violation in the strict sense (only one is ever visible at a time).

---

## Public Passport — `src/pages/HandleResolver.tsx` + `src/pages/CreatorEPK.tsx`

`HandleResolver` is a thin resolver, not the actual public page: `mode="passportId"` is wired directly at `/passport/:passportId` (App.tsx:352); `mode="handle"` is used as a fallback inside `CreatorSiteByUsername` when a `/:username` segment starts with `@` (`src/pages/CreatorSiteByUsername.tsx:131-133`) or, on resolution, redirects (`<Navigate to={`/epk/${userId}`} replace />`, HandleResolver.tsx:82) to `CreatorEPK` at `/epk/:userId` (App.tsx:346) — the actual public EPK/comp-card page. Both files were read in full.

**1. Primary goal:** Let an outside visitor (signed-in or anonymous) see one creator's public press kit and either contact/hire them, claim the profile if it's theirs, or sign up.

**2. Primary component(s):** In `CreatorEPK`, the `HoloCard`-wrapped identity block (avatar, name, role, location, verification badge, bio, social links — CreatorEPK.tsx:390-492) is the dominant surface, matching the owner-side `PassportHero` treatment per its own comment ("same 3D HoloCard treatment as the owner Passport," CreatorEPK.tsx:389).

**3. Secondary component(s):** `EPKShareToolbar` (owner-only), `VideoIntroSection`, `ModelStrip` (conditional on model sub-role), "Why work with me" bio block, Professional/Passion Skills, and further down (not fully read) presumably Credits/Reviews/RateCard sections plus `EPKFooterCTA` fixed at the bottom.

**4. Duplicated components / redundant cards:** For an **unclaimed** profile, two separate "claim this" CTAs exist simultaneously on screen:
- A mid-page banner: "Is this you? … Claim this profile to unlock all features" with a "Claim This Profile" button (CreatorEPK.tsx:566-585).
- A **fixed, always-visible bottom bar** (`EPKFooterCTA`, rendered unconditionally at CreatorEPK.tsx:986-992) which, for `isUnclaimed`, shows its own "Claim Your Creative Passport" button plus a second "Not you? Sign Up to Connect" button (`EPKFooterCTA.tsx:30-47`).

Both banners fire the same underlying action (`onClaimClick` → `setShowClaimDialog(true)`, CreatorEPK.tsx:990 and 577), so a visitor sees "claim this profile" phrased two different ways in two different places on the same screen — a genuine duplicate CTA, not just a duplicate card.

**5. Hidden but important actions:** There is **no "Message this creator" CTA anywhere in `CreatorEPK.tsx`** (confirmed by search — no `MessageCircle`/`MessageSquare` icon or `/messages?user=` navigation call in the file). The only signed-in-visitor CTAs are conditional on the creator having set a Calendly link ("Book a Call," CreatorEPK.tsx:599-608) or a website ("Visit Website," lines 610-620) — if neither is set, a signed-in non-owner visitor has literally no contact action on the page beyond raw social-media icon links. For a page whose stated purpose includes "connect with other creators" (per the unclaimed-banner copy itself, line 574), the absence of a direct messaging path is a notable gap.

**6. Conflicting CTAs:** The duplicate claim CTA in finding #4 is also a conflicting-CTA instance: the mid-page "Claim This Profile" button and the fixed-footer "Claim Your Creative Passport" button are two same-weight, same-destination buttons visible in the same scroll session (the footer is `fixed bottom-0`, so it's on-screen simultaneously with whichever mid-page content the user has scrolled to, per `EPKFooterCTA.tsx:17`).

**7. Data source:** Real Supabase — `profiles` (public columns, RLS-readable), `credits`, `press_links`, `awards`, and others fetched in parallel (CreatorEPK.tsx:160-230-ish region); genuinely public/live data, not mocked.

**8. Loading state:** Present but minimal — a bare centered spinner (`animate-spin` div) with no skeleton matching the eventual layout (CreatorEPK.tsx:313-318), less polished than the skeleton patterns used on WorkHome/ThriveDesk.

**9. Error state:** `notFound` collapses "profile doesn't exist" and any fetch error into one message: "This creator profile doesn't exist or is not public." (CreatorEPK.tsx:321-332) — same pattern as ThriveDesk's "Studio not found," no distinct network-error state.

**10. Empty state:** Honest at the sections read — e.g. Professional Skills only renders `if profile.professional_skills && … .length > 0` (CreatorEPK.tsx:624), no fabricated skill/credit placeholders.

**11. AI-assisted behavior:** None directly in this file — the page is a read-mostly public display, not an AI surface. The `ClaimProfileDialog` (opened from either claim CTA) is outside the audited file list.

**12. Responsive behavior:** No obvious breakage — content is capped at `max-w-lg mx-auto px-4 pt-6 pb-32` (CreatorEPK.tsx:387), which is mobile-first by design; the `pb-32` (128px) reserves space for the fixed `EPKFooterCTA` (`fixed bottom-0 left-0 right-0`, `EPKFooterCTA.tsx:17`), similar in spirit to Messages.tsx's `pb-20` and ThriveDesk's `pb-[calc(6.5rem+env(safe-area-inset-bottom))]` mobile-chrome clearance. One residual risk: the unclaimed-profile variant of `EPKFooterCTA` is taller than the claimed/owner variants (two stacked buttons plus secondary links plus branding line, `EPKFooterCTA.tsx:30-47, 71-93`) versus the single-button owner/visitor variants — the fixed `pb-32` reservation is a constant, not variant-aware, so the tallest footer state has the least clearance margin of the three, though not evidently enough to overlap content outright.

**13. Hierarchy classification:** Tier 1 (HoloCard identity block) is correctly dominant. **Violation:** the duplicate/conflicting claim CTA (findings #4/#6) puts two Tier-1-weight action buttons for the same action live on screen simultaneously (mid-page banner + fixed footer), which is exactly the "two buttons competing for the same primary action" pattern the audit was asked to check for.

---

## Cross-cutting patterns

**Duplicate H1/heading pattern (repeats 2x, likely more elsewhere).** Both Today (`UnifiedHome.tsx` + `ThrivePromptHero.tsx`) and SoundStages/Circle (`Circle.tsx` + `LiveCallsPanel.tsx`) stack a `FeaturePageHeader`-driven `<h1>` immediately above a second, differently-styled heading from the primary child component that restates the same page concept ("What are we moving forward today?" / "Stages… Where creators meet, live" → "SOUND STAGES"). This looks like a structural side-effect of the shared `FeaturePageHeader` component being adopted as a wrapper around pre-existing primary components that already owned their own heading — the wrapper was added but the child's own heading was never removed. Given the repo's git history includes a commit titled "fix duplicate H1" (per the session's git log), this may be a known, partially-addressed class of issue rather than a one-off; these two instances are still present in the current source as read.

**"One primary card + quick actions + live context" pattern holds up best on Kreto.** Of the audited pages, `KretoTab.tsx` is the cleanest match for the documented consolidation pattern (InlineKretoChat as the one dominant card, quick actions visually quieter below it, live-context cards below that, all pulling real data, no duplicate CTAs). Passport comes close but is diluted by the next-action duplication (finding #4 in that section) and the stack of up-to-four entry banners above the hero.

**AI confirmation-before-side-effect is inconsistently strict.** Kreto's page-level disclosure ("waits for your approval first … only acts on its own for safe, reversible steps," KretoTab.tsx:222-226) and Passport's `KretoPassportBuilder` (bio/skills applied "only after the user explicitly confirms them … never auto-published," Profile.tsx:116-117 comment) are the strongest, most explicit confirmation patterns found. By contrast, ThrivePromptHero's default (non-Plan-mode) path can create a new `projects` row directly from a single routed AI message with no separate "create this?" step (`ThrivePromptHero.tsx:242-256`), and Admin's AI Discovery Agent bulk-imports profiles with no per-profile review gate (appropriate for an internal tool, but worth noting as the least-gated AI action in the audited set).

**Real data, not fabricated data, is the norm.** Across all ten in-scope routes, every primary and secondary surface read pulls from live Supabase tables or edge functions. No page was found substituting hard-coded/mock arrays for what should be live account or platform data. The one simulated element found (Today's guest-only rotating "X just claimed a credit…" activity ticker, `UnifiedHome.tsx:94-99`, 386, 424-434) uses real first names from real fetched creators but a templated action sentence, and is scoped to the signed-out landing hero rather than any of the signed-in surfaces this audit's 13-point criteria targeted.

**Loading states are present everywhere but inconsistent in polish.** Proportioned skeletons matching final layout (WorkHome, ThriveDesk, Passport, Scout's ScoutedGigsSection) coexist with bare centered spinners (CreatorEPK, Admin's admin-check gate). Not a defect, but a consistency opportunity.

**Error states consistently collapse "not found" and "fetch failed" into one message.** ThriveDesk ("Studio not found"), CreatorEPK ("Profile Not Found"), and Profile.tsx ("Profile not found") all use one message/state for both a genuinely missing/unauthorized resource and a transient network failure. None of these are misleading (they don't claim success), but none give a user with a real connectivity problem a way to distinguish "this doesn't exist" from "try again."

**Fixed/sticky footer CTAs appear in exactly one audited surface (Public Passport) and do follow the mobile-safe-area padding pattern used elsewhere.** ThriveDesk and Messages both explicitly reserve bottom padding for fixed mobile chrome (`pb-[calc(6.5rem+env(safe-area-inset-bottom))]`, `pb-20 lg:pb-0`); CreatorEPK's `pb-32` on its content wrapper (CreatorEPK.tsx:387) follows the same convention for its fixed `EPKFooterCTA`, though the reservation is a constant while the footer's rendered height varies by claim state (see Public Passport, finding #12).
