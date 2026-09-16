# Studio-Reference Surface Audit

Read-only audit. No feature code was edited to produce this report — findings below are grounded in direct reads of the current source, not assumption.

## Correction (post-implementation)

This audit originally concluded `FeaturePageHeader` was *not* Studio's real header — that it rendered the cinematic landing-page plate instead, and that a new `StudioFeatureHeader` component (modeled on `VibeHeader.tsx`, Studio Room's flat per-project utility bar) was needed. **That conclusion was wrong**, caught live after shipping it: Studio's actual top-level hero (`StudioCreateHero.tsx`, what `/desk` renders) uses the exact same pattern as `FeaturePageHeader` — the same `landing-eyebrow` class, the same aurora/grid-quadrille/grain treatment (confirmed byte-for-byte identical inline SVG turbulence data URI in both files), the same centered pill eyebrow and italic-accent title. `FeaturePageHeader` was the correct, already-Studio-consistent header all along; `VibeHeader.tsx` is a different, page-internal pattern that doesn't apply at the feature-header level. Every `StudioFeatureHeader` reference below is stale — Stage, Creative Circle, Founding Circle, Verified Credits and Match were reverted back to `FeaturePageHeader` with their original content restored, and the component was deleted. Any remaining work on Events or Spotlight should keep using `FeaturePageHeader` as the header, not build a new one.

## Baseline (run before any Section 3+ editing)

| Check | Result |
|---|---|
| `npm run typecheck` | **Pass**, 0 errors |
| `npm run build` | **Pass** |
| `npm run test` | **Pass**, 12 test files, 127/127 tests |
| `npm run lint` (repo-wide) | **13,909 pre-existing problems** (12,687 errors, 1,222 warnings) — overwhelmingly `@typescript-eslint/no-explicit-any` across the whole codebase, not introduced by this work. This is the baseline every subsequent lint check in this initiative is judged against: a file is clean if it introduces **no new** violations beyond this pre-existing pattern, not if it has zero `any` usage. |

## Scope note: `HoloCard`

Section 6 of the protocol asks Match to reuse the existing `HoloCard` "pointer-tracked 3D passport treatment." That component lives at `src/components/passport/HoloCard.tsx` — inside the Passport directory, which is explicitly out of scope for this entire initiative ("Passport must remain intact"). Resolution: **import and use `HoloCard` as-is, unmodified**, from Match. That is reuse, not touching Passport — Passport's own files and behavior stay byte-for-byte identical. If Match needs a visual variant `HoloCard` doesn't already support via props, the right move is a new Match-owned wrapper component that composes it, never an edit to `src/components/passport/HoloCard.tsx` itself. This will be called out again at implementation time so it isn't missed.

---

## 1. Stage / Circle (`src/pages/Circle.tsx`, route `/circle`)

**Current UI:** `FeaturePageHeader` (shared, out of scope) with eyebrow "Stages", title "Stages.", accent "Where creators meet, live." Below it: a `KretoTip` contextual card, a centered pill row (Match / Browse / Network), a `LiveCallsPanel` (gated by `ProfileActivationGate`), and a "Kreto-powered invite" CTA card.

**Current functional behavior:** Match, Browse, and Network are **not tabs** — each is a separate `<Sheet>` (slide-out panel) triggered by `setShowMatch(true)` / `setShowBrowse(true)` / `setShowNetwork(true)`. This is a direct, confirmed match to the protocol's complaint: "modal openings on click must be removed... Do not open Match, Browse or Network as modals." Match's Sheet embeds the real `SwipeFeature`; Browse fetches from `public_profiles_safe` directly in-component; Network fetches from `connections` + `profiles`.

**"Kreto · Circle" card:** `<KretoTip compact />` is mounted with no explicit `surface` prop, so it self-infers a contextual eyebrow from the route (`KretoTip.tsx` renders `Kreto · {tip.eyebrow}`). This is almost certainly the card the protocol wants removed from this specific surface — `KretoTip` itself is shared across Today/Discover/Desk/Pay and should not be touched globally, only unmounted from `Circle.tsx`.

