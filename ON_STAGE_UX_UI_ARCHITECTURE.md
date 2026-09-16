# On Stage — UX/UI Architecture

What was actually built, mapped against the brief's §3/§4 information
architecture. Scope: Sound Stages (`SoundStageRoom.tsx`) only.

## Structure delivered

```
[Fullscreen shell -- DialogPrimitive.Root/Portal/Content, fixed inset-0]

Top bar:
  Live / Backstage badge + Rec badge (when recording)
  Stage title (real <h1>, also the Dialog's accessible name via
    DialogPrimitive.Title asChild)
  Participant count + network-quality text (Excellent/Good/Limited,
    once a real reading exists)
  Share icon (opens copy-link/native-share dialog)
  Leave (X)

Main content (centered at max-w-3xl within the fullscreen column, so
roster/text content doesn't stretch edge-to-edge on wide viewports; video/
audience grids still use the full column width):
  Active screen-share hero tile, when present
  "On stage" section -- adaptive by format x mode (see below), pre-existing
  Raised-hands queue (host-only), pre-existing
  Audience section -- capped at 24 tiles with a "+N more" expand (new
    this pass), pre-existing otherwise

Bottom control dock:
  Leave, Captions (host), Record (host) -- gradient CTA when idle
  meSpeaker cluster: Invite (new), Screen share (gradient CTA when idle),
    Camera (video mode), Mic
  Audience-only: Raise hand
```

## What's new this phase vs. what already existed

**New**: the fullscreen container itself (was a Radix Sheet capped at
`sm:h-[92vh] sm:max-w-2xl` on desktop); the grey-to-pink CTA treatment;
Share; Invite; the network-quality text; the audience-grid cap; the
recording -> Recordings-page toast on leave; the accessibility fixes
(heading, focus-trap/Escape restoration, status text, live announcements).

**Pre-existing, reused as-is**: the adaptive stage layout logic itself
(`format` in `open_1to1`/`open_group`/`audience` crossed with `mode` in
`audio`/`video` -- six real layout branches, hero-tile-plus-strip for solo
performers, balanced grids that change column count with participant
count), mic-check/greenroom, backstage soundcheck, raise-hand/promote/
demote, live captions, cloud recording start/stop, screen-share start/
stop, all cleanup/teardown logic. None of this needed rebuilding -- the
Phase 1 audit's finding that "not basic controls, a small modal" was the
real complaint held up under this phase's own code reading.

## Display modes -- not built as named user-facing settings

The brief's §4 suggests possible modes (Focus/Grid/Speaker/Screen Share/
Compact mobile) as if they might be user-selectable settings. They were
**not** built that way, deliberately: the existing `format`x`mode` system
already determines the right layout automatically from real room state
(how many people, audio vs video, which format the host picked at
creation) with no user toggle needed or wanted -- adding a redundant manual
"pick your layout" control on top would contradict the brief's own
"minimize decisions, favor automation" spirit elsewhere, and no product
requirement surfaced a case where a host or participant would want to
override the automatic layout. **REQUIRES_PRODUCT_DECISION** if named,
persisted per-user layout preferences are actually wanted -- the existing
system already produces the right layout per room without one.

## Context rail / chat -- not added

The brief's §3 lists chat, participant list, shared links/files, session
details, recording status, and Kreto follow-up insights as a possible side
rail. Per the brief's own "only add what the codebase genuinely supports"
instruction: participant list already exists inline (stage + audience
sections, not a separate rail); recording status already exists (top bar
badge); the rest (chat, shared files, Kreto-generated follow-up insights)
have no backing data/feature in Sound Stages today and were not
fabricated. **NOT_AVAILABLE**, correctly left absent rather than faked.

## Verification

Cross-reference `ON_STAGE_BROWSER_VERIFICATION_MATRIX.md` for what was
actually driven live vs. code-reviewed only. Typecheck/test/lint/build
clean across every commit this phase (see each commit's own message for
the exact verification run alongside it).
