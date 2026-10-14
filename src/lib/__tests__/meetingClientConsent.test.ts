import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { hasExplicitRecordingConsent } from "../../../supabase/functions/_shared/recordingConsent";

/**
 * The two clients that start a recorded meeting never consent for the person:
 * recording and transcription are opt-in, and the consent they send is true only
 * when the person switched one of them on. The server side of the same rule
 * (create-meeting, book-meeting) is covered in recordingConsent.test.ts.
 */

const read = (rel: string) => readFileSync(resolve(__dirname, rel), "utf8");
const dialog = read("../../components/calls/StartMeetingDialog.tsx");
const booking = read("../../pages/BookingPage.tsx");

describe("StartMeetingDialog — recording is opt-in and carries the consent", () => {
  it("starts with recording and transcription off", () => {
    expect(dialog).toMatch(/const \[recording, setRecording\] = useState\(false\)/);
    expect(dialog).toMatch(/const \[transcript, setTranscript\] = useState\(false\)/);
    expect(dialog).not.toMatch(/const \[(recording|transcript), set\w+\] = useState\(true\)/);
  });

  it("sends record_consent as a boolean that is true only when one of them is on", () => {
    expect(dialog).toContain("record_consent: recording || transcript");
    expect(dialog).toContain("recording_enabled: recording");
    expect(dialog).toContain("transcript_enabled: transcript");
  });

  it("tells the host what turning it on means", () => {
    expect(dialog).toContain("By turning it on, you confirm they know.");
  });
});

describe("BookingPage — the guest's recording consent starts unticked", () => {
  it("does not pre-tick the box", () => {
    expect(booking).toMatch(/const \[recordConsent, setRecordConsent\] = useState\(false\)/);
    expect(booking).not.toMatch(/useState\(true\)[^\n]*\n[^\n]*recordConsent/);
  });

  it("still sends the guest's choice as a boolean", () => {
    expect(booking).toContain("record_consent: recordConsent");
  });
});

describe("what the server does with what these clients send", () => {
  it("records only for an explicit true", () => {
    expect(hasExplicitRecordingConsent(true)).toBe(true);
    // The ways a client built from these defaults can arrive without consent:
    expect(hasExplicitRecordingConsent(false)).toBe(false);
    expect(hasExplicitRecordingConsent(undefined)).toBe(false);
    expect(hasExplicitRecordingConsent("true")).toBe(false);
  });
});