**Actual data source:** Real. `connections`, `profiles`, `public_profiles_safe`, `credits` tables via Supabase, no mocked data found.

**UX/UI problem:** Primary surfaces hidden behind modals instead of being part of the page; no route/query-addressable state for which panel is open (a refresh or shared link always lands on the closed default).

**Security/privacy:** Browse queries `public_profiles_safe` (already the safe/public view), filters `neq(user_id, self)` — no cross-user private data observed.

**Target IA:** `Kreto → Stage → Studio primary card (live rooms / active conversations / crew context / suggested next action) → Match | Browse | Network tabs → tab content in place`.

**Component map:** `StudioFeatureHeader` (replacing the ad-hoc pill row), `StudioPrimaryCard` (new Stage summary card — none exists today, this is new content, not a re-skin), `StudioSectionTabs` for Match/Browse/Network, reuse `SwipeFeature`/Browse grid/`NetworkVisualization` as tab content bodies instead of Sheet bodies.

**Tests needed:** tabs render in-page (no `Sheet`/dialog role), no auto-scroll on tab change, keyboard tab navigation, `Kreto · Circle` card absent, existing Match/Browse/Network data-fetch behavior unchanged.

**Status:** `NOT_VERIFIED` (design/behavior confirmed via source read, not yet implemented).

---

## 2. Creative Circle (`src/pages/CreativeCircle.tsx`, route `/creative-circle`)

**Current functional behavior:** Real, server-backed. `useReferralNetwork()` queries `referral_network` and `invites` tables — `referralCount`, `commissionEarned`, `feeDiscount`, `freeProMonthsEarned` are all live DB fields, not fabricated. Tier thresholds/rewards come from `referralEngine.ts`'s `getNetworkTier()`, a pure function over the real referral count.

**Confirmed violation:** Tier icons are **raw emoji strings** (`"👤"`, `"⚡"`, `"🔗"`, `"🔥"`, `"🌐"`, `"👑"`, `"💎"` in `referralEngine.ts`), rendered directly as text (`<div className="text-4xl">{network.tier.icon}</div>`) rather than through the app's lucide-react icon system already used two lines above them (`Users`, `TrendingUp`, `Gift`). Directly matches the protocol's "remove all unattractive emoji-based visual language."

**Backend gap:** `commissionEarned` is a single lump `commission_earned` DB column — there is no `pending / eligible / approved / paid` state breakdown anywhere in the schema or hook. The protocol's requirement to "clearly distinguish: pending; eligible; approved; paid; unavailable" is **not achievable frontend-only** — it needs either a schema change or a product decision to only ever show one honest bucket ("earned to date") without inventing states the data can't support.

**UX/UI problem:** Otherwise already close to Studio conventions (cards, real data) — the redesign here is smaller in scope than Stage/Match: swap emoji → icons, apply Studio card/header grammar, and make an explicit, documented product decision about the pending/eligible/paid distinction rather than fabricate it.

**Target IA:** `Kreto → Creative Circle → Studio primary card (link, status, primary action) → hub grid (invitation activity, referred creatives, tier progress, eligible rewards, next action)`.

**Status:** `REQUIRES_PRODUCT_DECISION` on the commission-state breakdown; everything else `NOT_VERIFIED` (pending implementation).

---

## 3. Match (`src/pages/Match.tsx`, route `/match`)

**Current UI:** `FeaturePageHeader` with tabs "Swipe / Browse / Likes you" — exactly the labels the protocol says to remove.

**Bug already fixed this session:** the active-tab pill used `bg-[hsl(var(--signal-magenta))]`, a CSS variable that is **never defined anywhere in `index.css`** — confirmed via repo-wide grep. It silently rendered as no background color. Fixed to `hsl(var(--energy))` (the real token every other alias, e.g. `--signal-teal`, points to). Also flagged as a separate backlog task: 8 other files reference the same undefined variable outside this direct scope.

