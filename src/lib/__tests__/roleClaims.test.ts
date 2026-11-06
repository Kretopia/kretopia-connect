import { beforeEach, describe, expect, it, vi } from "vitest";

type Result = { data: unknown; error: { code?: string; message: string } | null };
const tables: Record<string, Result> = {};
const rpc = vi.fn();
const notifyUser = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const chain: Record<string, unknown> = {};
      const self = () => chain;
      for (const m of ["select", "order", "limit", "in", "eq"]) chain[m] = self;
      chain.then = (ok: (v: unknown) => unknown) => Promise.resolve(tables[table] ?? { data: [], error: null }).then(ok);
      return chain;
    },
    rpc: (...args: unknown[]) => rpc(...args),
  },
}));
vi.mock("@/lib/notifyUser", () => ({ notifyUser: (...a: unknown[]) => notifyUser(...a) }));

import {
  compareNames,
  decideRoleClaim,
  isMissingOnBackend,
  loadRoleClaims,
  notifyRoleClaimDecision,
  readDecisionAnswer,
  safeHttpUrl,
  type RoleClaimView,
} from "../roleClaims";

const claim = (over: Record<string, unknown> = {}) => ({
  id: "c1", role_id: "r1", requester_id: "u1", thumbnail_url: null, status: "pending", note: null,
  created_at: "2026-11-05T10:00:00Z", decided_at: null, decided_by: null, ...over,
});

beforeEach(() => {
  for (const k of Object.keys(tables)) delete tables[k];
  rpc.mockReset();
  notifyUser.mockReset();
});

describe("readDecisionAnswer: what the database said, for the decision that was asked for", () => {
  it("an approval that the database approved carries the new credit", () => {
    expect(readDecisionAnswer(true, null, { success: true, status: "approved", credit_id: "cr1" })).toEqual({ kind: "approved", creditId: "cr1" });
  });

  it("a decline is a decline", () => {
    expect(readDecisionAnswer(false, null, { success: true, status: "rejected" })).toEqual({ kind: "rejected" });
  });

  it("an approval that came back declined means the role was claimed in the meantime, and is never reported as an approval", () => {
    expect(readDecisionAnswer(true, null, { success: true, status: "rejected" })).toEqual({ kind: "declined-already-claimed" });
  });

  it("a decline that the database reports as approved is an error, not a quiet grant", () => {
    expect(readDecisionAnswer(false, null, { success: true, status: "approved" }).kind).toBe("error");
  });

  it("a request someone else already decided says who won, and changes nothing", () => {
    expect(readDecisionAnswer(true, null, { success: false, error: "Already approved" })).toEqual({ kind: "already-decided", status: "approved" });
    expect(readDecisionAnswer(true, null, { success: false, error: "Already rejected" })).toEqual({ kind: "already-decided", status: "rejected" });
  });

  it("a non-admin is told so, and an unapplied migration is told apart from a failure", () => {
    expect(readDecisionAnswer(true, { code: "P0001", message: "Only admins can decide a role claim" }, null)).toEqual({ kind: "forbidden" });
    expect(readDecisionAnswer(true, { code: "PGRST202", message: "Could not find the function public.decide_icdb_role_claim" }, null)).toEqual({ kind: "not-set-up" });
  });

  it("anything it does not understand is an error, never a success", () => {
    expect(readDecisionAnswer(true, { message: "boom" }, null)).toEqual({ kind: "error", message: "boom" });
    expect(readDecisionAnswer(true, null, null).kind).toBe("error");
    expect(readDecisionAnswer(true, null, { success: true }).kind).toBe("error");
  });
});

describe("decideRoleClaim", () => {
  it("sends the decision to the admin-only database function, with the note trimmed and capped", async () => {
    rpc.mockResolvedValue({ data: { success: true, status: "rejected" }, error: null });
    await expect(decideRoleClaim("c1", false, `  ${"x".repeat(400)}  `)).resolves.toEqual({ kind: "rejected" });
    expect(rpc).toHaveBeenCalledWith("decide_icdb_role_claim", { p_request_id: "c1", p_approve: false, p_note: "x".repeat(300) });
  });

  it("sends no note at all when none was typed", async () => {
    rpc.mockResolvedValue({ data: { success: true, status: "approved", credit_id: "cr1" }, error: null });
    await decideRoleClaim("c1", true, "   ");
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_note: null });
  });

  it("a network failure is an error and nothing is claimed", async () => {
    rpc.mockRejectedValue(new Error("offline"));
    await expect(decideRoleClaim("c1", true, "")).resolves.toEqual({ kind: "error", message: "offline" });
  });
});

