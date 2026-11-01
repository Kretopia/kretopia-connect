// The three server-side fetchers of a member-supplied address that had no network policy: extract-event-details (an event link),
// transcribe-voice-note (an audio file) and send-push-notification (a push endpoint). Network and DNS are faked: no probe of
// any real or internal address is ever made. Every refusal asserts that nothing was fetched and nothing was written.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { webcrypto } from "node:crypto";
import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { safeFetchBytes, FetchPolicyError } from "../../../../supabase/functions/_shared/ssrf";
import { isAllowedPushEndpoint } from "../../../../supabase/functions/_shared/pushEndpoint";
import { decideVoiceNote, isOwnStorageUrl, storageHosts, VOICE_TABLES, voiceTableFor } from "../../../../supabase/functions/_shared/voiceNote";
import { MemoryDb } from "./memoryDb";

const world = vi.hoisted(() => ({
  current: "",
  handlers: {} as Record<string, (req: Request) => Promise<Response>>,
  db: null as unknown,
  user: "member-1" as string | null,
  rpc: vi.fn(),
  fetch: vi.fn(),
  dns: {} as Record<string, string[]>,
}));

vi.mock("https://deno.land/std@0.168.0/http/server.ts", () => ({ serve: (h: (req: Request) => Promise<Response>) => { world.handlers[world.current] = h; } }));
vi.mock("npm:@supabase/supabase-js@2", () => ({ createClient: () => ({ auth: { getUser: async () => (world.user ? { data: { user: { id: world.user } }, error: null } : { data: { user: null }, error: { message: "bad" } }) }, rpc: world.rpc }) }));
vi.mock("https://esm.sh/@supabase/supabase-js@2.49.4", () => ({
  createClient: () => ({ auth: { getUser: async () => (world.user ? { data: { user: { id: world.user } }, error: null } : { data: { user: null }, error: { message: "bad" } }) }, rpc: world.rpc, from: (t: string) => (world.db as MemoryDb).from(t) }),
}));
vi.mock("https://esm.sh/@supabase/supabase-js@2.45.0", () => ({ createClient: () => ({ from: (t: string) => (world.db as MemoryDb).from(t) }) }));

const env: Record<string, string> = {
  SUPABASE_URL: "https://backend.test", SUPABASE_SERVICE_ROLE_KEY: "service-key", SUPABASE_ANON_KEY: "anon-key",
  LOVABLE_API_KEY: "ai-key", FIRECRAWL_API_KEY: "fc-key",
};
const resolveDns = async (host: string, type: string) => (type === "A" ? (world.dns[host] ?? ["93.184.216.34"]) : []);

beforeAll(async () => {
  vi.stubGlobal("Deno", { serve: (h: (req: Request) => Promise<Response>) => { world.handlers[world.current] = h; }, env: { get: (k: string) => env[k] }, resolveDns });
  for (const name of ["extract-event-details", "transcribe-voice-note"]) {
    world.current = name;
    await import(`../../../../supabase/functions/${name}/index.ts`);
  }
});

const call = (name: string, body: unknown, token = "member-token") =>
  world.handlers[name](new Request("https://edge.test", { method: "POST", headers: { Authorization: `Bearer ${token}`, Origin: "https://www.kretopia.com" }, body: JSON.stringify(body) }));
const fetchedUrls = () => world.fetch.mock.calls.map(([u]) => String(u));

