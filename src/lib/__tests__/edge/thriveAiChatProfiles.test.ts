// Runs the real thrive-ai-chat handler: the Kreto model and effort decide the tier and caps (Auto never upgrades on
// length alone), an unavailable choice is refused with a named alternative, and the estimate guard asks before a big
// share of what is left, stops when the request does not fit, and in both cases counts, saves and reserves nothing.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryDb } from "./memoryDb";
import { GEMINI_3_1_PRO, GEMINI_3_8_FLASH, GEMINI_3_FLASH, GEMINI_FLASH_LITE } from "../../../../supabase/functions/_shared/aiModels";

const world = vi.hoisted(() => ({
  handler: null as null | ((req: Request) => Promise<Response>),
  db: null as unknown,
  rpc: null as unknown as ReturnType<typeof import("vitest").vi.fn>,
  gate: null as unknown as ReturnType<typeof import("vitest").vi.fn>,
  model: null as unknown as ReturnType<typeof import("vitest").vi.fn>,
  upstream: null as null | (() => Response),
}));

vi.mock("https://deno.land/std@0.168.0/http/server.ts", () => ({ serve: (h: (req: Request) => Promise<Response>) => { world.handler = h; } }));
vi.mock("npm:@supabase/supabase-js@2", () => ({
  createClient: () => ({ from: (t: string) => (world.db as MemoryDb).from(t), rpc: (...a: unknown[]) => world.rpc(...a) }),
}));
vi.mock("../../../../supabase/functions/_shared/kretoIdentity.ts", () => ({ resolveKretoIdentity: async () => ({ id: "user-1" }) }));
vi.mock("../../../../supabase/functions/_shared/embed.ts", () => ({ embedText: async () => { throw new Error("no embeddings in tests"); }, toPgVector: () => "" }));
vi.mock("../../../../supabase/functions/_shared/copilotContext.ts", () => ({
  loadCopilotContext: async () => ({}),
  renderContextPreamble: () => "USER FACTS: first name Maya.",
  getOrCreateCopilotThread: async () => "conv-1",
}));
vi.mock("../../../../supabase/functions/_shared/aiRateLimit.ts", () => ({
  gateAiCall: (...a: unknown[]) => world.gate(...a),
  commitAiCredit: async () => {},
  releaseAiCredit: async () => {},
}));
vi.mock("../../../../supabase/functions/_shared/measuredModelFetch.ts", () => ({
  loadModelPricing: async () => ({ cost_currency: "credits", input: { text: { tiers: [{ min: 0, max: null, cost: 0.000001 }] } }, output: { text: { tiers: [{ min: 0, max: null, cost: 0.000004 }] } } }),
  measuredModelFetch: (...a: unknown[]) => world.model(...a),
}));

const env: Record<string, string> = { LOVABLE_API_KEY: "gateway-key", SUPABASE_URL: "https://backend.test", SUPABASE_SERVICE_ROLE_KEY: "service-key", SUPABASE_ANON_KEY: "anon-key" };
const DAY = new Date().toISOString().slice(0, 10).replace(/-/g, "");

beforeAll(async () => {
  vi.stubGlobal("Deno", { env: { get: (k: string) => env[k] } });
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  await import("../../../../supabase/functions/thrive-ai-chat/index.ts");
});
afterAll(() => vi.unstubAllGlobals());

const seed = (allowance = 60000, used = 0, plan: Record<string, unknown> = { subscription_tier: "free" }) =>
  new MemoryDb()
    .seed("ai_conversations", [{ id: "conv-1", user_id: "user-1" }])
    .seed("profiles", [{ user_id: "user-1", ...plan }])
    .seed("ai_credit_config", [{ feature: "kreto_tokens", daily_allowance: allowance }])
    .seed("ai_credit_ledger", used ? [{ user_id: "user-1", feature: "kreto_tokens", window_key: DAY, used, reserved: 0, cap: allowance }] : []);

const send = (body: Record<string, unknown>) =>
  world.handler!(new Request("https://edge.test", {
    method: "POST",
    headers: { Authorization: "Bearer user-token", Origin: "https://www.kretopia.com", "Content-Type": "application/json" },
    body: JSON.stringify({ conversation_id: "conv-1", persist: true, stream: false, ...body }),
  }));
const ask = (text: string, extra: Record<string, unknown> = {}) => send({ messages: [{ role: "user", content: text }], ...extra });
const db = () => world.db as MemoryDb;
const sentBody = () => JSON.parse(String((world.model.mock.calls.at(-1)?.[4] as RequestInit).body));
const consumed = () => world.rpc.mock.calls.filter(([name]) => name === "consume_copilot_message").length;