describe("loadRoleClaims", () => {
  it("says the migration is missing instead of showing an empty queue", async () => {
    tables.icdb_role_claim_requests = { data: null, error: { code: "PGRST205", message: "Could not find the table 'public.icdb_role_claim_requests' in the schema cache" } };
    await expect(loadRoleClaims()).resolves.toEqual({ kind: "not-set-up" });
  });

  it("an empty queue is an empty queue", async () => {
    tables.icdb_role_claim_requests = { data: [], error: null };
    await expect(loadRoleClaims()).resolves.toEqual({ kind: "ok", claims: [], truncated: false });
  });

  it("puts the role, project and member beside each request and flags members competing for the same role", async () => {
    tables.icdb_role_claim_requests = {
      data: [claim({ id: "c1", requester_id: "u1" }), claim({ id: "c2", requester_id: "u2" }), claim({ id: "c3", requester_id: "u3", role_id: "r2", status: "approved" })],
      error: null,
    };
    tables.icdb_project_roles = {
      data: [
        { id: "r1", project_id: "p1", role_title: "Director", person_name: "Dee Marshall", is_claimed: false, claimed_by: null },
        { id: "r2", project_id: "p1", role_title: "Editor", person_name: "Sam Lee", is_claimed: true, claimed_by: "u3" },
      ],
      error: null,
    };
    tables.public_profiles_safe = {
      data: [
        { user_id: "u1", full_name: "Dee Marshall", username: "dee", avatar_url: null, verification_status: "verified" },
        { user_id: "u2", full_name: "Dee M.", username: null, avatar_url: null, verification_status: null },
        { user_id: "u3", full_name: "Sam Lee", username: "sam", avatar_url: null, verification_status: null },
      ],
      error: null,
    };
    tables.icdb_projects = { data: [{ id: "p1", title: "Night Shift", year: 2024, type: "film", platform: null, external_url: null }], error: null };

    const result = await loadRoleClaims();
    if (result.kind !== "ok") throw new Error("expected ok");
    const [first, second, decided] = result.claims;
    expect(first.role?.role_title).toBe("Director");
    expect(first.project?.title).toBe("Night Shift");
    expect(first.requester?.username).toBe("dee");
    expect(first.competing).toEqual([{ requestId: "c2", name: "Dee M." }]);
    expect(second.competing).toEqual([{ requestId: "c1", name: "Dee Marshall" }]);
    // Decided requests do not compete with anyone.
    expect(decided.competing).toEqual([]);
  });

  it("a failed lookup is an error: a claim is never reviewed with its role missing", async () => {
    tables.icdb_role_claim_requests = { data: [claim()], error: null };
    tables.icdb_project_roles = { data: null, error: { message: "permission denied" } };
    await expect(loadRoleClaims()).resolves.toEqual({ kind: "error", message: "permission denied" });
  });
});

describe("compareNames: a hint for the reviewer, never a decision", () => {
  it("same, whatever the order, case or accents", () => {
    expect(compareNames("Noé Plantier", "plantier noe")).toBe("same");
  });
  it("one name inside the other is neither the same nor different", () => {
    expect(compareNames("Plantier", "Noé Plantier")).toBe("similar");
    expect(compareNames("Noé A. Plantier", "Noé Plantier")).toBe("similar");
  });
  it("different names say different, and a missing name says unknown", () => {
    expect(compareNames("Dee Marshall", "Sam Lee")).toBe("different");
    expect(compareNames(null, "Sam Lee")).toBe("unknown");
    expect(compareNames("Dee", "  ")).toBe("unknown");
  });
});

describe("notifyRoleClaimDecision", () => {
  const view = {
    request: claim(),
    role: { id: "r1", project_id: "p1", role_title: "Director", person_name: "Dee", is_claimed: false, claimed_by: null },
    project: { id: "p1", title: "Night Shift", year: 2024, type: "film", platform: null, external_url: null },
    requester: null,
    competing: [],
  } as unknown as RoleClaimView;

  it("an approval says the credit is the member's own claim, not a verified one", async () => {
    await notifyRoleClaimDecision(view, { kind: "approved", creditId: "cr1" }, "internal");
    const call = notifyUser.mock.calls[0][0];
    expect(call.userId).toBe("u1");
    expect(call.message).toMatch(/Director on Night Shift is now on your Passport/);
    expect(call.message).toMatch(/your own claim/);
    expect(call.message).not.toMatch(/verified/i);
    expect(call.message).not.toContain("internal");
  });

  it("a decline carries the note the admin wrote for the member, and links to the project", async () => {
    await notifyRoleClaimDecision(view, { kind: "rejected" }, "We could not match you to this credit.");
    const call = notifyUser.mock.calls[0][0];
    expect(call.title).toMatch(/wasn't approved/);
    expect(call.message).toContain("We could not match you to this credit.");
    expect(call.actionUrl).toBe("/credits/project/p1");
  });

  it("a claim lost to someone else's says so, without the admin's note", async () => {
    await notifyRoleClaimDecision(view, { kind: "declined-already-claimed" }, "secret");
    expect(notifyUser.mock.calls[0][0].message).toMatch(/approved first/);
    expect(notifyUser.mock.calls[0][0].message).not.toContain("secret");
  });

  it("tells nobody about a decision that someone else made or that failed", async () => {
    await notifyRoleClaimDecision(view, { kind: "already-decided", status: "approved" }, "");
    await notifyRoleClaimDecision(view, { kind: "error", message: "x" }, "");
    await notifyRoleClaimDecision(view, { kind: "forbidden" }, "");
    expect(notifyUser).not.toHaveBeenCalled();
  });
});

describe("helpers", () => {
  it("recognises a table or function that is missing on the backend", () => {
    expect(isMissingOnBackend({ code: "42P01", message: "relation does not exist" })).toBe(true);
    expect(isMissingOnBackend({ message: "Could not find the function public.x in the schema cache" })).toBe(true);
    expect(isMissingOnBackend({ code: "42501", message: "permission denied for table" })).toBe(false);
    expect(isMissingOnBackend(null)).toBe(false);
  });

  it("links and loads only http(s) addresses", () => {
    expect(safeHttpUrl("https://example.com/a")).toBe("https://example.com/a");
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("data:text/html,<script>")).toBeNull();
    expect(safeHttpUrl("not a url")).toBeNull();
    expect(safeHttpUrl(null)).toBeNull();
  });
});
