# Recording of curated stages: the host's choice, and a notice before anyone joins

Slice W, GA UX-04 / REL-10, third and last of the recording-consent slices (H booking, I meetings + the two clients in #175, W stages). Code only: no migration, no policy, no secret, no data change. Not deployed.

## What each room creator does today (read in the repository, not run)
| Creator | Recording on the Daily room | Who starts it | Verdict |
|---|---|---|---|
| `create-meeting` (slice I) | only for `recording_enabled === true` **and** `record_consent === true` | the room, at creation | gated (#152, #175) |
| `book-meeting` (slice H) | only for `record_consent === true` | the room | gated |
| `go-live-stage` | `stage.recording_enabled` | the host's page auto-starts on join (`autoStartRecording`) | follows the stage flag, which W1 fixes |
| `create-curated-stage` | writes `curated_stages.recording_enabled` | n/a | **W1, W2** |
| `create-sound-stage`, `create-circle-room`, `create-video-room`, `create-direct-video-call` | `enable_recording: "cloud"` always (a capability) | the host, by pressing Record in the call; everyone gets the "recording started" event | unchanged, see below |

## Findings
| # | Where | Evidence | Effect | Now |
|---|---|---|---|---|
| W1 | `create-curated-stage` | `recording_enabled: type === "scout" ? true : !!recording_enabled` | a scout host who switched "Record this stage" off was recorded anyway: the control did nothing for that type. A truthy non-boolean also counted as "yes" for showcase stages | the value is the host's own: `recording_enabled === true` for every type |
| W2 | `CuratedStage.tsx` | the stage page said nothing about recording; the only notice was Daily's "recording started" toast once the room was already recording (auto-started by the host's page on join) | an RSVP, a paid ticket or a walk-in happened without being told | one line before the call to action: "This stage is recorded. Everyone in the room sees a recording badge.", shown when the stage records and has not ended |
| W3 | `CreateStageSheet.tsx` | the switch hint said only "Attendees get a recap link after" | the host was not told it starts by itself when they go live | hint now says it starts when they go live and that attendees are told on the stage page first |

## Tests
`src/lib/__tests__/stageRecordingConsent.test.ts` (new, 7, source contract): the function no longer forces scout and uses `=== true` (no `!!`); the notice exists, is guarded by `stage.recording_enabled && !isEnded` and renders before the primary call to action; the sheet explains the switch and still sends a boolean. Not run: a real stage, a real Daily room.

## Deliberately not changed
- **The four host-pressed creators.** Removing `enable_recording` from their rooms would make the in-call Record button fail for a host who legitimately wants it, and would not add a consent step: the notice there is the in-room recording event and badge. A real change needs a product call (a host confirmation before the first recording, or recording off unless asked at creation).
- **Existing rows.** Scout stages created before this change carry `recording_enabled = true` the host did not choose. No data was touched. How many are still scheduled is a read-only count to run before deciding whether to correct them; correcting rows is a production data change and needs approval.
- **Consent of the other participants** is still "told, then they join"; there is no per-participant opt-out and no acknowledgement click.
- The default of the switch stays on in the sheet (the host sees it, labelled, and attendees are now told). Turning the default off is a product decision with a cost on recaps.

## Release
Code reaches users in two places: the frontend publish (notice and hint) and a paste of `create-curated-stage` into `kretopia-app` (the forced scout recording). Either order is safe: with the function not pasted the notice still shows for stages that record; with it pasted and the frontend not published the host's choice is honoured and attendees just see no notice.

## Rollback
Revert this PR; re-paste the previous `create-curated-stage`. Rolling back restores forced recording for scout stages.
