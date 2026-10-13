# Slice I: a meeting can only be attached to a project or Circle the caller can prove

Gate audit finding: **GA SEC-05** (§3). Matrix row 18 of `gate-audit-company-experience-execution-matrix.md`.
Status of this slice: code only, no migration, **not deployed**. Partial by design: two of the four ids.

## Threat addressed

`create-meeting` accepted `project_id`, `conversation_id`, `event_id` and `circle_id` from any authenticated caller and wrote them with the service role, with no proof of access. The columns have no foreign keys. These ids decide where a recap is distributed (`transcribe-call` posts to the Circle chat and notifies participants) and which project context a meeting claims, so an association the caller does not hold can misdirect distribution. The Daily room was also created before any such check, leaving an orphan room on any later failure.

## Affected actor, object, action

| Actor | Object | Action |
|---|---|---|
| Authenticated user | A project or Circle they do not belong to | Create a meeting attached to it |

## Code paths changed

| File | Change |
|---|---|
| `supabase/functions/_shared/meetingContextAccess.ts` (new) | Pure `decideCircleContext(facts)`: the room must exist and the caller must be its creator or hold a `spark_room_members` row; a failed lookup answers 503; a missing room and an unrelated one give the same 403 (no existence oracle). |
| `supabase/functions/create-meeting/index.ts` | Before the Daily room exists: `project_id` goes through `requireProjectAccess` (owner or accepted collaborator, any role); `circle_id` must be a UUID and pass the decision above. Refusal is 403, a failed lookup 503. |
| `src/lib/__tests__/meetingContextAccess.test.ts` (new) | Decision matrix and a source-order contract. |

Unchanged on purpose: the source whitelist, recording and transcription defaults, invitee insertion, the host token, every response field, and the handling of `conversation_id` and `event_id`.

## What this slice does NOT cover (and why)

- **`conversation_id`**: no `conversations` table exists in `supabase/migrations`; the canonical record to check against was not identified in this pass.
- **`event_id`**: the events table definition was not located in the migrations in this pass, so its owner/attendee rule is unknown.
- Both are still written unchecked. They were left alone rather than rejected, because `StartMeetingDialog` passes them for DM and event meetings and a wrong guess would break working flows. Each needs its table and rule read first.
- **`invited_user_ids`** are inserted as given (GA REL-07 and distribution still apply).
- **Recording defaults**: `create-meeting` also treats a missing `recording_enabled` / `transcript_enabled` as ON (`!== false`), the same pattern as slice H. The two existing callers always send booleans. Candidate follow-up.

## Caveat on Circle membership

Joining a Circle is self-service today (`spark_room_members` policy "Users can join rooms"), so membership is the canonical record but not a strong boundary: a caller can join, then attach. This gate makes the association provable and auditable; making Circle membership itself restrictive is a policy proposal (GA SEC-16 also flags that table's SELECT policy).

## Acceptance tests

Automated (vitest): `src/lib/__tests__/meetingContextAccess.test.ts`

| Identity | Context | Expected |
|---|---|---|
| Circle creator | their Circle | allowed |
| Circle member | that Circle | allowed |
| Unrelated authenticated user | that Circle | 403 |
| Any user | a Circle id that does not exist | 403, identical to the unrelated case |
| Creator or member | any lookup failing | 503 |
| Owner or accepted collaborator | their project | allowed (existing helper) |
| Pending invitee or outsider | that project | 403 (helper requires `accepted`) |
| Source | project and Circle checks precede the Daily room request |

Manual, staging-safe (not run: no staging access): create a meeting from a project you belong to (works), from a project you do not (403, and no new Daily room), from your own Circle (works) and from another's you have not joined (403).

## Rollback

Revert the PR. No data, schema or secret changed.

## Release

PR only; no automatic deploy. Edge functions deploy through the documented Lovable paste path, which needs explicit approval. Watch the client for a Circle host who is neither creator nor member: they would now receive a 403.
