import { createHmac } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryDb } from "./memoryDb";

// Runs the real daily-recording-webhook handler against an in-memory database.
const world = vi.hoisted(() => ({
  handler: null as null | ((r: Request) => Promise<Response>),
  db: null as any,
  pending: [] as Promise<unknown>[],
}));

vi.mock("https://deno.land/std@0.190.0/http/server.ts", () => ({ serve: (h: any) => { world.handler = h; } }));
vi.mock("https://esm.sh/@supabase/supabase-js@2.57.2", () => ({ createClient: () => ({ from: (t: string) => world.db.from(t) }) }));

const SECRET = "whsec_test";
const ROOM = "td-abc123";
const REC = "rec-111";
const HOST = "host-1";
const ENV: Record<string, string> = {
  DAILY_WEBHOOK_HMAC_SECRET: SECRET,
  SUPABASE_URL: "https://x.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-key",
};

const fetchMock = vi.fn();

beforeAll(async () => {
  // jsdom's AbortSignal predates .timeout (Deno has it); a signal that never fires is enough here.
  (AbortSignal as any).timeout ??= () => new AbortController().signal;
  (globalThis as any).Deno = { env: { get: (k: string) => ENV[k] } };
  (globalThis as any).EdgeRuntime = { waitUntil: (p: Promise<unknown>) => world.pending.push(p) };
  vi.stubGlobal("fetch", (...a: unknown[]) => fetchMock(...a));
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  await import("../../../../supabase/functions/daily-recording-webhook/index.ts");
});

const projectCall = { id: "call-1", project_id: "proj-1", started_by: HOST, participants: [{ user_id: HOST }], room_url: `https://kretopia.daily.co/${ROOM}`, started_at: "2026-10-19T10:00:00Z" };

beforeEach(() => {
  world.db = new MemoryDb().seed("project_video_calls", [projectCall]);
  world.pending = [];
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
});

const ready = (over: Record<string, unknown> = {}, type = "recording.ready-to-download") => ({
  version: "1.0.0",
  type,
  id: "evt-1",
  payload: { room_name: ROOM, recording_id: REC, duration: 125, ...over },
  event_ts: Math.floor(Date.now() / 1000),
});

async function deliver(body: unknown, opts: { ts?: number; sig?: "good" | "bad" | "none"; raw?: string } = {}) {
  const raw = opts.raw ?? JSON.stringify(body);
  const ts = String(opts.ts ?? Math.floor(Date.now() / 1000));
  const headers: Record<string, string> = { "x-webhook-timestamp": ts };
  if (opts.sig !== "none") headers["x-webhook-signature"] = opts.sig === "bad" ? "00".repeat(32) : createHmac("sha256", SECRET).update(`${ts}.${raw}`).digest("hex");
  const res = await world.handler!(new Request("https://fn.example/hook", { method: "POST", headers, body: raw }));
  await Promise.all(world.pending);
  return { res, json: await res.clone().json().catch(() => null) };
}
const rows = () => world.db.rows("call_transcripts");
const dispatches = () => fetchMock.mock.calls.filter((c) => String(c[0]).endsWith("/functions/v1/transcribe-call"));

describe("daily-recording-webhook: only a verified, fresh request is acted on", () => {
  it("refuses a bad or missing signature and a stale timestamp, and writes nothing", async () => {
    expect((await deliver(ready(), { sig: "bad" })).res.status).toBe(401);
    expect((await deliver(ready(), { sig: "none" })).res.status).toBe(401);
    expect((await deliver(ready(), { ts: Math.floor(Date.now() / 1000) - 3600 })).res.status).toBe(401);
    expect(rows()).toHaveLength(0);
    expect(dispatches()).toHaveLength(0);
  });

  it("answers 500 when the signing secret is not configured (Daily retries, nothing is silently dropped)", async () => {
    const saved = ENV.DAILY_WEBHOOK_HMAC_SECRET;
    delete ENV.DAILY_WEBHOOK_HMAC_SECRET;
    try {
      expect((await deliver(ready())).res.status).toBe(500);
    } finally {
      ENV.DAILY_WEBHOOK_HMAC_SECRET = saved;
    }
  });
});

