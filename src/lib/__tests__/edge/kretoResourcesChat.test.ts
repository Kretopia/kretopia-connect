// Runs the real kreto-resources chat path: the Kreto model, effort and estimate handshake reach the chat function (zod
// used to strip them), the allowance the composer shows travels with them, Deep and Maximum reserve their larger output
// ceiling, the route headers come back readable, and a question from the chat function costs nothing.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryDb } from "./memoryDb";

const world = vi.hoisted(() => ({
  handler: null as null | ((req: Request) => Promise<Response>),
  db: null as unknown,
  gate: null as unknown as ReturnType<typeof import("vitest").vi.fn>,
  commit: null as unknown as ReturnType<typeof import("vitest").vi.fn>,
  release: null as unknown as ReturnType<typeof import("vitest").vi.fn>,
  upstream: null as unknown as ReturnType<typeof import("vitest").vi.fn>,
}));

vi.mock("npm:@supabase/supabase-js@2", () => ({ createClient: () => ({ from: (t: string) => (world.db as MemoryDb).from(t) }) }));
vi.mock("../../../../supabase/functions/_shared/kretoIdentity.ts", () => ({
  resolveKretoIdentity: async () => ({ id: "user-1", legacy: true, url: "https://legacy.test", key: "anon", authorization: "Bearer user-token", client: { from: (t: string) => (world.db as MemoryDb).from(t) } }),
}));
vi.mock("../../../../supabase/functions/_shared/aiRateLimit.ts", () => ({
  gateAiCall: (...a: unknown[]) => world.gate(...a),
  commitAiCredit: (...a: unknown[]) => world.commit(...a),
  releaseAiCredit: (...a: unknown[]) => world.release(...a),
}));
vi.mock("../../../../supabase/functions/_shared/measuredModelFetch.ts", () => ({ measuredModelFetch: (...a: unknown[]) => world.upstream(...a) }));
vi.mock("../../../../supabase/functions/_shared/guard.ts", () => ({ corsFor: () => ({ "Access-Control-Allow-Origin": "https://www.kretopia.com" }) }));

const CONV = "11111111-1111-4111-8111-111111111111";
const env: Record<string, string> = { SUPABASE_URL: "https://cloud.test", SUPABASE_SERVICE_ROLE_KEY: "service-key" };
const DAY = new Date().toISOString().slice(0, 10).replace(/-/g, "");

beforeAll(async () => {
  vi.stubGlobal("Deno", { env: { get: (k: string) => env[k] }, serve: (h: (req: Request) => Promise<Response>) => { world.handler = h; } });
  await import("../../../../supabase/functions/kreto-resources/index.ts");
});
afterAll(() => vi.unstubAllGlobals());

beforeEach(() => {
  world.db = new MemoryDb()
    .seed("ai_conversations", [{ id: CONV, user_id: "user-1" }])
    .seed("ai_credit_config", [{ feature: "kreto_tokens", daily_allowance: 60000 }])
    .seed("ai_credit_ledger", [{ user_id: "user-1", feature: "kreto_tokens", window_key: DAY, used: 20000, reserved: 0, cap: 60000 }]);
  world.gate = vi.fn(async () => ({ allowed: true, used: 1, cap: 30 }));
  world.commit = vi.fn(async () => {});
  world.release = vi.fn(async () => {});
  world.upstream = vi.fn(async () => new Response("data: [DONE]\n\n", { status: 200, headers: { "Content-Type": "text/event-stream", "X-Kreto-Profile": "forge", "X-Kreto-Effort": "3", "X-Kreto-Share": "4" } }));
});

