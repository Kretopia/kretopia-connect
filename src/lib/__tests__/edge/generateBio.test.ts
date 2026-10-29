import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GEMINI_3_FLASH } from "../../../../supabase/functions/_shared/aiModels.ts";
import { TOKENS_SHORT_DRAFT } from "../../../../supabase/functions/_shared/aiLimits.ts";
import { DEFAULT_DAILY_CAP } from "../../../../supabase/functions/_shared/aiRateLimit.ts";

// Runs the real generate-bio handler with the real sign-in guard (require-user.ts) and the real usage counter
// (aiRateLimit.ts) on top of a fake Supabase client and a fake AI gateway: who gets through, what reaches the model, and
// that nothing is spent for a caller who is not signed in or whose input is refused.
const world = vi.hoisted(() => ({
  handler: null as null | ((r: Request) => Promise<Response>),
  // The access tokens the fake auth server accepts, and who they belong to.
  people: {} as Record<string, { id: string }>,
  // What the usage counter answers, and every call made to it with the key of the client that made it.
  counter: { data: null, error: null } as { data: unknown; error: { message: string } | null },
  counterCalls: [] as Array<{ name: string; args: Record<string, unknown>; clientKey: string }>,
  env: {} as Record<string, string | undefined>,
}));

vi.mock("https://deno.land/std@0.168.0/http/server.ts", () => ({ serve: (h: (r: Request) => Promise<Response>) => { world.handler = h; } }));
vi.mock("https://esm.sh/@supabase/supabase-js@2.49.4", () => ({
  createClient: (_url: string, key: string, options?: { global?: { headers?: Record<string, string> } }) => {
    const bearer = options?.global?.headers?.Authorization ?? "";
    return {
      auth: {
        getUser: async () => {
          const person = world.people[bearer.replace(/^Bearer /, "")];
          return person ? { data: { user: person }, error: null } : { data: { user: null }, error: { message: "invalid JWT" } };
        },
      },
      rpc: async (name: string, args: Record<string, unknown>) => {
        world.counterCalls.push({ name, args, clientKey: key });
        return world.counter;
      },
    };
  },
}));

type Mod = typeof import("../../../../supabase/functions/generate-bio/index.ts");
let mod: Mod;
const fetchMock = vi.fn();

beforeAll(async () => {
  (globalThis as unknown as { Deno: unknown }).Deno = { env: { get: (k: string) => world.env[k] } };
  mod = await import("../../../../supabase/functions/generate-bio/index.ts");
});

beforeEach(() => {
  world.people = { "token-ana": { id: "user-ana" }, "token-ben": { id: "user-ben" } };
  world.counter = { data: [{ allowed: true, used: 1, cap: DEFAULT_DAILY_CAP }], error: null };
  world.counterCalls = [];
  world.env = { LOVABLE_API_KEY: "ai-key", SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "anon-key", SUPABASE_SERVICE_ROLE_KEY: "service-key" };
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const GOOD = { fullName: "Ana Silva", role: "Colorist", location: "Lisbon, Portugal", skills: ["Color grading", "Editing"] };
const call = (body: unknown, authorization: string | null = "Bearer token-ana", method = "POST") =>
  world.handler!(
    new Request("https://fn.example/generate-bio", {
      method,
      headers: authorization === null ? {} : { Authorization: authorization },
      body: method === "POST" ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
    }),
  );
const modelSays = (content: string | null, status = 200) =>
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status }));
const sentToModel = () => JSON.parse(fetchMock.mock.calls[0][1].body) as { model: string; max_tokens: number; messages: Array<{ role: string; content: string }> };
const promptSent = () => sentToModel().messages[0].content;
// Nothing was spent: no model call, and nothing counted against anyone.
const nothingSpent = () => {
  expect(fetchMock).not.toHaveBeenCalled();
  expect(world.counterCalls).toEqual([]);
};

