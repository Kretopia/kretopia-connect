# On Stage — Invite and Share Report

Two distinct capabilities, per the brief's own separation (§9 vs §10).
Both **IMPLEMENTED, TYPECHECKED, BROWSER_VERIFIED with a confirmed
database write** -- not just rendered, actually exercised end-to-end live
this session with a real account.

## Share (§10)

**What it is**: copy-link + native Web Share, opened from a Share icon in
the top bar (visible to any participant once live, not host-gated -- the
stage is already open to anyone, so sharing its existence is no higher-
stakes than the stage itself being joinable).

**Link scope**: `{origin}/circle?tab=stages&join={stage_id}` -- carries
only the stage id, nothing else (no token, no attendee data, no recording
link). `join-sound-stage` re-validates `is_live` server-side on use,
identically to a rail-card click -- learning a stage id from a shared link
adds no new trust surface versus the existing join path.

**New deep-link wiring**: `Circle.tsx` reads `?join=`, passes it to
`LiveCallsPanel`, which fetches the row and calls the existing
`handleJoinStage` path -- this is what makes the shared link actually
*work* rather than just look like a link (previously no such route
existed for Sound Stages at all, confirmed in the Phase 1 audit).

**Live-verified**: opened Share, got a real URL with a real stage id,
Copy link produced a real "Link copied" toast (clipboard write confirmed
by the app's own success toast, not assumed).

## Invite (§9)

**What it is**: reuses the app's existing connections-picker
(`ShareToMessageDialog`, already used to share gigs/projects/events/etc.)
by adding `"stage"` as a new `SharedContentType`. No new dialog, no new
edge function, no schema change (`messages.shared_content_type` is a plain
text column, no CHECK constraint to widen).

**Every brief requirement satisfied by inherited, already-correct
infrastructure**:
- Recipient resolved from the caller's real `connections` table rows --
  never typed/guessed. Confirmed live: the picker showed this account's
  actual connections, not fixtures.
- Explicit multi-select + a "Send separately to N people" tap -- no
  auto-invitation possible.
- In-app message, not an automatic email.
- Recipient sees real context (`shared_content_meta`: real stage title +
  "Live now on Kretopia" subtitle) -- confirmed by direct query of the
  actual inserted row after a live send.
- No attendee list, room token, or recording link in the payload.

**Authorization**: gated to `meSpeaker` (host + promoted speakers) in the
control dock, matching the brief's "authorized roles" language -- since
the stage itself has no access gate to bypass (unlike Curated Stages'
private invite system), this restriction is about who can *notify*
people, not who can grant *access*.

**Live-verified with an independent database check**: opened Invite, real
connections loaded, selected one, sent, got "Sent! Shared with 1 person".
Queried the `messages` table directly afterward (not trusting the toast
alone) and confirmed the actual row: correct `sender_id`/`receiver_id`,
`shared_content_type: "stage"`, `shared_content_id` matching the real
stage, `shared_content_meta` carrying the real title/subtitle.

## Rate limiting / duplicate prevention

Not implemented as a hard server-side constraint this pass -- the
`messages` table has no unique constraint preventing the same sender
inviting the same receiver to the same stage twice. **REQUIRES_PRODUCT_DECISION
/ REQUIRES_BACKEND_WORK** if a hard duplicate-prevention guarantee is
wanted; the UI itself doesn't currently disable an already-invited person
in the picker within one open/close cycle either. Low severity: worst
case is a person receiving the same "come join" message twice, not an
authorization or privacy issue.

## Guest link scoping/expiry/revocation

Not applicable to this Invite implementation -- it sends a message with a
link, it does not mint a separate guest-access token the way Curated
Stages' `invite-to-stage`/`curated_stage_invites` system does. Sound
Stages have no access gate to scope in the first place (any signed-in
user can already join a live one). If a *private* Sound Stage concept is
wanted in the future, that's a materially different feature
(**REQUIRES_PRODUCT_DECISION** + **REQUIRES_BACKEND_WORK**), not an
extension of what was built here.

## Files changed

`src/components/circle/SoundStageRoom.tsx`,
`src/components/messages/ShareToMessageDialog.tsx`,
`src/components/messages/SharedContentCard.tsx`,
`src/components/circle/LiveCallsPanel.tsx`, `src/pages/Circle.tsx`.
