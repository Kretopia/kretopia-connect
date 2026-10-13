import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { hasExplicitRecordingConsent } from "../../../supabase/functions/_shared/recordingConsent";

describe("hasExplicitRecordingConsent", () => {
  it("is consent only for the boolean true", () => {
    expect(hasExplicitRecordingConsent(true)).toBe(true);
  });

  it.each([false, undefined, null, "true", "1", 1, 0, {}, [], "yes"])("is not consent for %p", (value) => {
    expect(hasExplicitRecordingConsent(value)).toBe(false);
  });
});

describe("book-meeting wiring", () => {
  const source = readFileSync(resolve(__dirname, "../../../supabase/functions/book-meeting/index.ts"), "utf8");

  it("no longer treats a missing field as agreement", () => {
    expect(source).not.toContain("record_consent !== false");
    expect(source).toContain("hasExplicitRecordingConsent(body.record_consent)");
  });

  it("derives the Daily room, recording_enabled and transcript_enabled from the same explicit decision", () => {
    expect(source).toContain("...(recordConsent");
    expect(source).toContain("recording_enabled: recordConsent");
    expect(source).toContain("transcript_enabled: recordConsent");
  });

  it("tells the client what was enabled", () => {
    expect(source).toMatch(/json\(\{[\s\S]*recording_enabled: recordConsent[\s\S]*\}\)/);
  });
});

describe("the one existing client", () => {
  const page = readFileSync(resolve(__dirname, "../../pages/BookingPage.tsx"), "utf8");

  it("always sends a boolean record_consent, so the explicit path is unchanged for it", () => {
    expect(page).toContain("record_consent: recordConsent");
    expect(page).toMatch(/const \[recordConsent, setRecordConsent\] = useState\((true|false)\)/);
  });
});
