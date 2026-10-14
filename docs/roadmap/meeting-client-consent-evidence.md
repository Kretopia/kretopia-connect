# Recording consent in the two clients that start a recorded meeting

Slice V, GA UX-04 / REL-10 follow-up to slices H and I. Frontend only: no migration, no function, no policy, no secret. Closes the open item "`StartMeetingDialog` sends no `record_consent`" of the E to U deployment bundle.

## Finding
| # | Where | Evidence in the repository (not reproduced in production) | Effect |
|---|---|---|---|
| V1 | `src/components/calls/StartMeetingDialog.tsx` | `recording` and `transcript` started `true`; the body never carried `record_consent`. `create-meeting` (step I, merged, **not deployed**) records only for `recording_enabled === true` **and** `record_consent === true`. | Once step I is pasted, a host who left the toggle on gets **no recording and no transcript**, while the dialog still says "Record this call" is on. A silent loss that looks like a working feature. |
| V2 | `src/pages/BookingPage.tsx` | `recordConsent` started `true`: the guest's consent box was pre-ticked. | The server now needs an explicit `true`, but a pre-ticked box is a default the guest has to notice and undo, not an act. The slice H evidence doc raised this and left it open. |

## What changed (3 files + 1 test)
- `StartMeetingDialog.tsx`: recording and transcription start **off**. The body now sends `record_consent: recording || transcript`: true only when the host switched one of them on. When either is on, one line under the toggles says what it means: "Everyone who joins is told this call is recorded. By turning it on, you confirm they know." The record toggle's hint says it is off unless turned on.
- `BookingPage.tsx`: the box starts **unticked** and reads "Optional: record this call so Kreto can …". It still sends the guest's own choice as a boolean.
- `src/lib/__tests__/meetingClientConsent.test.ts` (new, 6): the dialog starts off, sends `record_consent: recording || transcript` and keeps `recording_enabled`/`transcript_enabled`; the booking box starts unticked and still sends `record_consent: recordConsent`; the server helper refuses `false`, `undefined` and `"true"`.

## Product trade-off (decision recorded, not hidden)
- Recording and transcription are no longer on by default for meetings started from the dialog, and fewer bookings will be recorded. That is the fail-closed direction the owner chose for the server ("an absent flag is no"); the clients now match it instead of showing a state the server will not honour.
- The confirmation line is plain factual copy, not reviewed legal text. If counsel wants specific wording or a separate checkbox, it is one string in `SettingsBlock`.

## Not covered (unchanged, listed so it is not read as fixed)
- The four room creators that enable cloud recording unconditionally and the stage creation screens without a consent control (see `security-slices-e-to-i-release-security-evidence.md`).
- Consent of the *other* participants: the host confirms they were told, the room shows the recording badge; there is no per-participant opt-out in this slice.
- `create-meeting` itself is unchanged and still not deployed.

## Release order
1. Publish the frontend (this PR). Until step I is pasted, nothing changes server-side.
2. Then paste step I (`create-meeting`, last in the bundle). Pasting it **before** the publish reproduces V1.

## Rollback
Revert this PR. The dialog goes back to recording and transcription on by default and sending no consent, and the booking box is pre-ticked again; do that only if step I has not been pasted, otherwise V1 returns.
