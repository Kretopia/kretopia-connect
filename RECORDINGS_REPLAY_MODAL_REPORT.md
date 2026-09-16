# Recordings Replay Modal Report

Covers the Recordings portion of the Kreto/Stage/Recordings/Landing sprint.

## The problem this fixes

Per the Phase 1 audit, "Replay" did not open anything in-app at all — every
one of the 3 call sites went through `WatchReplayButton`, which called
`window.open(url, "_blank")` on a signed Daily-hosted link, leaving the app
entirely for a bare external tab.

## What was built

**`RecordingReplayDialog.tsx`** (new) — a Kretopia-native modal using the
project's existing shadcn/Radix `Dialog` primitives (the same ones
`MediaPlayerModal.tsx`/`FilePreviewDialog.tsx` already use elsewhere, not a
second dialog system). Structure: title + subtitle (both real data, never
fabricated — see below), then a fixed 16:9 black stage holding a loading
spinner, an error message, or a native `<video controls>` once the signed
URL resolves. No autoplay — the video only plays when the visitor presses
play, satisfying the "no unmuted autoplay" requirement directly rather than
copying `MediaPlayerModal`'s existing `autoPlay` precedent, which the audit
flagged as the wrong pattern to follow.

**`WatchReplayButton.tsx`** — rewritten to open `RecordingReplayDialog`
instead of `window.open`. Reuses the exact same `get-recording-link` edge
function call it already had; server-side authorization
(`created_by`/`participants`/`project_members`/direct-call checks) is
untouched, since the client never needed its own copy of that logic. Gained
two new optional props, `title`/`subtitle`, so callers can pass real
metadata instead of the modal falling back to a generic "Call replay."

**All 3 call sites updated** to pass real metadata they already had in hand
(no new fetches added): `Recordings.tsx` and `RecentRecordingsRail.tsx` pass
their existing `KIND_LABEL[call_kind]` + formatted date/duration;
`CallRecapSheet.tsx` gained a small `RECAP_KIND_LABEL` map (it didn't have
one) for the same purpose.

## Real data only — what was deliberately left out

`call_transcripts` has no `title` column and no denormalized host name (confirmed
in the Phase 1 audit). The modal's title is the same `call_kind`-derived label
("Studio call," "1:1 call," etc.) already shown in the list — never an invented
per-recording title. No fake transcript, duration, or recap was added to the
modal; the existing `CallRecapSheet` remains the separate, working place for
transcript/summary/action-items, reachable from its own "Recap" button, exactly
as before. No caption/subtitle track was added — none exists, and shipping an
empty `<track>` element to imply the feature exists was rejected mid-build.

## A real accessibility bug found and fixed before shipping

Live-testing in the browser (not just code review) surfaced that focus did
**not** reliably return to the triggering "Watch call replay" button after
Escape-closing the dialog — it fell back to `<body>`. Root cause: the
dialog's content swaps from a loading spinner to a `<video>` element while
open, which appears to disrupt Radix's default `onCloseAutoFocus` tracking.
Fixed by managing focus-return explicitly — `WatchReplayButton` keeps a
`ref` to its own trigger button and passes an `onCloseAutoFocus` handler
that refocuses it directly, rather than relying on Radix's default behavior
succeeding through that mid-dialog content swap. Confirmed via
`document.activeElement` inspection before and after the fix, not just
visual inspection.

## Playback and cleanup

Video is paused explicitly the moment the dialog starts closing (`useEffect`
watching `open`), not left to trail into the close animation. Since
`DialogContent` unmounts on close (no `forceMount`), the `<video>` element
and its resources are released naturally by React on unmount — no separate
manual cleanup needed beyond the explicit pause.

## Not touched

`CallRecapSheet.tsx`'s transcript/summary/action-items UI, the
`get-recording-link`/`sync-daily-recordings`/`daily-recording-webhook`/`transcribe-call`
edge functions, and `MediaPlayerModal.tsx`/`FilePreviewDialog.tsx` (the
unrelated existing features whose Dialog pattern this borrowed, not
modified).

## Verification

- `npm run typecheck` / `npm run test` (127/127) clean — no new errors.
- Live end-to-end test against a real recording in this environment: clicked
  Replay on a genuine "1:1 call" row, confirmed the modal opened with the
  correct real title/subtitle ("1:1 call" / "20 days ago · 40m 36s"), the
  signed URL resolved and the native player rendered with controls, no
  autoplay occurred.
- Escape-to-close and focus-return verified via `document.activeElement`
  inspection, not just visually — confirmed broken, fixed, then reconfirmed
  fixed.
- Server-side authorization path unchanged and not re-tested end-to-end
  (unauthorized access), since the client-side call itself didn't change —
  only where the URL gets rendered.

---

Landing conversion is next, the last area in this sprint's ordering.