beforeEach(() => {
  vi.stubGlobal("crypto", webcrypto);
  world.user = "member-1";
  world.dns = {};
  world.rpc.mockReset();
  world.rpc.mockResolvedValue({ data: [{ allowed: true, used: 1, cap: 100 }], error: null });
  world.fetch.mockReset();
  vi.stubGlobal("fetch", world.fetch);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

// ─── the shared policy, for bodies that are not text ────────────────────────────────────────────────────────────────────────
describe("safeFetchBytes: the same policy for a voice note as for a page", () => {
  const dns = async (host: string) => (host === "storage.public.test" ? ["93.184.216.34"] : host === "rebind.test" ? ["10.0.0.7"] : ["93.184.216.34"]);
  const res = (body: BodyInit | null, init: ResponseInit & { headers?: Record<string, string> } = {}) => new Response(body, { status: 200, headers: { "content-type": "audio/webm" }, ...init });
  const policy = { allowedHosts: ["storage.public.test"], allowedMime: ["audio/"], maxBytes: 1000, maxRedirects: 0 } as const;
  const fetched = (r: Response) => ({ fetch: (async () => r) as unknown as typeof fetch, resolveDns: dns });
  const refused = async (url: string, code: string, p: Record<string, unknown> = policy) => {
    const f = vi.fn();
    await expect(safeFetchBytes(url, p, { fetch: f as unknown as typeof fetch, resolveDns: dns })).rejects.toMatchObject({ code });
    expect(f).not.toHaveBeenCalled(); // refused before any request left
  };

  it("returns the bytes of an allowed file", async () => {
    const out = await safeFetchBytes("https://storage.public.test/a.webm", policy, fetched(res(new Uint8Array([1, 2, 3]))));
    expect([...out.bytes]).toEqual([1, 2, 3]);
    expect(out.contentType).toBe("audio/webm");
  });

  it("refuses every address a server must not call, before a request leaves", async () => {
    const open = { allowedMime: ["audio/"], maxBytes: 1000 };
    await refused("https://127.0.0.1/a.webm", "blocked_address", open);
    await refused("https://10.0.0.5/a.webm", "blocked_address", open);
    await refused("https://192.168.1.10/a.webm", "blocked_address", open);
    await refused("https://172.20.0.1/a.webm", "blocked_address", open);
    await refused("https://169.254.169.254/latest/meta-data/", "blocked_address", open);
    await refused("https://[::1]/a.webm", "blocked_address", open);
    await refused("https://[::ffff:127.0.0.1]/a.webm", "blocked_address", open);
    await refused("https://[fd00::1]/a.webm", "blocked_address", open);
    await refused("https://localhost/a.webm", "blocked_host", open);
    await refused("https://metadata.google.internal/computeMetadata/v1/", "blocked_host", open);
    await refused("https://service.internal/a.webm", "blocked_host", open);
    await refused("https://printer.local/a.webm", "blocked_host", open);
    await refused("https://rebind.test/a.webm", "blocked_address", open); // a name that resolves to a private address
  });

  it("refuses other schemes, credentials, ports and addresses that are not on the allowlist", async () => {
    await refused("http://storage.public.test/a.webm", "scheme");
    await refused("ftp://storage.public.test/a.webm", "scheme");
    await refused("file:///etc/passwd", "scheme");
    await refused("https://user:pw@storage.public.test/a.webm", "credentials");
    await refused("https://storage.public.test:8443/a.webm", "port");
    await refused("https://storage.public.test:22/a.webm", "port");
    await refused("https://other.public.test/a.webm", "host_not_approved");
    await refused("not a url", "bad_url");
  });

  it("re-checks every redirect: a hop to an internal address is refused and the next request never leaves", async () => {
    const f = vi.fn().mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "https://169.254.169.254/latest/meta-data/" } }));
    await expect(safeFetchBytes("https://storage.public.test/a.webm", { ...policy, maxRedirects: 2 }, { fetch: f as unknown as typeof fetch, resolveDns: dns })).rejects.toMatchObject({ code: "blocked_address" });
    expect(f).toHaveBeenCalledTimes(1);
    const g = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: "https://storage.public.test/b.webm" } }));
    await expect(safeFetchBytes("https://storage.public.test/a.webm", policy, { fetch: g as unknown as typeof fetch, resolveDns: dns })).rejects.toMatchObject({ code: "redirects" });
  });

  it("refuses a type that is not allowed and a body that is too large, by header or by streaming", async () => {
    await expect(safeFetchBytes("https://storage.public.test/a", policy, fetched(res("<html>", { headers: { "content-type": "text/html" } })))).rejects.toMatchObject({ code: "mime" });
    await expect(safeFetchBytes("https://storage.public.test/a", policy, fetched(res("x", { headers: { "content-type": "audio/webm", "content-length": "5000" } })))).rejects.toMatchObject({ code: "too_large" });
    await expect(safeFetchBytes("https://storage.public.test/a", policy, fetched(res(new Uint8Array(2000))))).rejects.toMatchObject({ code: "too_large" });
    expect(new FetchPolicyError("mime", "x")).toBeInstanceOf(Error);
  });
});

