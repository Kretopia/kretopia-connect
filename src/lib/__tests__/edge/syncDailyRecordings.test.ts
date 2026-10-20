import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryDb } from "./memoryDb";

// Runs the real sync-daily-recordings handler against an in-memory database and a scripted Daily API.
const world = vi.hoisted(() => ({
  handler: null as null | ((r: Request) => Promise<Response>),
  db: null as any,
  user: "host-1" as string | null,
  pending: [] as Promise<unknown>[],
}));

vi.mock("https://deno.land/std@0.190.0/http/server.ts", () => ({ serve: (h: any) => { world.handler = h; } }));
vi.mock("https://esm.sh/@supabase/supabase-js@2.57.2", () => ({
  createClient: () => ({
    from: (t: string) => world.db.from(t),
    auth: { getClaims: async () => ({ data: world.user ? { claims: { sub: world.user } } : null }) },
  }),
}));

const ENV: Record<string, string> = { SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "anon", SUPABASE_SERVICE_ROLE_KEY: "service-key", DAILY_API_KEY: "daily-key" };
const ROOM = "td-abc123";
const fetchMock = vi.fn();
const NOW = Math.floor(Date.now() / 1000);

beforeAll(async () => {
  (AbortSignal as any).timeout ??= () => new AbortController().signal;
  (globalThis as any).Deno = { env: { get: (k: string) => ENV[k] } };
  (globalThis as any).EdgeRuntime = { waitUntil: (p: Promise<unknown>) => world.pending.push(p) };
  vi.stubGlobal("fetch", (...a: unknown[]) => fetchMock(...a));
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  await import("../../../../supabase/functions/sync-daily-recordings/index.ts");
});

const projectCall = { id: "call-1", project_id: "11111111-1111-4111-8111-111111111111", started_by: "host-1", participants: [{ user_id: "host-1" }], room_url: `https://k.daily.co/${ROOM}`, started_at: "2026-10-19T10:00:00Z" };

function daily(recordings: Array<Record<string, unknown>>) {
  fetchMock.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/access-link")) return new Response(JSON.stringify({ download_link: "https://dl.example/x.mp4" }), { status: 200 });
    if (u.includes("/recordings")) return new Response(JSON.stringify({ data: recordings }), { status: 200 });
    return new Response("{}", { status: 200 }); // transcribe-call dispatch
  });
}
const rec = (id: string, over: Record<string, unknown> = {}) => ({ id, room_name: ROOM, status: "finished", start_ts: NOW - 60, duration: 90, ...over });

async function sync(body: Record<string, unknown> = { room_name: ROOM }, auth = true) {
  const res = await world.handler!(
    new Request("https://fn.example/sync", { method: "POST", headers: auth ? { Authorization: "Bearer t" } : {}, body: JSON.stringify(body) }),
  );
  await Promise.all(world.pending);
  return { res, json: await res.json() };
}
const rows = () => world.db.rows("call_transcripts");
const dispatches = () => fetchMock.mock.calls.filter((c) => String(c[0]).endsWith("/functions/v1/transcribe-call"));

beforeEach(() => {
  world.db = new MemoryDb().seed("project_video_calls", [projectCall]);
  world.user = "host-1";
  world.pending = [];
  fetchMock.mockReset();
});

describe("sync-daily-recordings: stores this call's recording, once", () => {
  it("creates the canonical row, queues the transcript job and echoes since_ts", async () => {
    daily([rec("r1")]);
    const { res, json } = await sync({ room_name: ROOM, since_ts: NOW - 120 });
    expect(res.status).toBe(200);
    expect(json).toMatchObject({ ok: true, failed: 0, since_ts: NOW - 120, scanned: 1 });
    expect(json.results).toEqual([{ recording_id: "r1", transcript_id: rows()[0].id }]);
    expect(rows()[0]).toMatchObject({ call_kind: "project", recording_id: "r1", status: "pending", created_by: "host-1", duration_seconds: 90 });
    expect(dispatches()).toHaveLength(1);
  });

  it("a second sync (or the webhook having been first) leaves one row and one job", async () => {
    daily([rec("r1")]);
    await sync();
    await sync();
    expect(rows()).toHaveLength(1);
    expect(dispatches()).toHaveLength(1);
  });

  it("only recordings that started at or after since_ts are part of the answer", async () => {
    daily([rec("old", { start_ts: NOW - 86_400 }), rec("new", { start_ts: NOW - 30 })]);
    const { json } = await sync({ room_name: ROOM, since_ts: NOW - 120 });
    expect(json.results.map((r: any) => r.recording_id)).toEqual(["new"]);
    expect(rows().map((r: any) => r.recording_id)).toEqual(["new"]);
  });

  it("rejects a malformed since_ts and answers null when none was sent", async () => {
    daily([]);
    expect((await sync({ room_name: ROOM, since_ts: "yesterday" })).res.status).toBe(400);
    expect((await sync({ room_name: ROOM, since_ts: -5 })).res.status).toBe(400);
    expect((await sync({ room_name: ROOM, since_ts: NOW + 10 * 86_400 })).res.status).toBe(400);
    expect((await sync({ room_name: ROOM })).json.since_ts).toBeNull();
  });

  it("a recording that is already ready is reported, not queued again", async () => {
    world.db.seed("call_transcripts", [{ id: "t0", recording_id: "r1", status: "ready", call_kind: "project", call_id: "call-1", created_by: "host-1", created_at: "2026-10-19T10:00:00Z" }]);
    daily([rec("r1")]);
    const { json } = await sync();
    expect(json.results).toEqual([{ recording_id: "r1", transcript_id: "t0", skipped: "already ready" }]);
    expect(dispatches()).toHaveLength(0);
  });
});