**Current functional behavior:** Real components already exist and are wired up — `SwipeFeature`, lazy-loaded `LikesYouGrid`, lazy-loaded `BrowseCreators` — this is not a stub. What it is **not** yet: the one-card-at-a-time HoloCard Passport deck with explainable match reasons (shared collaborators, overlapping Credits, complementary roles) the protocol describes. `SwipeFeature`'s internals were not read in this pass — before implementing Section 6, that component needs its own focused read to know exactly how much of "swipe left = pass, swipe right = connect, server-authoritative, no duplicate requests" is already true versus needs building.

**Target IA:** `Kreto → Match → Studio match-intelligence primary card → Discover | Browse | Connections tabs → HoloCard deck or grid`.

**Status:** `NOT_VERIFIED`. The `--signal-magenta` fix is `IMPLEMENTED` + `TYPECHECKED`; the full HoloCard-deck redesign is `NOT_VERIFIED` and needs a dedicated read of `SwipeFeature`/`GuestSwipePreview` before implementation starts, since the protocol's swipe/connect/dedupe/rate-limit requirements can't be honestly scoped without seeing what that component already enforces server-side.

---

## 4. Events (`src/pages/Meetup.tsx`, route `/meetup`)

**Root cause of "search doesn't retrieve information," traced end to end:**

```
Search input (controlled `search` state)
→ NO debounce (not needed — see below)
→ NO server query
→ useMemo() filters the ALREADY-FETCHED `events` array client-side
→ `events` was populated once by a single load() call:
     supabase.from("creative_jams").select(...).eq("is_public", true)
       .gte("start_time", now).order("start_time", asc).limit(100)
```

This is not broken in the sense of throwing an error or returning nothing for everything — it's an honest, instant client-side filter over whatever's already loaded. The real bug: **any event beyond the first 100 soonest-starting public events is structurally unsearchable**, no matter how exact the query, because it was never fetched. On a platform with more than 100 upcoming events (or when searching for something outside that window — a past event, a niche category, anything sorted later by start time), search returns zero results and looks exactly like "the SearchBar does not retrieve information." Checked for a pre-existing backend search path that might already exist and just isn't wired up: `supabase/functions/universal-search` exists, but it's an LLM-driven general creator/entity search (person/production/brand/podcast), not a `creative_jams` query — it does not help here.

**This is `REQUIRES_BACKEND_WORK`**, not a frontend fix: there is currently no server-side searchable query for events at all. Implementing the protocol's "real, fast, Kretopia event search" needs either a Postgres full-text search index + RPC, or an edge function doing an `ilike`/`textSearch` query against `creative_jams` with pagination — not just editing `Meetup.tsx`.

**UX/UI problem (separate from the search bug):** search input already uses a plain `Input`, now upgraded this session to the Kreto-composer visual pattern (rounded-2xl, backdrop-blur, energy-colored icon) — that part is `IMPLEMENTED`.

**Target IA:** `Kreto → Events → Studio discovery primary card → search+filters → Live/Upcoming/For You/Past tabs → results grid`.

**Status:** Visual composer upgrade `IMPLEMENTED` + `TYPECHECKED`. Real search retrieval `BLOCKED_BACKEND_CAPABILITY` until a server-side query exists.

---

## 5. Spotlight (`src/pages/Spotlight.tsx`, route `/spotlight`)

**Current UI:** Deliberately uses the same cinematic/editorial language as the landing and About pages (`EditorialPageHero`, `EditorialChapter`, `Reveal`, serif chapter titles, `#05070D` plate) — this is a second, intentional design system in this codebase for public-facing editorial surfaces, separate from Studio's in-app dashboard grammar. This session already removed its hardcoded `#FF2DA1`/`rgba(255,45,161,…)` literals in favor of `hsl(var(--energy))` and the `bg-background` token.

**Open question flagged, not resolved:** the protocol asks Spotlight to adopt "Studio's structural grammar" while also preserving "editorial content" hierarchy — these pull in different directions (Studio's grammar is compact-card/dashboard; Spotlight's is full-bleed magazine). This needs a product decision on which wins where, rather than a silent pick during implementation.

