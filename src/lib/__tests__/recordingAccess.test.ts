import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  decideRecordingAccess,
  type RecordingAccessFacts,
} from "../../../supabase/functions/_shared/recordingAccess";

const U = "user-1";
const base: RecordingAccessFacts = {
  userId: U,
  createdBy: "someone-else",
  listedParticipant: false,
  projectAccess: false,
  directCallParty: false,
};
const decide = (o: Partial<RecordingAccessFacts> = {}) => decideRecordingAccess({ ...base, ...o });

describe("decideRecordingAccess: who may fetch a recording link", () => {
  it("allows the transcript's creator", () => {
    expect(decide({ createdBy: U })).toEqual({ allowed: true, reason: "creator" });
  });

  it("allows a listed participant who has not been revoked", () => {
    expect(decide({ listedParticipant: true })).toEqual({ allowed: true, reason: "listed_participant" });
    expect(decide({ listedParticipant: true, meetingParticipantStatus: "joined" }).allowed).toBe(true);
    expect(decide({ listedParticipant: true, meetingParticipantStatus: "left" }).allowed).toBe(true);
  });

  it.each(["denied", "removed"])("denies a listed participant whose meeting status is %s", (status) => {
    expect(decide({ listedParticipant: true, meetingParticipantStatus: status })).toEqual({
      allowed: false,
      reason: "revoked_participant",
    });
  });

  it("does not let a revoked meeting status be bypassed through project or direct-call audiences", () => {
    expect(decide({ meetingParticipantStatus: "removed", projectAccess: true }).allowed).toBe(false);
    expect(decide({ meetingParticipantStatus: "denied", directCallParty: true }).allowed).toBe(false);
  });

  it("still lets the creator in (the host owns the recording)", () => {
    expect(decide({ createdBy: U, meetingParticipantStatus: "removed" }).allowed).toBe(true);
  });

  it("allows canonical project access and the parties of a direct call", () => {
    expect(decide({ projectAccess: true })).toEqual({ allowed: true, reason: "project_access" });
    expect(decide({ directCallParty: true })).toEqual({ allowed: true, reason: "direct_call_party" });
  });

  it("denies an unrelated user", () => {
    expect(decide()).toEqual({ allowed: false, reason: "no_access" });
    expect(decide({ createdBy: null })).toEqual({ allowed: false, reason: "no_access" });
  });

  it("fails closed when any lookup failed, even for the creator", () => {
    expect(decide({ createdBy: U, lookupFailed: true })).toEqual({ allowed: false, reason: "lookup_failed" });
    expect(decide({ listedParticipant: true, lookupFailed: true }).allowed).toBe(false);
  });
});

describe("get-recording-link wiring", () => {
  const source = readFileSync(resolve(__dirname, "../../../supabase/functions/get-recording-link/index.ts"), "utf8");

  it("no longer reads the unqualified project_members table", () => {
    expect(source).not.toContain('"project_members"');
    expect(source).toContain("requireProjectAccess");
  });

  it("decides before any Daily link is requested, and answers 503 for a failed lookup", () => {
    const decision = source.indexOf("decideRecordingAccess({");
    const daily = source.indexOf("/access-link");
    expect(decision).toBeGreaterThan(-1);
    expect(daily).toBeGreaterThan(decision);
    expect(source).toMatch(/unavailable \? 503 : 403/);
  });

  it("reads the meeting participant status for meeting calls", () => {
    expect(source).toContain('.from("meeting_participants")');
    expect(source).toContain('row.call_kind === "meeting"');
  });
});