// ─── extract-event-details ─────────────────────────────────────────────────────────────────────────────────────────────────
describe("extract-event-details: a member's event link", () => {
  const bad = [
    "http://169.254.169.254/latest/meta-data/iam/security-credentials/",
    "https://169.254.169.254/latest/meta-data/",
    "https://localhost/admin",
    "https://127.0.0.1:443/",
    "https://10.0.0.5/internal",
    "https://[::1]/",
    "https://metadata.google.internal/computeMetadata/v1/",
    "https://user:password@example.com/event",
    "https://example.com:8443/event",
    "ftp://example.com/event",
    "file:///etc/passwd",
    "javascript:alert(1)",
    "not a url",
  ];
  for (const source_url of bad) {
    it(`refuses ${source_url} before any request leaves, including to the scraper and the model`, async () => {
      expect((await call("extract-event-details", { source_url, extract_only: true })).status).toBe(400);
      expect(world.fetch).not.toHaveBeenCalled();
    });
  }

  it("refuses a name that resolves to a private address", async () => {
    world.dns["sneaky.example.com"] = ["10.1.2.3"];
    expect((await call("extract-event-details", { source_url: "https://sneaky.example.com/event", extract_only: true })).status).toBe(400);
    expect(world.fetch).not.toHaveBeenCalled();
  });

  it("refuses a link that is not text, or longer than any real address", async () => {
    expect((await call("extract-event-details", { source_url: 42, extract_only: true })).status).toBe(400);
    expect((await call("extract-event-details", { source_url: { href: "https://example.com" }, extract_only: true })).status).toBe(400);
    expect((await call("extract-event-details", { source_url: `https://example.com/${"a".repeat(2100)}`, extract_only: true })).status).toBe(400);
    expect(world.fetch).not.toHaveBeenCalled();
  });

  it("refuses a redirect to an internal address and sends nothing there", async () => {
    world.fetch.mockResolvedValue(new Response(null, { status: 302, headers: { location: "https://169.254.169.254/latest/meta-data/" } }));
    expect((await call("extract-event-details", { source_url: "https://example.com/event", extract_only: true })).status).toBe(400);
    expect(fetchedUrls()).toEqual(["https://example.com/event"]);
  });

  it("fetches a public https page once, without following redirects by itself", async () => {
    world.fetch.mockImplementation(async (url: string) =>
      String(url).startsWith("https://example.com/")
        ? new Response("<html><body>Friday 12 Dec 8:00 pm, Studio B</body></html>", { status: 200, headers: { "content-type": "text/html; charset=utf-8" } })
        : new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), { status: 200 }));
    const res = await call("extract-event-details", { source_url: "https://example.com/event", extract_only: true });
    expect(res.status).not.toBe(400);
    expect(fetchedUrls()[0]).toBe("https://example.com/event");
    expect((world.fetch.mock.calls[0][1] as RequestInit).redirect).toBe("manual");
  });
});

