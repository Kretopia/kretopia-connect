# Phase 1: security foundation, slices E to I: release evidence

Status of this phase: **code complete and merged; release not performed.** No migration, no policy change, no deployment was made by this work. The release is a manual paste into the Lovable project `kretopia-app`, which this session has no authorised path to perform (no access to the production backend, and the Lovable agent is not to be used: its credits are frozen).

## 1. Threat addressed

| Gate (audit) | Threat | Slice / PR |
|---|---|---|
| GA SEC-06 (token half) | A participant a host set to `denied` or `removed` can still request a Daily token; a failed lookup falls through to the share-token branch | E / #142 |
| GA SEC-09 | A recording link is issued to any listed participant, to a non-canonical `project_members` row, and to a client for internal calls | F / #143, #149, #151, **#152** |
| GA UX-04 | A missing consent field enables recording and transcription | H / #145, **#152** (`create-meeting`) |
| GA SEC-05 (partial) | A meeting is attached to a project or Circle the caller cannot prove; the Daily room is created before any check | I / #146 |
| GA REL-04 | A captured signed Daily webhook request is valid forever | G / #144 |

## 2. Affected actor, object, action

Authenticated users with a stale or revoked participant row (meeting token, recording link); accepted project clients, guests and pending invitees (recording link); the public booking endpoint's caller (recording consent); any authenticated caller of `create-meeting` (context ids, recording flags); anyone holding an old signed Daily request (webhook).

## 3. Code paths changed (all merged in `main`)

| Function | Files | Effect |
|---|---|---|
| `mint-meeting-token` | `_shared/meetingParticipantAccess.ts`, `mint-meeting-token/index.ts` | 403 for `denied`/`removed`/unknown status; 503 on lookup failure; final write cannot un-revoke |
| `get-recording-link` | `_shared/recordingAccess.ts`, `get-recording-link/index.ts` | Decision from canonical records only. Project call: owner, accepted collaborator, accepted creative; accepted **client only if listed in `participants`**; guest, pending, denied, removed refused; lookup failure 503 |
| `book-meeting` | `_shared/recordingConsent.ts`, `book-meeting/index.ts` | Records only for `record_consent === true`; response gains `recording_enabled` |
| `create-meeting` | `_shared/meetingContextAccess.ts`, `create-meeting/index.ts` | `project_id` and `circle_id` provable before the room exists; recording and transcription need `recording_enabled === true` AND `record_consent === true` |
| `daily-recording-webhook` | `_shared/webhookFreshness.ts`, `daily-recording-webhook/index.ts` | Timestamped signature refused outside 900 s |

Regression guards: `meetingParticipantAccess` 11, `recordingAccess` 31, `webhookFreshness` 17, `recordingConsent` 15, `meetingContextAccess` 8 = **82 tests**, all passing at `main` `c444adb7f`.

## 4. Release readiness: what was verified, read-only, on 2026-10-13

Files of the `kretopia-app` project were read through the Lovable connector (it reports what the project's code says, not what runs):

| Function in `kretopia-app` | State | Consequence |
|---|---|---|
| `mint-meeting-token` | Pre-slice: no status check; fixed `4 * 60 * 60` expiry; no `roomSessionLimits` import | Slice E absent |
| `get-recording-link` | Pre-slice: `project_members` branch, any listed participant | Slices F, #152 absent |
| `create-meeting` | Pre-slice: no context checks; `recording_enabled !== false`; fixed 4 h | Slices I, #152 absent |
| `book-meeting` | Pre-slice: `record_consent !== false`; the host notification insert uses a `body` key the table does not have (the fixed version is in `main`) | Slice H absent; pasting also ships that notification fix |
| `daily-recording-webhook` | Pre-slice: candidate signatures, no timestamp check | Slice G absent |
| `_shared/projectAccess.ts` | Present and equivalent to `main` (exports `requireProjectAccess`, `ProjectAccessError`, `isUuid`; filters `accepted`) | Dependency satisfied |
| `_shared/roomSessionLimits.ts` | **Absent (404)** | **Blocking dependency, see 5** |
| `_shared/meetingParticipantAccess.ts` | Absent (new file) | Expected: pasted by step E |

## 5. A dependency the earlier plan missed

`mint-meeting-token` and `create-meeting` in `main` import `../_shared/roomSessionLimits.ts`. That file exists in `main` but **not** in `kretopia-app`. Pasting the two functions without it makes them fail to start: meeting tokens and meeting creation would stop for everyone. It only centralises the 4-hour ceiling both already used, so behaviour is unchanged once it is there.

Corrected paste list: **`_shared/roomSessionLimits.ts` first** (SHA-256 `f2aa42fe244c9659555bc10953a675ef7df51019a6d535816553c951a3a5961a`), then the files of the checklist. The manual checklist and a new pre-flight step (1.5b: confirm every imported shared file exists) are updated in this PR. Other shared imports of the five functions were checked: `projectAccess.ts` present; the rest are the new helpers.

## 6. Remaining gaps (not addressed by code; each needs an approved proposal)

- SQL: `is_meeting_member` still counts `denied`/`removed`; participant self-update policy; share link rotation and exposure; direct-write bypass of the `create-meeting` check (`schema-policy-impact-meetings.md`, M-A to M-E).
- No canonical **client-visible** field on calls: an accepted client sees only calls they are listed on.
- `conversation_id` and `event_id` unchecked (no canonical record found).
- Four room creators enable cloud recording unconditionally; stage creation UIs lack a consent control; `StartMeetingDialog` sends no `record_consent`, so it stops recording once `create-meeting` is deployed.
- Daily webhook: no event ledger; the raw-body signature form stays unbounded.
- Production grants and policies are unverified (preflights M-A B1 to B5 and the Circle and project preflights have not been run).

## 7. Acceptance tests (run at release, per step)

As in `security-slices-e-to-i-manual-deployment-checklist.md` section 2, plus:

| Check | Expected |
|---|---|
| `mint-meeting-token` and `create-meeting` start after the paste | no import error in the function logs; token mint and meeting creation return 200 for allowed callers |
| `create-meeting` without `record_consent` | `meetings.recording_enabled = false` and `transcript_enabled = false` |
| Accepted client, listed vs not listed, on a project call | 200 vs 403 |
| Guest, pending, denied, removed | 403 |

## 8. Rollback

Per function: re-paste the saved copy and redeploy that function. Helpers can stay (the old code does not import them). `roomSessionLimits.ts` can stay too: it is imported by many other functions in `main`.

## 9. Release state (merged is not deployed)

| Function | State |
|---|---|
| `mint-meeting-token`, `get-recording-link`, `book-meeting`, `create-meeting`, `daily-recording-webhook` | **not deployed** |