describe("who may call it", () => {
  it("answers the preflight for anyone and does nothing else", async () => {
    const res = await call(null, null, "OPTIONS");
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    nothingSpent();
  });

  it("refuses a call with no Authorization header: 401, no model call, nothing counted", async () => {
    const res = await call(GOOD, null);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    nothingSpent();
  });

  it.each([
    ["the publishable key a signed-out browser sends", "Bearer anon-key"],
    ["an expired or forged token", "Bearer expired"],
    ["a header that is not a bearer token", "Basic abc"],
  ])("refuses %s", async (_what, authorization) => {
    const res = await call(GOOD, authorization);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
    nothingSpent();
  });

  it("checks who is asking before it reads the body", async () => {
    expect((await call("not json", null)).status).toBe(401);
    expect((await call({}, null)).status).toBe(401);
    nothingSpent();
  });
});

describe("a signed-in caller", () => {
  it("gets a bio back as { bio }, drafted from what they typed", async () => {
    modelSays("  I grade films for a living.\n");
    const res = await call(GOOD);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ bio: "I grade films for a living." });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://ai.gateway.lovable.dev/v1/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer ai-key");
    const sent = sentToModel();
    expect(sent.model).toBe(GEMINI_3_FLASH);
    expect(sent.max_tokens).toBe(TOKENS_SHORT_DRAFT);
    expect(sent.messages).toHaveLength(1);
    expect(promptSent()).toContain("Name: Ana Silva");
    expect(promptSent()).toContain("Role: Colorist");
    expect(promptSent()).toContain("Based in: Lisbon, Portugal");
    expect(promptSent()).toContain("Skills: Color grading, Editing");
  });

  it("is counted once, on the service-role client, under this function's own key", async () => {
    modelSays("A bio.");
    await call(GOOD);
    expect(world.counterCalls).toEqual([
      { name: "consume_ai_feature_call", args: { _user_id: "user-ana", _feature_key: "generate-bio", _daily_cap: DEFAULT_DAILY_CAP }, clientKey: "service-key" },
    ]);
  });

  it("is counted as the person the token belongs to, never as an identity named in the body", async () => {
    modelSays("A bio.");
    await call({ ...GOOD, userId: "user-evil", user_id: "user-evil" }, "Bearer token-ben");
    expect(world.counterCalls).toHaveLength(1);
    expect(world.counterCalls[0].args._user_id).toBe("user-ben");
  });

  it("leaves location and skills out of the prompt when none were given", async () => {
    modelSays("A bio.");
    await call({ fullName: "Ana Silva", role: "Colorist", location: null, skills: null });
    expect(promptSent()).toContain("Role: Colorist");
    expect(promptSent()).not.toContain("Based in");
    expect(promptSent()).not.toContain("Skills:");
  });

  it("trims what was typed and drops blank skills", async () => {
    modelSays("A bio.");
    await call({ fullName: "  Ana Silva ", role: " Colorist\n", location: "  ", skills: ["  DJ ", "", "Producer", "   "] });
    expect(promptSent()).toContain("Name: Ana Silva\n");
    expect(promptSent()).toContain("Role: Colorist\n");
    expect(promptSent()).not.toContain("Based in");
    expect(promptSent()).toContain("Skills: DJ, Producer\n");
  });
});

