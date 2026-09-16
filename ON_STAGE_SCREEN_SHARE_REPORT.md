# On Stage — Screen Share Report

## Status: pre-existing, working, unmodified in logic

Screen share was already fully implemented before this phase (confirmed in
the Phase 1 audit) and this phase did not change its core logic --
`toggleScreenShare` calls Daily's own `startScreenShare()`/
`stopScreenShare()`, which internally uses the browser's native
`getDisplayMedia()` consent flow (a direct user gesture on the button
triggers it, satisfying the brief's "must be user-initiated" requirement
by construction -- there is no code path that could call this without a
click). State sync (`local-screen-share-started`/`-stopped` events)
correctly flips the button state on success, denial, or the user stopping
sharing from the browser's own picker UI (all three are the same Daily
event pair, already handled).

## What this phase changed

Two things, both additive, no logic changes:

1. **Visual**: the "start sharing" button now uses the grey-to-pink
   gradient CTA treatment when idle (about to start), reverting to a plain
   `lime`/outline "active" look while sharing -- matching the brief's
   explicit inclusion of "Start screen share" in its CTA-treatment list.
2. **Quality**: `sendSettings.screenVideo: "detail-optimized"` (see
   `ON_STAGE_VIDEO_QUALITY_REPORT.md`) -- a real Daily encoding preference
   favoring legible shared content, not previously configured (was
   provider-default, unconfigured).

## Existing behavior, re-confirmed by source reading this pass

- Shared screen is promoted to a hero tile above the stage/audience
  sections (`activeScreenShare`, unchanged).
- Presenter's own camera tile remains visible alongside (not replaced).
- Desktop-only button (`hidden sm:inline-flex`) -- correct, since mobile
  browsers largely can't call `getDisplayMedia()`.
- Failure/denial surfaces a real toast ("Couldn't share screen"), not a
  silent failure.
- Cleanup: stopping (by button or by the browser's own "Stop sharing" UI)
  correctly flips `sharingScreen` back via the same event listener either
  way -- there's no separate manual-stop-only code path that could get out
  of sync with a browser-initiated stop.

## Not independently re-verified this pass

Driving the actual `getDisplayMedia()` consent flow end-to-end (picking a
window/tab/screen, confirming the hero tile actually shows the shared
content, confirming a real "track ended" event from stopping via the
browser's own UI) — **NOT_AVAILABLE** in this sandboxed browser
environment, which cannot grant that permission. The button, its gradient
state, and the event wiring were confirmed present and correctly
structured by source reading and live-rendered in every test Stage this
pass (visible, correctly styled, correctly disabled/enabled per
`meSpeaker`), but the actual OS-level share-picker flow was not exercised.

## Files changed

`src/components/circle/SoundStageRoom.tsx` only.
