// Pure, dependency-free decision for "did the guest consent to recording and
// transcription". Imported by edge functions (Deno) and by tests (Vite).
//
// Rule: consent exists only when the request says so explicitly, with the
// boolean `true`. An absent field, null, a string ("true"), a number, or any
// other type is NOT consent (audit GA UX-04: `!== false` turned a missing
// field into agreement). The client that exists today (BookingPage) always
// sends a boolean, so the explicit path is unchanged for it.

export function hasExplicitRecordingConsent(value: unknown): boolean {
  return value === true;
}
