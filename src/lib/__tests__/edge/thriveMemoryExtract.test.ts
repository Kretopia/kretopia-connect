// Runs the real thrive-memory-extract handler: a project's facts are written only for a member of that project (the id
// comes from the caller's page), money figures and contact details are kept only when the person says remember, and a
// message carrying a secret teaches Kreto nothing.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryDb } from "./memoryDb";

const world = vi.hoisted(() => ({
  handler: null as null | ((req: Request) => Promise<Response>),
  db: null as unknown,
  rpc: null as unknown as ReturnType<typeof import("vitest").vi.fn>,
  memories: [] as unknown[],
}));

vi.mock("https://esm.sh/@supabase/supabase-js@2.45.4", () => ({
  createClient: () => ({ from: (t: string) => (world.db as MemoryDb).from(t), rpc: (...a: unknown[]) => world.rpc(...a) }),
}));
vi.mock("../../../../supabase/functions/_shared/guard.ts", () => ({ corsFor: () => ({}), requireServiceRole: async () => {} }));

const env: Record<string, string> = { SUPABASE_URL: "https://legacy.test", SUPABASE_SERVICE_ROLE_KEY: "service-key", LOVABLE_API_KEY: "gateway-key" };

beforeAll(async () => {
  vi.stubGlobal("Deno", { env: { get: (k: string) => env[k] }, serve: (h: (req: Request) => Promise<Response>) => { world.handler = h; } });
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ memories: world.memories }) } }] }), { status: 200 })));
  vi.spyOn(console, "warn").mockImplementation(() => {});
  await import("../../../../supabase/functions/thrive-memory-extract/index.ts");
});
afterAll(() => vi.unstubAllGlobals());

beforeEach(() => {
  world.db = new MemoryDb();
  world.rpc = vi.fn(async () => ({ data: false, error: null }));
  world.memories = [];
  (fetch as unknown as ReturnType<typeof vi.fn>).mockClear();
});

const extract = async (message: string, project_id: string | null = null) => {
  const res = await world.handler!(new Request("https://edge.test", { method: "POST", headers: { Authorization: "Bearer service-key", "Content-Type": "application/json" }, body: JSON.stringify({ user_id: "user-1", message, project_id }) }));
  return res.json();
};
const db = () => world.db as MemoryDb;

describe("thrive-memory-extract", () => {
  it("writes a project's facts only for a member of that project", async () => {
    world.memories = [{ scope: "project", kind: "deadline", mem_key: "edit-lock", label: "Edit locks Friday", importance: 4 }];
    await extract("The edit locks on Friday for this one", "someone-elses-project");
    expect(world.rpc).toHaveBeenCalledWith("user_has_project_access", { project_id_param: "someone-elses-project", user_id_param: "user-1" });
    expect(db().writes("studio_facts", "insert")).toHaveLength(0);

    world.rpc = vi.fn(async () => ({ data: true, error: null }));
    await extract("The edit locks on Friday for this one", "my-project");
    expect(db().writes("studio_facts", "insert")).toHaveLength(1);
  });

  it("keeps a rate only when the person says remember", async () => {
    world.memories = [{ scope: "user", kind: "rate", mem_key: "day-rate", label: "Day rate: $1,500", importance: 5 }];
    expect(await extract("My day rate is $1,500 these days")).toMatchObject({ inserted: 0, declined: 1 });
    expect(await extract("Remember that my day rate is $1,500")).toMatchObject({ inserted: 1, declined: 0 });
  });

  it("keeps a durable, harmless fact without being asked", async () => {
    world.memories = [{ scope: "user", kind: "vendor", mem_key: "preferred-dop", label: "Preferred DoP: Marcus", importance: 3 }];
    expect(await extract("Marcus is my go-to DoP for night shoots")).toMatchObject({ inserted: 1 });
  });

  it("learns nothing from a message that carries a secret, and does not even ask the model", async () => {
    world.memories = [{ scope: "user", kind: "fact", mem_key: "studio", label: "Studio on Rue Oberkampf", importance: 2 }];
    expect(await extract("Studio is on Rue Oberkampf, wifi password is lens2026")).toMatchObject({ skipped: "secret" });
    expect(fetch).not.toHaveBeenCalled();
    expect(db().writes("thrive_memory")).toHaveLength(0);
  });
});
