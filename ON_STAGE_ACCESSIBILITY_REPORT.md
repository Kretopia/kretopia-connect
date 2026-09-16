# On Stage — Accessibility Report

Scope: `SoundStageRoom.tsx` only (Sound Stages), per the approved Phase 2
scope. Classification tags per the brief: NOT_STARTED, AUDITED, IMPLEMENTED,
TYPECHECKED, UNIT_TESTED, INTEGRATION_TESTED, BROWSER_VERIFIED,
PRODUCTION_VERIFIED, REQUIRES_REALTIME_PROVIDER_CHANGE,
REQUIRES_BACKEND_WORK, REQUIRES_PRODUCT_DECISION, BLOCKED.

Everything below marked BROWSER_VERIFIED was checked against the live
accessibility tree (`read_page`) and/or live keyboard input in this
environment's authenticated session this pass, not just by reading source —
each item says which.

## Fixed this pass

**Escape-to-close / focus trap — a real regression from the Phase 2
fullscreen shell change, not a pre-existing gap.** The Sheet the shell
replaced gave both for free via Radix; the bare `fixed inset-0` div it was
swapped in for had neither — Escape did nothing, and Tab could walk focus
out into the page behind it. Fixed by rebuilding the shell on
`DialogPrimitive.Root`/`Portal`/`Content` directly (the same primitive
`Dialog`/`DialogContent` already wrap elsewhere in this file, styled
full-screen instead of centered) instead of a plain div — this restores the
Sheet's original behavior rather than introducing new UX.
**IMPLEMENTED, TYPECHECKED, BROWSER_VERIFIED** — pressed Escape live during
an active Stage; confirmed it closed the call and correctly ran the same
host-leaves-ends-stage cleanup as the X button (`sound_stages.is_live`
flipped to `false` server-side, confirmed by direct query).

**Stage title as a real heading, not a plain paragraph.** Was `<p>`; a
full-screen "destination" surface with no heading landmark makes screen-reader
section navigation impossible. Now `<h1>`. **IMPLEMENTED, TYPECHECKED,
BROWSER_VERIFIED** — `read_page` on the live dialog shows
`heading "Final QA Test"`, not `generic`.