beforeEach(() => {
  world.db = seed();
  world.rpc = vi.fn(async (name: string) => (name === "consume_copilot_message" ? { data: [{ allowed: true, used: 1, cap: 500 }], error: null } : { data: null, error: null }));
  world.gate = vi.fn(async () => ({ allowed: true, used: 1, cap: 100 }));
  world.upstream = () => new Response(JSON.stringify({ choices: [{ message: { content: "Hey Maya — done." } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }), { status: 200, headers: { "Content-Type": "application/json" } });
  world.model = vi.fn(async () => world.upstream!());
});

describe("Kreto model and effort decide the tier and the caps", () => {
  it("by default (Auto, Balanced) a short ask runs on the fast tier with today's 400-token ceiling, and says which Kreto model ran", async () => {
    const res = await ask("What's due this week?");
    expect(res.status).toBe(200);
    expect(sentBody()).toMatchObject({ model: GEMINI_3_FLASH, max_tokens: 400 });
    expect(res.headers.get("X-Kreto-Profile")).toBe("pulse");
    expect(res.headers.get("X-Kreto-Effort")).toBe("2");
    expect(res.headers.get("Access-Control-Expose-Headers")).toMatch(/X-Kreto-Profile/);
    expect(res.headers.get("Access-Control-Expose-Headers")).toMatch(/X-Copilot-Conversation-Id/);
    // No provider name or model id ever goes back.
    for (const [k, v] of res.headers.entries()) if (k.startsWith("x-kreto")) expect(v).not.toMatch(/gemini|google/i);
  });

  it("a long ordinary message is NOT silently upgraded (it used to go to the stronger model past 200 characters)", async () => {
    await ask("Tell me what changed in my week, project by project, with the reasons and what I should look at first please. ".repeat(3));
    expect(sentBody().model).toBe(GEMINI_3_FLASH);
  });

  it("a document request runs as Kreto Forge on the strong tier with 800 tokens, as before, and is named", async () => {
    const res = await ask("Draft a proposal for the Night Shoot client");
    expect(sentBody()).toMatchObject({ model: GEMINI_3_8_FLASH, max_tokens: 800 });
    expect(res.headers.get("X-Kreto-Profile")).toBe("forge");
  });

  it("Quick on Kreto Signal uses the lite tier, 300 tokens and fewer prior messages", async () => {
    db().seed("ai_messages", Array.from({ length: 30 }, (_, i) => ({ conversation_id: "conv-1", role: i % 2 ? "assistant" : "user", content: `turn ${i}`, created_at: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString() })));
    await ask("thanks", { profile: "signal", effort: 1 });
    const body = sentBody();
    expect(body).toMatchObject({ model: GEMINI_FLASH_LITE, max_tokens: 300 });
    expect(body.messages.filter((m: { role: string }) => m.role !== "system").length).toBeLessThanOrEqual(17);
  });

  it("the profile's focus is added to Kreto's instructions", async () => {
    await ask("What do I owe?", { profile: "ledger" });
    expect(sentBody().messages[0].content).toMatch(/FOCUS: Focus on money/);
  });

  it("an unavailable choice is refused with a named alternative, before anything is counted, saved or reserved", async () => {
    const res = await ask("Decide my pricing for next year", { profile: "oracle", effort: 4 });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "KRETO_PROFILE_UNAVAILABLE", alternative: "vision", error: "Kreto Oracle is on Premium for now. I can run this with Kreto Vision." });
    expect(world.model).not.toHaveBeenCalled();
    expect(consumed()).toBe(0);
    expect(world.gate).not.toHaveBeenCalled();
    expect(db().writes("ai_messages", "insert")).toHaveLength(0);
  });
});

describe("the deepest tier: admins and active Premium accounts only, for now", () => {
  it("an admin runs Kreto Oracle on the deepest tier", async () => {
    world.db = seed().seed("user_roles", [{ user_id: "user-1", role: "admin" }]);
    const res = await ask("Decide my pricing for next year", { profile: "oracle", effort: 2 });
    expect(res.status).toBe(200);
    expect(sentBody().model).toBe(GEMINI_3_1_PRO);
    expect(res.headers.get("X-Kreto-Profile")).toBe("oracle");
  });

  it("an active Premium plan runs it too; a cancelled one is offered Kreto Vision", async () => {
    world.db = seed(60000, 0, { subscription_tier: "creator_pro", subscription_status: "active" });
    expect((await ask("Decide my pricing for next year", { profile: "oracle", effort: 2 })).status).toBe(200);
    expect(sentBody().model).toBe(GEMINI_3_1_PRO);
    world.db = seed(60000, 0, { subscription_tier: "creator_pro", subscription_status: "canceled" });
    const res = await ask("Decide my pricing for next year", { profile: "oracle", effort: 2 });
    expect(res.status).toBe(400);
    expect((await res.json()).alternative).toBe("vision");
  });
});