// ─── transcribe-voice-note ─────────────────────────────────────────────────────────────────────────────────────────────────
describe("transcribe-voice-note: whose message, which file", () => {
  const MSG = "11111111-1111-4111-8111-111111111111";
  const STORED = "https://backend.test/storage/v1/object/public/voice/note.webm";
  const seed = (over: Record<string, unknown> = {}, table: "messages" | "project_messages" = "messages") =>
    new MemoryDb().seed(table, [
      table === "messages"
        ? { id: MSG, sender_id: "member-1", receiver_id: "member-2", attachment_url: STORED, attachment_type: "voice", voice_note_transcript: null, ...over }
        : { id: MSG, user_id: "member-1", project_id: "p1", voice_url: STORED, voice_transcript: null, ...over },
    ]);
  const audio = () => new Response(new Uint8Array([1, 2, 3, 4]), { status: 200, headers: { "content-type": "audio/webm" } });
  const ai = (text = "hello team") => new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), { status: 200 });
  const wire = () => world.fetch.mockImplementation(async (url: string) => (String(url).includes("/storage/") ? audio() : ai()));
  const transcribe = (extra: Record<string, unknown> = {}) => call("transcribe-voice-note", { message_id: MSG, audio_url: "https://169.254.169.254/latest/meta-data/", ...extra });
  const none = () => {
    expect(world.fetch).not.toHaveBeenCalled();
    expect((world.db as MemoryDb).log.filter((l) => l.op === "update")).toHaveLength(0);
  };

  it("transcribes the file the message points to, ignores the address in the request, and writes the text once", async () => {
    const db = (world.db = seed()) as MemoryDb;
    wire();
    const res = await transcribe();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, transcript: "hello team" });
    expect(fetchedUrls()).toEqual([STORED, "https://ai.gateway.lovable.dev/v1/chat/completions"]); // never the address the request carried
    expect(db.rows("messages")[0].voice_note_transcript).toBe("hello team");
  });

  it("does it again for nobody: a message already transcribed costs nothing", async () => {
    const db = (world.db = seed({ voice_note_transcript: "done" })) as MemoryDb;
    const res = await transcribe();
    expect(await res.json()).toEqual({ success: true, transcript: "done", already: true });
    none();
    expect(db.rows("messages")[0].voice_note_transcript).toBe("done");
  });

  it("treats a silent note ('') as done too", async () => {
    world.db = seed({ voice_note_transcript: "" });
    expect((await (await transcribe()).json()).already).toBe(true);
    none();
  });

  it("answers a member who did not send the message exactly like a missing message, touching nothing", async () => {
    world.db = seed({ sender_id: "someone-else" });
    const stranger = await transcribe();
    world.db = seed();
    const missing = await call("transcribe-voice-note", { message_id: "99999999-9999-4999-8999-999999999999" });
    expect(stranger.status).toBe(404);
    expect(await stranger.json()).toEqual(await missing.json());
    world.db = seed({ sender_id: "someone-else" });
    await transcribe();
    none();
  });

  it("refuses a message that is not a voice note, or has no file", async () => {
    world.db = seed({ attachment_type: "image" });
    expect((await transcribe()).status).toBe(422);
    world.db = seed({ attachment_url: null });
    expect((await transcribe()).status).toBe(422);
    none();
  });

  it("refuses a stored address that is not our storage: a member can store any text in their own message", async () => {
    for (const attachment_url of [
      "https://evil.test/a.webm",
      "http://backend.test/storage/v1/object/public/voice/a.webm",
      "https://backend.test/not-storage/a.webm",
      "https://backend.test@evil.test/storage/v1/object/public/a.webm",
      "https://backend.test:8443/storage/v1/object/public/a.webm",
      "https://169.254.169.254/storage/v1/object/public/a.webm",
      "file:///etc/passwd",
    ]) {
      world.db = seed({ attachment_url });
      expect((await transcribe()).status).toBe(422);
    }
    none();
  });

  it("refuses a file that is too large or not audio, without calling the model", async () => {
    world.db = seed();
    world.fetch.mockResolvedValue(new Response("x", { status: 200, headers: { "content-type": "audio/webm", "content-length": "50000000" } }));
    expect((await transcribe()).status).toBe(413);
    world.fetch.mockResolvedValue(new Response("<html>", { status: 200, headers: { "content-type": "text/html" } }));
    expect((await transcribe()).status).toBe(422);
    expect(fetchedUrls().every((u) => u.includes("/storage/"))).toBe(true); // the model was never reached
    expect((world.db as MemoryDb).log.filter((l) => l.op === "update")).toHaveLength(0);
  });

  it("does not follow a redirect from our storage to somewhere else", async () => {
    world.db = seed();
    world.fetch.mockResolvedValue(new Response(null, { status: 302, headers: { location: "https://169.254.169.254/latest/meta-data/" } }));
    expect((await transcribe()).status).toBe(422);
    expect(fetchedUrls()).toEqual([STORED]);
  });

  it("works for a project message, on its own columns, and only for its author", async () => {
    const db = (world.db = seed({}, "project_messages")) as MemoryDb;
    wire();
    expect((await transcribe({ table: "project_messages" })).status).toBe(200);
    expect(db.rows("project_messages")[0].voice_transcript).toBe("hello team");
    world.db = seed({ user_id: "someone-else" }, "project_messages");
    expect((await transcribe({ table: "project_messages" })).status).toBe(404);
  });

  it("refuses a table that is not on the list by falling back to direct messages, never to a free table name", async () => {
    world.db = seed();
    wire();
    expect((await transcribe({ table: "profiles" })).status).toBe(200);
    expect((world.db as MemoryDb).log.every((l) => l.table === "messages")).toBe(true);
  });

  it("refuses a message id that is not an id, and a session that does not verify", async () => {
    world.db = seed();
    for (const message_id of ["abc", "", 5, null, `${MSG}' or '1'='1`]) expect((await call("transcribe-voice-note", { message_id })).status).toBe(400);
    world.user = null;
    expect((await transcribe()).status).toBe(401);
    none();
  });

  it("never overwrites a transcript that appeared while the model was working", async () => {
    const db = (world.db = seed()) as MemoryDb;
    world.fetch.mockImplementation(async (url: string) => {
      if (String(url).includes("/storage/")) return audio();
      db.rows("messages")[0].voice_note_transcript = "written by a concurrent request";
      return ai("second");
    });
    expect((await transcribe()).status).toBe(200);
    expect(db.rows("messages")[0].voice_note_transcript).toBe("written by a concurrent request");
  });
});

