# Kreto New Room Performance Report

## Status: `PERFORMANCE_VERIFIED` (bundle/build level) — full CPU/frame-stability measurement during a real live-mic `listening` session is `DEFERRED` (see limitation below)

## Bundle impact (measured)

`npm run build`, before vs. after this pass:

- `VoiceFirstCreateModal-*.js`: 500.35 KB → 503.14 KB (**+2.8 KB**)
- `ThriveDesk-*.js`: 792.41 KB → 793.42 KB (**+1.0 KB**)

No new dependency was added — the entire increase is the new state/logic/JSX in these two files plus the small new `newRoomCaution.ts`/`StudioCreatedAcknowledgement.tsx` modules, all of which import only things already in the bundle (`framer-motion`, `react-router-dom`, the already-present `KretoPresence`).

## Requirements checked

- **No new dependency, no WebGL**: confirmed — same import set as before, plus the two new same-codebase modules.
- **No new network request**: confirmed by inspection — `isOffline` is driven by the browser's own `online`/`offline` `window` events, not a request; every other new state derives from data the existing `extract-brief`/`projects` calls already produce.
- **Reuses the existing Framer Motion/CSS system**: `listening`'s new pulse is one more branch in `KretoPresence`'s existing `signalAnimate`/`signalTransition` computation — no new animation primitive.
- **Does not delay input response, draft creation, or Studio navigation**: none of the new state is on the critical path of any of the four intake functions or `createProject()` — every new `set*Info`/`set*Error` call sits alongside existing calls in the same synchronous handler or the same `catch` block; nothing was added that awaits before them.
- **No animation loop after unmount**: `KretoPresence`'s animations are owned by Framer Motion components that unmount along with the rest of the modal when `open` becomes false (existing reset effect, untouched) — no new interval/rAF loop was added by this pass. The one real timer touched (`startTimer`/`stopTimer`, pre-existing) is unchanged.
- **Listener cleanup**: the new `online`/`offline` listener effect is scoped to `open` and returns a cleanup function removing both listeners — verified by reading the effect back after writing it; matches the same pattern the file already uses for its keydown/focus-trap listener.
- **No large asset in New Room unless lazy-loaded and measured**: not applicable — this pass only uses `card`/`compact` sizes, never `full` (which remains unused everywhere, per `KRETO_SURFACE_PLACEMENT_MAP.md`).

## Limitation this pass: live-mic frame stability

`KRETO_HERO_NEW_ROOM_PERFORMANCE_REPORT.md` (the prior audit) flagged that `listening` would be the first surface where `KretoPresence` animates continuously *during* a real, latency-sensitive action (live `MediaRecorder` capture), and recommended measuring CPU/frame stability during an actual recording session before calling this fully performance-verified. That measurement was not performed this pass — the live browser verification exercised the *text* intake path in full (including a real `extract-brief` round trip), not a real microphone recording, since a scripted browser session doesn't have a real audio input device to record from. The `listening` state's own rendering is unit-tested (`KretoPresence.test.tsx`) and its trigger conditions are integration-tested (`VoiceFirstCreateModal.test.tsx`'s mocked-`MediaRecorder` tests), but real-hardware frame stability during actual voice capture remains unverified and is flagged here rather than assumed.
