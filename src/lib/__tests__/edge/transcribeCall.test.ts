import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryDb } from "./memoryDb";

// Runs the real transcribe-call handler against an in-memory database and scripted Daily / AI answers.
const world = vi.hoisted(() => ({
  handler: null as null | ((r: Request) => Promise<Response>),
  db: null as any,
}));

vi.mock("https://deno.land/std@0.190.0/http/server.ts", () => ({ serve: (h: any) => { world.handler = h; } }));
vi.mock("https://esm.sh/@supabase/supabase-js@2.57.2", () => ({ createClient: () => ({ from: (t: string) => world.db.from(t) }) }));
vi.mock("../../../../supabase/functions/_shared/embed.ts", () => ({ embedText: async () => null, toPgVector: () => "[]" }));

const KEY = "service-key";
const ENV: Record<string, string> = { SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: KEY, DAILY_API_KEY: "daily-key", LOVABLE_API_KEY: "ai-key" };
const MB = 1024 * 1024;
const fetchMock = vi.fn();

beforeAll(async () => {
  (AbortSignal as any).timeout ??= () => new AbortController().signal;
  (globalThis as any).Deno = { env: { get: (k: string) => ENV[k] } };
  vi.stubGlobal("fetch", (...a: unknown[]) => fetchMock(...a));
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  await import("../../../../supabase/functions/transcribe-call/index.ts");
});

const aiAnswer = {
  choices: [{ message: { tool_calls: [{ function: { arguments: JSON.stringify({
    language: "en",
    transcript: "Hello there.",
    summary: "A short call.",
    chapters: [{ start_seconds: 0, title: "Intro" }],
    action_items: [{ kind: "task", title: "Send the storyboard" }],
  }) } }] } }],
};

/** Scripts Daily and the AI gateway. `audio` is the downloaded recording. */
function script(opts: { audio?: { size: number; declare?: boolean }; linkStatus?: number; aiStatus?: number } = {}) {
  const audio = opts.audio ?? { size: 1 * MB, declare: true };
  const cancel = vi.fn();
  fetchMock.mockImplementation(async (url: string) => {
    if (String(url).includes("/access-link")) {
      return opts.linkStatus && opts.linkStatus !== 200
        ? new Response("nope", { status: opts.linkStatus })
        : new Response(JSON.stringify({ download_link: "https://dl.example/rec.mp4" }), { status: 200 });
    }
    if (String(url).startsWith("https://dl.example")) {
      const res = new Response(new Uint8Array(audio.declare === false ? 0 : 8), {
        status: 200,
        headers: audio.declare === false ? {} : { "content-length": String(audio.size) },
      });
      if (audio.declare === false) Object.defineProperty(res, "arrayBuffer", { value: async () => new ArrayBuffer(audio.size) });
      Object.defineProperty(res, "body", { value: { cancel } });
      return res;
    }
    if (String(url).includes("ai.gateway")) {
      return opts.aiStatus && opts.aiStatus !== 200 ? new Response("limit", { status: opts.aiStatus }) : new Response(JSON.stringify(aiAnswer), { status: 200 });
    }
    throw new Error(`unscripted fetch ${url}`);
  });
  return { cancel };
}

const row = (over: Record<string, unknown> = {}) => ({ id: "t1", recording_id: "rec-1", call_kind: "project", call_id: "c1", created_by: "host-1", status: "pending", error: null, participants: [], duration_seconds: 90, ...over });
const call = (auth = true) =>
  world.handler!(
    new Request("https://fn.example/t", {
      method: "POST",
      headers: auth ? { Authorization: `Bearer ${KEY}` } : {},
      body: JSON.stringify({ transcript_id: "t1", recording_id: "rec-1" }),
    }),
  );
const ai = () => fetchMock.mock.calls.filter((c) => String(c[0]).includes("ai.gateway"));
const t1 = () => world.db.rows("call_transcripts")[0];

beforeEach(() => {
  world.db = new MemoryDb().seed("call_transcripts", [row()]);
  fetchMock.mockReset();
});

describe("transcribe-call: a recording over the inline cap is stored, just not transcribed", () => {
  it("skips on the declared size: marks the row, tells the host the replay is saved, calls no AI, answers 200", async () => {
    const { cancel } = script({ audio: { size: 40 * MB } });
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, skipped: "too_large", transcript_id: "t1" });
    expect(t1().status).toBe("failed");
    expect(t1().error).toMatch(/^transcript_skipped:too_large \(40 MB, limit 8 MB\)$/);
    expect(cancel).toHaveBeenCalled(); // the body is dropped, never buffered
    expect(ai()).toHaveLength(0);
    const notice = world.db.rows("notifications")[0];
    expect(notice).toMatchObject({ user_id: "host-1", type: "call_recording_saved", action_url: "/recordings" });
    expect(notice.message).toMatch(/replay is in Recordings/i);
  });

  it("skips on the real size when the server did not declare one", async () => {
    script({ audio: { size: 12 * MB, declare: false } });
    const res = await call();
    expect(res.status).toBe(200);
    expect((await res.json()).skipped).toBe("too_large");
    expect(t1().error).toMatch(/^transcript_skipped:too_large/);
    expect(ai()).toHaveLength(0);
  });

  it("a recording just under the cap is transcribed", async () => {
    script({ audio: { size: 7 * MB } });
    expect((await call()).status).toBe(200);
    expect(ai()).toHaveLength(1);
    expect(t1()).toMatchObject({ status: "ready", summary: "A short call.", transcript: "Hello there." });
  });
});

describe("transcribe-call: one run per row", () => {
  it.each(["transcribing", "ready"])("a row that is %s belongs to another run: nothing is fetched or changed", async (status) => {
    world.db.tables.call_transcripts = [row({ status })];
    script();
    const res = await call();
    expect(res.status).toBe(200);
    expect((await res.json()).skipped).toBe("claimed");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(t1().status).toBe(status);
  });

  it("a replayed job after success does not insert the action items twice", async () => {
    script();
    await call();
    await call();
    expect(world.db.rows("call_action_items")).toHaveLength(1);
    expect(ai()).toHaveLength(1);
  });

  it("a failed row is claimed again (that is what a retry is) and its old error is cleared", async () => {
    world.db.tables.call_transcripts = [row({ status: "failed", error: "Gemini error 500" })];
    script();
    expect((await call()).status).toBe(200);
    expect(t1()).toMatchObject({ status: "ready", error: null });
  });

  it("a database failure while claiming is a 500 that leaves the row alone", async () => {
    world.db.hooks.failOn = (table: string, op: string) => (table === "call_transcripts" && op === "update" ? { message: "db down" } : null);
    script();
    const res = await call();
    expect(res.status).toBe(500);
    expect(t1().status).toBe("pending");
  });
});

describe("transcribe-call: real failures stay failures", () => {
  it("a Daily link failure is a 500 and the row records why", async () => {
    script({ linkStatus: 404 });
    const res = await call();
    expect(res.status).toBe(500);
    expect(t1()).toMatchObject({ status: "failed" });
    expect(t1().error).toMatch(/Daily access-link failed: 404/);
  });

  it("an AI credits error is a 500 and the row records why", async () => {
    script({ aiStatus: 402 });
    expect((await call()).status).toBe(500);
    expect(t1().error).toMatch(/AI credits exhausted/);
  });

  it("refuses a caller without the service-role key", async () => {
    script();
    expect((await call(false)).status).toBe(401);
    expect(t1().status).toBe("pending");
  });
});
