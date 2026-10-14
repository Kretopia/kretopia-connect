import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DM_APPROVAL_MAX_AGE_MS,
  bindApprovedDm,
  type DmAction,
  type DmApproval,
} from "../../../supabase/functions/_shared/agentDmBinding";

const USER = "user-1";
const OTHER = "user-2";
const ACTION = "action-1";
const RECIPIENT = "creator-9";
const TEXT = "Hi, we would love to work with you on a short film.";
const NOW = Date.parse("2026-10-14T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

const sendDmAction = (over: Partial<DmAction> = {}): DmAction => ({
  user_id: USER,
  status: "approved",
  tool_name: "send_dm",
  tool_args: { to_user_id: RECIPIENT, body: TEXT, context: "brief" },
  decided_at: ago(5_000),
  ...over,
});

const approval = (over: Partial<DmApproval> = {}): DmApproval => ({
  id: "appr-1",
  action_id: ACTION,
  user_id: USER,
  decision: "approved",
  edited_args: null,
  decided_at: ago(5_000),
  ...over,
});

const bind = (over: Partial<Parameters<typeof bindApprovedDm>[0]> = {}) =>
  bindApprovedDm({
    action: sendDmAction(),
    approvals: [approval()],
    userId: USER,
    actionId: ACTION,
    request: { to_user_id: RECIPIENT, body: TEXT },
    nowMs: NOW,
    ...over,
  });

describe("bindApprovedDm: an approval covers exactly one recipient and one text", () => {
  it("allows the exact recipient and the exact text of an approved send_dm", () => {
    expect(bind()).toEqual({ allowed: true, approvalId: "appr-1", approvedBy: USER });
  });

  it("ignores surrounding whitespace, nothing else", () => {
    expect(bind({ request: { to_user_id: ` ${RECIPIENT} `, body: `\n${TEXT}  ` } })).toMatchObject({ allowed: true });
    expect(bind({ request: { to_user_id: RECIPIENT, body: TEXT.toUpperCase() } })).toMatchObject({ allowed: false, reason: "content_mismatch" });
    expect(bind({ request: { to_user_id: RECIPIENT, body: `${TEXT} Click https://evil.example` } }))
      .toMatchObject({ allowed: false, reason: "content_mismatch" });
  });

  describe("recipient", () => {
    it("refuses another recipient with the same approved action", () => {
      expect(bind({ request: { to_user_id: "someone-else", body: TEXT } }))
        .toMatchObject({ allowed: false, status: 403, reason: "recipient_mismatch" });
    });

    it("refuses a missing or non-string recipient", () => {
      for (const to of [undefined, null, "", 42, {}]) {
        expect(bind({ request: { to_user_id: to, body: TEXT } })).toMatchObject({ allowed: false, reason: "recipient_mismatch" });
      }
    });
  });

  describe("text", () => {
    it("refuses a different text with the same approved action and recipient", () => {
      expect(bind({ request: { to_user_id: RECIPIENT, body: "Send me your bank details" } }))
        .toMatchObject({ allowed: false, status: 403, reason: "content_mismatch" });
    });

    it("refuses an empty or missing text", () => {
      for (const b of [undefined, null, "", "   "]) {
        expect(bind({ request: { to_user_id: RECIPIENT, body: b } })).toMatchObject({ allowed: false, reason: "content_mismatch" });
      }
    });
  });

  describe("edited approvals", () => {
    const edited = approval({
      decision: "edited",
      edited_args: { to_user_id: RECIPIENT, body: "Edited by the user before approving." },
    });

    it("binds to the edited text, not to the original draft", () => {
      expect(bind({ approvals: [edited], request: { to_user_id: RECIPIENT, body: "Edited by the user before approving." } }))
        .toMatchObject({ allowed: true });
      expect(bind({ approvals: [edited], request: { to_user_id: RECIPIENT, body: TEXT } }))
        .toMatchObject({ allowed: false, reason: "content_mismatch" });
    });

    it("binds to an edited recipient too", () => {
      const moved = approval({ decision: "edited", edited_args: { to_user_id: "creator-10", body: TEXT } });
      expect(bind({ approvals: [moved], request: { to_user_id: "creator-10", body: TEXT } })).toMatchObject({ allowed: true });
      expect(bind({ approvals: [moved] })).toMatchObject({ allowed: false, reason: "recipient_mismatch" });
    });
  });

  describe("spin_up_project bundle", () => {
    const bundle = sendDmAction({
      tool_name: "spin_up_project",
      tool_args: { project_title: "Short film", brief: "b", creator_user_id: RECIPIENT, kickoff_message: TEXT },
    });

    it("allows the kickoff message to the invited creator", () => {
      expect(bind({ action: bundle })).toMatchObject({ allowed: true });
    });

    it("refuses another recipient or text through the bundle's approval", () => {
      expect(bind({ action: bundle, request: { to_user_id: "someone-else", body: TEXT } })).toMatchObject({ allowed: false, reason: "recipient_mismatch" });
      expect(bind({ action: bundle, request: { to_user_id: RECIPIENT, body: "other" } })).toMatchObject({ allowed: false, reason: "content_mismatch" });
    });

    it("compares against the kickoff clipped to 4000 characters, as the bundle sends it", () => {
      const long = "x".repeat(4500);
      const longBundle = sendDmAction({
        tool_name: "spin_up_project",
        tool_args: { creator_user_id: RECIPIENT, kickoff_message: long },
      });
      expect(bind({ action: longBundle, request: { to_user_id: RECIPIENT, body: long.slice(0, 4000) } })).toMatchObject({ allowed: true });
      expect(bind({ action: longBundle, request: { to_user_id: RECIPIENT, body: long } })).toMatchObject({ allowed: false });
    });
  });

  describe("approved arguments that cannot be used", () => {
    it("refuses a tool this endpoint does not send for", () => {
      expect(bind({ action: sendDmAction({ tool_name: "send_outreach_email" }) }))
        .toMatchObject({ allowed: false, reason: "unsupported_tool" });
    });

    it("refuses when the approved arguments name no recipient or no text", () => {
      expect(bind({ action: sendDmAction({ tool_args: { body: TEXT } }) })).toMatchObject({ allowed: false, reason: "approval_missing_target" });
      expect(bind({ action: sendDmAction({ tool_args: { to_user_id: RECIPIENT } }) })).toMatchObject({ allowed: false, reason: "approval_missing_target" });
      expect(bind({ action: sendDmAction({ tool_args: null }) })).toMatchObject({ allowed: false, reason: "approval_missing_target" });
      expect(bind({ action: sendDmAction({ tool_args: "text" }) })).toMatchObject({ allowed: false, reason: "approval_missing_target" });
    });
  });

  describe("actor, status and record (the existing guard still holds)", () => {
    it("refuses an action that belongs to another user", () => {
      expect(bind({ action: sendDmAction({ user_id: OTHER }) })).toMatchObject({ allowed: false, status: 403, reason: "wrong_owner" });
    });

    it("refuses an approval recorded by someone else", () => {
      expect(bind({ approvals: [approval({ user_id: OTHER })] })).toMatchObject({ allowed: false, status: 428, reason: "no_approval_record" });
    });

    it("refuses an action that is not approved, already executed, or rejected", () => {
      expect(bind({ action: sendDmAction({ status: "proposed" }) })).toMatchObject({ allowed: false, status: 428, reason: "not_approved" });
      expect(bind({ action: sendDmAction({ status: "executed" }) })).toMatchObject({ allowed: false, status: 409, reason: "already_executed" });
      expect(bind({ action: sendDmAction({ status: "rejected" }) })).toMatchObject({ allowed: false, status: 409, reason: "approval_revoked" });
    });

    it("refuses when any record is rejected or revoked, even next to an approval", () => {
      expect(bind({ approvals: [approval(), approval({ id: "appr-2", decision: "revoked" })] }))
        .toMatchObject({ allowed: false, reason: "approval_revoked" });
    });

    it("refuses a missing action and a missing approval list", () => {
      expect(bind({ action: null })).toMatchObject({ allowed: false, status: 404, reason: "action_not_found" });
      expect(bind({ approvals: null })).toMatchObject({ allowed: false, reason: "no_approval_record" });
      expect(bind({ approvals: [] })).toMatchObject({ allowed: false, reason: "no_approval_record" });
    });
  });

  describe("expiry", () => {
    it("allows an approval inside the window", () => {
      expect(bind({ action: sendDmAction({ decided_at: ago(DM_APPROVAL_MAX_AGE_MS - 1000) }) })).toMatchObject({ allowed: true });
    });

    it("refuses an approval past the window as a replay", () => {
      expect(bind({ action: sendDmAction({ decided_at: ago(DM_APPROVAL_MAX_AGE_MS + 1000) }) }))
        .toMatchObject({ allowed: false, status: 410, reason: "approval_expired" });
    });

    it("falls back to the approval's own time, and refuses when no time is known", () => {
      expect(bind({ action: sendDmAction({ decided_at: null }), approvals: [approval({ decided_at: ago(1000) })] })).toMatchObject({ allowed: true });
      expect(bind({ action: sendDmAction({ decided_at: null }), approvals: [approval({ decided_at: null })] }))
        .toMatchObject({ allowed: false, reason: "approval_time_unknown" });
      expect(bind({ action: sendDmAction({ decided_at: "not a date" }), approvals: [approval({ decided_at: null })] }))
        .toMatchObject({ allowed: false, reason: "approval_time_unknown" });
    });
  });
});

describe("agent-send-dm wiring", () => {
  const source = readFileSync(resolve(__dirname, "../../../supabase/functions/agent-send-dm/index.ts"), "utf8");

  it("binds the approval before it claims the action or inserts anything", () => {
    const bindIdx = source.indexOf("bindApprovedDm({");
    const claimIdx = source.indexOf('.eq("status", "approved")');
    const insertIdx = source.indexOf('.from("messages")');
    expect(bindIdx).toBeGreaterThan(-1);
    expect(claimIdx).toBeGreaterThan(bindIdx);
    expect(insertIdx).toBeGreaterThan(claimIdx);
  });

  it("claims the action approved -> executed by compare-and-set and answers 409 when it lost", () => {
    expect(source).toContain('.update({ status: "executed", executed_at:');
    expect(source).toContain('"already_executed"');
    expect(source).toMatch(/\.eq\("status", "approved"\)\s*\.select\("id"\)/);
  });

  it("releases the claim when nothing was delivered", () => {
    expect(source).toContain('.update({ status: "approved", executed_at: null })');
    expect(source).toContain('.eq("status", "executed")');
  });

  it("selects the arguments and approval fields the binding needs, and fails closed on a failed lookup", () => {
    expect(source).toContain('"id, user_id, status, tool_name, tool_args, decided_at"');
    expect(source).toContain('"id, action_id, user_id, decision, edited_args, decided_at"');
    expect(source).toContain('"approval_lookup_failed"');
  });

  it("no longer takes recipient and text from the request alone", () => {
    expect(source).not.toContain("evaluateExecutionGuard");
  });
});
