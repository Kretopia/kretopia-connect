# Deployment runbook: security slices E to I (edge functions)

Status: **plan only. Nothing in this document has been executed, and nothing was deployed.** The edge functions of the production (legacy) backend deploy only by pasting code into the Lovable project `kretopia-app`; this repository's tooling has no access to it. Merging a PR is not a deployment: record the real state in section 9.

## 1. What is being deployed

Five functions and five new shared helpers, all already merged to `main` (PRs #142 to #146). No migration, no policy, no secret, no data change.

| Order | Function | Slice / PR | Gate | New shared file | Behaviour change for callers |
|---|---|---|---|---|---|
| 1 | `mint-meeting-token` | E / #142 | GA SEC-06 (token half) | `_shared/meetingParticipantAccess.ts` | A `denied` / `removed` participant gets 403; a failed lookup gets 503 (was: fell through) |
| 2 | `get-recording-link` | F / #143 | GA SEC-09 | `_shared/recordingAccess.ts` (imports the file above) | Revoked meeting participants get 403; accepted project operators can now fetch their project's call recordings; lookup failure 503 |
| 3 | `book-meeting` | H / #145 | GA UX-04 | `_shared/recordingConsent.ts` | Recording and transcription only for `record_consent === true`; response gains `recording_enabled` |
| 4 | `create-meeting` | I / #146 | GA SEC-05 (partial) | `_shared/meetingContextAccess.ts` | `project_id` and `circle_id` must be provable (403/503) before the Daily room is created |
| 5 | `daily-recording-webhook` | G / #144 | GA REL-04 | `_shared/webhookFreshness.ts` | A timestamped signature older or newer than 900 s is refused (401) |

The order puts the shared helper dependency first (slice F imports slice E's helper), keeps the highest-traffic user-facing flows early while they are easiest to smoke-test, and leaves the webhook last because it is the only one whose failure is silent (a dropped event, not an error shown to a person).

## 2. Files to paste, with checksums

Checksums are SHA-256 of the files at `origin/main` when this runbook was written. After pasting, recompute from the Lovable copy and compare: a mismatch means a different version was pasted.

| File (repository path) | Lines | SHA-256 |
|---|---|---|
| `supabase/functions/_shared/meetingParticipantAccess.ts` (new) | | `f2dc1c33ed6a0faea0a5b2d85bbb320254c9e0b65a847d0886017976da863364` |
| `supabase/functions/_shared/recordingAccess.ts` (new) | | `b8d60142396af75144f36e7f4b1b1529622d712237840fc25df7588accaab031` |
| `supabase/functions/_shared/webhookFreshness.ts` (new) | | `3c045d7ab2dc778ecfae0ac97f767ce78601347cfbdac2d2706a6fd9e7885411` |
| `supabase/functions/_shared/recordingConsent.ts` (new) | | `eb55e18f64d64443aeacf65bb4ec00dfea6f4a2bca6a53d1d7f170721fd0a8be` |
| `supabase/functions/_shared/meetingContextAccess.ts` (new) | | `968cffd00c61377fede4dde150298a127e028e3304021287adb78ab7ec8e727f` |
| `supabase/functions/_shared/projectAccess.ts` (**existing, verify, see 3.2**) | | `0a0b3cb8b1dabcf1c5628f5464c9ad714f1f85e7a968f3450a3ef91867b4a092` |
| `supabase/functions/mint-meeting-token/index.ts` | 150 | `63bd589476d440ae084e5c72b60bbec74c78477c6f3d1121cf05acc7208f643e` |
| `supabase/functions/get-recording-link/index.ts` | 167 | `3b696b3f00492dc961c9cc6c2e2a6ed3ae96c5e53966aad05e2fa950aeba0655` |
| `supabase/functions/book-meeting/index.ts` | 196 | `45d2b2de5865a883af9b579d415e6230e81520510579d29ca523eebc7da5ab56` |
| `supabase/functions/create-meeting/index.ts` | 218 | `e6d518f401b2faab7dd5bdab5ea840d6c21b57203864d7db53ea8591d7c6eb7c` |
| `supabase/functions/daily-recording-webhook/index.ts` | 315 | `f2795873808140b6d06a1b2d778b19e2682d32f0eb44593dfb78be6f9d77ff04` |

Paste whole files, not hunks. The five new helpers must exist in the project **before** the functions that import them, or those functions fail to start.

## 3. Pre-flight (all read-only)

### 3.1 Save what is running now
For each of the five functions, save the currently deployed source (copy from the Lovable project and from the Supabase function's version history). This is the rollback artefact. Do not skip it: a function's earlier version cannot be rebuilt from this repository alone (see 3.3).

### 3.2 Check the shared helper the project already has
`_shared/projectAccess.ts` is not new, but slices F and I import three names from it. In the Lovable copy confirm it exports `requireProjectAccess`, `ProjectAccessError` and `isUuid`, and that `requireProjectAccess` selects `status = accepted` on `project_collaborators`. If it does not, paste the repository version (checksum above); it was last changed on 2026-10-03 (`b8bc1330f`).

### 3.3 Know what else rides along
The Lovable copy of the project is **older than `main`** (project memory). Pasting whole files therefore also brings changes that predate these slices:

| File | Earlier change that will ride along |
|---|---|
| `book-meeting/index.ts` | `17d129551` (2026-10-06) in-app notifications for Studio events: the host notification insert; `f41b3f899` (2026-09-16) |
| `create-meeting`, `daily-recording-webhook`, `get-recording-link`, `mint-meeting-token` | `f41b3f899` (2026-09-16) "Changes" |
| `projectAccess.ts` | `b8bc1330f` (2026-10-03) fail-closed project access guards |

Diff each repository file against the saved copy (3.1) and read the whole diff, not only the lines of this slice, before pasting.

### 3.4 Decisions to confirm first
These are open in the PR descriptions. Do not paste until each is answered.

1. **`daily-recording-webhook` window**: keep 900 s or tighten (Daily's retry timestamps are not documented here).
2. **`get-recording-link` widening**: accepted project operators (owner, collaborator, creative) can now fetch the recording of their project's calls. Accept, or have the project branch removed first (one line).
3. **`create-meeting` Circle hosts**: a Circle host who is neither its creator nor a member now gets 403. Confirm there is none, or accept.
4. **`book-meeting` consent**: callers other than the booking page that omit `record_consent` are no longer recorded. The pre-ticked checkbox is untouched.

### 3.5 Tests and secrets
- Run locally: `npx vitest run src/lib/__tests__/meetingParticipantAccess.test.ts src/lib/__tests__/recordingAccess.test.ts src/lib/__tests__/webhookFreshness.test.ts src/lib/__tests__/recordingConsent.test.ts src/lib/__tests__/meetingContextAccess.test.ts` (expect 63 passing).
- Confirm `DAILY_WEBHOOK_HMAC_SECRET` and `DAILY_API_KEY` are set in the function environment. Confirm presence only; never read or print the values.

## 4. Steps (repeat for each function, in the order of section 1)

1. Paste the new shared helper(s) for that function (and, for the first function, all five).
2. Paste the function's `index.ts`.
3. Deploy that function only.
4. Run its smoke tests (section 5).
5. Watch its logs for 15 minutes (section 6) before the next one.
6. Record the result in section 9.

Stop the sequence at the first function whose smoke test fails; roll that one back (section 7) and report.

## 5. Smoke tests

Use two ordinary test accounts and one test meeting you control. Templates use placeholders only: never paste a real token into a ticket or chat.

| Function | Test | Expected |
|---|---|---|
| `mint-meeting-token` | Host requests a token | 200 and a token (unchanged) |
| | Invited attendee requests a token | 200, row becomes `joined` |
| | Host sets that attendee to `removed`; they request again | **403** "You no longer have access to this meeting"; the row stays `removed` |
| | Unrelated signed-in user, no link | 403 (unchanged) |
| `get-recording-link` | Creator of a ready transcript | 200 with a link |
| | A listed participant after the host set them `removed` (meeting kind) | **403** |
| | An accepted project collaborator on a project call | 200 (the widening in 3.4) |
| | A pending invitee of the project, not a participant | 403 |
| `book-meeting` | Booking page with the box ticked | 200, `recording_enabled: true` |
| | Booking page with the box unticked | 200, `recording_enabled: false` |
| | POST without `record_consent` | 200, `recording_enabled: false` |
| `create-meeting` | Meeting from a project you belong to | 200 |
| | Meeting with a project you do not belong to | **403**, and no new Daily room appears |
| | Meeting from your own Circle | 200 |
| | Meeting with a Circle you have not joined | **403** |
| `daily-recording-webhook` | Daily's dashboard "test" event | 200 |
| | A genuine fresh recording event | 200, transcript row created |
| | The same signed request replayed after the window | **401** |

Request shape (placeholders, run from a trusted shell, never commit):

```
curl -sS -X POST "<SUPABASE_URL>/functions/v1/<FUNCTION>" \
  -H "Authorization: Bearer <TEST_USER_JWT>" \
  -H "Content-Type: application/json" \
  -d '<JSON_BODY>'
```

## 6. What to watch in the logs (first day)

| Function | Line | Meaning |
|---|---|---|
| `daily-recording-webhook` | `rejected: timestamp_outside_tolerance` | A replay, or a late Daily retry: if frequent, the window is too tight |
| | `accepted a raw-body signature: its age cannot be bounded` | Production still uses the legacy signature form: informs whether it can be removed |
| `mint-meeting-token` | HTTP 403 "no longer have access" | Expected after a host removes someone; a burst may mean a legitimate status is being mislabelled |
| | HTTP 503 | A participant lookup failed: investigate before it persists |
| `get-recording-link` | HTTP 503 "Could not verify access" | Same |
| `create-meeting` | 403 "do not have access to that project/Circle" | Expected for misuse; a person reporting it from a normal flow means a legitimate path was missed |

Define in advance what triggers a rollback: any 5xx rate above the function's normal level, or any report that a legitimate meeting, booking or recording is blocked.

## 7. Rollback

Per function, independently: re-paste the saved previous `index.ts` (3.1) and redeploy that function. The new shared helpers can stay in place: they are unused by the old code and harmless. A rollback of `get-recording-link` does not require rolling back `mint-meeting-token`, and the helper it imports remains valid.

## 8. Not covered by this deployment

Everything in `schema-policy-impact-meetings.md` (the SQL half: `is_meeting_member`, the participant self-update policy, link rotation, the direct-write bypass of the `create-meeting` check). Until that proposal is approved and applied, **a removed participant can still read meeting data through the database**, and a user can still attach a meeting to a foreign project by writing the row directly. These functions close the edge-function paths only. Also unchanged: `conversation_id` and `event_id` validation, recording defaults in `create-meeting`, other recorded-call creators, the replay ledger.

## 9. Deployment record (fill in as it happens; merged is not deployed)

| Function | PR merged | Pasted by / when | Checksum matches | Smoke tests | Logs reviewed | State |
|---|---|---|---|---|---|---|
| `mint-meeting-token` | #142 | | | | | not deployed |
| `get-recording-link` | #143 | | | | | not deployed |
| `book-meeting` | #145 | | | | | not deployed |
| `create-meeting` | #146 | | | | | not deployed |
| `daily-recording-webhook` | #144 | | | | | not deployed |