describe("sync-daily-recordings: asked for a room without a timestamp (a saved segment is found by its id)", () => {
  it("returns the room's recordings even when they started before the caller's clock says they did", async () => {
    // The device heard "recording started" 2 s after Daily began it; a since_ts taken from the device dropped the recording.
    daily([rec("seg", { start_ts: NOW - 2 })]);
    const withSince = await sync({ room_name: ROOM, since_ts: NOW });
    expect(withSince.json.results).toEqual([]);
    const without = await sync({ room_name: ROOM });
    expect(without.json.results.map((r: any) => r.recording_id)).toEqual(["seg"]);
    expect(without.json.results[0].transcript_id).toBeTruthy();
  });
});

describe("sync-daily-recordings: says what Daily is still doing", () => {
  it("a recording still being finalised is 'status=…', one Daily cancelled is 'unavailable=…'", async () => {
    daily([rec("a", { status: "in-progress" }), rec("b", { status: "canceled" })]);
    const { json } = await sync();
    expect(json.results).toEqual([
      { recording_id: "a", skipped: "status=in-progress" },
      { recording_id: "b", skipped: "unavailable=canceled" },
    ]);
    expect(rows()).toHaveLength(0);
  });
});

describe("sync-daily-recordings: a failure is never a clean 200", () => {
  it("every recording failing to save is a 502 with the failures listed", async () => {
    daily([rec("r1")]);
    world.db.hooks.beforeInsert = () => ({ message: "disk full" });
    const { res, json } = await sync();
    expect(res.status).toBe(502);
    expect(json).toMatchObject({ ok: false, failed: 1 });
    expect(json.results[0].error).toMatch(/disk full/);
  });

  it("some failing is a 200 that says ok:false and still lists what was saved", async () => {
    daily([rec("r1"), rec("r2")]);
    let n = 0;
    world.db.hooks.beforeInsert = () => (++n === 1 ? { message: "constraint" } : undefined);
    const { res, json } = await sync();
    expect(res.status).toBe(200);
    expect(json).toMatchObject({ ok: false, failed: 1 });
    expect(json.results.filter((r: any) => r.transcript_id)).toHaveLength(1);
  });

  it("a failing call lookup is reported per recording instead of reading as 'not ours'", async () => {
    daily([rec("r1")]);
    world.db.hooks.failOn = (table: string) => (table === "project_video_calls" ? { message: "reset" } : null);
    const { res, json } = await sync();
    expect(res.status).toBe(502);
    expect(json.results[0]).toMatchObject({ recording_id: "r1", error: expect.stringMatching(/look up the call/) });
  });

  it("a Daily outage is a 500", async () => {
    fetchMock.mockResolvedValue(new Response("down", { status: 503 }));
    expect((await sync()).res.status).toBe(500);
  });
});

describe("sync-daily-recordings: only the caller's own calls", () => {
  it("never stores, queues or reports a recording of a call the caller may not act on", async () => {
    world.user = "stranger";
    daily([rec("r1")]);
    const { res, json } = await sync();
    expect(res.status).toBe(200);
    expect(json).toMatchObject({ scanned: 0, results: [] });
    expect(rows()).toHaveLength(0);
    expect(dispatches()).toHaveLength(0);
  });

  it("a listed participant may; an unauthenticated caller may not", async () => {
    world.user = "guest-in-call";
    world.db.tables.project_video_calls[0].participants = [{ user_id: "host-1" }, { user_id: "guest-in-call" }];
    daily([rec("r1")]);
    expect((await sync()).json.scanned).toBe(1);
    world.user = null;
    expect((await sync({ room_name: ROOM }, false)).res.status).toBe(401);
  });
});