const chat = (extra: Record<string, unknown> = {}) =>
  world.handler!(new Request("https://cloud.test/functions/v1/kreto-resources", {
    method: "POST",
    headers: { Authorization: "Bearer user-token", "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "chat", conversation_id: CONV, surface: "home", messages: [{ role: "user", content: "Draft a one-pager" }], ...extra }),
  }));
const forwarded = () => JSON.parse(String((world.upstream.mock.calls.at(-1)?.[4] as RequestInit).body));
const tokenReserve = () => world.gate.mock.calls.find(([, , feature]) => feature === "kreto_tokens")?.[3] as number;

describe("kreto-resources chat: Kreto model and effort", () => {
  it("passes the choice, the handshake and what is left on the composer's allowance to the chat function", async () => {
    const res = await chat({ profile: "forge", effort: 3, confirm_supported: true, confirm_estimate: true });
    expect(res.status).toBe(200);
    expect(forwarded()).toMatchObject({ profile: "forge", effort: 3, confirm_supported: true, confirm_estimate: true, kreto_tokens_left: 40000 });
  });

  it("returns which Kreto model answered, readable by the browser, and commits once the reply is read", async () => {
    const res = await chat({ effort: 3 });
    expect(res.headers.get("X-Kreto-Profile")).toBe("forge");
    expect(res.headers.get("X-Kreto-Share")).toBe("4");
    expect(res.headers.get("Access-Control-Expose-Headers")).toMatch(/X-Copilot-Conversation-Id.*X-Kreto-Profile/);
    await res.text();
    expect(world.commit).toHaveBeenCalledWith(expect.anything(), "user-1", "kreto_tokens", tokenReserve(), 0);
    expect(world.release).not.toHaveBeenCalled();
  });

  it("Balanced reserves the same 800 output tokens as before; Deep and Maximum reserve their larger ceiling", async () => {
    const prompt = Math.ceil("Draft a one-pager".length / 4);
    await chat();
    expect(tokenReserve()).toBe(prompt + 800);
    world.gate.mockClear();
    await chat({ effort: 1 });
    expect(tokenReserve()).toBe(prompt + 800);
    world.gate.mockClear();
    await chat({ effort: 3 });
    expect(tokenReserve()).toBe(prompt + 1200);
    world.gate.mockClear();
    await chat({ effort: 4 });
    expect(tokenReserve()).toBe(prompt + 2000);
  });

  it("a question from the chat function (409) reaches the browser as is, and the reservation is released", async () => {
    world.upstream = vi.fn(async () => new Response(JSON.stringify({ code: "KRETO_CONFIRM", error: "This needs about 40% of what's left today. Run it?", estimate: { share_pct: 40 } }), { status: 409, headers: { "Content-Type": "application/json" } }));
    const res = await chat({ confirm_supported: true });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: "KRETO_CONFIRM", estimate: { share_pct: 40 } });
    expect(world.release).toHaveBeenCalledTimes(2);
    expect(world.commit).not.toHaveBeenCalled();
  });

  it("what Kreto may see and the memory switch reach the chat function, and the sources come back readable", async () => {
    world.upstream = vi.fn(async () => new Response("data: [DONE]\n\n", { status: 200, headers: { "Content-Type": "text/event-stream", "X-Kreto-Profile": "pulse", "X-Kreto-Context": "projects,memory:2" } }));
    const res = await chat({ context: ["projects", "money"], memory: false });
    expect(forwarded()).toMatchObject({ context: ["projects", "money"], memory: false });
    expect(res.headers.get("X-Kreto-Context")).toBe("projects,memory:2");
    expect(res.headers.get("Access-Control-Expose-Headers")).toMatch(/X-Kreto-Context/);
    await chat({ context: "auto" });
    expect(forwarded().context).toBe("auto");
  });

  it("an unknown section is refused before anything is reserved", async () => {
    const res = await chat({ context: ["wallet"] });
    expect(res.status).toBe(400);
    expect(world.gate).not.toHaveBeenCalled();
  });

  it("an effort outside 1 to 4 is refused before anything is reserved", async () => {
    const res = await chat({ effort: 5 });
    expect(res.status).toBe(400);
    expect(world.gate).not.toHaveBeenCalled();
    expect(world.upstream).not.toHaveBeenCalled();
  });

  it("no figure is sent when the allowance cannot be read (the chat function then uses its own)", async () => {
    world.db = new MemoryDb().seed("ai_conversations", [{ id: CONV, user_id: "user-1" }]);
    await chat();
    expect(forwarded().kreto_tokens_left).toBeUndefined();
  });
});
