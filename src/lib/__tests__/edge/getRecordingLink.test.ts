import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryDb } from "./memoryDb";

// Runs the real get-recording-link handler: who may open a recording, and what they are told when they cannot.
const world = vi.hoisted(() => ({
  handler: null as null | ((r: Request) => Promise<Response>),
  db: null as any,
  user: null as string | null,
}));

vi.mock("https://deno.land/std@0.190.0/http/server.ts", () => ({ serve: (h: any) => { world.handler = h; } }));
vi.mock("https://esm.sh/@supabase/supabase-js@2.57.2", () => ({
  createClient: () => ({
    from: (t: string) => world.db.from(t),
    auth: { getClaims: async () => ({ data: world.user ? { claims: { sub: world.user } } : null }) },
  }),
}));

const ENV: Record<string, string> = { SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "anon", SUPABASE_SERVICE_ROLE_KEY: "service-key", DAILY_API_KEY: "daily-key" };
const fetchMock = vi.fn();
const P = "11111111-1111-4111-8111-111111111111";
const OWNER = "owner-1";
const HOST = "host-1";

beforeAll(async () => {
  (globalThis as any).Deno = { env: { get: (k: string) => ENV[k] } };
  vi.stubGlobal("fetch", (...a: unknown[]) => fetchMock(...a));
  vi.spyOn(console, "error").mockImplementation(() => {});
  await import("../../../../supabase/functions/get-recording-link/index.ts");
});

const projectRecording = (over: Record<string, unknown> = {}) => ({ id: "t1", recording_id: "rec-1", created_by: HOST, call_kind: "project", call_id: "call-1", project_id: P, participants: [{ user_id: HOST }], ...over });

beforeEach(() => {
  world.db = new MemoryDb()
    .seed("projects", [{ id: P, created_by: OWNER }])
    .seed("call_transcripts", [projectRecording()]);
  world.user = null;
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ download_link: "https://dl.example/rec.mp4", expires: 1234 }), { status: 200 }));
});

async function open(as: string | null, auth = true) {
  world.user = as;
  const res = await world.handler!(
    new Request("https://fn.example/link", { method: "POST", headers: auth ? { Authorization: "Bearer t" } : {}, body: JSON.stringify({ transcript_id: "t1" }) }),
  );
  return { res, json: await res.json() };
}
const collaborator = (user_id: string, role: string, status = "accepted") =>
  world.db.seed("project_collaborators", [{ id: `pc-${user_id}`, project_id: P, user_id, role, status }]);

describe("get-recording-link: who may open a project call's recording", () => {
  it.each([
    ["the call's creator", () => HOST],
    ["the project owner", () => OWNER],
    ["an accepted collaborator", () => (collaborator("collab", "member"), "collab")],
    ["an accepted creative", () => (collaborator("creative", "creative"), "creative")],
  ])("%s gets a link", async (_n, who) => {
    const user = who();
    const { res, json } = await open(user);
    expect(res.status).toBe(200);
    expect(json.download_link).toBe("https://dl.example/rec.mp4");
  });

  it("an accepted client only when explicitly listed as a participant of the call", async () => {
    collaborator("client", "client");
    expect((await open("client")).res.status).toBe(403);
    world.db.tables.call_transcripts[0].participants = [{ user_id: HOST }, { user_id: "client" }];
    expect((await open("client")).res.status).toBe(200);
  });

  it.each([
    ["a pending invitee", () => (collaborator("pending", "member", "pending"), "pending")],
    ["a guest-role member", () => (collaborator("guest", "guest"), "guest")],
    ["a removed member (no row)", () => "removed"],
    ["a stranger", () => "stranger"],
  ])("%s is refused and no link is minted", async (_n, who) => {
    const user = who();
    const { res } = await open(user);
    expect(res.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("no session is a 401; a recording that does not exist is a 404", async () => {
    expect((await open(null, false)).res.status).toBe(401);
    world.db.tables.call_transcripts = [];
    expect((await open(HOST)).res.status).toBe(404);
  });

  it("a lookup that fails is a refusal (503), never access", async () => {
    world.db.hooks.failOn = (table: string) => (table === "projects" ? { message: "db down" } : null);
    collaborator("collab", "member");
    const { res } = await open("collab");
    expect(res.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("get-recording-link: a meeting's revoked participants", () => {
  beforeEach(() => {
    world.db.tables.call_transcripts = [projectRecording({ call_kind: "meeting", call_id: "m1", project_id: null, participants: [{ user_id: HOST }, { user_id: "attendee" }] })];
  });
  it("a listed participant opens it; once denied or removed, no longer", async () => {
    world.db.seed("meeting_participants", [{ meeting_id: "m1", user_id: "attendee", status: "joined" }]);
    expect((await open("attendee")).res.status).toBe(200);
    for (const status of ["denied", "removed"]) {
      world.db.rows("meeting_participants")[0].status = status;
      expect((await open("attendee")).res.status).toBe(403);
    }
  });
});

describe("get-recording-link: what the user is told when Daily cannot serve it", () => {
  it("a recording Daily no longer has says so, with a code the UI can use, and leaks nothing from Daily", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "not-found", info: "recording rec-1 does not exist for account acct_secret" }), { status: 404 }));
    const { res, json } = await open(HOST);
    expect(res.status).toBe(404);
    expect(json).toEqual({ error: "This recording is no longer available.", code: "recording_unavailable" });
    expect(JSON.stringify(json)).not.toMatch(/acct_secret|details/);
  });

  it("any other Daily failure is a 502 with a retry hint, not Daily's status or body", async () => {
    fetchMock.mockResolvedValue(new Response("slow down", { status: 429 }));
    const { res, json } = await open(HOST);
    expect(res.status).toBe(502);
    expect(json.code).toBe("recording_link_failed");
    expect(JSON.stringify(json)).not.toMatch(/slow down/);
  });
});