describe("voice note rules", () => {
  it("maps only the two known tables", () => {
    expect(voiceTableFor("project_messages").table).toBe("project_messages");
    for (const bad of [undefined, null, "profiles", "__proto__", "constructor", 5, {}]) expect(voiceTableFor(bad)).toBe(VOICE_TABLES.messages);
  });
  it("accepts only our own storage addresses", () => {
    const hosts = storageHosts("https://backend.test", "https://account.test", "not a url", null);
    expect(hosts).toEqual(["backend.test", "account.test"]);
    expect(isOwnStorageUrl("https://account.test/storage/v1/object/sign/x.webm?token=1", hosts)).toBe(true);
    expect(isOwnStorageUrl("https://account.test.evil.test/storage/v1/object/x", hosts)).toBe(false);
    expect(isOwnStorageUrl("", hosts)).toBe(false);
  });
  it("gives the stranger the missing-message answer", () => {
    expect(decideVoiceNote(VOICE_TABLES.messages, { sender_id: "a", attachment_type: "voice", attachment_url: "u", voice_note_transcript: null }, "b")).toEqual({ ok: false, status: 404, error: "Message not found" });
    expect(decideVoiceNote(VOICE_TABLES.messages, null, "b")).toEqual({ ok: false, status: 404, error: "Message not found" });
  });
});

// ─── send-push-notification ────────────────────────────────────────────────────────────────────────────────────────────────
describe("send-push-notification: the push endpoint", () => {
  it("accepts a browser vendor's push service and nothing else", () => {
    for (const ok of [
      "https://fcm.googleapis.com/fcm/send/abc",
      "https://updates.push.services.mozilla.com/wpush/v2/abc",
      "https://web.push.apple.com/QZ12",
      "https://wns2-par02p.notify.windows.com/w/?token=abc",
    ]) expect(isAllowedPushEndpoint(ok)).toBe(true);
    for (const bad of [
      "http://fcm.googleapis.com/fcm/send/abc",
      "https://169.254.169.254/latest/meta-data/",
      "https://localhost/push",
      "https://10.0.0.5/push",
      "https://fcm.googleapis.com.evil.test/fcm/send/abc",
      "https://evil.test/fcm.googleapis.com",
      "https://user:pw@fcm.googleapis.com/fcm/send/abc",
      "https://fcm.googleapis.com:8443/fcm/send/abc",
      "https://push.apple.com/x",
      "https://evilpush.apple.com.evil.test/x",
      "ftp://fcm.googleapis.com/x",
      "", "not a url", null, undefined, 5, `https://fcm.googleapis.com/${"a".repeat(2100)}`,
    ]) expect(isAllowedPushEndpoint(bad)).toBe(false);
  });

  it("is checked before the request is signed or sent, and never follows a redirect", () => {
    const src = readFileSync(resolve(__dirname, "../../../../supabase/functions/send-push-notification/index.ts"), "utf8");
    const check = src.indexOf("isAllowedPushEndpoint(sub.endpoint)");
    expect(check).toBeGreaterThan(-1);
    expect(check).toBeLessThan(src.indexOf("await createVapidAuthHeader("));
    expect(check).toBeLessThan(src.indexOf("await fetch(sub.endpoint"));
    expect(src).toContain('redirect: "manual"');
  });
});
