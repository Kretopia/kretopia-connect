# Slice H: recording consent on a booking is explicit

Gate audit finding: **GA UX-04** (§5, P1). Matrix row 15 of `gate-audit-company-experience-execution-matrix.md`.
Status of this slice: code only, no migration, **not deployed**.

## Threat addressed

`book-meeting` is a public endpoint. It computed `recordConsent = body.record_consent !== false`, so a request that omitted the field, sent `null`, or sent a wrong type enabled cloud recording and transcription on the Daily room and set `recording_enabled` and `transcript_enabled` on the meeting. Missing consent was treated as agreement.

## Affected actor, object, action

| Actor | Object | Action |
|---|---|---|
| A guest (or any caller) of the public booking endpoint | The booked meeting and its Daily room | Create a booking without having said yes to recording |

## Code paths changed

| File | Change |
|---|---|
| `supabase/functions/_shared/recordingConsent.ts` (new) | Pure `hasExplicitRecordingConsent(value)`: true only for the boolean `true`. |
| `supabase/functions/book-meeting/index.ts` | `recordConsent` comes from that helper. The response gains an additive `recording_enabled` so a client can show what was actually enabled. |
| `src/lib/__tests__/recordingConsent.test.ts` (new) | Value matrix, wiring contract, and a check that the one existing client always sends a boolean. |

Unchanged on purpose: the room settings, the meeting row shape, the collision check, notifications, every response field that existed.

## Effect on the existing client

`src/pages/BookingPage.tsx` always sends `record_consent: recordConsent` with a boolean state, so a booking made from the page behaves as before. Only a caller that omits or mistypes the field is now **not** recorded. That is the intended fail-closed change.

## Decisions for the approver (not in this PR)

1. **The checkbox is pre-ticked** (`useState(true)` in `BookingPage.tsx`). The server now requires an explicit `true`, but a pre-ticked box is a weak form of consent. Whether to default it to unticked is a product and legal decision with a conversion cost; the audit raises it without settling it.
2. **Other creators of recorded meetings** (`create-meeting`, direct and project calls, stages) were not part of this finding and were not changed. Their consent and defaults need the same read before any claim that recording is consent-gated product-wide.
3. **No consent record.** The meeting stores the boolean outcome, not who consented, when, or to which wording. A receipt is a schema proposal for Phase 2.

## Acceptance tests

Automated (vitest): `src/lib/__tests__/recordingConsent.test.ts`

| Input `record_consent` | Recording and transcript enabled |
|---|---|
| `true` | yes |
| `false`, absent, `null`, `"true"`, `"1"`, `1`, `0`, `{}`, `[]` | no |

Also: source contract (no `!== false`; room, `recording_enabled` and `transcript_enabled` share one decision; response includes `recording_enabled`) and a check that `BookingPage` sends a boolean.

Manual, staging-safe (not run: no staging access): book once with the box ticked (recording on, response `recording_enabled: true`), once unticked (off), and once by posting without the field (off).

## Rollback

Revert the PR. No data, schema or secret changed. Existing meetings keep their stored flags.

## Release

PR only; no automatic deploy. Edge functions deploy through the documented Lovable paste path, which needs explicit approval.
