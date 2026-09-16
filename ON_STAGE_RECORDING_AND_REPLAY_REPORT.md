# On Stage — Recording and Replay Report

## Status: recording pre-existing, replay pre-existing (different sprint),
## the link between them was the actual gap

**Recording** (start/stop, host-only, state synced to all participants via
real Daily events) was already fully working before this phase.

**Replay** (`RecordingReplayDialog.tsx` + `WatchReplayButton.tsx`, an
in-app player, no autoplay, correct signed-URL auth via
`get-recording-link`) was already fully working, but built in an *earlier*
sprint than this one (`RECORDINGS_REPLAY_MODAL_REPORT.md`), for the
Recordings page generally, not Stage-specific. `/recordings` already lists
Sound Stage recordings (`KIND_LABEL.sound_stage` already present) and
plays them through that same dialog -- **no new player, no duplicated
modal infrastructure was built or needed**, correctly satisfying the
brief's explicit "do not duplicate player/modal infrastructure" instruction.

**The actual gap**, per the Phase 1 audit: nothing inside `SoundStageRoom`
ever told a host where their recording goes. That's what this phase
closed.

## What was implemented

On leave, if the stage was actively recording, a toast fires: "Recording
saved" / "It'll appear in your Recordings once Daily finishes processing —
usually a few minutes after a stage ends." with a "View Recordings" action
(using `ToastAction`, existing infrastructure, confirmed rendered
correctly by `Toaster.tsx` before relying on it -- it had never actually
been used anywhere in the app until this pass).

Deliberately does not try to open the replay directly, poll for
readiness, or guess when the recording is ready: Daily's webhook resolves
a room to a `call_transcripts` row asynchronously, well after the call
ends, so there is nothing to show at the moment of leaving. Pointing at
the surface that already handles "not ready yet" correctly (its own copy
already says so) is the honest choice per the brief's own "no fake
success" requirement, rather than a spinner or fake-ready state here.

**Host-only, deliberately**: `get-recording-link`'s authorization for the
`sound_stage` call kind currently only actually grants access to
`created_by` (the host) -- a known, pre-existing, documented gap (see
Security report below and `docs/SECURITY_FINDINGS.md`'s
`call_transcripts` RLS note). Showing this toast to non-host
speakers/audience would promise replay access they likely can't get.
**REQUIRES_PRODUCT_DECISION** on whether closing that RLS gap (so
co-hosts/speakers can also replay) is wanted -- out of scope for this
phase per the brief's own "don't touch RLS to make a UI action work"
instruction.

## Live verification (not just code review)

Started a real audio Sound Stage, tapped Record, confirmed Daily's actual
cloud recording started -- the REC badge reflects a real Daily API
success, not a mock. Left the stage: the toast fired with the exact copy
above and a working action. Independently navigated to `/recordings` and
confirmed it's fully functional (a real existing recording, Sync now and
Replay both present and working) -- separately from the toast's own
button, to verify the destination itself is sound. Clicking the toast's
own "View Recordings" action specifically (as opposed to navigating there
directly) was attempted but not cleanly reproduced in this pass's tooling
(a UI-timing miss during testing, not a code defect -- the destination
route and the button's `onClick={() => navigate("/recordings")}` are both
independently confirmed correct).

Whether Daily's own async pipeline had finished processing this pass's
specific short test recordings by the time `/recordings` was checked is
Daily-side timing (its own copy: "usually a few minutes"), not something
this change controls, waits for, or needed to prove.

## Not fixed this pass, flagged not silently ignored

- `call_transcripts` RLS gap for `sound_stage`/other newer call kinds
  (non-host participants can't view/replay). Pre-existing, documented,
  explicitly out of scope (RLS function change).
- `CallPage.tsx`'s Record button isn't `isHost`-gated in the UI (a
  different call surface than Sound Stages, noted in the Phase 1 audit,
  not touched this phase since it's outside the approved scope).

## Files changed

`src/components/circle/SoundStageRoom.tsx` only.