describe("daily-recording-webhook: events that need nothing from us are 200 and say why", () => {
  it("test ping, recording.started and recording.error write nothing", async () => {
    expect((await deliver({ type: "test" })).res.status).toBe(200);
    const started = await deliver(ready({}, "recording.started"));
    expect(started.res.status).toBe(200);
    expect(started.json.ignored).toMatch(/recording\.started/);
    const err = await deliver({ type: "recording.error", payload: { room_name: ROOM, error_msg: "boom" } });
    expect(err.res.status).toBe(200);
    expect(err.json.ignored).toMatch(/recording\.error/);
    expect(rows()).toHaveLength(0);
  });

  it("a recording from a room that is not one of ours is ignored (the Daily key is account-wide)", async () => {
    const { res, json } = await deliver(ready({ room_name: "someone-elses-room" }));
    expect(res.status).toBe(200);
    expect(json.ignored).toBe("no matching call");
    expect(rows()).toHaveLength(0);
  });
});

describe("daily-recording-webhook: a failure is never a 2xx", () => {
  it("a finished-recording event without its ids, or with malformed ones, is a 400", async () => {
    expect((await deliver(ready({ recording_id: undefined }))).res.status).toBe(400);
    expect((await deliver(ready({ room_name: undefined }))).res.status).toBe(400);
    expect((await deliver(ready({ room_name: "a/b;c" }))).res.status).toBe(400);
    expect((await deliver(null, { raw: "not json" })).res.status).toBe(400);
    expect(rows()).toHaveLength(0);
  });

  it("a failing call lookup is a 500, not 'no matching call' (Daily does not retry a 2xx)", async () => {
    world.db.hooks.failOn = (table: string) => (table === "project_video_calls" ? { message: "connection reset" } : null);
    const { res } = await deliver(ready());
    expect(res.status).toBe(500);
    expect(rows()).toHaveLength(0);
    expect(dispatches()).toHaveLength(0);
  });

  it("a failing insert is a 500 and no transcript job is queued", async () => {
    world.db.hooks.beforeInsert = () => ({ message: "disk full" });
    const { res } = await deliver(ready());
    expect(res.status).toBe(500);
    expect(rows()).toHaveLength(0);
    expect(dispatches()).toHaveLength(0);
  });
});

