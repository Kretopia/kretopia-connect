import { describe, expect, it } from "vitest";
import {
  ProjectAccessError,
  projectHasExplicitShare,
  requireProjectAccess,
  userMayActOnCall,
} from "../../../supabase/functions/_shared/projectAccess";

const P = "11111111-1111-4111-8111-111111111111";
const OWNER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const U = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

type Rows = { projects?: any; collabs?: any[]; guestLinks?: any[]; err?: string };

// Minimal fake of the supabase query builder: filters return the builder,
// terminal calls resolve from the fixture. Records the last value of each eq().
function fake(rows: Rows) {
  const seen: Record<string, any> = {};
  return {
    from(table: string) {
      const q: any = {
        select() { return q; },
        eq(col: string, val: any) { seen[`${table}.${col}`] = val; return q; },
        is() { return q; },
        or() { return q; },
        limit() { return q; },
        ilike() { return q; },
        maybeSingle() {
          if (rows.err) return Promise.resolve({ data: null, error: { message: rows.err } });
          return Promise.resolve({ data: table === "projects" ? rows.projects ?? null : null, error: null });
        },
        then(res: any) {
          if (rows.err) return res({ data: null, error: { message: rows.err } });
          if (table === "project_guest_links") return res({ data: rows.guestLinks ?? [], error: null });
          if (table === "project_collaborators") {
            const wanted = seen["project_collaborators.status"];
            return res({ data: (rows.collabs ?? []).filter((c) => c.status === wanted), error: null });
          }
          return res({ data: [], error: null });
        },
      };
      return q;
    },
  };
}

describe("requireProjectAccess (fail-closed)", () => {
  it("grants the owner", async () => {
    const a = await requireProjectAccess(fake({ projects: { id: P, created_by: OWNER } }), P, OWNER);
    expect(a.role).toBe("owner");
    expect(a.isOwner).toBe(true);
    expect(a.canSeeMoney).toBe(true);
  });

  it("grants an accepted creative and keeps money visible", async () => {
    const a = await requireProjectAccess(
      fake({ projects: { id: P, created_by: OWNER }, collabs: [{ status: "accepted", role: "creative" }] }), P, U);
    expect(a.role).toBe("creative");
    expect(a.canSeeMoney).toBe(true);
  });

  it("maps the 'member' role to collaborator", async () => {
    const a = await requireProjectAccess(
      fake({ projects: { id: P, created_by: OWNER }, collabs: [{ status: "accepted", role: "member" }] }), P, U);
    expect(a.role).toBe("collaborator");
  });

  it("denies a pending invitee", async () => {
    await expect(requireProjectAccess(
      fake({ projects: { id: P, created_by: OWNER }, collabs: [{ status: "pending", role: "member" }] }), P, U,
    )).rejects.toMatchObject({ status: 403 });
  });

  it("hides money from client and guest", async () => {
    for (const role of ["client", "guest"]) {
      const a = await requireProjectAccess(
        fake({ projects: { id: P, created_by: OWNER }, collabs: [{ status: "accepted", role }] }), P, U);
      expect(a.role).toBe(role);
      expect(a.canSeeMoney).toBe(false);
    }
  });

  it("treats NULL or unknown roles as guest", async () => {
    for (const role of [null, "collaborator", "superadmin"]) {
      const a = await requireProjectAccess(
        fake({ projects: { id: P, created_by: OWNER }, collabs: [{ status: "accepted", role }] }), P, U);
      expect(a.role).toBe("guest");
    }
  });

  it("picks the most restrictive role when several rows exist", async () => {
    const a = await requireProjectAccess(
      fake({ projects: { id: P, created_by: OWNER }, collabs: [
        { status: "accepted", role: "member" }, { status: "accepted", role: "guest" }] }), P, U);
    expect(a.role).toBe("guest");
  });

  it("denies outsiders and unknown projects", async () => {
    await expect(requireProjectAccess(fake({ projects: { id: P, created_by: OWNER } }), P, U))
      .rejects.toBeInstanceOf(ProjectAccessError);
    await expect(requireProjectAccess(fake({}), P, U)).rejects.toMatchObject({ status: 403 });
  });

  it("denies malformed project ids and missing users", async () => {
    await expect(requireProjectAccess(fake({ projects: { id: P, created_by: OWNER } }), "not-a-uuid", OWNER))
      .rejects.toMatchObject({ status: 403 });
    await expect(requireProjectAccess(fake({ projects: { id: P, created_by: OWNER } }), P, null))
      .rejects.toMatchObject({ status: 401 });
  });

  it("denies (503) when the lookup errors", async () => {
    await expect(requireProjectAccess(fake({ err: "boom" }), P, OWNER)).rejects.toMatchObject({ status: 503 });
  });

  it("honours allowRoles", async () => {
    await expect(requireProjectAccess(
      fake({ projects: { id: P, created_by: OWNER }, collabs: [{ status: "accepted", role: "guest" }] }), P, U,
      { allowRoles: ["owner", "creative", "collaborator"] },
    )).rejects.toMatchObject({ status: 403 });
  });
});

describe("userMayActOnCall", () => {
  const db = () => fake({ projects: { id: P, created_by: OWNER }, collabs: [{ status: "accepted", role: "guest" }] });

  it("allows the host", async () => {
    expect(await userMayActOnCall(db(), U, { host_id: U })).toBe(true);
  });

  it("denies a guest member of the call's project", async () => {
    expect(await userMayActOnCall(db(), U, { host_id: OWNER, project_id: P })).toBe(false);
  });

  it("denies participants unless allowParticipant is set", async () => {
    expect(await userMayActOnCall(db(), U, { host_id: OWNER, participants: [U] })).toBe(false);
    expect(await userMayActOnCall(db(), U, { host_id: OWNER, participants: [U] }, { allowParticipant: true })).toBe(true);
  });

  it("denies a call with no host, project or participant proof", async () => {
    expect(await userMayActOnCall(db(), U, { host_id: OWNER })).toBe(false);
  });
});

describe("projectHasExplicitShare", () => {
  it("is false for a malformed id and on lookup errors", async () => {
    expect(await projectHasExplicitShare(fake({}), "nope")).toBe(false);
    expect(await projectHasExplicitShare(fake({ err: "boom" }), P)).toBe(false);
  });

  it("is true for a live guest link or a pending invite, false otherwise", async () => {
    expect(await projectHasExplicitShare(fake({ guestLinks: [{ id: "l" }] }), P)).toBe(true);
    expect(await projectHasExplicitShare(fake({ collabs: [{ status: "pending" }] }), P)).toBe(true);
    expect(await projectHasExplicitShare(fake({ collabs: [{ status: "accepted" }] }), P)).toBe(false);
  });
});