describe("the weekly allowance", () => {
  const spent = (credits: number) => [{ user_id: "user-1", feature: "kreto_message", credits, created_at: new Date().toISOString() }];

  it("a free account that has used its week is stopped, and told when it comes back", async () => {
    world.db = seed().seed("ai_model_calls", spent(0.5));
    const res = await ask("What's due this week?", { confirm_estimate: true });
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ code: "KRETO_ALLOWANCE_INSUFFICIENT", basis: "week", error: "This needs more than you have left this week. It comes back on Monday. Quick gives a lighter answer." });
    expect(world.model).not.toHaveBeenCalled();
  });

  it("near the end of the week it asks first, in terms of the week", async () => {
    world.db = seed().seed("ai_model_calls", spent(0.488));
    const res = await ask("What's due this week?", { confirm_supported: true });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: "KRETO_CONFIRM", basis: "week" });
  });

  it("last week's spend does not count, and an admin has no weekly cap", async () => {
    world.db = seed().seed("ai_model_calls", [{ user_id: "user-1", credits: 5, created_at: new Date(Date.now() - 8 * 86400000).toISOString() }]);
    expect((await ask("What's due this week?")).status).toBe(200);
    world.db = seed().seed("ai_model_calls", spent(50)).seed("user_roles", [{ user_id: "user-1", role: "admin" }]);
    expect((await ask("What's due this week?")).status).toBe(200);
  });
});

describe("the estimate guard", () => {
  it("asks first when the request would use a large share of what is left today, and counts, saves and reserves nothing", async () => {
    world.db = seed(4000, 0); // a short ask reserves roughly 500 tokens of the 4,000 left: over a quarter needs a bigger ask
    const big = "Summarise everything about my projects and money in detail. ".repeat(40);
    const res = await ask(big, { confirm_supported: true });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body).toMatchObject({ code: "KRETO_CONFIRM", basis: "today", profile: "pulse", effort: 2 });
    expect(body.error).toMatch(/^This needs about \d+% of what's left today\. Run it\?$/);
    expect(body.estimate.tokens).toBeGreaterThan(1000);
    expect(world.model).not.toHaveBeenCalled();
    expect(consumed()).toBe(0);
    expect(world.gate).not.toHaveBeenCalled();
    expect(db().writes("ai_messages", "insert")).toHaveLength(0);

    // Confirmed: it runs, is counted once, and the turn is saved once.
    const again = await ask(big, { confirm_supported: true, confirm_estimate: true });
    expect(again.status).toBe(200);
    expect(world.model).toHaveBeenCalledTimes(1);
    expect(consumed()).toBe(1);
    expect(db().writes("ai_messages", "insert").length).toBeGreaterThanOrEqual(1);
    expect(again.headers.get("X-Kreto-Share")).toMatch(/^\d+$/);
  });

  it("a caller that cannot ask (the floating Kreto, drafts) is not asked: the request runs as it did before", async () => {
    world.db = seed(4000, 0);
    const res = await ask("Summarise everything about my projects and money in detail. ".repeat(40));
    expect(res.status).toBe(200);
    expect(world.model).toHaveBeenCalledTimes(1);
  });

  it("stops when the request does not fit, even if confirmed, and says when the allowance comes back", async () => {
    world.db = seed(60000, 59990);
    const res = await ask("What's due this week?", { confirm_estimate: true });
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.code).toBe("KRETO_ALLOWANCE_INSUFFICIENT");
    expect(body.error).toBe("This needs more than you have left today. It comes back at midnight UTC. Quick gives a lighter answer.");
    expect(world.model).not.toHaveBeenCalled();
    expect(consumed()).toBe(0);
  });

  it("the allowance the composer shows (forwarded by the Cloud endpoint) can only make it stricter, never looser", async () => {
    const big = "Summarise everything about my projects and money in detail. ".repeat(40);
    // Plenty left on this ledger, little on the one the person sees: it asks.
    expect((await ask(big, { confirm_supported: true, kreto_tokens_left: 4000 })).status).toBe(409);
    // Little left on this ledger: a larger figure from the caller does not loosen it.
    world.db = seed(4000, 0);
    expect((await ask(big, { confirm_supported: true, kreto_tokens_left: 10_000_000 })).status).toBe(409);
    // Nonsense is ignored.
    world.db = seed();
    expect((await ask("What's due this week?", { kreto_tokens_left: -5 })).status).toBe(200);
    expect(world.model).toHaveBeenCalledTimes(1);
  });

  it("with plenty left it runs without asking", async () => {
    const res = await ask("What's due this week?");
    expect(res.status).toBe(200);
    expect(world.model).toHaveBeenCalledTimes(1);
  });
});

describe("truthful, Kretopia-voiced failures", () => {
  it("the daily message limit is counted only when the request goes ahead, and says Kreto, not Copilot", async () => {
    world.rpc = vi.fn(async (name: string) => (name === "consume_copilot_message" ? { data: [{ allowed: false, used: 30, cap: 30 }], error: null } : { data: null, error: null }));
    const res = await ask("What's due this week?");
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ code: "COPILOT_DAILY_LIMIT", error: "You've used today's 30 of 30 Kreto messages. They come back at midnight UTC." });
    expect(db().writes("ai_messages", "insert")).toHaveLength(0);
  });

  it("a provider failure says Kreto couldn't answer and that nothing changed, never 'AI'", async () => {
    world.upstream = () => new Response("boom", { status: 500 });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await ask("What's due this week?");
    expect(res.status).toBe(500);
    const { error } = await res.json();
    expect(error).toBe("Kreto couldn't answer right now. Nothing was changed. Try again in a moment.");
    expect(error).not.toMatch(/\bAI\b/);
  });
});