describe("daily-recording-webhook: the canonical row, once", () => {
  it("creates the row before answering 200 and queues the transcript job in the background", async () => {
    const { res, json } = await deliver(ready({ download_link: "https://dl.example/a.mp4" }));
    expect(res.status).toBe(200);
    expect(json).toMatchObject({ ok: true, created: true, dedup: false, queued: true });
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toMatchObject({
      call_kind: "project",
      call_id: "call-1",
      project_id: "proj-1",
      recording_id: REC,
      recording_url: "https://dl.example/a.mp4",
      duration_seconds: 125,
      status: "pending",
      created_by: HOST,
    });
    expect(json.transcript_id).toBe(rows()[0].id);
    const [url, init] = dispatches()[0];
    expect(String(url)).toBe("https://x.supabase.co/functions/v1/transcribe-call");
    expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer service-key" });
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ transcript_id: rows()[0].id, recording_id: REC });
  });

  it("a replay of the same event does not create a second row or queue a second job", async () => {
    await deliver(ready());
    const second = await deliver(ready());
    expect(second.res.status).toBe(200);
    expect(second.json).toMatchObject({ created: false, dedup: true, queued: false });
    expect(rows()).toHaveLength(1);
    expect(dispatches()).toHaveLength(1);
  });

  it("a replay does not blank a known duration and does refresh the link", async () => {
    await deliver(ready({ download_link: "https://dl.example/old.mp4" }));
    await deliver(ready({ duration: undefined, download_link: "https://dl.example/new.mp4" }));
    expect(rows()[0].duration_seconds).toBe(125);
    expect(rows()[0].recording_url).toBe("https://dl.example/new.mp4");
    await deliver(ready({ duration: undefined, download_link: undefined }));
    expect(rows()[0]).toMatchObject({ duration_seconds: 125, recording_url: "https://dl.example/new.mp4" });
  });

  it("two deliveries racing each other leave exactly one row, and only the survivor's job is queued", async () => {
    // A competing delivery inserts its row (older, so it wins) between our lookup and our insert.
    let raced = false;
    world.db.hooks.beforeInsert = (table: string, _incoming: unknown, db: MemoryDb) => {
      if (table !== "call_transcripts" || raced) return;
      raced = true;
      db.seed("call_transcripts", [{ id: "aaa-winner", recording_id: REC, status: "pending", error: null, created_at: "2000-01-01T00:00:00.000Z", call_kind: "project", call_id: "call-1", created_by: HOST }]);
    };
    const { res, json } = await deliver(ready());
    expect(res.status).toBe(200);
    expect(rows()).toHaveLength(1);
    expect(rows()[0].id).toBe("aaa-winner");
    expect(json).toMatchObject({ transcript_id: "aaa-winner", created: false, dedup: true });
    expect(world.db.writes("call_transcripts", "delete")).toHaveLength(1);
  });
});

describe("daily-recording-webhook: the unique index on recording_id", () => {
  const UNIQUE = { code: "23505", message: 'duplicate key value violates unique constraint "call_transcripts_recording_id_key"' };

  it("the loser of a race gets the unique violation and answers with the winner's row, not an error", async () => {
    let raced = false;
    world.db.hooks.beforeInsert = (table: string, _incoming: unknown, db: MemoryDb) => {
      if (table !== "call_transcripts" || raced) return;
      raced = true;
      db.seed("call_transcripts", [{ id: "aaa-winner", recording_id: REC, status: "pending", error: null, created_at: "2000-01-01T00:00:00.000Z", call_kind: "project", call_id: "call-1", created_by: HOST }]);
      return UNIQUE;
    };
    const { res, json } = await deliver(ready());
    expect(res.status).toBe(200);
    expect(json).toMatchObject({ transcript_id: "aaa-winner", created: false, dedup: true });
    expect(rows()).toHaveLength(1);
    expect(world.db.writes("call_transcripts", "delete")).toHaveLength(0);
  });

  it("a unique violation with no row to read back is still an error, never a silent success", async () => {
    world.db.hooks.beforeInsert = (table: string) => (table === "call_transcripts" ? UNIQUE : undefined);
    const { res } = await deliver(ready());
    expect(res.status).toBe(500);
    expect(rows()).toHaveLength(0);
    expect(dispatches()).toHaveLength(0);
  });

  it("another insert error is still an error", async () => {
    world.db.hooks.beforeInsert = () => ({ code: "23502", message: "null value in column" });
    const { res } = await deliver(ready());
    expect(res.status).toBe(500);
    expect(rows()).toHaveLength(0);
  });
});

