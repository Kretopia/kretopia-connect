import { describe, expect, it } from "vitest";
import {
  describeOutcome,
  describeResend,
  extractEmails,
  inviteByEmail,
  inviteMember,
  normalizeEmail,
  storedRoleFor,
} from "../projectInvites";

type Row = Record<string, any>;

/** Minimal in-memory stand-in for the bits of supabase-js these helpers use. */
function fakeClient(opts: { rows?: Row[]; emailSent?: boolean; fnError?: boolean; insertError?: string } = {}) {
  const rows: Row[] = [...(opts.rows ?? [])];
  const invoked: Array<{ name: string; body: any }> = [];
  let nextId = 1;

  const from = (table: string) => {
    if (table !== "project_collaborators") throw new Error(`unexpected table ${table}`);
    const filters: Array<[string, any]> = [];
    let mode: "select" | "insert" | "delete" = "select";
    let payload: Row | null = null;
    const run = async () => {
      const match = (r: Row) => filters.every(([k, v]) => r[k] === v);
      if (mode === "insert") {
        if (opts.insertError) return { data: null, error: { message: opts.insertError } };
        rows.push({ id: `new-${nextId++}`, created_at: "2026-10-06", ...payload });
        return { data: null, error: null };
      }
      if (mode === "delete") {
        for (let i = rows.length - 1; i >= 0; i--) if (match(rows[i])) rows.splice(i, 1);
        return { data: null, error: null };
      }
      return { data: rows.filter(match), error: null };
    };
    const builder: any = {
      select: () => builder,
      eq: (k: string, v: any) => (filters.push([k, v]), builder),
      order: () => builder,
      limit: () => builder,
      insert: (p: Row) => ((mode = "insert"), (payload = p), builder),
      delete: () => ((mode = "delete"), builder),
      then: (res: any, rej: any) => run().then(res, rej),
    };
    return builder;
  };

  const functions = {
    invoke: async (name: string, { body }: { body: any }) => {
      invoked.push({ name, body });
      if (opts.fnError) return { data: null, error: { message: "boom" } };
      return { data: { success: true, emailSent: opts.emailSent ?? true }, error: null };
    },
  };

  return { client: { from, functions }, rows, invoked };
}

const base = { projectId: "p1", inviterId: "owner" };

describe("role mapping", () => {
  it("writes the picked role into `role`, not just agent_role", () => {
    expect(storedRoleFor("client")).toBe("client");
    expect(storedRoleFor("creative")).toBe("creative");
    // "collaborator" is not a legal stored role (check constraint): it is "member".
    expect(storedRoleFor("collaborator")).toBe("member");
  });
});

describe("email helpers", () => {
  it("normalizes and extracts distinct emails from pasted text", () => {
    expect(normalizeEmail("  Ann@Studio.COM ")).toBe("ann@studio.com");
    expect(extractEmails("Ann@x.com, bob@y.io\nann@x.com;  nope@")).toEqual(["ann@x.com", "bob@y.io"]);
  });
});

