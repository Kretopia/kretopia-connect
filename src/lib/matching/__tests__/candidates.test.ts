import { describe, expect, it } from "vitest";
import { audienceOf, buildCandidateFacts, loadCandidatePool, skillList, type PoolClient } from "../candidates";

describe("skillList", () => {
  it("reads strings and { skill } / { name } objects, and nothing else", () => {
    expect(skillList(["Editing", { skill: "Color" }, { name: "Sound" }, { other: 1 }, "", null, 4])).toEqual(["Editing", "Color", "Sound"]);
    expect(skillList(null)).toEqual([]);
    expect(skillList("Editing")).toEqual([]);
  });
});

describe("audienceOf", () => {
  it("reads the follower figure a sync stored, as a number or a string", () => {
    expect(audienceOf({ subscriberCount: "12400" })).toBe(12400);
    expect(audienceOf({ followers: 5000 })).toBe(5000);
    expect(audienceOf({ subscriberCount: "1,200" })).toBe(1200);
  });
  it("is null when there is no figure, or it is not a whole non-negative number", () => {
    expect(audienceOf(null)).toBeNull();
    expect(audienceOf({})).toBeNull();
    expect(audienceOf({ subscriberCount: "" })).toBeNull();
    expect(audienceOf({ subscriberCount: "12.3K" })).toBeNull();
    expect(audienceOf({ subscriberCount: "-4" })).toBeNull();
    expect(audienceOf({ subscriberCount: "1.5" })).toBeNull();
  });
});

describe("buildCandidateFacts", () => {
  const profile = { user_id: "u1", full_name: " Ana Lopez ", role: " Videographer ", bio: "", location: "Paris", professional_skills: ["Editing"], tiktok_url: "https://tiktok.com/@ana", instagram_url: "  ", youtube_url: null };

  it("keeps links as stated facts, and only real (non-blank) ones", () => {
    const facts = buildCandidateFacts(profile, [], []);
    expect(facts.links).toEqual({ tiktok: true });
    expect(facts).toMatchObject({ fullName: "Ana Lopez", role: "Videographer", bio: null, location: "Paris", skills: ["Editing"] });
  });

  it("records a synced account with its figure, ignoring platforms outside the list", () => {
    const facts = buildCandidateFacts(profile, [], [
      { user_id: "u1", platform: "youtube", platform_data: { subscriberCount: "900" } },
      { user_id: "u1", platform: "imdb", platform_data: {} },
      { user_id: "u1", platform: "SPOTIFY", platform_data: null },
    ]);
    expect(facts.synced).toEqual({ youtube: { audience: 900 }, spotify: { audience: null } });
  });

  it("classifies each credit's proof with the shared classifier, and leaves portfolio pieces out", () => {
    const facts = buildCandidateFacts(profile, [
      { user_id: "u1", project_name: "A", verification_status: "verified" },
      { user_id: "u1", project_name: "B", endorsement_count: 2 },
      { user_id: "u1", project_name: "C", ai_confidence: 0.99 },
      { user_id: "u1", project_name: "Reel", source: "portfolio" },
    ], []);
    expect(facts.credits.map((c) => [c.projectName, c.evidence])).toEqual([["A", "verified"], ["B", "co_signed"], ["C", "self_claimed"]]);
  });

  it("falls back to a neutral name when the profile has none", () => {
    expect(buildCandidateFacts({ user_id: "u2" }, [], []).fullName).toBe("Creative");
  });
});

type Call = { table: string; ops: Array<[string, unknown[]]> };
function fakeClient(tables: Record<string, unknown[] | { message: string }>) {
  const calls: Call[] = [];
  const client: PoolClient = {
    from: (table) => {
      const call: Call = { table, ops: [] };
      calls.push(call);
      const q: ReturnType<PoolClient["from"]>["select"] extends (...a: never[]) => infer R ? R : never = new Proxy({} as never, {
        get: (_t, op: string | symbol) => {
          if (typeof op === "symbol") return undefined;
          if (op === "then") {
            const rows = tables[table];
            const result = Array.isArray(rows) ? { data: rows, error: null } : { data: null, error: rows };
            return (resolve: (v: unknown) => unknown) => resolve(result);
          }
          return (...args: unknown[]) => { call.ops.push([op, args]); return q; };
        },
      });
      return { select: (...args: unknown[]) => { call.ops.push(["select", args]); return q; } };
    },
  };
  return { client, calls };
}

describe("loadCandidatePool", () => {
  const profiles = [
    { user_id: "u1", full_name: "Ana", role: "Videographer", account_type: "individual" },
    { user_id: "u2", full_name: "Acme", role: "Brand", account_type: "company" },
    { user_id: "me", full_name: "Searcher", role: "Producer", account_type: "individual" },
  ];

  it("reads only completed Passports from the public view, and drops company accounts and the searcher", async () => {
    const { client, calls } = fakeClient({ public_profiles_safe: profiles, credits: [{ user_id: "u1", project_name: "Nord", verification_status: "verified" }], connected_platforms_public: [{ user_id: "u1", platform: "youtube", platform_data: { subscriberCount: "50" } }] });
    const out = await loadCandidatePool(client, { excludeUserId: "me" });
    expect(out.pool.map((c) => c.userId)).toEqual(["u1"]);
    expect(out.pool[0].credits).toHaveLength(1);
    expect(out.pool[0].synced).toEqual({ youtube: { audience: 50 } });
    expect(out.examined).toBe(3);
    expect(out.truncated).toBe(false);
    expect(calls[0].table).toBe("public_profiles_safe");
    expect(calls[0].ops.some(([o, a]) => o === "eq" && a[0] === "onboarding_completed" && a[1] === true)).toBe(true);
  });

  it("asks for credits and synced accounts in small batches of ids", async () => {
    const many = Array.from({ length: 95 }, (_, i) => ({ user_id: `u${String(i).padStart(3, "0")}`, account_type: "individual" }));
    const { client, calls } = fakeClient({ public_profiles_safe: many, credits: [], connected_platforms_public: [] });
    await loadCandidatePool(client);
    const creditCalls = calls.filter((c) => c.table === "credits");
    expect(creditCalls).toHaveLength(3);
    for (const call of creditCalls) expect((call.ops.find(([o]) => o === "in")![1][1] as string[]).length).toBeLessThanOrEqual(40);
  });

  it("flags a pool that hit the profile limit rather than silently searching part of it", async () => {
    const rows = Array.from({ length: 6 }, (_, i) => ({ user_id: `u${i}`, account_type: "individual" }));
    const { client } = fakeClient({ public_profiles_safe: rows, credits: [], connected_platforms_public: [] });
    const out = await loadCandidatePool(client, { limit: 5 });
    expect(out.pool).toHaveLength(5);
    expect(out.examined).toBe(5);
    expect(out.truncated).toBe(true);
  });

  it("fails loudly, naming the part, rather than returning an empty pool", async () => {
    const { client } = fakeClient({ public_profiles_safe: { message: "permission denied" } });
    await expect(loadCandidatePool(client)).rejects.toThrow("profiles: permission denied");
  });
});
