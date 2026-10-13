# Slice F: the recording link follows the call's audience, not any stale row

Gate audit finding: **GA SEC-09** (§3). Matrix row 7 of `gate-audit-company-experience-execution-matrix.md`.
Status of this slice: code only, no migration, **not deployed**.

## Threat addressed

`get-recording-link` authorised the creator, any user listed in the transcript's `participants` jsonb, any row of an unqualified `project_members` table, and the parties of a direct call, then asked Daily for a one-hour access link. Nothing looked at whether a participant had since been denied or removed from the meeting, and every lookup error was swallowed into "not a member" or, worse, left the previous branch's result standing.

## Affected actor, object, action

| Actor | Object | Action |
|---|---|---|
| Authenticated user listed on a transcript but `denied` or `removed` from its meeting | `call_transcripts` recording | Request a Daily access link |
| Authenticated user with a stale or non-canonical project row | Project call recording | Same |

## Code paths changed

| File | Change |
|---|---|
| `supabase/functions/_shared/recordingAccess.ts` (new) | Pure `decideRecordingAccess(facts)`. Creator allowed; a `denied` or `removed` meeting status denies every non-creator path; listed participant, canonical project access or direct-call party allow; a failed lookup denies. |
| `supabase/functions/get-recording-link/index.ts` | Builds the facts from canonical records: `meeting_participants.status` for meeting calls; `requireProjectAccess` (owner or accepted `owner`/`collaborator`/`creative`) instead of `project_members`; the direct call's `started_by`/`invited_user_id`. Lookup errors answer 503, denials 403, before any Daily request. |
| `src/lib/__tests__/recordingAccess.test.ts` (new) | Role matrix plus a source-order contract. |

Unchanged on purpose: authentication, the creator path, the listed-participant path for non-revoked people, direct-call parties, the Daily request and its one-hour link, the cached `recording_url` write.

## Behaviour change to review before release

- `project_members` appears nowhere in `supabase/migrations` or the generated types in this repository, so the old branch may have been dead and the lookup may have always failed. The replacement uses the canonical strict check, so **accepted project operators (owner, collaborator, creative) can now fetch the recording of their project's calls**. That equals the transcript audience (project access) and the documented intent of the handler, but it is an effective widening if the old branch was dead. Clients and guests are not added.
- If `project_members` does exist in production, its rows no longer grant anything.

## Remaining gaps

- ~~A listed participant of a project call who has lost project access keeps the link.~~ **Closed by owner decision 2 (follow-up PR):** a call that belongs to a project (`call_transcripts.project_id` set) is available only to its creator, the project owner and accepted operators. Having been in the room, a guest role, a pending invitation or a direct-call relation grants nothing there. Clients are not added (the decision says owner and accepted members, excluding guests; clients were left out until stated otherwise).
- Revocation covers **meeting**-kind calls only (the only kind with participant statuses).
- The access link already issued lives until its Daily expiry; the stored `recording_url` cache can still be read through the table's own RLS.
- The recording and transcript audiences are still defined in two places (this function and the SQL policies on `call_transcripts` / `meeting_recordings`); aligning them is a Phase 2 proposal.

## Acceptance tests

Automated (vitest): `src/lib/__tests__/recordingAccess.test.ts`

| Identity | Expected |
|---|---|
| Transcript creator (host) | allowed, even if their own meeting row says removed |
| Listed participant, status joined or left | allowed |
| Listed participant, status denied or removed | 403 |
| Revoked status plus project access or direct-call party | 403 (no bypass through another audience) |
| Accepted project operator, not listed | allowed |
| Direct-call party | allowed |
| Unrelated user | 403 |
| Any lookup failing | 503, including for the creator |
| Source | no `project_members`; decision precedes the Daily request; 503 vs 403 branches |

Manual, staging-safe (not run: no staging access in this pass): one meeting recording and one project call recording, with host, joined attendee, the same attendee after `removed`, an accepted collaborator, a pending invitee and an unrelated user. A pending invitee must be denied (`requireProjectAccess` requires `accepted`).

## Rollback

Revert the PR. No data, schema or policy changed.

## Release

PR only; no automatic deploy. Edge functions deploy through the documented Lovable paste path, which needs explicit approval.