describe("daily-recording-webhook: a replay queues a job only when the row needs one", () => {
  const seedRow = (over: Record<string, unknown>) =>
    world.db.seed("call_transcripts", [{ id: "row-1", recording_id: REC, call_kind: "project", call_id: "call-1", created_by: HOST, error: null, created_at: new Date().toISOString(), ...over }]);
  const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

  it("never for a ready transcript or one that was skipped on purpose", async () => {
    seedRow({ status: "ready" });
    expect((await deliver(ready())).json.queued).toBe(false);
    world.db.tables.call_transcripts = [];
    seedRow({ status: "failed", error: "transcript_skipped:too_large (42 MB, limit 8 MB)" });
    expect((await deliver(ready())).json.queued).toBe(false);
    world.db.tables.call_transcripts = [];
    seedRow({ status: "failed", error: "Recording too large for inline transcription (42529331 bytes, max 8388608). Chunking not yet implemented." });
    expect((await deliver(ready())).json.queued).toBe(false);
    expect(dispatches()).toHaveLength(0);
  });

  it("for a real failure, and for a job that never started", async () => {
    seedRow({ status: "failed", error: "Gemini error 500" });
    expect((await deliver(ready())).json.queued).toBe(true);
    world.db.tables.call_transcripts = [];
    seedRow({ status: "pending", created_at: ago(5 * 60_000) });
    expect((await deliver(ready())).json.queued).toBe(true);
    expect(dispatches()).toHaveLength(2);
  });

  it("not for a job that is plainly still running; a job stalled for 20 minutes is released and queued again", async () => {
    seedRow({ status: "pending", created_at: ago(10_000) });
    expect((await deliver(ready())).json.queued).toBe(false);
    world.db.tables.call_transcripts = [];
    seedRow({ status: "transcribing", created_at: ago(5 * 60_000) });
    expect((await deliver(ready())).json.queued).toBe(false);
    world.db.tables.call_transcripts = [];
    seedRow({ status: "transcribing", created_at: ago(25 * 60_000) });
    expect((await deliver(ready())).json.queued).toBe(true);
    expect(rows()[0].status).toBe("pending"); // released so transcribe-call can claim it
  });
});

describe("daily-recording-webhook: a job that could not run does not leave the row looking busy", () => {
  it("marks the row failed when transcribe-call is unreachable", async () => {
    fetchMock.mockRejectedValue(new Error("connection refused"));
    const { res } = await deliver(ready());
    expect(res.status).toBe(200); // the recording is stored; only the recap job failed
    expect(rows()[0]).toMatchObject({ status: "failed" });
    expect(rows()[0].error).toMatch(/could not be started/);
  });

  it("does not overwrite the reason transcribe-call recorded itself", async () => {
    fetchMock.mockImplementation(async () => {
      Object.assign(world.db.rows("call_transcripts")[0], { status: "failed", error: "Gemini error 500: boom" });
      return new Response("{}", { status: 500 });
    });
    await deliver(ready());
    expect(rows()[0]).toMatchObject({ status: "failed", error: "Gemini error 500: boom" });
  });
});

describe("daily-recording-webhook: every kind of call finds its row", () => {
  it("meetings, direct calls and stage rooms", async () => {
    world.db.seed("meetings", [{ id: "m1", host_id: "mh", project_id: null, circle_id: null, source: "studio", room_name: "mtg-1", created_at: "2026-10-01" }]);
    world.db.seed("direct_video_calls", [{ id: "d1", started_by: "dh", invited_user_id: "di", participants: [], room_name: "dm-1", room_url: "https://k.daily.co/dm-1", started_at: "2026-10-01" }]);
    world.db.seed("sound_stages", [{ id: "s1", host_user_id: "sh", room_name: "ss-1", room_url: "https://k.daily.co/ss-1", created_at: "2026-10-01" }]);
    await deliver(ready({ room_name: "mtg-1", recording_id: "r-m" }));
    await deliver(ready({ room_name: "dm-1", recording_id: "r-d" }));
    await deliver(ready({ room_name: "ss-1", recording_id: "r-s" }));
    const by = Object.fromEntries(rows().map((r: any) => [r.recording_id, r]));
    expect(by["r-m"]).toMatchObject({ call_kind: "meeting", call_id: "m1", created_by: "mh" });
    expect(by["r-d"]).toMatchObject({ call_kind: "direct", call_id: "d1", created_by: "dh" });
    expect(by["r-s"]).toMatchObject({ call_kind: "sound_stage", call_id: "s1", created_by: "sh" });
  });
});