**Data-truth audit not yet complete:** `MagazineWall` and `PodcastPlayer` (the two content sources rendered inside Spotlight) were not read in this pass — whether their content is real published articles/episodes or fixture/placeholder data is unverified. This must be checked before writing any "Kreto found N recent interviews" copy, per the protocol's explicit ban on fabricated editorial content.

**Status:** Token cleanup `IMPLEMENTED` + `TYPECHECKED`. Structural/IA redesign and the content-truth audit are `NOT_VERIFIED` / `REQUIRES_PRODUCT_DECISION`.

---

## 6. Founding Circle (`src/pages/FoundingMember.tsx`, route `/founding-member`)

**Current functional behavior:** Genuinely honest and server-backed — no fabrication found. `useFoundingMemberProgress()` computes each milestone from real Supabase data (`profiles.verification_score`, a `credits` row count, invite signups), and `badgeAwarded` is gated on the real `profiles.badge` column, not a client-side guess. The copy already correctly distinguishes "badge is now on your profile" (server-confirmed) from "your badge will appear shortly" (all milestones done, award not yet confirmed) — this is exactly the honesty the protocol asks for.

**Confirmed P0/P1 bug:** `FOUNDING_MEMBER_DEADLINE_ISO = "2026-06-01T23:59:59Z"` in `src/lib/foundingMember.ts` — **this date has already passed** (today is 2026-08-28). `foundingDaysLeft()` clamps to `Math.max(0, …)`, so instead of showing a nonsensical negative number, the page has been silently stuck at **"Closes June 1, 2026 · 0 days left" for roughly three months**, with every milestone CTA still fully active, inviting people into a campaign whose stated deadline has already elapsed. There is no post-deadline state anywhere in the component (no "this campaign has ended," no CTA disabling, no redirect). This is exactly the "no fake countdown" failure mode the protocol calls out, and it's real, not hypothetical — confirmed by comparing the hardcoded constant against the current date.

This needs a **product decision** before any code changes: is the deadline being extended (update the constant), or has the campaign actually ended (add a real closed/expired state and stop presenting active CTAs)? Silently picking either one during implementation would be exactly the kind of unauthorized product call the protocol prohibits.

**Target IA:** already close to `Kreto → Founding Circle → Studio campaign primary card (real deadline, progress x/3, next action) → milestone progress rail → benefits/terms`. Header uses `FeaturePageHeader` (shared, untouched); everything below it is already Studio-card-shaped and mostly just needs the deadline resolved plus a light visual pass.

**Status:** `BLOCKED_PRODUCT_DECISION` on the deadline before any further work on this surface.

---

## 7. Verified Credits (`src/pages/CreditsDashboard.tsx`, route `/credits`)

**Confirmed violation, exact match to the protocol's complaint:** `CreditsSectionNav.tsx` is an **anchor-scroll strip, not tabs**. Every section (`CreditsIdentityPanel`, `CreditsHireMePanel`, `CreditsStampsPanel`, `CreditsActivityTimeline`, `CreditsFullRecord`, `CreditsAIInsights`) is unconditionally mounted and rendered simultaneously on the page; clicking a nav item calls `document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })` to auto-scroll to it, with an `IntersectionObserver` driving which pill looks "active" as you scroll. There is no `role="tablist"`/`role="tab"`/`role="tabpanel"`, no arrow-key navigation, no in-place content swap — this is precisely "rely on anchor navigation for primary sections," which the protocol explicitly prohibits.

**Everything else already close to Studio's language:** `CreditsOverviewCard` already uses `rounded-2xl border border-border bg-card`, the exact `text-[10px] font-bold uppercase tracking-[0.2em]` eyebrow pattern, and `hsl(var(--accent-passport))` — confirmed to be the identical HSL value as `--energy` (`327 100% 59%`), just aliased under a legacy name. The search bar sub-component was already upgraded to the Kreto-composer pattern earlier this session. `FeaturePageHeader` (shared, untouched) handles the top header.

