# On Stage — Video Quality Report

## What was implemented

`sendSettings` added to the Daily `createCallObject` call
(`SoundStageRoom.tsx`), confirmed against the installed `@daily-co/daily-js`
package's own type definitions, not guessed at:

```
sendSettings: mode === "video"
  ? { video: "adaptive-3-layers", screenVideo: "detail-optimized" }
  : { screenVideo: "detail-optimized" }
```

`"adaptive-3-layers"` is Daily's own documented preset: simulcast
low/medium/high encodings, with Daily's SFU choosing which layer to
forward to each receiver based on that receiver's actual real-time network
conditions, and recovering automatically when conditions improve. This is
the platform's own adaptive-bitrate mechanism -- nothing here hand-rolls
bitrate or resolution logic, and nothing forces a fixed resolution on
anyone, satisfying the brief's explicit "HD-preferred, not HD-forced"
requirement using the provider's real capability rather than reinventing
it. `"detail-optimized"` for screen video favors legible slides/text over
motion smoothness, the more likely case for a Stage's screen share.

**IMPLEMENTED, TYPECHECKED.** **RUNTIME_CONFIRMED indirectly**: every live
join this pass (multiple Stages, audio mode) succeeded with this option
present and no Daily API rejection -- if the preset string were invalid,
`createCallObject`/`join` would have failed outright, and it didn't.
**Not independently confirmed via `getStats()` inspection of actual
resolved encodings** -- no tooling for that was available in this pass,
and it wasn't required to prove the option is accepted and functioning at
a basic level.

## Network-quality indicator

Real, typed Daily event (`network-quality-change`,
`networkState: 'good'|'warning'|'bad'|'unknown'`) mapped to a text label
(Excellent/Good/Limited) in the top bar, never shown before the first real
reading, never color-alone (see the accessibility report). **IMPLEMENTED,
TYPECHECKED.** Not exercised with an actual degraded-network condition
this pass (no network-throttling tooling available) -- the event handler
itself is a one-line state update wired to a real, documented event, low
risk, but the "does it actually fire and show the right label under real
degradation" case is unverified beyond the type-correctness of the wiring.

## Explicitly not built this pass

**A user-facing quality-tier selector (Auto / HD when available / Data
saver)**, per the brief's own conditional: "Only show settings that are
functionally wired to the real media implementation." A selector wired to
`sendSettings` presets would be straightforward to add (swap the preset
string on a user toggle), but wasn't built without an explicit ask, since
UI surface area should match a real, requested capability rather than be
added speculatively. **REQUIRES_PRODUCT_DECISION** on whether this is
wanted; if so, it's a small, well-scoped follow-up (a 2-3 option toggle in
an overflow menu, changing the `sendSettings.video` preset value).

**"Reconnecting" quality state.** Documented already in the accessibility
and Phase-2-commit-1 notes: Daily's `network-connection` event exists but
its `event` field is an untyped string with no enumerated values in this
SDK version. **BLOCKED** on confirming those values before building
against them, not guessed at.

**Raw WebRTC stats in the UI.** Correctly absent per the brief's own
"no raw WebRTC stats in normal user UI" requirement -- confirmed nothing
in this component surfaces `getStats()` output directly.

## Files changed

`src/components/circle/SoundStageRoom.tsx` only (the `sendSettings`
addition and the network-quality state/UI, both part of Phase 2 commit 1).
