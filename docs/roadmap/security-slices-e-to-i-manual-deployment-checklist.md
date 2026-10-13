# Manual deployment checklist: security slices E to I in `kretopia-app`

**Status: checklist only. Nothing was deployed by this work, and nothing in this file runs by itself.** Supersedes the plan in `security-slices-e-to-i-deployment-runbook.md` where they differ (the decisions below and the extra PR #149). Production edge functions deploy only by pasting into the Lovable project `kretopia-app`; the person doing it ticks each box.

Order: **E, then F, then H, then I, then G.**

## 0. Decisions recorded (owner, 2026-10-13)

| # | Decision | How it is met | Residual |
|---|---|---|---|
| 1 | Daily webhook replay window stays 900 s | `_shared/webhookFreshness.ts` default | none |
| 2 | Project recording access: only the project owner and accepted project members; exclude pending, guest, denied and removed participants | `get-recording-link` with `recordingAccess.ts` from PR **#149** (a project call is available only to its creator, the owner and accepted `owner`/`collaborator`/`creative`; denied/removed meeting status denies first) | Resolved 2026-10-13: **accepted clients are included** (roles owner, collaborator, creative, client); guests stay excluded. Needs the follow-up PR that changes the role list |
| 3 | Circle hosts: read-only preflight before deploying `create-meeting`; do not deploy it if legitimate hosts would get 403 | Section 3 below is a hard gate for step I | The preflight must be run by someone with production database access |
| 4 | Recording requires `record_consent`; do not record when it is absent | `book-meeting` (PR #145): only `record_consent === true` records | `create-meeting` still treats an absent `recording_enabled` / `transcript_enabled` as ON (its two callers always send booleans). Not changed; a one-line follow-up if you want the rule product-wide |

Before starting, confirm PR **#149** is merged (it is not part of the checksums in the earlier runbook). All hashes below are for the repository at the moment you start: recompute them (section 1.3) rather than trusting this file.

## 1. Pre-flight (all read-only)

- [ ] **1.1 Save what runs now.** For each of the five functions, copy the currently deployed source from `kretopia-app` and from the function's version history, into a folder you keep until the end of the day. This is the only real rollback artefact.
- [ ] **1.2 Verify the shared helper that already exists.** In the project's `_shared/projectAccess.ts`, confirm it exports `requireProjectAccess`, `ProjectAccessError` and `isUuid`, and that `requireProjectAccess` filters collaborators on `status = accepted`. If not, paste the repository version.
- [ ] **1.3 Check what rides along.** The project's copy is older than `main`. Diff each repository file below against the saved copy and read the **whole** diff (not only this slice's lines). Known extras: `book-meeting` carries the 2026-10-06 in-app notification change; the other four carry `f41b3f899` (2026-09-16).
- [ ] **1.4 Run the tests in the repository:** `npx vitest run src/lib/__tests__/meetingParticipantAccess.test.ts src/lib/__tests__/recordingAccess.test.ts src/lib/__tests__/webhookFreshness.test.ts src/lib/__tests__/recordingConsent.test.ts src/lib/__tests__/meetingContextAccess.test.ts` (expect 70 passing once the clients PR is merged).
- [ ] **1.5 Secrets present (presence only, never read or print):** `DAILY_API_KEY`, `DAILY_WEBHOOK_HMAC_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` are set in the function environment.
- [ ] **1.6 Name the person who watches the logs** and the time window (15 minutes after each function, then the first day).

## 2. Sequence

For each step: paste helper(s), paste the function, deploy **that function only**, run its tests, watch its logs for 15 minutes, tick, continue. Stop at the first failure and roll that function back (section 5).

### Step E: `mint-meeting-token`  (PR #142)
- [ ] Create `_shared/meetingParticipantAccess.ts` (new).
- [ ] Replace `mint-meeting-token/index.ts`.
- [ ] Deploy `mint-meeting-token`.
- [ ] Host requests a token: **200**.
- [ ] Invited attendee requests a token: **200**, their row becomes `joined`.
- [ ] Host sets that attendee to `removed`; they request again: **403** "You no longer have access to this meeting", row stays `removed`.
- [ ] Unrelated signed-in user, no link: **403**.
- [ ] Logs for 15 minutes: no unexpected 503.

### Step F: `get-recording-link`  (PRs #143 and #149)
- [ ] Create `_shared/recordingAccess.ts` (new, imports the step E helper: step E must be done).
- [ ] Confirm `_shared/projectAccess.ts` is current (1.2).
- [ ] Replace `get-recording-link/index.ts`.
- [ ] Deploy `get-recording-link`.
- [ ] Creator of a ready transcript: **200** with a link.
- [ ] A **project** call: accepted collaborator and accepted **client**: each **200**.
- [ ] A **project** call: a person who attended as a project **guest**, a pending invitee, and someone removed from the project: each **403**.
- [ ] A **meeting** recording: a listed participant after the host set them `removed`: **403**.
- [ ] A non-project direct call: a party to it: **200**.
- [ ] Logs: 403 "Forbidden" is expected for the cases above; investigate any report from a normal flow.

### Step H: `book-meeting`  (PR #145)
- [ ] Create `_shared/recordingConsent.ts` (new).
- [ ] Replace `book-meeting/index.ts` (read the extra notification diff, 1.3).
- [ ] Deploy `book-meeting`.
- [ ] Booking page, box ticked: **200**, `recording_enabled: true`.
- [ ] Booking page, box unticked: **200**, `recording_enabled: false`.
- [ ] Request without `record_consent`: **200**, `recording_enabled: false`.
- [ ] The host notification still arrives for a booking.

### Step I: `create-meeting`  (PR #146), **blocked until section 3 passes**
- [ ] Section 3 preflight is done and its result is "no legitimate host would be refused".
- [ ] Create `_shared/meetingContextAccess.ts` (new).
- [ ] Replace `create-meeting/index.ts`.
- [ ] Deploy `create-meeting`.
- [ ] Meeting from a project you belong to: **200**.
- [ ] Meeting with a project you do not belong to: **403**, and **no new Daily room** appears.
- [ ] Meeting from your own Circle: **200**.
- [ ] Meeting with a Circle you have not joined and did not create: **403**.
- [ ] A DM meeting and an event meeting (the two ids that are not checked): **200**, unchanged.
- [ ] Logs: any 403 on a normal flow means a legitimate path was missed: roll back and report.

### Step G: `daily-recording-webhook`  (PR #144)
- [ ] Create `_shared/webhookFreshness.ts` (new).
- [ ] Replace `daily-recording-webhook/index.ts`.
- [ ] Deploy `daily-recording-webhook`.
- [ ] Daily dashboard "test" event: **200**.
- [ ] A genuine fresh recording event: **200**, a transcript row is created.
- [ ] Replay the same signed request after the window: **401**.
- [ ] Logs for a full day: `rejected: timestamp_outside_tolerance` should be rare; `accepted a raw-body signature` tells you whether the legacy form is still in use.

## 3. Hard gate for step I: Circle hosts (read-only)

Goal (decision 3): confirm that no legitimate host of a Circle meeting would receive 403 under the new rule: *the caller created the Circle or holds a membership row*.

Run **read-only** (SELECT only) against the production database, as someone with access:

```
-- READ-ONLY. Meetings attached to a Circle whose host would now be refused.
select m.id, m.host_id, m.circle_id, m.source, m.created_at,
       (r.id is null) as circle_missing,
       (r.created_by = m.host_id) as host_created_circle,
       (sm.id is not null) as host_is_member
from public.meetings m
left join public.spark_rooms r on r.id = m.circle_id
left join public.spark_room_members sm on sm.room_id = m.circle_id and sm.user_id = m.host_id
where m.circle_id is not null
  and (r.id is null or (r.created_by <> m.host_id and sm.id is null))
order by m.created_at desc;
```

Also count all meetings with a non-null `circle_id` and the distinct hosts, so the refused set can be read as a share of the total.

Reading the result:

| Result | Action |
|---|---|
| Zero rows | Gate passes |
| Rows, all older than 90 days, or hosts who are no longer in the Circle by design | Gate passes; write down why |
| Recent rows (last 90 days) for hosts with a legitimate reason (e.g. an event host who runs the Circle's live room without joining) | **Do not deploy `create-meeting`.** Report the pattern; the rule needs a second branch (e.g. event host) before it ships |
| `circle_missing = true` | A dangling reference: not a legitimate host; note it for the M-E foreign-key cleanup |

The same shape of check for projects (hosts without owner or accepted access to their meeting's `project_id`) is advisable, using `projects.created_by` and `project_collaborators` with `status = 'accepted'`. Decision 3 only requires the Circle check; the project one is the same risk class.

## 4. After all five

- [ ] Fill section 6 (merged is not deployed).
- [ ] Re-run the five tests of step E to I once more end to end with the two test accounts.
- [ ] Keep the saved copies (1.1) until the first full day of logs is clean.
- [ ] Do **not** treat this as closing the meeting findings: `schema-policy-impact-meetings.md` is still unapplied (M-A to M-E).

## 5. Rollback, per function

Re-paste the saved copy from 1.1 and redeploy that one function. The new shared helpers can stay: they are unused by the old code and harmless. Rolling back `get-recording-link` does not require rolling back `mint-meeting-token` (its helper remains valid). Record each rollback in section 6 with the reason.

## 6. Deployment record (merged is not deployed)

| Step | Function | PR(s) | Pasted by / when | Checksum matched | Tests passed | Logs reviewed | State |
|---|---|---|---|---|---|---|---|
| E | `mint-meeting-token` | #142 | | | | | not deployed |
| F | `get-recording-link` | #143, #149 | | | | | not deployed |
| H | `book-meeting` | #145 | | | | | not deployed |
| I | `create-meeting` | #146 | | | | | not deployed (gated by 3) |
| G | `daily-recording-webhook` | #144 | | | | | not deployed |
