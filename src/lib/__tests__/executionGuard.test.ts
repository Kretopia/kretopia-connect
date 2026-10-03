import { describe, expect, it } from "vitest";
import { evaluateExecutionGuard, summarizeRunApproval } from "../../../supabase/functions/_shared/executionGuard";

const U = "u1";
const A = "a1";
const act = (o: any = {}) => ({ user_id: U, status: "approved", tool_name: "send_dm", ...o });
const ok = (decision = "approved", o: any = {}) => ({ action_id: A, user_id: U, decision, ...o });
const run = (o: any = {}) => evaluateExecutionGuard({ action: act(), approvals: [ok()], userId: U, actionId: A, ...o });

describe("evaluateExecutionGuard", () => {
  it("allows approved action with an approved record", () => {
    expect(run()).toEqual({ allowed: true, decision: "approved" });
  });
  it("allows an edited approval", () => {
    expect(run({ approvals: [ok("edited")] })).toEqual({ allowed: true, decision: "edited" });
  });
  it("needs approval when there is no approval record", () => {
    expect(run({ approvals: [] })).toMatchObject({ allowed: false, reason: "no_approval_record", needsApproval: true });
    expect(run({ approvals: null })).toMatchObject({ allowed: false, reason: "no_approval_record" });
  });
  it("ignores approval records by someone else", () => {
    expect(run({ approvals: [ok("approved", { user_id: "other" })] })).toMatchObject({ reason: "no_approval_record" });
  });
  it("needs approval while proposed", () => {
    expect(run({ action: act({ status: "proposed" }) })).toMatchObject({ allowed: false, reason: "not_approved", needsApproval: true });
  });
  it("blocks replay of an executed action", () => {
    expect(run({ action: act({ status: "executed" }) })).toMatchObject({ allowed: false, reason: "already_executed", needsApproval: false });
  });
  it("blocks rejected / revoked / cancelled records even next to an approval", () => {
    for (const d of ["rejected", "revoked", "cancelled", "canceled", "REJECTED"]) {
      expect(run({ approvals: [ok(), ok(d)] })).toMatchObject({ allowed: false, reason: "approval_revoked" });
    }
  });
  it("blocks a revoked / cancelled action status", () => {
    for (const status of ["revoked", "cancelled", "rejected"]) {
      expect(run({ action: act({ status }) })).toMatchObject({ allowed: false, reason: "approval_revoked" });
    }
  });
  it("blocks other owners and missing actions", () => {
    expect(run({ action: act({ user_id: "other" }) })).toMatchObject({ reason: "wrong_owner" });
    expect(run({ action: null })).toMatchObject({ reason: "action_not_found" });
  });
  it("fails closed on unknown status and missing user", () => {
    expect(run({ action: act({ status: null }) })).toMatchObject({ allowed: false, reason: "not_approved" });
    expect(run({ userId: "" })).toMatchObject({ allowed: false });
  });
  it("blocks when the action lookup failed (null or undefined action)", () => {
    expect(run({ action: null })).toMatchObject({ allowed: false, reason: "action_not_found", needsApproval: false });
    expect(run({ action: undefined })).toMatchObject({ allowed: false, reason: "action_not_found" });
  });
  it("blocks when the approvals lookup failed (null or undefined approvals)", () => {
    expect(run({ approvals: null })).toMatchObject({ allowed: false, reason: "no_approval_record", needsApproval: true });
    expect(run({ approvals: undefined })).toMatchObject({ allowed: false, reason: "no_approval_record" });
  });
  it("blocks an auto_executed action from being sent again", () => {
    expect(run({ action: act({ status: "auto_executed" }) })).toMatchObject({ allowed: false, reason: "already_executed" });
  });
  it("normalises case and whitespace in statuses and decisions", () => {
    expect(run({ action: act({ status: " APPROVED " }), approvals: [ok(" Approved ")] }).allowed).toBe(true);
    expect(run({ approvals: [ok(), ok(" Cancelled ")] })).toMatchObject({ reason: "approval_revoked" });
  });
  it("treats an unrecognised decision as no approval", () => {
    expect(run({ approvals: [ok("maybe")] })).toMatchObject({ allowed: false, reason: "no_approval_record" });
  });
  it("honours expectedTool", () => {
    expect(run({ expectedTool: "send_dm" }).allowed).toBe(true);
    expect(run({ expectedTool: "spin_up_project" })).toMatchObject({ reason: "wrong_tool" });
  });
  it("ignores approvals for other actions when actionId is given", () => {
    expect(run({ approvals: [ok("approved", { action_id: "zzz" })] })).toMatchObject({ reason: "no_approval_record" });
  });
});

describe("summarizeRunApproval", () => {
  it("labels states from recorded data", () => {
    expect(summarizeRunApproval({ runStatus: "awaiting_approval", actionStatus: "proposed" })).toMatchObject({ approvalLabel: "Waiting for your approval", tone: "waiting", runLabel: "Waiting for approval" });
    expect(summarizeRunApproval({ runStatus: "completed", actionStatus: "executed", approvals: [{ decision: "approved" }] })).toMatchObject({ approvalLabel: "Approved", tone: "ok" });
    expect(summarizeRunApproval({ runStatus: "completed", actionStatus: "executed", approvals: [{ decision: "edited" }] })).toMatchObject({ approvalLabel: "Approved (edited)" });
    expect(summarizeRunApproval({ runStatus: "failed", actionStatus: "rejected", approvals: [{ decision: "rejected" }] })).toMatchObject({ approvalLabel: "Rejected", tone: "blocked" });
    expect(summarizeRunApproval({ runStatus: "completed", actionStatus: "auto_executed" })).toMatchObject({ approvalLabel: "Not needed (safe step)" });
  });
  it("never reports success when records are missing", () => {
    expect(summarizeRunApproval({ runStatus: null, actionStatus: "executed", approvals: [] })).toMatchObject({ approvalLabel: "No approval record", tone: "unknown", runLabel: "Unknown" });
    expect(summarizeRunApproval({})).toMatchObject({ approvalLabel: "Unknown", runLabel: "Unknown" });
  });
});
