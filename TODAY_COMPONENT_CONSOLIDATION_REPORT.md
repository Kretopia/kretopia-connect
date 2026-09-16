# Today — Component Consolidation Report

Scope: full rebuild, per your explicit decision — not a rename of
`TodayThreeCards`, a genuine restructure of the page's content architecture
into exactly three top-level interactive components.

## Before

`UnifiedHome.tsx` composed the authed experience through `TodayCommandCenter`'s
six loosely-named tiers (`entry`/`nextAction`/`schedule`/`activeWork`/
`opportunities`/`supporting`), fanning out to ~15 independent components:
`TodayThreeCards`, `KretoTip`, `SurfaceProactiveCards`, `UpcomingSessionsCard`,
a local `SoundStagesSection`, `SpeedTonightCard`, a "People for you" carousel,
`DailyBriefingCard`, `DuplicateAccountBanner`, `GetStartedChecklist`, then a
closed-by-default `<details>` hiding `MorningPulse`, `ApprovalsHub`,
`ScoutedGigsSection`, `MoneyBrief`, `TrendingLane`, plus `PushNotificationPrompt`
outside it. Nothing filtered, nothing had a shared visual system, and the
dashboard's actual primary content (approvals, deadlines, discovery) was
hidden behind a closed disclosure by default.

## After

Three components, each wrapped in the new shared `TodaySectionShell`
primitive (`src/components/home/TodaySectionShell.tsx` — consistent icon +
eyebrow + title header, one card system instead of three unrelated ones):

**A. `TodayFocus`** (`src/components/home/TodayFocus.tsx`) — the single
highest-priority action, computed fresh, not three tiles: an overdue task >
a task due today > a pending AI proposal > the freshest scouted gig > a
calm "all caught up" state. Real inline actions: Complete/Snooze a task
(writes `project_tasks.status`/`due_date`), Review/Not now on a proposal
(writes `agent_proposals.status`, same table `SurfaceProactiveCards` already
used).

**B. `MoreFromToday`** (`src/components/home/MoreFromToday.tsx`) — the
dominant, always-visible dashboard (no more closed `<details>`). Real,
stateful filter chips (All / Approvals / Deadlines / Discover / Schedule)
with live counts, gating:
- Approvals → `SurfaceProactiveCards` + `ApprovalsHub` (existing, reused as-is)
- Deadlines → a new list (project tasks due within 7 days) with real inline
  Complete/Snooze/Open-Project actions per row
- Discover → People-for-you carousel (moved here from the old `opportunities`
  tier) + `ScoutedGigsSection` + `TrendingLane`
- Schedule → `UpcomingSessionsCard` + Sound Stages rail + `SpeedTonightCard`

Below the filtered area, the always-relevant single widgets are unfiltered
(they already self-hide when empty): `KretoTip`, `DailyBriefingCard`,
`DuplicateAccountBanner`, `GetStartedChecklist`, `MoneyBrief` (compact),
`PushNotificationPrompt` — plus a preserved unread-messages banner (the one
signal `MorningPulse` uniquely carried, now surfaced here instead of lost).

**C. `Momentum`** (`src/components/home/Momentum.tsx`) — real completed-task
count this week, real active-project count and rail (the data `MorningPulse`
used to show as "Active Studios", same query, new framing), and the single
nearest non-overdue upcoming task as "next milestone." No streak — per the
spec's "only if real," and no genuine streak concept exists in this schema,
so none was invented.

## Retired, not deleted

`TodayThreeCards.tsx`, `MorningPulse.tsx`, `TodayCommandCenter.tsx` are
unreferenced after this pass but left in the repo (zero call sites,
confirmed by grep) — same "don't delete without checking references"
convention as prior passes. `KretoTip` and `ApprovalsHub`/`ScoutedGigsSection`/
etc. are still very much alive, just recomposed under the new structure
instead of removed.

## Verified

- `npm run typecheck` — clean. `npm run test` — 99/99 passing.
  `npm run build` — clean.
- `npx eslint` on all 6 touched/new files — the only remaining `any` is a
  single unavoidable RPC-name cast (`get_unread_message_count`, not in the
  generated Supabase types), identical to the same necessary cast already
  present in `MorningPulse.tsx`. Every other `any` this pass could have
  introduced was typed properly instead (see per-file diffs).
- **Live-verified in the browser**, logged in as a real account: personalized
  greeting rendered correctly ("Gabriel, here's what moves you forward
  today." / composer's "What's next, Gabriel?" — deliberately different
  text, no duplicate-H1-style repeat); Today Focus rendered a real pending
  proposal with working Review/Not now buttons; More from Today's filter
  chips showed live counts (Approvals 4) and actually filtered content when
  clicked (confirmed Discover-only view hid Approvals/Deadlines/Schedule,
  confirmed via a DOM text-walk, not just a screenshot); Momentum rendered
  real numbers (2 done this week, 2 projects moving forward) with real
  project cards (AI Fashion Models, Kretopia Feature Bible v1).
- **One regression caught and fixed during this same verification pass**:
  my first version of the Sound Stages sub-header in `MoreFromToday` always
  rendered its "Sound Stages this week" label even when the rail had
  nothing to show — the original `SoundStagesSection` guarded against
  exactly this ("avoids a stranded 'this week' header"). Fixed by restoring
  the `onLoad`/count-gating pattern; confirmed live that the header now
  correctly disappears when the rail is empty.

## Not independently verified

Reduced-motion behavior (the staged entrance animation and each component's
internal transitions correctly collapse to `duration: 0` — code path exists
via `useReducedMotion()`, matching the app-wide convention, but not
re-tested at the OS-level reduced-motion setting this session). Keyboard-only
navigation through the filter chips and per-item action buttons (all are
real `<button>`s with existing focus-visible styling, but not tabbed through
manually).
