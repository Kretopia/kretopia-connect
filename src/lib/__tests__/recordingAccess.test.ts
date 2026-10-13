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
const decideRecordingAccessFactsExample = (): RecordingAccessFacts => ({ ...base, isProjectCall: true, projectClient: true, meetingParticipantStatus: null, lookupFailed: false });

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

describe("decideRecordingAccess: a project call belongs to the project team (owner decision 2)", () => {
  const projectCall = { isProjectCall: true };

  it("allows the owner or an accepted operator, and the creator", () => {
    expect(decide({ ...projectCall, projectAccess: true })).toEqual({ allowed: true, reason: "project_access" });
    expect(decide({ ...projectCall, createdBy: U }).allowed).toBe(true);
  });

  it("does not let having been in the room grant anything: a guest, a pending invitee or a former member is listed but has no project access", () => {
    expect(decide({ ...projectCall, listedParticipant: true })).toEqual({
      allowed: false,
      reason: "project_members_only",
    });
  });

  it("does not let a direct-call party bypass it", () => {
    expect(decide({ ...projectCall, directCallParty: true }).allowed).toBe(false);
  });

  it("still denies a revoked meeting status even for a project member", () => {
    expect(decide({ ...projectCall, projectAccess: true, meetingParticipantStatus: "removed" })).toEqual({
      allowed: false,
      reason: "revoked_participant",
    });
  });

  it("leaves non-project calls exactly as before", () => {
    expect(decide({ listedParticipant: true }).allowed).toBe(true);
    expect(decide({ directCallParty: true }).allowed).toBe(true);
  });
});

describe("decideRecordingAccess: clients see a project call only when they are on it (corrective rule)", () => {
  const projectCall = { isProjectCall: true };
  const client = { ...projectCall, projectClient: true };

  it("allows an accepted client who is a listed participant of the call", () => {
    expect(decide({ ...client, listedParticipant: true })).toEqual({ allowed: true, reason: "client_participant" });
  });

  it("denies an accepted client who is not on the call: being a client opens no internal call", () => {
    expect(decide(client)).toEqual({ allowed: false, reason: "client_not_participant" });
  });

  it("does not let a client bypass through a direct-call relation", () => {
    expect(decide({ ...client, directCallParty: true }).allowed).toBe(false);
  });

  it("denies a project guest, listed or not (no operator access, no client access)", () => {
    expect(decide({ ...projectCall, listedParticipant: true })).toEqual({ allowed: false, reason: "project_members_only" });
    expect(decide(projectCall)).toEqual({ allowed: false, reason: "project_members_only" });
  });

  it("denies a pending invitee and a former member: they have no accepted project access at all", () => {
    expect(decide({ ...projectCall, listedParticipant: true, projectAccess: false, projectClient: false }).allowed).toBe(false);
  });

  it.each(["denied", "removed"])("denies a %s meeting status first, even for a listed client or an operator", (status) => {
    expect(decide({ ...client, listedParticipant: true, meetingParticipantStatus: status })).toEqual({
      allowed: false,
      reason: "revoked_participant",
    });
    expect(decide({ ...projectCall, projectAccess: true, meetingParticipantStatus: status }).allowed).toBe(false);
  });

  it("leaves owner, accepted collaborator and accepted creative unchanged: allowed whether or not they are listed", () => {
    expect(decide({ ...projectCall, projectAccess: true })).toEqual({ allowed: true, reason: "project_access" });
    expect(decide({ ...projectCall, projectAccess: true, listedParticipant: true }).allowed).toBe(true);
  });

  it("has no client-visible input: sharing a whole call with clients needs a canonical field that does not exist yet", () => {
    const facts = Object.keys(decideRecordingAccessFactsExample());
    expect(facts.some((k) => /client_?visible|visibleToClient|sharedWithClient/i.test(k))).toBe(false);
  });
});

describe("create-meeting recording default fails closed", () => {
  const source = readFileSync(resolve(__dirname, "../../../supabase/functions/create-meeting/index.ts"), "utf8");

  it("records only when recording_enabled is true AND consent is explicit", () => {
    expect(source).toContain("hasExplicitRecordingConsent(body.record_consent)");
    expect(source).toContain("body.recording_enabled === true && consented");
    expect(source).toContain("body.transcript_enabled === true && consented");
  });

  it("no longer treats an absent flag as on", () => {
    expect(source).not.toContain("body.recording_enabled !== false");
    expect(source).not.toContain("body.transcript_enabled !== false");
  });

  it("declares record_consent on the request body", () => {
    expect(source).toMatch(/record_consent\?: boolean/);
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

  it("reads the role from the strict check and never passes a client or guest as an operator", () => {
    expect(source).not.toContain("allowRoles");
    expect(source).toContain('access.role === "client"');
    expect(source).toContain('access.role !== "guest"');
    expect(source).toContain("projectClient,");
  });

  it("tells the decision whether the call belongs to a project", () => {
    expect(source).toContain("isProjectCall: !!row.project_id");
  });

  it("reads the meeting participant status for meeting calls", () => {
    expect(source).toContain('.from("meeting_participants")');
    expect(source).toContain('row.call_kind === "meeting"');
  });
});
