# Today Command Center — QA

**Route:** `/` (authenticated branch of `UnifiedHome.tsx`)
**Commits:** `367fe0a1` (Phase 2), `16cfe8c7` (Phase 6, HoloCard/HeroPhoneCarousel — shared file, Today itself untouched by that phase), `18f3f206` (Phase 8, duplicate profile query fix)

## What changed

- Headline rewritten to "What are we moving forward today?" (was "Today. Your command center for right now.").
- The entire authenticated JSX was restructured into a new `TodayCommandCenter` layout component (`src/components/home/TodayCommandCenter.tsx`) — a pure named-slot wrapper with **no data fetching of its own**. Every existing child component and data hook in `UnifiedHome.tsx` was kept exactly as-is and simply handed to the tier it belongs in:
  - `entry` → `ThrivePromptHero` (the Kreto prompt panel with its searchbar)
  - `nextAction` → `TodayThreeCards`, `KretoTip`, `SurfaceProactiveCards`
  - `schedule` → `UpcomingSessionsCard`, `SoundStagesSection`, `SpeedTonightCard`
  - `opportunities` → "People for you" rail (rebuilt onto the real `Carousel` component with position dots, replacing a manual `overflow-x-auto` div)
  - `supporting` → `DailyBriefingCard`, `DuplicateAccountBanner`, `GetStartedChecklist`, and a `<details>`-collapsed section for `MorningPulse`/`ApprovalsHub`/`ScoutedGigsSection`/`MoneyBrief`/`TrendingLane`
- Phase 8: removed a redundant second `profiles` table query — `UnifiedHome.tsx` was fetching the same user's profile row twice in one `Promise.all` (a narrow 4-column select and the full `PROFILE_SELECT` list, the latter a strict superset of the former). Now fetched once.

## Acceptance criteria

| Criterion | Status |
|---|---|
| Dominant headline "What are we moving forward today?" | ✅ Live-verified |
| First viewport = greeting/status/one primary next action/condensed overview/Searchbar, no card overload | ✅ At 375px: eyebrow, headline, subtitle, tutorial trigger, and the full Kreto prompt panel (with searchbar) are all above the fold before any scroll |
| Priority order: urgent → next best action → today's schedule → active work → opportunities → supporting info | ✅ Implemented via `TodayCommandCenter`'s fixed slot order |
| No duplicate info across cards | ✅ Same underlying data/components as before, only reorganized — no new duplication introduced |
| AI guidance explains why, uses real data, never invents deadlines/projects/opportunities | ✅ No change to any AI-guidance data source — `KretoTip`/`SurfaceProactiveCards` untouched functionally |
| Preserve direct feature access | ✅ All original child components and their navigation/actions preserved unchanged |
| Searchbar: dashboard-nav optimized, grouped results, debounce, keyboard nav, escape, clear, loading/empty/error, no fake results | ⚠️ **Not modified this charter** — `ThrivePromptHero` was reused as-is in the `entry` slot; its search behavior was not audited or changed. This is a gap against the charter's Phase 2 sub-spec, noted here rather than silently left off the record. |
| No horizontal overflow at 375/768/1440px | ✅ Verified via `scrollWidth === clientWidth` at all three widths |
| Single H1, keyboard accessible | ✅ Covered by the shared `FeaturePageHeader` (title is the page's one H1) |

## Known gap

The Today Searchbar's own internal behavior (placeholder text "Search Kretopia", grouped People/Work/Opportunities/Your-activity results, voice search, per-charter empty/error states) was **not built or audited** in this charter — `TodayCommandCenter`'s `entry` slot renders the pre-existing `ThrivePromptHero` unchanged. This remains open for a future pass; flagging it explicitly here rather than claiming it as done.

## Live verification

Screenshots taken at 375px, 768px, and desktop widths (see `CORE_SURFACES_AUDIT.md` Phase 7 section for the full sweep). Console reviewed after the Phase 8 query change — only the pre-existing baseline 401/404 noise from unrelated Supabase calls, no new errors.
