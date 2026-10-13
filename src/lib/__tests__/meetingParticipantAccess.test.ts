import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  REVOKED_PARTICIPANT_STATUSES,
  participantMayMint,
} from "../../../supabase/functions/_shared/meetingParticipantAccess";

describe("participantMayMint: who a participant row can still get a meeting token for", () => {
  it.each(["invited", "knocking", "joined", "left"])("keeps today's flow for status %s", (status) => {
    expect(participantMayMint({ status })).toBe(true);
  });

  it.each(["denied", "removed"])("denies a %s participant (revocation)", (status) => {
    expect(participantMayMint({ status })).toBe(false);
  });

  it("denies when the row, the status or its type is missing or unknown (fail closed)", () => {
    expect(participantMayMint(null)).toBe(false);
    expect(participantMayMint(undefined)).toBe(false);
    expect(participantMayMint({})).toBe(false);
    expect(participantMayMint({ status: null })).toBe(false);
    expect(participantMayMint({ status: "banned" })).toBe(false);
    expect(participantMayMint({ status: "JOINED" })).toBe(false);
    expect(participantMayMint({ status: 1 as unknown as string })).toBe(false);
  });

  it("lists exactly the two revoked statuses the table allows", () => {
    expect([...REVOKED_PARTICIPANT_STATUSES].sort()).toEqual(["denied", "removed"]);
  });
});

describe("mint-meeting-token wiring", () => {
  const source = readFileSync(
    resolve(__dirname, "../../../supabase/functions/mint-meeting-token/index.ts"),
    "utf8",
  );

  it("reads the participant status and checks it before any Daily token is requested", () => {
    const select = source.indexOf('.select("role, status")');
    const gate = source.indexOf("participantMayMint(pRow)");
    const dailyToken = source.indexOf("/meeting-tokens");
    expect(select).toBeGreaterThan(-1);
    expect(gate).toBeGreaterThan(select);
    expect(dailyToken).toBeGreaterThan(gate);
  });

  it("answers 403 to a revoked participant and 503 to a failed lookup instead of falling through", () => {
    expect(source).toMatch(/participantMayMint\(pRow\)\)\s*return json\([^)]*\},\s*403\)/);
    expect(source).toMatch(/if \(pErr\) return json\([^)]*\},\s*503\)/);
  });

  it("does not turn a revoked row back into joined", () => {
    expect(source).toContain('.not("status", "in",');
    expect(source).toContain("REVOKED_PARTICIPANT_STATUSES.join");
  });
});
