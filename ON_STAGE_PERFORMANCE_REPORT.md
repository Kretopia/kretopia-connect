# On Stage — Performance Report

Scope: `SoundStageRoom.tsx` only (Sound Stages), per the approved Phase 2
scope. Classification tags per the brief: NOT_STARTED, AUDITED, IMPLEMENTED,
TYPECHECKED, UNIT_TESTED, INTEGRATION_TESTED, BROWSER_VERIFIED,
PRODUCTION_VERIFIED, REQUIRES_REALTIME_PROVIDER_CHANGE,
REQUIRES_BACKEND_WORK, REQUIRES_PRODUCT_DECISION, BLOCKED.

No profiler/CPU/memory tooling was available in this environment (no
production-scale test room, no browser performance-profiling access) — every
item below is SOURCE_CONFIRMED against the actual event/render logic, not
measured with hard numbers. Flagging that distinction rather than inventing
metrics.

## Fixed this pass

**Full member re-fetch on every single Daily event, no debouncing —
the audit's top-flagged risk.** `onAny` (bound to
`participant-joined/updated/left`, `joined-meeting`,
`track-started/stopped`) called `refreshMembers()` synchronously on every
firing. Daily fires these independently per track per participant, so a
group join or a burst of camera/mic startups could trigger many full
re-fetches (each walking `call.participants()` and, for any new user_id,
a Supabase profile lookup) within milliseconds, each followed by a
`setMembers` React state update and a re-render of every visible tile.
Coalesced into one refresh per 150ms window instead. The timer lives in
the enclosing effect's own scope (not a ref, since `onAny` is defined
inside an async `init()` nested in the effect, where `useRef` isn't
callable) so the effect's existing cleanup function can clear it directly
alongside its other teardown — verified no dangling timer survives an
unmount or an `open` flip. **IMPLEMENTED, TYPECHECKED, BROWSER_VERIFIED**
(the debounced path was exercised in every live Stage session this pass —
join/record/leave cycles all still worked correctly with the 150ms
coalescing in place; not independently measured for actual event-burst
frequency reduction, since reproducing a real multi-participant join burst
wasn't possible with a single test account in this environment).

**Audience grid had no upper bound on mounted tiles.** "Audience" format
rooms allow up to 200 people; the audience section mapped the entire list
unconditionally. Capped to 24 tiles by default with an explicit "+N more"
expand, rather than pulling in a virtualization library: audience members
are always rendered as plain avatar tiles (`StageTile`, never
`VideoStageTile`) regardless of room mode — confirmed by reading the
render branch, no video or audio track is ever mounted for a pure
audience member, only for those promoted to the stage — so the actual
cost being bounded here is DOM node count and the per-tile `useMemo`
color calculation, not media/CPU load. A full virtualization approach
would be solving a bigger problem than exists today. **IMPLEMENTED,
TYPECHECKED**; BROWSER_VERIFIED only for the zero/near-zero-audience case
this pass produced (a single test account can't populate 24+ audience
members) — the cap/expand logic itself was read back correctly in the
accessibility tree (heading count updates correctly), but the "+N more"
button's actual appearance past the 24-tile threshold was not visually
exercised.

## Already correct — confirmed, not touched

- **Cleanup on leave/unmount**: `teardownDailyCall` (stops local video,
  stops local audio, `leave()`, `destroy()`, each independently
  try/caught) and `cleanupCall` (same pattern plus `end-sound-stage` when
  the host leaves) were already solid per the Phase 1 audit — re-confirmed
  this pass, not modified. The mic-check preview's `getUserMedia` stream is
  explicitly stopped on phase change/unmount. **AUDITED, SOURCE_CONFIRMED**.
- **No continuous polling during the live call**: the VU-meter
  `requestAnimationFrame` loop (used for the mic-check preview's live
  volume bars) is scoped to `phase === "miccheck"` only and explicitly
  torn down (`cancelAnimationFrame`) before the real call starts —
  `localLevel` stays `0` for the rest of the session, so the "own volume"
  glow-sizing effect is mic-check-only by original design, not something
  silently running every frame during an active multi-participant call.
  Active-speaker detection during the live call is Daily's own
  event-driven `active-speaker-change`, not polled. **AUDITED,
  SOURCE_CONFIRMED** — this is a correctness/scope note more than a
  performance finding, since nothing needed changing.
- **Daily SDK already lazy-loaded and code-split**: confirmed again this
  pass via the production build output — `daily-esm-*.js` is its own
  248.86 kB / 69.02 kB gzip chunk, not in the main bundle, loaded only via
  the existing dynamic `import()` in `dailyFrame.ts`. **AUDITED,
  PRODUCTION_VERIFIED** (build output inspected directly).
- **Motion uses transform/opacity, not layout-triggering properties**: the
  fullscreen shell's own entrance (`animate-in fade-in`) and every
  speaking-ring/badge animation use opacity, box-shadow, or transform —
  none animate `width`/`height`/`top`/`left` in a way that would force
  synchronous layout on every frame. **AUDITED, SOURCE_CONFIRMED**.
- **Stable keys**: every mapped list (`stage`, `audience`,
  `remoteAudioTracks`) already keys on `sessionId`, not array index.
  **AUDITED, SOURCE_CONFIRMED**.

## Not independently re-verified this pass

- **Join-to-first-video / remote-first-frame timing, actual CPU/memory
  under load, reconnection latency**: no instrumentation exists to measure
  these, and no multi-participant load test was possible with a single
  test account in this environment. **NOT_STARTED** as measured metrics —
  the debounce/cap fixes above address the two mechanisms most likely to
  cause the state-update-frequency and unbounded-DOM-growth symptoms the
  brief's checklist is really asking about, but neither was benchmarked
  with real numbers.
- **Repeated join/leave cycle for leak detection**: exercised manually
  several times this session (create → record → leave, multiple times)
  with no observed degradation, but not verified via an actual memory
  profiler (heap snapshots before/after N cycles). **BROWSER_VERIFIED**
  for functional correctness (no stale state, no duplicate media
  sessions, no crash across repeated cycles this session) but **NOT
  PRODUCTION_VERIFIED** for actual memory-leak absence.

## Files changed this pass

`src/components/circle/SoundStageRoom.tsx` only.

## Verification

`npx tsc --noEmit -p tsconfig.app.json`, `npm run test -- --run` (127/127),
`npx eslint` (zero new issues beyond the pre-existing baseline, confirmed
via `git diff` grep), and `npm run build` all clean.
