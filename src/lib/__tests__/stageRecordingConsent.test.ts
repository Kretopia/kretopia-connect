import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Curated stages (showcase and scout) record only when the host chose it, and
 * everyone is told on the stage page before they save a spot or walk in.
 *
 * Before: create-curated-stage forced `recording_enabled = true` for scout
 * stages whatever the host sent, so the "Record this stage" switch did nothing
 * for them; and the only notice was Daily's "recording started" toast once the
 * room was already recording.
 */

const read = (rel: string) => readFileSync(resolve(__dirname, rel), "utf8");
const create = read("../../../supabase/functions/create-curated-stage/index.ts");
const page = read("../../pages/CuratedStage.tsx");
const sheet = read("../../components/circle/CreateStageSheet.tsx");

describe("create-curated-stage — the host's choice is the only source of recording_enabled", () => {
  it("is true only for a literal true, for every stage type", () => {
    expect(create).toContain("recording_enabled: recording_enabled === true");
  });

  it("no longer forces recording for scout stages", () => {
    expect(create).not.toMatch(/type === "scout" \? true/);
    expect(create).not.toMatch(/recording_enabled:\s*type ===/);
  });

  it("does not fold a truthy non-boolean into consent", () => {
    expect(create).not.toContain("!!recording_enabled");
  });
});

describe("stage page — the notice comes before the call to action", () => {
  it("shows a recording notice when the stage records and has not ended", () => {
    expect(page).toContain('data-testid="stage-recording-notice"');
    expect(page).toMatch(/stage\.recording_enabled && !isEnded/);
    expect(page).toContain("This stage is recorded.");
  });

  it("renders it ahead of the host and attendee actions", () => {
    const notice = page.indexOf('data-testid="stage-recording-notice"');
    const cta = page.indexOf("{/* Primary CTA */}");
    expect(notice).toBeGreaterThan(-1);
    expect(cta).toBeGreaterThan(notice);
  });
});

describe("create sheet — the host is told what the switch does", () => {
  it("says it starts when going live and that attendees are told first", () => {
    expect(sheet).toContain("Starts when you go live; attendees are told on the stage page before they join.");
  });

  it("still sends the host's switch as a boolean", () => {
    expect(sheet).toContain("recording_enabled: recording");
  });
});