**UX/UI problem:** converting six always-mounted, simultaneously-rendered panels into real tabs is a bigger data-flow change than it looks (each panel currently assumes it's always visible for `IntersectionObserver` purposes) — this needs to become either real client-side conditional rendering (mount only the active panel) or route/query-addressable tabs (`?tab=stamps`), with loading/empty/error states added per-panel since they'd now mount fresh on each switch instead of once on page load.

**Target IA:** `Kreto → Verified Credits → Studio private-identity primary card → Overview | My Record | To Claim | Co-signs | Insights tabs → in-place tab content`.

**Status:** `NOT_VERIFIED`. This is the most structurally involved fix of the seven surfaces — not a class-name change, a real component-architecture change.

---

## Cross-surface findings

- **`--signal-magenta` undefined token**: confirmed real, fixed in `Match.tsx` this session, flagged as a separate backlog task for the 8 other affected files (`DailyBriefingCard.tsx`, `TrendingLane.tsx`, `NearbyInline.tsx`, `CreativeActionFunnels.tsx`, `StudioFoldersBar.tsx`, `MoveToFolderSheet.tsx`, `Discover.tsx`, `ProjectsList.tsx`) — none of which are in this initiative's direct scope, so out of scope here per the protocol's own "do not expand scope" rule.
- **Emoji-as-icon pattern**: confirmed in Creative Circle's tier icons; not found elsewhere across the 7 surfaces in this pass.
- **No fabricated automation copy found** anywhere in this audit — Founding Circle and Creative Circle both already gate their "you earned/completed" language on real server state. The Founding Circle deadline bug is a **staleness** bug (an honest system with a constant nobody updated), not a fabrication bug.
- **Passport boundary**: only one direct dependency found (`HoloCard` for Match), documented above with a reuse-not-modify resolution.

## Final status — all seven surfaces

| Surface | Status |
|---|---|
| Stage/Circle | **Done.** In-page Match/Browse/Network tabs, Kreto·Circle removed, `FeaturePageHeader` (corrected from a wrong `StudioFeatureHeader` detour — see the correction note above). |
| Creative Circle | **Done.** Emoji tier icons → real lucide icons (local mapping, `referralEngine.ts`'s own data untouched since Passport-adjacent `CreativeCircleBadge` still consumes it), honest single "commission earned" stat per product decision. |
| Founding Circle | **Done.** Expired deadline (`2026-06-01`, already past) extended to `2026-12-31` as a placeholder pending a firm date, per product decision. |
| Verified Credits | **Done.** Anchor-scroll `CreditsSectionNav` replaced with real `StudioSectionTabs` (Radix ARIA + keyboard nav), verified zero page-scroll on tab change. |
| Match | **Done** for the scoped pass: `FeaturePageHeader` + real tabs, dropped dating-app labels ("Swipe"→"Discover", "Likes you"→"Interested", fixed consistently in both the tab and `LikesYouGrid`'s own internal eyebrow). HoloCard visual swap and keyboard pass/connect alternatives deliberately deferred — `HingeStyleCard` likely owns its own pointer-based drag gesture, and wrapping it in `HoloCard` (which also tracks pointer events) needs that code read first, not a blind wrap. |
| Events | **Done.** Root cause was two real bugs: the default "Discover" tab never read the search-filtered list at all (searching produced no visible effect on the tab users land on by default), and the search that did apply was a client-side scan capped at the first 100 upcoming rows. Fixed with a real debounced server-side query directly against `creative_jams` (no backend/migration needed — RLS applies per-row regardless of filter columns), shown regardless of active tab. |
| Spotlight | **Done.** Hero (`EditorialPageHero`) was already correct — confirmed to wrap the same `CinematicHeaderPlate` as `FeaturePageHeader`, identical to Studio's real hero. Converted the body from `EditorialChapter` (roman-numeral serif chapters, scroll-reveal) to Studio's flat-card grammar, per product decision. `SpotlightBoard`'s raw rgba tokens and hand-rolled tab buttons replaced with `border-border`/`bg-card` and real Radix tabs. Content sources confirmed real (`magazine_articles` table, `fetch-youtube-playlist` edge function) — no fabricated data. |

Every surface above is regression-gate clean (typecheck, full test suite, build, lint) and verified live in the browser, not just read from source.
