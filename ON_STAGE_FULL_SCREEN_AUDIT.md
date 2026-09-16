# On Stage Fullscreen Call — Phase 1 Audit

Read-only. No edits made beyond this document, per the brief's own instruction to
stop after this audit and wait for explicit approval.

Confidence tags used throughout, per the brief's spec:
**SOURCE_CONFIRMED** (read directly in code, file:line cited),
**RUNTIME_CONFIRMED** (also verified in a live/running app this session),
**NOT_CONFIRMED** (inferred, or would need live testing not performed this pass),
**NOT_AVAILABLE** (does not exist in the codebase today).

## Where this fits — this is not a fresh ask

This repo already ran a 4-part sprint on adjacent scope, same feature area,
completed same-day (2026-09-02), each phase with its own report:

1. `KRETO_STAGE_RECORDINGS_CONVERSION_AUDIT.md` — the Phase 1 audit that scoped it.
2. `KRETO_IDENTITY_MARK_REPORT.md` — built `KretoMark.tsx`, the K-mark identity
   component (also fixed `KretoAvatar.tsx`'s `alt="Kreto, your AI Executive
   Producer"` policy violation — confirmed fixed, now reads "Kreto, your
   Executive Producer": `src/components/brand/KretoAvatar.tsx:136`).
3. `STAGE_UX_UI_OVERHAUL_REPORT.md` — added a real "Stages" tab to `Circle.tsx`,
   unified card grid (`StageCard`/`StageGrid`/`StagePrimaryCard`). Its own text
   explicitly protects `SoundStageRoom.tsx` (**"the actual in-call room ... reused
   exactly as they were; this was an information-architecture and
   card-consistency pass, not a rewrite of the real-time call infrastructure"**).
4. `RECORDINGS_REPLAY_MODAL_REPORT.md` — built `RecordingReplayDialog.tsx`, a
   real in-app player replacing `window.open()` to Daily's hosted player.

There's also an independent, earlier `SOUNDSTAGES_AUDIT.md` (2026-06-22) covering
the full Open-Stage/Curated-Stage backend, RLS, and edge functions, and
`docs/SECURITY_FINDINGS.md` (2026-08-12) covering a real, fixed vulnerability in
`mint-meeting-token` plus several documented-but-not-fixed adjacent gaps.

**This audit's job is the piece #3 explicitly deferred: the in-call room itself.**
Everything below builds on, cites, and does not duplicate those four documents.

---

## 1. Existing call architecture — SOURCE_CONFIRMED

There are **two structurally different call surfaces**, not one:

**A. Sound Stages** (spontaneous, "Open Stage") — `SoundStageRoom.tsx`
(`src/components/circle/SoundStageRoom.tsx`, 1819 lines). Rendered as a
Radix `Sheet` (`side="bottom"`, `h-[100dvh] sm:h-[92vh] sm:max-w-2xl sm:mx-auto
sm:rounded-t-3xl`) — **this is the "small modal" the brief describes**. Its own
doc comment (line 44-48): *"Clubhouse / Twitter-Spaces style Sound Stage room.
Audio-first. Stage (host + speakers) on top, audience grid below. Audience can
raise hand → host promotes to speaker."* Mounted from exactly one place:
`LiveCallsPanel.tsx:319` (on `/circle` and `/discover`'s live tab).

**B. Curated Stages** (scheduled, ticketed, "Scout"/"Showcase"/"Speed" sub-types)
— `CuratedStage.tsx` (own route, `/circle/stage/:id`) uses **`VideoCallSheet.tsx`**
(`src/components/project/VideoCallSheet.tsx:400`) for the actual call — a
different, simpler component using Daily's own **Prebuilt iframe UI**, not a
custom-rendered grid. `CuratedStage.tsx` also has its own invite dialog
(`InviteToStageDialog.tsx`), host console (`StageHostConsole.tsx`), and apply
flow (`ApplyToStageSheet.tsx`) — all real, none touched by this audit's scope.

**C. Generic calls** — `CallPage.tsx` (`/meet/:meetingId`, universal host/
member/guest entry) and `GuestCall.tsx` also use Daily's Prebuilt iframe via
`createDailyFrameAsync()` (`src/lib/dailyFrame.ts`), same pattern as B.

**Recommendation for scope**: the brief's "Stages → On Stage" reads as the Sound
Stage flow (A) — it's the one styled as a small modal with the Clubhouse-style
layout the brief's own product framing ("not a generic meeting room," "do not
turn this into a Zoom/Teams clone") already matches. B and C are separate,
working systems this audit recommends leaving alone unless a product decision
says otherwise (flagged in §21).

## 2. Existing provider/SDK boundaries — SOURCE_CONFIRMED

**Daily.co** (`@daily-co/daily-js@^0.89.1`, `package.json`). Two SDK modes used,
inconsistently, across the two call surfaces:

- **Call Object mode** (`DailyIframe.createCallObject()`) — Sound Stages only
  (`SoundStageRoom.tsx:406`). Gives raw per-participant track access, which is
  *why* Sound Stages already has custom adaptive layouts (§3) that
  Prebuilt-iframe mode structurally cannot offer — Kretopia's own React tree
  never sees individual tracks in Prebuilt mode, Daily's iframe renders its own
  internal UI.
- **Prebuilt iframe mode** (`DailyIframe.createFrame()`, wrapped by
  `createDailyFrameAsync()`) — `VideoCallSheet.tsx`, `CallPage.tsx`,
  `GuestCall.tsx`. `CallPage.tsx:106-110` passes `showFullscreenButton: true,
  showLeaveButton: false` — config that only makes sense for Daily's own
  built-in chrome, confirming this mode renders Daily's default participant
  grid inside the iframe, not a Kretopia-controlled layout.

`dailyFrame.ts` lazy-loads the SDK via dynamic `import()` (confirmed in the
build output: `daily-esm-*.js` is its own 248.86 kB / 69.02 kB gzip chunk, not
in the main bundle) and holds a **global singleton guard** — Daily only allows
one `DailyIframe`/call-object instance at a time; `destroyExistingDailyFrameAsync()`
tears down any stale instance before creating a new one, specifically to survive
React StrictMode double-mount and HMR. This is real, working infrastructure —
**do not touch `dailyFrame.ts`'s teardown logic** per the brief's own "do not
replace working real-time infrastructure" instruction.

## 3. Existing room state machine — SOURCE_CONFIRMED

`SoundStageRoom.tsx` phase model: `"miccheck" | "joining" | "in"`
(line 122), plus an orthogonal `isBackstage` boolean (host-only soundcheck —
row exists with `is_live: false` until the host taps "Open the doors," line
167-187). `CallPage.tsx` has its own separate phase model:
`"loading" | "lobby" | "live" | "ended" | "error"` (line 24). These are not
shared — each call surface reinvented its own state machine.

## 4. Existing participant roles — SOURCE_CONFIRMED, with a real gap flagged

Three roles in `SoundStageRoom.tsx`: `host`, `speaker`, `audience`
(`Role` type, line 68). Derivation (`refreshMembers`, line 213-241):

- `host`: `p.owner` (from the Daily token's `is_owner` claim) OR
  `uid === hostUserId` (a prop).
- `speaker`: `speakersRef.current.has(uid)` — **a plain in-memory `Set`,
  updated only by broadcast `app-message` events** (`"promote"`/`"demote"`,
  line 480-487), never persisted to any table.
- `audience`: default.

**Two things this audit confirms, not infers:**

- **The `is_owner` boundary is real and server-verified.** Both
  `create-sound-stage/index.ts:103` and `join-sound-stage/index.ts:82` derive
  `is_owner` server-side (`stage.host_user_id === userId`, read via the
  service-role client, never trusting client input) before minting the Daily
  meeting token. Daily's own backend enforces `is_owner` for privileged calls
  (`startRecording`, `updateParticipant({eject:true})`, etc.) — so even though
  `LiveCallsPanel.tsx:116` also computes `isHost` client-side
  (`stage.host_user_id === user.id`) to pass as a prop, that client value only
  ever controls **UI visibility**, not actual authorization. This matches the
  brief's "no client-trusted role" requirement correctly, for the host/owner
  boundary specifically.
- **The speaker/audience boundary is NOT server-enforced at the media layer.**
  `speakersRef` is client-only, and `call.sendAppMessage()` (Daily's generic
  pub/sub data channel) has no permission model — any participant, including
  an audience member, can broadcast a fake `{"type":"promote","userId":"..."}`
  message. More importantly: nothing in the meeting-token minting
  (`join-sound-stage/index.ts`) restricts an audience member's token from
  actually transmitting audio/video — `setLocalAudio(true)`/`setLocalVideo(true)`
  are local-only Daily SDK calls with no server-side gate. The UI simply never
  renders a mic/cam toggle for non-speakers (`meSpeaker` branch,
  `SoundStageRoom.tsx:1195-1254`), but a participant with basic devtools access
  could call `callRef.current.setLocalAudio(true)` directly. **This is a real,
  confirmed-by-source gap** — "audience can't speak" is a UI/social convention
  today, not a media-level permission, similar in spirit to Clubhouse's own
  historical trust model but worth an explicit product decision (§21) on
  whether it needs Daily's token-level `permissions` (e.g. `canSend`) scoping
  to become a real enforcement boundary.

`CuratedStage.tsx`'s flow has richer, **persisted** roles for its own tables
(`curated_stage_applications`, `_raised_hands`, `_turns`) — per
`SOUNDSTAGES_AUDIT.md`, all correctly RLS-gated host-only for the mutating
edge functions. Not shared with Sound Stages; a separate system.

## 5. Existing media constraints — SOURCE_CONFIRMED

No HD-specific or adaptive-quality constraints exist anywhere in the call
surfaces today.

- **Greenroom preview** (`Greenroom.tsx:94-97`): `getUserMedia({ audio: ...,
  video: ... })` — device selection only (`deviceId: {exact}`), no
  resolution/frameRate constraints at all.
- **SoundStageRoom mic-check preview** (line 313-322): `video: { width: {ideal:
  640}, height: {ideal: 480}, facingMode: "user" }` — but this is **only the
  local preview stream**, released before Daily joins (line 389-391, with a
  250ms grace wait the June `SOUNDSTAGES_AUDIT.md` already flagged as possibly
  too short on older iOS Safari — item #7 in its reliability watch-list, not
  yet addressed).
- **The actual Daily join** (`SoundStageRoom.tsx:395-404`,
  `CallPage.tsx:130-137`): `videoSource: mode === "video"` / no explicit video
  constraint object at all — Daily's own SDK default capture behavior applies,
  unconfigured by Kretopia's code. No `setBandwidth()`, no
  `updateInputSettings()`, no simulcast/SVC config, no codec preference calls
  found anywhere in the codebase (`grep` for these Daily API names returned
  nothing).

**Implication for §6 of the brief (HD-preferred adaptive quality)**: this is
genuinely net-new work, not a gap in existing logic — there is no current
quality ladder to adapt, upgrade, or preserve.

## 6. Existing quality controls — NOT_AVAILABLE

No quality-tier UI, no network-state indicator, no "Excellent/Good/Limited/
Reconnecting" signal, no settings panel exposing Auto/HD/Data-saver anywhere in
the call surfaces. `call.on("participant-updated", ...)` handlers exist but are
only used to refresh the member list (§4), never to read `track.getSettings()`
or Daily's network-quality events (`network-quality-change` is not subscribed
anywhere). Confirmed by grep across all call-related files — zero matches for
`network-quality`, `getStats`, `getSettings()` in a media-quality context.

## 7. Existing recording controls — SOURCE_CONFIRMED, one gap found

**Sound Stages** (`SoundStageRoom.tsx:731-753`): `startRecording({layout:
{preset:"default"}})`/`stopRecording()`, correctly gated behind `{isHost &&
(...)}`  in the render (line 1174), state synced via Daily's own
`recording-started`/`recording-stopped`/`recording-error` events so all
participants see accurate status, not just the host who triggered it (line
432-448). Failure path shows a real toast, not a silent no-op.

**Generic calls** (`CallPage.tsx:187-195, 343-352`): same `startRecording()`/
`stopRecording()` pattern, **but the Record button in the control bar is not
wrapped in an `isHost` check** — every participant (host, member, or guest) sees
and can tap it. Because `mint-meeting-token/index.ts:105` correctly sets
`is_owner: isHost` server-side, a non-host's `startRecording()` call should be
rejected by Daily's backend (the existing `catch` block surfaces "Recording
unavailable" on failure) — **this is a UI-consistency gap, not a privilege
escalation**: SoundStageRoom gates the button correctly, CallPage doesn't, and
the difference is confusing UX (a control that's shown but will just fail) more
than a security hole. NOT_CONFIRMED whether Daily actually rejects it at
runtime — inferred from the correct `is_owner` derivation, not live-tested this
pass.

**Known adjacent RLS gap** (per `docs/SECURITY_FINDINGS.md`, not fixed): the
transcript-visibility function `user_can_view_call_transcript()` was never
updated when `call_kind` widened to include `'sound_stage'` — so today, only
the stage's `created_by` can ever view its transcript; invited co-hosts/
speakers are silently locked out. Over-restrictive, not a leak, but directly
relevant to any recording/transcript UI this phase touches.

## 8. Existing recording permissions — SOURCE_CONFIRMED

`get-recording-link` (used by the now-real `RecordingReplayDialog.tsx`, built
in the prior sprint's Recordings phase) does real server-side authorization:
`created_by`/`participants` array/`project_members`/direct-call
`started_by`/`invited_user_id` checks, 403 otherwise (per
`KRETO_STAGE_RECORDINGS_CONVERSION_AUDIT.md` §C, re-confirmed present in this
audit's file listing — `src/components/calls/RecordingReplayDialog.tsx` and
`WatchReplayButton.tsx` both exist). **This is the modal the brief's §11 refers
to — it already exists, ships with focus-management and no-autoplay fixes
already applied, and this phase should integrate with it, not build a second
one.**

## 9. Existing invite/share flows — mixed, SOURCE_CONFIRMED

- **Sound Stages: no invite mechanism at all.** Read the full 1819-line
  `SoundStageRoom.tsx` — no invite button, no share button, no copy-link
  action anywhere in its control bar or header. The only "share" surface is
  `LiveCallsPanel.tsx:274-297`'s generic "Have an invite link? / Join via link"
  text input, which is for *joining*, not generating an invite. **This is a
  real, confirmed gap** matching the brief's §9/§10 requirements — there is
  currently no way for a participant to invite someone else into a live Sound
  Stage from inside the room.
- **Curated Stages: a real invite system exists**, just on a different
  surface — `InviteToStageDialog.tsx` (150 lines) calls the `invite-to-stage`
  edge function; per `SOUNDSTAGES_AUDIT.md`, RLS on the private-stage gate
  (`go-live-stage`) is "host OR matching `invite_token` OR email present in
  `curated_stage_invites`" — real, working, server-checked. If Sound Stages
  gets an invite feature this phase, `invite-to-stage`'s pattern (resolve
  recipient server-side, no auto-send) is the correct template to follow
  rather than inventing a new one.
- **Generic calls**: `CallPage.tsx`/`GuestCall.tsx` have "Copy invite link"
  (clipboard only, no recipient resolution, no authorization check beyond
  "you're already in the lobby") — the simplest of the three patterns.

**Known adjacent gap** (`docs/SECURITY_FINDINGS.md`, not fixed):
`create-video-guest-link` only checks project ownership when `project_id` is
supplied — a caller who instead supplies a self-chosen `room_name` gets a
guest link minted with no ownership verification. Not in this audit's direct
scope (that function isn't called from Sound Stages) but worth knowing if any
new Sound Stage invite work reuses guest-link infrastructure.

## 10. Existing share flow — partial, SOURCE_CONFIRMED

No "share the Stage" action (social/native share) exists anywhere in
`SoundStageRoom.tsx`. `LiveCallsPanel.tsx` and `CuratedStage.tsx` have no
`navigator.share()` calls found in the codebase for Stage rooms specifically
(the Events feature has its own separate `EventShareKit.tsx`, unrelated). This
is genuinely net-new work per the brief's §10, not a fix to existing logic.

## 11. Existing access and permission controls — SOURCE_CONFIRMED

RLS on `sound_stages` (`supabase/migrations/20260517125613...sql:25-41`):
SELECT open to any authenticated user (`USING (true)`), INSERT/UPDATE/DELETE
host-only (`auth.uid() = host_user_id`). Correct for the intended "open,
joinable rooms" model. **One minor hygiene note**: the SELECT policy doesn't
filter `is_live = true` — a backstage (soundchecking, not yet public) stage's
`room_url`/`title` are technically readable by any signed-in user via a direct
table query, even though the UI hides it from the "on air" rail. Low severity:
`create-sound-stage/index.ts:70` creates the Daily room with `privacy:
"private"`, so knowing the URL alone doesn't grant entry — a signed meeting
token is still required, and `join-sound-stage/index.ts:59` independently
re-checks `stage.is_live` before minting one. Worth a follow-up RLS tightening
(`is_live = true OR auth.uid() = host_user_id`) but not a live exploit path.

## 12. Existing mobile behavior — SOURCE_CONFIRMED

`SoundStageRoom`'s Sheet is `h-[100dvh]` on mobile (full height, `dvh` not
`vh` — correctly accounts for mobile browser chrome), `safe-area-inset-bottom`
respected in the control bar padding (line 1143). Screen-share button is
explicitly `hidden sm:inline-flex` (line 1201) — correctly reflects that
mobile browsers can't call `getDisplayMedia()`. No swipe gestures, no
background/foreground (`visibilitychange`) handling found anywhere in the call
surfaces — if the OS backgrounds the browser tab mid-call, there's no explicit
pause/resume/reconnect handling; whatever Daily's SDK does by default applies,
unmodified by Kretopia's code.

## 13. Existing error/reconnect behavior — SOURCE_CONFIRMED, partial

`CallPreflightGate.tsx` + `callPreflight.ts` (both call surfaces) handle
pre-join failure well: no-WebRTC, no-getUserMedia, insecure-context,
in-app-webview detection (Instagram/TikTok/Facebook/etc. user-agent sniffing),
unsupported-browser (via Daily's own `supportedBrowser()`), each with a
specific message and a copy-link/open-elsewhere fallback. This is genuinely
solid, already-built infrastructure — **do not touch**.

**What's missing**: no explicit *mid-call* reconnecting/degraded-network UI
state anywhere. `call.on("participant-updated"...)` and friends are wired for
roster sync, not connection-quality. No `network-quality-change` handler
exists. If Daily's own SDK silently degrades quality under congestion (likely,
per Daily's platform defaults), the user currently has no visible indication
that anything changed — this is the real gap behind the brief's §13
requirement, not a reconnect-loop bug to fix.

## 14. Existing cleanup behavior — SOURCE_CONFIRMED, solid

`teardownDailyCall()` (`dailyFrame.ts:95-102`): stops local video, stops local
audio, `leave()`, `destroy()`, each independently try/caught so one failure
doesn't block the rest. `SoundStageRoom.tsx`'s `cleanupCall` (line 189-201)
does the same via `call.leave()`/`call.destroy()`, plus fires
`end-sound-stage` when the host leaves. The mic-check preview stream
(`Greenroom.tsx`, `SoundStageRoom.tsx`) is explicitly stopped
(`getTracks().forEach(t => t.stop())`) on unmount/mode-change, and the
216-line effect in `SoundStageRoom.tsx:374-380` is deliberately split from the
`phase`-dependent join effect specifically to avoid tearing down a
freshly-joined call — a subtle correctness detail already handled. **This is
mature, already-correct cleanup logic — the brief's "do not lose stale
tracks/listeners" requirements are already met** for both call surfaces.

## 15. UX/UI problems — assessed against the brief's own goals

- **Container mismatch confirmed**: `SoundStageRoom` is a bottom Sheet, not a
  dedicated route/full-screen surface — matches the brief's core complaint
  exactly.
- **Not "basic controls" internally** — worth correcting the brief's framing
  before Phase 2 scopes work: mic/cam toggle, screen share, cloud recording,
  live captions (Daily transcription), raise-hand/promote/demote, per-format
  adaptive layouts (`open_1to1`/`open_group`/`audience`, both audio and video
  variants, hero-tile-plus-strip logic for solo performers) all already exist
  and work (line 934-1117). The actual gaps are: no invite, no share, no
  quality UI, no fullscreen container, no reconnect/degraded-state UI, no
  analytics.
- **Visual system**: uses `bg-energy`/`hsl(var(--energy))` (pink) as the
  primary accent for badges, hand-raise, promote buttons, speaking-ring glow —
  consistent with the "pink as default" pattern the brief asks to move away
  from project-wide. `--signal-teal` (speaking indicator), `--signal-amber`
  (backstage badge) are also in active use — real semantic tokens exist to
  build the brief's "controlled grey-to-pink gradient" CTA system from, not
  starting from nothing.
- **Kreto identity available and correctly built**: `KretoMark.tsx` (fixed
  earlier this session to render the real multicolor asset, not a
  flat-recolored mask) is the correct component per the brief's "Kretopia
  K-mark for Kreto identity where appropriate" — not currently used anywhere
  in `SoundStageRoom.tsx` (no Kreto-branded moment exists in the call itself
  today; the brief explicitly forbids inventing fake "Kreto is managing your
  call" panels, so this should stay absent unless a real backend capability
  justifies it).

## 16. Performance risks — SOURCE_CONFIRMED, one clear item

The June `SOUNDSTAGES_AUDIT.md` already flagged this file's size (1736 lines
then, 1819 now) as the single highest-risk surface on the platform and
recommended splitting into `useStageCall`/`useStageRoster`/`useStageCaptions`
hooks before adding more surface area — directly relevant since this phase
adds more surface area (fullscreen layout, invite, share, quality UI). Its own
event handling pattern (`onAny` fires `refreshMembers()` — a full participant
+ profile re-fetch — on *every* `participant-joined/updated/left/track-started/
track-stopped` event, line 418-427) will not scale cleanly to the brief's
7+-participant speaker-stage layout without some coalescing/debouncing;
currently fine at small room sizes, a real risk at larger ones. No
virtualization exists for the audience grid (`audience.map(...)`, line
1099-1105) — currently renders every audience member's tile unconditionally.

## 17. Privacy/security risks — see §4, §9, §11 above; summary

- Host/owner boundary: real, server-enforced. Good.
- Speaker/audience boundary: client-only convention, not media-enforced.
  Confirmed gap, needs a product decision (§21).
- No invite exists on Sound Stages to audit for over-permission (the gap
  itself is the finding).
- Minor RLS SELECT-scope note on `sound_stages` (§11).
- Known, documented, **not-yet-fixed** adjacent gaps from
  `docs/SECURITY_FINDINGS.md` worth carrying forward if this phase touches
  neighboring code: `sync-daily-recordings` ID leak (low),
  `create-video-guest-link` missing ownership check on the no-`project_id`
  path, `redeem-video-guest-link` unlimited reuse (flagged as possibly
  intentional), `call_transcripts` RLS under-permissive for `sound_stage`/
  other newer `call_kind`s, one raw-payload log line in
  `daily-recording-webhook`. None of these are newly found by this audit —
  cited for completeness since a full security report is required in §14 of
  the brief.

## 18. Files to change (Phase 2, pending approval)

- `src/components/circle/SoundStageRoom.tsx` — primary target. Container
  (Sheet → full-screen), layout, controls, invite/share additions.
- `src/components/circle/LiveCallsPanel.tsx` — mount point; may need route
  changes if Sound Stages moves from a Sheet to a dedicated route.
- Possibly new: a `useStageCall`/`useStageRoster` hook split (recommended by
  the June audit, now more load-bearing given added surface area) — a
  refactor decision, not assumed without approval.
- New quality-UI, invite-dialog, share-sheet components as scoped.

## 19. Files to protect (do not touch without a separate explicit decision)

- `src/lib/dailyFrame.ts` — singleton/teardown logic, already correct and
  fragile to regress (StrictMode/HMR duplicate-instance handling).
- `src/lib/callPreflight.ts`, `src/components/calls/CallPreflightGate.tsx` —
  already-correct browser/webview detection.
- `src/components/calls/Greenroom.tsx`, `AdmitQueue.tsx` — working,
  reusable as-is.
- `src/pages/CuratedStage.tsx` and its 4 dedicated components
  (`StageHostConsole.tsx`, `ApplyToStageSheet.tsx`, `InviteToStageDialog.tsx`,
  `StageDoorsCountdown.tsx`) — separate route/flow, explicitly out of scope
  per the prior sprint's own note, re-confirmed here.
- `src/pages/CallPage.tsx`, `src/pages/GuestCall.tsx`,
  `src/components/project/VideoCallSheet.tsx` — the generic/Studio call path,
  a different product surface from Sound Stages; the §7 Record-button gating
  gap is worth a one-line fix but is not part of a Sound Stages fullscreen
  overhaul.
- `src/components/calls/RecordingReplayDialog.tsx`,
  `src/components/calls/WatchReplayButton.tsx` — recently built, working,
  accessibility-verified; integrate with, don't duplicate.
- `supabase/functions/mint-meeting-token`, `create-sound-stage`,
  `join-sound-stage`, `end-sound-stage` — correct server-side authorization,
  no changes needed for a UI-layer overhaul.
- `supabase/functions/mcp/index.ts` — standing pre-existing drift from
  earlier in this session, unrelated, not staged.

## 20. Required backend/provider changes

- **HD/adaptive quality (brief §6)**: achievable within Daily's existing
  Call Object API (capture constraints on `createCallObject`/`setLocalVideo`,
  Daily's own adaptive bitrate is already active by default server-side —
  Kretopia's code just never configures or surfaces it). **No provider
  change required** — this is client-code configuration + UI work, not
  `REQUIRES_REALTIME_PROVIDER_CHANGE`.
- **Speaker/audience media-level enforcement (§4 gap)**: would need Daily
  meeting-token `permissions` scoping (e.g. restricting `canSend` for
  audience tokens) added to `join-sound-stage/index.ts`. **REQUIRES_BACKEND_WORK**
  if the product decision (§21) is to close this gap.
- **Invite on Sound Stages (§9/§10)**: needs a new edge function (or an
  extension of the existing `invite-to-stage` pattern) scoped to
  `sound_stages` rather than `curated_stages`. **REQUIRES_BACKEND_WORK**.
- **Analytics (§17 of the brief)**: `analytics_events` table already accepts
  anon+authenticated inserts (confirmed in the prior Landing audit) — no
  schema change needed, just new `trackEvent()` call sites.
- **Transcript RLS for `sound_stage` kind** (§7/§17 above): a pre-existing,
  documented, not-yet-fixed RLS function gap — **REQUIRES_PRODUCT_DECISION**
  on whether to bundle into this phase or leave to a dedicated RLS pass (the
  brief's own worktree-safety section says not to touch RLS to make a UI
  action work, which argues for treating this as a separate, deliberate fix
  rather than a side effect of this phase).

## 21. Required product decisions

1. **Scope confirmation**: is "On Stage" the Sound Stage flow
   (`SoundStageRoom.tsx`) only, or does it also include Curated Stages'
   `VideoCallSheet.tsx`-based call UI? This audit assumes Sound Stages only
   (§1) — confirm before Phase 2.
2. **Speaker/audience enforcement**: accept the current client-convention
   model (matches Clubhouse/Twitter Spaces' own historical approach) or
   invest in Daily token `permissions` scoping to make it a real media-layer
   boundary?
3. **`CallPage.tsx` Record-button gating**: worth a small, separate one-line
   fix (wrap in `isHost &&`) regardless of the fullscreen Stage work, since
   it's a different file/surface — bundle in or file separately?
4. **`useStageCall` hook split**: the June audit recommended this before
   adding more surface area to `SoundStageRoom.tsx`. This phase is exactly
   "more surface area." Refactor first, or build fullscreen directly into
   the existing monolith and refactor after?

## Test plan (for Phase 2)

Per the brief's §18 checklist — unit/component coverage for fullscreen shell
rendering, role-gated controls (host vs. speaker vs. audience, including a
test that a non-owner's privileged Daily calls are rejected — currently
NOT_CONFIRMED at runtime, only inferred from correct token minting), media
toggle/cleanup/no-stale-tracks, HD-preferred constraint requests, screen-share
user-gesture requirement, invite/share authorization and no-auto-send,
recording/replay integration with the existing `RecordingReplayDialog`,
accessibility (keyboard, focus, Escape, live-region status), and a repeated
join/leave cycle for leak-detection. Full detail deferred to Phase 2 planning
once scope (§21.1) is confirmed.

## Browser/device verification plan

Per the brief's §19 — deferred to Phase 2. This audit did not launch the dev
server against Sound Stages this pass (no authenticated test session
available in this environment); all findings above are SOURCE_CONFIRMED via
direct code reading, not RUNTIME_CONFIRMED. Flagging explicitly rather than
assuming: **live verification at 390×844 / 768×1024 / 1440×900, with a real
authenticated multi-participant test, is still required before any
RELEASE_READY claim**, independent of how thorough the source-level audit is.

---

## Baseline (run before any edits)

- `npm run build` (`vite build`) — **pass**. `daily-esm-*.js` correctly
  code-split (248.86 kB / 69.02 kB gzip), lazy-loaded, not in the main bundle.
- `npx tsc --noEmit -p tsconfig.app.json` — **pass**, clean, zero errors.
- `npm run test` (`vitest run`) — **pass**, 127/127, 12 test files. Zero
  existing tests reference calls/stages/Daily — this entire area is
  currently untested.
- `npx eslint .` — **13,911 problems** (12,691 errors, 1,220 warnings),
  consistent with the June/September audits' baseline (~13,900) — pre-existing,
  repo-wide, not introduced by or specific to this scope.

---

**Status: ON_STAGE_AUDIT_COMPLETE. Awaiting explicit approval before any edit,
per this brief's own Phase 1 instruction.** Recommend resolving the four
product decisions in §21 (especially #1, scope) before Phase 2 begins, since
they materially change which files get touched.