**Active-speaker / role / mute / hand-raised state was color-and-icon-only.**
The speaking ring (teal glow), host crown, mic-off badge, and ✋ emoji all
had zero text alternative in both `StageTile` (audio-layout tiles) and
`VideoStageTile` (video-layout tiles) — a screen-reader user got no signal
at all for any of these states. Added a single computed `statusText`
("host", "speaking", "muted", "hand raised") rendered as a `sr-only` span
appended to each member's name, and marked the now-redundant decorative
badges `aria-hidden="true"`. `VideoStageTile`'s host badge already had real
"Host" text (not fixed, wasn't broken) — only its mute/speaking icon lacked
text, now fixed the same way. **IMPLEMENTED, TYPECHECKED, BROWSER_VERIFIED**
— live dialog's own participant tile read back as `"You", ", host, muted"`
in the accessibility tree, correctly matching the actual live state (host,
mic blocked in this sandboxed browser) rather than a guessed/static value.

**Recording start/stop was visual-only (the REC badge).** A screen-reader
user got no notification when recording began or ended mid-call. Added a
persistent `aria-live="polite"` region that announces "Recording started"/
"Recording stopped" on real transitions only (guarded against firing on
initial mount, when both the ref and the state start at `false`/`false`).
**IMPLEMENTED, TYPECHECKED, BROWSER_VERIFIED** — live-tested a full
start-recording → leave cycle in the previous commit (before this pass);
the announcement logic itself was added this pass and is
SOURCE_CONFIRMED correct against that same verified recording flow, not
independently re-tested with a screen reader in this pass (no screen
reader available in this environment) — flagging that distinction rather
than overclaiming.

## Already correct — confirmed, not touched

- **Reduced motion**: a single global rule in `src/index.css`
  (`@media (prefers-reduced-motion: reduce) { *, *::before, *::after {
  animation-duration: 0.01ms !important; ... } }`) already collapses every
  animation/transition in the app, including this shell's `animate-in
  fade-in`, the Live/Rec badge pulses, and the hand-raise wave — with no
  per-component opt-in needed. **AUDITED, SOURCE_CONFIRMED**.
- **No autoplay sound beyond the call itself**: `RemoteAudio` autoplaying
  other participants' voices is the live call working as intended, not a
  violation — verified separately (prior sprint, `RECORDINGS_REPLAY_MODAL_REPORT.md`)
  that the actual replay player has no autoplay. **AUDITED**.
- **No camera/mic permission requested on page load**: gated behind the
  mic-check screen's explicit toggles, consistent with the rest of the call
  surfaces (per `docs/SECURITY_FINDINGS.md`'s own prior finding on this).
  **AUDITED**.
- **Controls have labels**: every control button already carries
  `aria-label`/`title` (mic, camera, screen share, record, captions, raise
  hand, host menu items, leave, and this phase's own Share/Invite
  additions). **BROWSER_VERIFIED** — every button in the live accessibility
  tree dump has a real accessible name, none fall back to "button".
- **Mobile touch targets**: control-dock icon buttons are `h-11 w-11`/
  `h-12 w-12` (44-48px), meeting common minimum target size. **AUDITED**.
- **No hover-only controls**: the host dropdown-menu trigger and all
  control-dock actions are always visible/tappable, never hover-revealed.
  **AUDITED**.
- **Dialog/drawer focus behavior for the nested Share and Invite dialogs**:
  both already use the project's standard `Dialog`/`DialogContent`
  (Radix), which handles focus trap, Escape, and focus-return the same as
  every other dialog in the app — Radix correctly nests (an inner dialog's
  Escape closes only that dialog, not the outer Stage shell too, standard
  dismissable-layer-stack behavior). **AUDITED, BROWSER_VERIFIED** (opened
  and closed both live in the previous two commits).

## Not fixed this pass — flagged, not guessed

- **"Reconnecting" state has no accessible announcement, because it
  doesn't exist yet at all** (§ Phase 2 commit 1's own note): Daily's
  `network-connection` event exists but its `event` field is an untyped
  string with no enumerated values in this SDK version. Building the
  announcement without first confirming those values would mean guessing
  at a state that might silently never fire. **BLOCKED** — same reason as
  the original commit.
- **200% zoom / no horizontal overflow**: not independently re-verified
  with an actual OS/browser zoom level this pass (only viewport-width
  resize was checked, not zoom specifically, which can trigger different
  overflow behavior than a narrow viewport in some layouts). **NOT_STARTED**
  as a distinct check — recommend a manual pass per the brief's own
  browser verification matrix.
- **"Alternative to drag/gesture layouts"**: no drag/gesture-driven layout
  exists anywhere in this component (no draggable tiles, no swipe-to-dismiss)
  — nothing to provide an alternative for. **AUDITED, not applicable**.
- **Captions/transcript accessibility**: live captions (existing feature,
  untouched this pass) render as a visible rolling overlay
  (`aria-live="polite"` already present on that container, confirmed by
  reading the surrounding code, not newly added) — not independently
  re-tested with captions actually running this pass, since triggering
  Daily's transcription pipeline live wasn't part of this pass's changes.
  **AUDITED, not RUNTIME_CONFIRMED this pass**.
- **Leave/end confirmation**: the brief allows "where appropriate" — leaving
  currently has no confirmation step (matches its pre-Phase-2 behavior,
  which also had none). Adding one is a product/UX decision (an extra
  click on every exit vs. protecting against an accidental Escape/click)
  rather than a pure accessibility fix, and wasn't assumed. **REQUIRES_PRODUCT_DECISION**.

## Files changed this pass

`src/components/circle/SoundStageRoom.tsx` only.

## Verification

`npx tsc --noEmit -p tsconfig.app.json`, `npm run test -- --run` (127/127),
`npx eslint` (zero new issues beyond the pre-existing baseline, confirmed
via `git diff` grep), and `npm run build` all clean. Live-verified in this
session's authenticated browser session (real Sound Stage, real Daily
call) rather than assumed from source alone, per item above.