describe("what it will put in the prompt", () => {
  const refused = async (body: unknown) => {
    const res = await call(body);
    expect(res.status).toBe(400);
    nothingSpent();
    return (await res.json()) as { error: string };
  };

  it.each([
    ["nothing", {}],
    ["no role", { fullName: "Ana" }],
    ["no name", { role: "Colorist" }],
    ["a name and role that are blank", { fullName: "   ", role: "\n" }],
    ["a name that is not text", { fullName: 5, role: "Colorist" }],
    ["a role that is not text", { fullName: "Ana", role: ["Colorist"] }],
    ["a body that is JSON but not an object", null],
    ["a list instead of an object", [GOOD]],
  ])("needs a name and a role: %s", async (_what, body) => {
    expect(await refused(body)).toEqual({ error: "Name and role are required" });
  });

  it("refuses a body that is not JSON", async () => {
    expect(await refused("not json")).toEqual({ error: "Invalid request body" });
  });

  it("accepts every field right up to its limit, measured after trimming", async () => {
    modelSays("A bio.");
    const res = await call({
      fullName: `  ${"n".repeat(mod.MAX_NAME)}  `,
      role: "r".repeat(mod.MAX_ROLE),
      location: "l".repeat(mod.MAX_LOCATION),
      skills: Array.from({ length: mod.MAX_SKILLS }, (_, i) => String(i).padEnd(mod.MAX_SKILL, "s")),
    });
    expect(res.status).toBe(200);
    expect(world.counterCalls).toHaveLength(1);
  });

  const overLimit: Array<[string, () => Record<string, unknown>, () => string]> = [
    ["a name", () => ({ fullName: "n".repeat(mod.MAX_NAME + 1) }), () => `Name is too long (${mod.MAX_NAME} characters at most).`],
    ["a role", () => ({ role: "r".repeat(mod.MAX_ROLE + 1) }), () => `Role is too long (${mod.MAX_ROLE} characters at most).`],
    ["a location", () => ({ location: "l".repeat(mod.MAX_LOCATION + 1) }), () => `Location is too long (${mod.MAX_LOCATION} characters at most).`],
    ["a list of skills", () => ({ skills: Array.from({ length: mod.MAX_SKILLS + 1 }, (_, i) => `skill ${i}`) }), () => `Too many skills (${mod.MAX_SKILLS} at most).`],
    ["a list padded with blank skills", () => ({ skills: Array.from({ length: mod.MAX_SKILLS + 1 }, () => "") }), () => `Too many skills (${mod.MAX_SKILLS} at most).`],
    ["one skill", () => ({ skills: ["DJ", "s".repeat(mod.MAX_SKILL + 1)] }), () => `A skill is too long (${mod.MAX_SKILL} characters at most).`],
  ];
  it.each(overLimit)("refuses %s one past its limit with a 400 and a message that says which", async (_what, patch, message) => {
    expect(await refused({ ...GOOD, ...patch() })).toEqual({ error: message() });
  });

  it.each([
    ["a location that is not text", { location: 42 }, "Location must be text."],
    ["skills that are not a list", { skills: "DJ, Producer" }, "Skills must be a list of text."],
    ["a skill that is not text", { skills: ["DJ", 7] }, "Skills must be a list of text."],
    ["an object that only looks like a list", { skills: { length: 3, join: "x" } }, "Skills must be a list of text."],
  ])("refuses %s", async (_what, patch, message) => {
    expect(await refused({ ...GOOD, ...patch })).toEqual({ error: message });
  });

  it("keeps the largest request it accepts down to a small prompt", async () => {
    modelSays("A bio.");
    await call({
      fullName: "n".repeat(mod.MAX_NAME),
      role: "r".repeat(mod.MAX_ROLE),
      location: "l".repeat(mod.MAX_LOCATION),
      skills: Array.from({ length: mod.MAX_SKILLS }, () => "s".repeat(mod.MAX_SKILL)),
    });
    // The fixed instructions are about 500 characters; the caller's part cannot add more than a few thousand.
    expect(promptSent().length).toBeLessThan(5000);
  });
});

describe("the usage limit", () => {
  it("returns the counter's own response when the limit is reached, without a model call", async () => {
    world.counter = { data: [{ allowed: false, used: 5, cap: 5 }], error: null };
    const res = await call(GOOD);
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({
      error: "Daily limit reached for this feature (5/5). Come back tomorrow.",
      code: "AI_FEATURE_DAILY_LIMIT",
      used: 5,
      cap: 5,
    });
    expect(world.counterCalls).toHaveLength(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails closed when the counter itself is broken: a 500 and no model call", async () => {
    world.counter = { data: null, error: { message: "function consume_ai_feature_call does not exist" } };
    const res = await call(GOOD);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Could not verify usage limit. Try again shortly." });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("when the model cannot answer", () => {
  it.each([
    [429, 429, "Rate limited"],
    [402, 402, "AI credits exhausted"],
    [500, 500, "AI request failed: 500"],
  ])("maps a gateway %i to a %i with { error }", async (gatewayStatus, status, error) => {
    fetchMock.mockResolvedValue(new Response("{}", { status: gatewayStatus }));
    const res = await call(GOOD);
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error });
  });

  it("answers an empty bio, not an error, when the model sends no text", async () => {
    modelSays(null);
    const res = await call(GOOD);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ bio: "" });
  });

  it("says so when the AI key is missing, and counts nothing against the person", async () => {
    world.env.LOVABLE_API_KEY = undefined;
    const res = await call(GOOD);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "LOVABLE_API_KEY not configured" });
    nothingSpent();
  });
});
