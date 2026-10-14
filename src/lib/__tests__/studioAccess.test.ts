import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  STUDIO_OPERATOR_ROLES,
  guardStudioOperator,
  studioOperatorAccess,
} from "../../../supabase/functions/_shared/studioAccess";

// A tiny in-memory stand-in for the service-role client: enough of the
// query-builder chain used by requireProjectAccess (select / eq / maybeSingle,
// and an awaited filtered select).
interface Row { [k: string]: unknown }
function fakeAdmin(db: { projects: Row[]; project_collaborators: Row[] }, fail: { projects?: boolean; project_collaborators?: boolean } = {}) {
  return {
    from(table: "projects" | "project_collaborators") {
      const filters: Array<[string, unknown]> = [];
      const rows = () => db[table].filter((r) => filters.every(([k, v]) => r[k] === v));
      const failed = !!fail[table];
      interface Chain {
        select: () => Chain;
        eq: (k: string, v: unknown) => Chain;
        maybeSingle: () => Promise<{ data: Row | null; error: { message: string } | null }>;
        then: (resolveFn: (v: unknown) => unknown) => unknown;
      }
      const chain: Chain = {
        select: () => chain,
        eq: (k, v) => {
          filters.push([k, v]);
          return chain;
        },
        maybeSingle: async () =>
          failed ? { data: null, error: { message: "boom" } } : { data: rows()[0] ?? null, error: null },
        then: (resolveFn) =>
          resolveFn(failed ? { data: null, error: { message: "boom" } } : { data: rows(), error: null }),
      };
      return chain;
    },
  };
}

const P = "11111111-1111-4111-8111-111111111111";
const OWNER = "owner-1";
const db = {
  projects: [{ id: P, created_by: OWNER }],
  project_collaborators: [
    { project_id: P, user_id: "collab", role: "member", status: "accepted" },
    { project_id: P, user_id: "creative", role: "creative", status: "accepted" },
    { project_id: P, user_id: "client", role: "client", status: "accepted" },
    { project_id: P, user_id: "guest", role: "guest", status: "accepted" },
    { project_id: P, user_id: "pending", role: "member", status: "pending" },
    { project_id: P, user_id: "pending-creative", role: "creative", status: "pending" },
    { project_id: P, user_id: "mixed", role: "creative", status: "accepted" },
    { project_id: P, user_id: "mixed", role: "client", status: "accepted" },
  ],
};
const admin = fakeAdmin(db);

describe("studioOperatorAccess: who may run a Studio generator", () => {
  it("allows the owner", async () => {
    expect(await studioOperatorAccess(admin, P, OWNER)).toEqual({ ok: true, role: "owner" });
  });

  it("allows an accepted collaborator and an accepted creative", async () => {
    expect(await studioOperatorAccess(admin, P, "collab")).toMatchObject({ ok: true, role: "collaborator" });
    expect(await studioOperatorAccess(admin, P, "creative")).toMatchObject({ ok: true, role: "creative" });
  });

  it("refuses an accepted client and an accepted guest", async () => {
    expect(await studioOperatorAccess(admin, P, "client")).toMatchObject({ ok: false, status: 403 });
    expect(await studioOperatorAccess(admin, P, "guest")).toMatchObject({ ok: false, status: 403 });
  });

  it("refuses a pending invitee, whatever the invited role", async () => {
    expect(await studioOperatorAccess(admin, P, "pending")).toMatchObject({ ok: false, status: 403 });
    expect(await studioOperatorAccess(admin, P, "pending-creative")).toMatchObject({ ok: false, status: 403 });
  });

  it("refuses an unrelated user and an unknown project", async () => {
    expect(await studioOperatorAccess(admin, P, "stranger")).toMatchObject({ ok: false, status: 403 });
    expect(await studioOperatorAccess(admin, "22222222-2222-4222-8222-222222222222", OWNER)).toMatchObject({ ok: false, status: 403 });
  });

  it("refuses a malformed project id and a missing user", async () => {
    expect(await studioOperatorAccess(admin, "not-a-uuid", OWNER)).toMatchObject({ ok: false, status: 403 });
    expect(await studioOperatorAccess(admin, P, null)).toMatchObject({ ok: false, status: 401 });
  });

  it("treats the lowest accepted tier as the role: creative and client at once is a client", async () => {
    expect(await studioOperatorAccess(admin, P, "mixed")).toMatchObject({ ok: false, status: 403 });
  });

  it("answers 503 and grants nothing when a lookup failed, even for the owner", async () => {
    expect(await studioOperatorAccess(fakeAdmin(db, { projects: true }), P, OWNER)).toMatchObject({ ok: false, status: 503 });
    expect(await studioOperatorAccess(fakeAdmin(db, { project_collaborators: true }), P, "collab")).toMatchObject({ ok: false, status: 503 });
  });

  it("names exactly the operator roles", () => {
    expect([...STUDIO_OPERATOR_ROLES].sort()).toEqual(["collaborator", "creative", "owner"]);
  });
});

describe("guardStudioOperator: ready-to-send denial", () => {
  it("returns the caller's CORS headers and the status on a denial", async () => {
    const guard = await guardStudioOperator(admin, P, "guest", { "Access-Control-Allow-Origin": "*" });
    expect(guard.ok).toBe(false);
    if (guard.ok === false) {
      expect(guard.response.status).toBe(403);
      expect(guard.response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(await guard.response.json()).toHaveProperty("error");
    }
  });

  it("passes the role through on success", async () => {
    expect(await guardStudioOperator(admin, P, "creative", {})).toMatchObject({ ok: true, role: "creative" });
  });
});

describe("generators: wiring", () => {
  const read = (p: string) => readFileSync(resolve(__dirname, "../../../supabase/functions", p), "utf8");

  it("generate-moodboard-image proves access before the paid model call", () => {
    const source = read("generate-moodboard-image/index.ts");
    const guard = source.indexOf("guardStudioOperator(admin, projectId, user.id");
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(source.indexOf("ai.gateway.lovable.dev"));
    expect(source).not.toContain('.from("project_collaborators")');
  });

  it("generate-studio-copy proves access before the quota is spent or the model is called", () => {
    const source = read("generate-studio-copy/index.ts");
    const guard = source.indexOf("guardStudioOperator(admin, projectId, user.id");
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(source.indexOf("checkAndConsumeStudioAIGeneration(admin"));
    expect(guard).toBeLessThan(source.indexOf("ai.gateway.lovable.dev"));
    expect(source).not.toContain('.from("project_collaborators")');
  });

  it("studio-ingest proves access before the model call and before any fact is written", () => {
    const source = read("studio-ingest/index.ts");
    const guard = source.indexOf("guardStudioOperator(admin, project_id, user.id");
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(source.indexOf("ai.gateway.lovable.dev"));
    expect(guard).toBeLessThan(source.indexOf('.from("studio_facts").insert('));
    expect(source).not.toContain('.from("project_collaborators")');
  });

  it("match-event-guests no longer treats any collaborator row as a host", () => {
    const source = read("match-event-guests/index.ts");
    expect(source).toContain("studioOperatorAccess(admin, project.id, user.id)");
    expect(source).not.toContain('.from("project_collaborators")');
    expect(source.indexOf("studioOperatorAccess(admin")).toBeLessThan(source.indexOf("ai.gateway.lovable.dev"));
  });
});
