# Stage UX/UI Overhaul Report

Covers the Stage portion of the Kreto/Stage/Recordings/Landing sprint. Built
directly on the Phase 1 audit findings (`KRETO_STAGE_RECORDINGS_CONVERSION_AUDIT.md`
§B) — the two concrete architectural problems it identified are what this
work fixes.

## The two problems this fixes

1. **No dedicated "Stages" tab existed.** The page's own H1 already read
   "STAGES. Where creators meet, live.," but the actual tabs were
   Match/Browse/Network, with live-session content bolted on unconditionally
   below all three regardless of which was selected.
2. **Card sizing was genuinely inconsistent** across three separately-styled
   components: `SoundStagesRail` (fixed `w-[280px]` carousel), `CuratedStagesRail`
   (fixed `w-64`/`h-24` rail), and the Browse-tab grid (`aspect-[3/4]`) — no
   shared aspect ratio or card component.

## What was built

**`Circle.tsx`** — added `"stages"` as a real fourth tab (icon: `Radio`),
now the **default landing tab** when no explicit `?tab=` other than
match/browse/network is present. The old unconditional `LiveCallsPanel`
render below the tabs is gone; its content now lives inside the Stages tab
itself. The prior deep-link convention (`?tab=live` implicitly always
showing live content) is preserved: any unrecognized/legacy tab value still
resolves to Stages, not Match.

**`StagePrimaryCard.tsx`** (new) — the one primary card the spec requires,
answering exactly the four questions it specifies, with a real 3-state model
built from real data (no invented "replay" state — see limitation below):

- **LIVE NOW** (a `sound_stages` row with `is_live=true`, or else a `curated_stages`
  row with `status='live'`): host, title, live participant count, "Join Stage."
- **UPCOMING** (soonest `curated_stages` row with `status='scheduled'`): title,
  formatted start time, RSVP count, "Save your place."
- **NO LIVE SESSION** (neither exists): "Nothing live right now" +
  "Browse upcoming sessions" (anchors to the grid below) + "Start a Stage"
  (opens the existing `GoLiveSheet`, reusing the same auth-gate logic the
  page already had).

Subscribes to both tables via Supabase realtime so it updates live without a
refresh, matching the reactivity the two old rails already had.

**`StageCard.tsx`** (new, shared) — one card shape for both Stage types:
fixed 16:9 cover, host avatar, title, a text-labeled "● Live" badge (never
color alone), date/participant count, single primary action. Used in a
responsive grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`) that goes
single-column on mobile, never scrolls horizontally, and gives every card
equal visual weight — replacing the two divergent rails entirely.

**`StageGrid.tsx`** (new) — fetches live `sound_stages` + scheduled/live
`curated_stages` together, merges them into one list of `StageCard`s, and
adds what neither original rail had: a real fetch-error state with a Retry
button (both previously just silently fell back to their empty state on any
failure — the exact gap the Phase 1 audit flagged). Also realtime-subscribed.

**`LiveCallsPanel.tsx`** — restructured to lead with `StagePrimaryCard`, keep
the existing "Start a Stage / Find a Collaborator" quick-action row exactly
as it was (already correctly sized to match "Grow your circle" from earlier
work this session), then the new unified `StageGrid` in place of the two old
rail sections. Every existing handler — join, create, join-by-link,
in-call room rendering, Speed Sessions call sheet — is untouched; only the
visual/IA layer changed.

## Explicitly deferred, not faked

**REPLAY AVAILABLE is not implemented.** The Phase 1 audit for Recordings
found no real linkage between a Stage and a played-back recording anywhere
in the data model — building this state now would mean either fabricating
data or guessing at a join that doesn't exist yet. Per the sprint's own rule
("do not claim a replay exists if it does not"), this is deferred until the
Recordings work (next in this sprint) establishes real Stage↔recording
linkage, rather than shipped as a fake/non-functional tab.

## Not touched (protected, per the audit)

`CuratedStage.tsx` and its dedicated flow (`StageHostConsole.tsx`,
`ApplyToStageSheet.tsx`, `InviteToStageDialog.tsx`, etc.) — a separate route
this sprint didn't scope in. `CircleDetail.tsx`'s unrelated Crew-hub Stages
tab — a different feature that happens to share the word "Circle."
`SoundStageRoom.tsx` (the actual in-call room) and `GoLiveSheet.tsx`/`CreateStageSheet.tsx`
— reused exactly as they were; this was an information-architecture and
card-consistency pass, not a rewrite of the real-time call infrastructure.

## Accessibility

- `StageCard` is a real `<button>` with a full descriptive `aria-label`
  (action + title + type + live/when status) — not relying on visual layout
  alone for a screen reader to understand what a card does.
- Live status always carries the text "Live," never color/pulse alone.
- `StageGrid`'s pulse/skeleton states use `role="list"`/`listitem` semantics
  and `aria-busy`/`aria-label` on loading.
- Focus-visible rings added to `StageCard` (`focus-visible:ring-2`) — the
  audit found `CuratedStagesRail` had none.
- The "Browse upcoming sessions" anchor link uses `scroll-mt-20` so the
  jump target isn't hidden under the sticky header.

## Verification

- `npm run typecheck` / `npm run test` (127/127) clean — no new errors
  beyond the pre-existing, already-flagged SEPA types-drift.
- Live-verified in the browser, authenticated: the Stages tab renders first
  and is visually selected by default; the primary card correctly shows its
  NO LIVE SESSION state against this environment's real (empty) data;
  "Start a Stage" opens the existing `GoLiveSheet` with no errors; the grid's
  empty state renders correctly.
- Confirmed behaviorally (not just by inspection) that both new components'
  Supabase queries succeed: neither fell into its explicit error-state UI,
  which only renders on a genuine query failure.
- Live/upcoming card rendering inside the grid and primary card could not be
  visually verified against real populated data, since no stage was live or
  scheduled in this environment at the time of testing — the query logic
  mirrors the original rails' proven field names and filters closely enough
  to be low-risk, but this is worth a manual look once real stages exist.

---

Recordings is next per the audit's ordering.