describe("inviteByEmail", () => {
  it("saves one pending row with the right role and emails the invitee", async () => {
    const { client, rows, invoked } = fakeClient();
    const out = await inviteByEmail({ ...base, client, role: "client", email: "  New@Person.com " });
    expect(out).toEqual({ kind: "invited", emailSent: true });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      project_id: "p1",
      email: "new@person.com",
      role: "client",
      agent_role: "client",
      status: "pending",
      invited_by: "owner",
    });
    expect(invoked).toEqual([{ name: "send-project-invitation", body: { email: "new@person.com", projectId: "p1" } }]);
  });

  it("a Collaborator is stored as role=member (never the illegal 'collaborator')", async () => {
    const { client, rows } = fakeClient();
    await inviteByEmail({ ...base, client, role: "collaborator", email: "a@b.co" });
    expect(rows[0]).toMatchObject({ role: "member", agent_role: "collaborator" });
  });

  it("does not add a second row for an address that is already invited, but re-sends the email", async () => {
    const { client, rows, invoked } = fakeClient({
      rows: [{ id: "r1", project_id: "p1", email: "a@b.co", status: "pending" }],
    });
    const out = await inviteByEmail({ ...base, client, role: "creative", email: "A@B.co" });
    expect(out).toEqual({ kind: "already_pending", emailSent: true });
    expect(rows).toHaveLength(1);
    expect(invoked).toHaveLength(1);
  });

  it("does nothing for someone who is already in the room", async () => {
    const { client, rows, invoked } = fakeClient({
      rows: [{ id: "r1", project_id: "p1", email: "a@b.co", status: "accepted" }],
    });
    const out = await inviteByEmail({ ...base, client, role: "creative", email: "a@b.co" });
    expect(out).toEqual({ kind: "already_member" });
    expect(rows).toHaveLength(1);
    expect(invoked).toHaveLength(0);
  });

  it("re-inviting after a cancel/decline replaces the dead row", async () => {
    const { client, rows } = fakeClient({
      rows: [{ id: "r1", project_id: "p1", email: "a@b.co", status: "rejected" }],
    });
    const out = await inviteByEmail({ ...base, client, role: "creative", email: "a@b.co" });
    expect(out.kind).toBe("invited");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: "pending", id: "new-1" });
  });

  it("keeps the saved invitation and says so honestly when the email can't be sent", async () => {
    const { client, rows } = fakeClient({ emailSent: false });
    const out = await inviteByEmail({ ...base, client, role: "creative", email: "a@b.co" });
    expect(out).toEqual({ kind: "invited", emailSent: false });
    expect(rows).toHaveLength(1);
    const copy = describeOutcome(out, "a@b.co", "email");
    expect(copy.variant).toBe("destructive");
    expect(copy.title).toMatch(/email not sent/i);
  });

  it("treats a thrown edge-function error like an unsent email, not a lost invite", async () => {
    const { client, rows } = fakeClient({ fnError: true });
    const out = await inviteByEmail({ ...base, client, role: "creative", email: "a@b.co" });
    expect(out).toEqual({ kind: "invited", emailSent: false });
    expect(rows).toHaveLength(1);
  });

  it("returns the database error instead of throwing", async () => {
    const { client } = fakeClient({ insertError: "permission denied" });
    const out = await inviteByEmail({ ...base, client, role: "creative", email: "a@b.co" });
    expect(out).toEqual({ kind: "error", message: "permission denied" });
  });
});

describe("inviteMember (existing account)", () => {
  it("saves a pending row linked by user_id with the right role", async () => {
    const { client, rows, invoked } = fakeClient();
    const out = await inviteMember({ ...base, client, role: "client", userId: "u2" });
    expect(out).toEqual({ kind: "invited", emailSent: false });
    expect(rows[0]).toMatchObject({ user_id: "u2", email: null, role: "client", agent_role: "client", status: "pending" });
    // the database trigger notifies; no email function call for an existing account
    expect(invoked).toHaveLength(0);
  });

  it("does not double-invite or re-add a member", async () => {
    const pending = fakeClient({ rows: [{ id: "r1", project_id: "p1", user_id: "u2", status: "pending" }] });
    expect(await inviteMember({ ...base, client: pending.client, role: "creative", userId: "u2" })).toEqual({
      kind: "already_pending",
      emailSent: false,
    });
    expect(pending.rows).toHaveLength(1);

    const member = fakeClient({ rows: [{ id: "r2", project_id: "p1", user_id: "u3", status: "accepted" }] });
    expect(await inviteMember({ ...base, client: member.client, role: "creative", userId: "u3" })).toEqual({
      kind: "already_member",
    });
    expect(member.rows).toHaveLength(1);
  });

  it("never invites yourself", async () => {
    const { client, rows } = fakeClient();
    expect(await inviteMember({ ...base, client, role: "creative", userId: "owner" })).toEqual({ kind: "already_member" });
    expect(rows).toHaveLength(0);
  });
});

describe("describeOutcome", () => {
  it("is plain and consistent", () => {
    expect(describeOutcome({ kind: "invited", emailSent: true }, "a@b.co", "email").title).toBe("Invitation sent");
    expect(describeOutcome({ kind: "invited", emailSent: false }, "Ann", "account").title).toBe("Invitation sent");
    expect(describeOutcome({ kind: "already_member" }, "Ann", "account").title).toMatch(/already/i);
    expect(describeOutcome({ kind: "already_pending", emailSent: true }, "a@b.co", "email").title).toMatch(/again/i);
    expect(describeOutcome({ kind: "error", message: "x" }, "Ann", "account").variant).toBe("destructive");
  });
});

describe("describeResend", () => {
  it("says sent only when the email left", () => {
    expect(describeResend(true, "a@b.co")).toEqual({ title: "Invite resent", description: "Sent again to a@b.co." });
  });
  it("says it was not sent, as an error, when the function answered 200 without sending", () => {
    const copy = describeResend(false, "a@b.co");
    expect(copy.title).toBe("Email not sent");
    expect(copy.description).toContain("a@b.co");
    expect(copy.variant).toBe("destructive");
  });
});
