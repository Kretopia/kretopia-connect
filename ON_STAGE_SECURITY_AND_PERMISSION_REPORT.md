# On Stage — Security and Permission Report

Consolidates and re-confirms the security findings from
`ON_STAGE_FULL_SCREEN_AUDIT.md` §4/§9/§11/§17, plus what changed (nothing
security-relevant was loosened) across this phase's four implementation
commits. No RLS was modified. No new backend authorization logic was
added except where noted.

## Host/owner boundary -- real, server-enforced. Green.

`create-sound-stage/index.ts` and `join-sound-stage/index.ts` both derive
`is_owner` for the Daily meeting token **server-side**, from
`stage.host_user_id === userId` read via the service-role client -- never
from client input. Daily's own backend enforces `is_owner` for privileged
calls (`startRecording`, `updateParticipant({eject:true})`, forced mute of
others). The client-side `isHost` boolean this phase's UI reads
(`LiveCallsPanel.tsx`) only ever controls **button visibility**, never
actual authorization -- confirmed by reading the token-minting code, not
inferred. **AUDITED, SOURCE_CONFIRMED.**

## Speaker/audience boundary -- client-convention only, not media-enforced. Real gap, not fixed this phase.

`speakersRef` (who's "on stage" as a promoted speaker) is a plain
in-memory `Set`, updated only by broadcast `app-message` events with no
Daily-side permission model backing them -- any participant, including
audience, could broadcast a forged `promote` message, and nothing in the
token-minting stops an audience member's own client from calling
`setLocalAudio(true)`/`setLocalVideo(true)` on their own connection
regardless of role. This was true before this phase and remains true
after it -- **not touched**, since closing it for real needs Daily
meeting-token `permissions` scoping (`REQUIRES_BACKEND_WORK`) and a
product decision on whether the current Clubhouse-style social-convention
model (roughly matching Clubhouse/Twitter Spaces' own historical
approach) is acceptable as-is. **REQUIRES_PRODUCT_DECISION**, flagged
again here rather than silently dropped between reports.

## RLS on `sound_stages` -- correct, one minor hygiene note

SELECT open to any authenticated user, INSERT/UPDATE/DELETE host-only via
`auth.uid() = host_user_id` -- correct for an intentionally open,
joinable-room model. Minor note (unchanged from Phase 1, not fixed this
phase): the SELECT policy doesn't filter `is_live = true`, so a backstage
(not-yet-public) stage's title/room_url are technically readable by any
signed-in user via a direct table query, even though the UI hides it.
Low severity: Daily rooms are created `privacy: "private"`, so the URL
alone doesn't grant entry, and `join-sound-stage` independently re-checks
`is_live` before minting a token either way.

## This phase's new surface area -- reviewed for the same class of issue

- **Invite/Share deep link** (`?join=<stage_id>`): adds no new trust
  surface. `join-sound-stage` re-validates `is_live` server-side
  regardless of how the caller learned the id -- a shared/leaked link is
  exactly as privileged as a rail-card click, no more.
- **Invite message send**: uses the existing `messages` table and its
  existing RLS (unchanged, not modified by this phase) -- reused, not
  reimplemented, so no new authorization logic was written to review.
  Recipient is always a real row from the caller's own `connections`
  table, never client-supplied free text resolved to a user server-side.
- **Recording-saved toast**: reads only client-side `recording` state
  (already known to the client, since they're the one who toggled it) and
  navigates to an existing, already-authorized route (`/recordings`,
  itself gated by `get-recording-link`'s own real checks). No new data
  exposure.
- **Network-quality indicator**: reads only Daily's own client-side event
  data about the local connection. No new data exposure.

## Known, pre-existing, adjacent gaps (not newly found, not fixed --
## carried forward from `docs/SECURITY_FINDINGS.md` for completeness)

- `call_transcripts` RLS under-permissive for `sound_stage` (and other
  newer `call_kind`s): only `created_by` can view/replay; over-restrictive,
  not a leak, but directly relevant to this phase's Recording/Replay work
  (see that report). Not fixed -- an RLS function change, explicitly a
  "stop before" category per the brief's own instructions.
- `sync-daily-recordings` recording/transcript **ID** leak (not content) --
  low severity, unrelated code path, not touched.
- `create-video-guest-link` missing ownership check on one input branch --
  unrelated code path (Curated Stages/generic calls), not touched.
- `redeem-video-guest-link` unlimited reuse -- possibly intentional design,
  unrelated code path, not touched.

None of these were loosened, worked around, or newly introduced by this
phase -- they're listed here only so a reader of this specific report has
the full current picture without needing to cross-reference three other
documents.

## What this phase did NOT do (by design)

- Did not modify any RLS policy.
- Did not modify any edge function's authorization logic.
- Did not expose any provider/infrastructure name in the UI (Daily is
  never mentioned to end users anywhere in this phase's changes).
- Did not weaken the `is_owner`/host-token boundary in any way.
- Did not add any client-trusted role check as a substitute for a real
  server check.

## Verification

Every claim above is SOURCE_CONFIRMED against the actual current code
(this phase's diffs, plus the unmodified files they call into), consistent
with the Phase 1 audit's own findings, re-checked rather than assumed
still-true.
