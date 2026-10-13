# Slice E: a denied or removed participant no longer gets a meeting token

Gate audit finding: **GA SEC-06** (§3), token half. Matrix row 16 of `gate-audit-company-experience-execution-matrix.md`.
Status of this slice: code only, no migration, **not deployed**.

## Threat addressed

`mint-meeting-token` loaded the caller's `meeting_participants` row by `role` only and issued a Daily token to anyone who had a row, whatever its `status`. The column allows `invited, knocking, joined, left, denied, removed`. A host who removed or denied someone therefore left that person able to request a fresh token, and the final write re-marked the row `joined`.

It also closes the link re-entry variant: a removed person who still holds the share link has a row, so they reach the row branch (not the `share_token` branch) and used to be admitted.

## Affected actor, object, action

| Actor | Object | Action |
|---|---|---|
| Authenticated user with a participant row whose status is `denied` or `removed` | A meeting's Daily room | Request a meeting token |

## Code paths changed

| File | Change |
|---|---|
| `supabase/functions/_shared/meetingParticipantAccess.ts` (new) | Pure helper `participantMayMint(row)`: eligible only for `invited`, `knocking`, `joined`, `left`; denies `denied`, `removed`, null, unknown and non-string status (fail closed). |
| `supabase/functions/mint-meeting-token/index.ts` | Selects `role, status`; a failed lookup answers 503 instead of falling through to the share-token branch; a revoked or unknown status answers 403 before any Daily call; the final "mark joined" write excludes revoked statuses so a host revoking mid-request is not undone. |
| `src/lib/__tests__/meetingParticipantAccess.test.ts` (new) | Role/status matrix and a source-order contract for the wiring. |

Unchanged on purpose: the host path (`host_id`), the invited/joined/left/knocking flow, the anonymous guest path (share token), token expiry, every response shape for allowed callers.

## Remaining DB/RLS gaps (need an approved Phase 2 proposal, not applied)

- `is_meeting_member()` and the SELECT policies on `meetings`, `meeting_participants`, `meeting_transcripts`, `meeting_recordings` still count a `denied` or `removed` row as a member (GA SEC-06, SQL half).
- The policy "User updates own participant row" fixes only `user_id`; role, status and `meeting_id` are not frozen (GA SEC-07).
- A share link still converts into a persistent attendee row and there is no rotation or revocation (GA SEC-08).
- A token already issued stays valid until its Daily `exp`; this slice stops future issuance only.
- The anonymous share-token path is unchanged.

## Acceptance tests

Automated (vitest, no network): `src/lib/__tests__/meetingParticipantAccess.test.ts`

| Case | Expected |
|---|---|
| status `invited`, `knocking`, `joined`, `left` | eligible (existing flow preserved) |
| status `denied`, `removed` | denied |
| row missing, status missing, null, unknown, wrong case, non-string | denied |
| source order | status read, then gate, then the Daily token request |
| failed lookup | 503, not a fall-through |
| final write | cannot set a revoked row back to `joined` |

Manual, staging-safe (not run in this pass, no staging access): with three accounts and one meeting,

| Identity | Expected response of `mint-meeting-token` |
|---|---|
| Host | token (unchanged) |
| Invited attendee | token, status becomes `joined` (unchanged) |
| Same attendee after the host sets `removed` | 403 "You no longer have access to this meeting", row stays `removed` |
| Same attendee after `denied` | 403 |
| Unrelated authenticated user, no row, no share token | 403 (unchanged) |
| Anonymous with a valid share token | token (unchanged, out of this slice) |

## Rollback

Revert the PR. No data, schema or policy was changed, so there is nothing else to restore.

## Release

PR only; no automatic deploy. Edge functions deploy only by the documented path (see project memory: pasting into the Lovable project), and that needs explicit approval.
