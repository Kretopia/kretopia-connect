// Runs the real send-push-notification handler against a fake push service. What it proves: a notification leaves the server
// as an encrypted Web Push request that the subscribing browser (and only it) can read, carrying a deep link into the app,
// to every device of the member once, and a subscription is dropped only when the push service says it is gone.
// Nothing leaves the machine: fetch is a stand-in for the browser vendor's push service, and the database is in memory.
import { webcrypto } from "node:crypto";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryDb } from "./memoryDb";

const world = vi.hoisted(() => ({
  handler: null as null | ((req: Request) => Promise<Response>),
  db: null as unknown,
  verifiedUser: null as string | null,
  fetch: vi.fn(),
}));

vi.mock("https://deno.land/std@0.190.0/http/server.ts", () => ({ serve: (h: (req: Request) => Promise<Response>) => { world.handler = h; } }));
vi.mock("https://esm.sh/@supabase/supabase-js@2.57.2", () => ({
  createClient: () => ({
    auth: { getUser: async () => (world.verifiedUser ? { data: { user: { id: world.verifiedUser } }, error: null } : { data: { user: null }, error: { message: "bad token" } }) },
    from: (table: string) => (world.db as MemoryDb).from(table),
  }),
}));

const env: Record<string, string> = {
  SUPABASE_URL: "https://backend.test",
  SUPABASE_SERVICE_ROLE_KEY: "service-key",
  SUPABASE_ANON_KEY: "anon-key",
  VAPID_SUBJECT: "mailto:noreply@kretopia.com",
};

const b64url = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64url");
const ecdh = { name: "ECDH", namedCurve: "P-256" } as const;
const enc = new TextEncoder();

type Device = { id: string; endpoint: string; keys: CryptoKeyPair; authSecret: Uint8Array; row: Record<string, unknown> };

/** A browser's subscription: its own key pair and auth secret, stored the way the app stores them (plain base64). */
async function device(id: string, endpoint: string, userId = "member-1"): Promise<Device> {
  const keys = (await webcrypto.subtle.generateKey(ecdh, true, ["deriveBits"])) as CryptoKeyPair;
  const authSecret = webcrypto.getRandomValues(new Uint8Array(16));
  const p256dh = Buffer.from(new Uint8Array(await webcrypto.subtle.exportKey("raw", keys.publicKey))).toString("base64");
  return { id, endpoint, keys, authSecret, row: { id, user_id: userId, endpoint, p256dh, auth: Buffer.from(authSecret).toString("base64") } };
}

/** What the browser does with a request body it received from the push service (RFC 8291, section 4). */
async function readAsBrowser(body: Uint8Array, d: Device): Promise<string> {
  const salt = body.slice(0, 16);
  const idLength = body[20];
  const asPublic = body.slice(21, 21 + idLength);
  const ciphertext = body.slice(21 + idLength);
  const uaPublic = new Uint8Array(await webcrypto.subtle.exportKey("raw", d.keys.publicKey));
  const secret = new Uint8Array(
    await webcrypto.subtle.deriveBits({ name: "ECDH", public: await webcrypto.subtle.importKey("raw", asPublic, ecdh, false, []) }, d.keys.privateKey, 256),
  );
  const derive = async (s: Uint8Array, ikm: Uint8Array, info: Uint8Array, bytes: number) =>
    new Uint8Array(
      await webcrypto.subtle.deriveBits(
        { name: "HKDF", hash: "SHA-256", salt: s, info },
        await webcrypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]),
        bytes * 8,
      ),
    );
  const ikm = await derive(d.authSecret, secret, new Uint8Array([...enc.encode("WebPush: info\0"), ...uaPublic, ...asPublic]), 32);
  const cek = await derive(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await derive(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const key = await webcrypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);
  const record = new Uint8Array(await webcrypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, key, ciphertext));
  return new TextDecoder().decode(record.slice(0, -1));
}

beforeAll(async () => {
  vi.stubGlobal("crypto", webcrypto);
  // jsdom's AbortSignal has no static timeout(), which Deno and every current runtime have. fetch is a stand-in here, so the
  // signal is never used; it only has to exist.
  if (!("timeout" in AbortSignal)) Object.defineProperty(AbortSignal, "timeout", { configurable: true, value: () => new AbortController().signal });
  const vapid = (await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  env.VAPID_PUBLIC_KEY = b64url(new Uint8Array(await webcrypto.subtle.exportKey("raw", vapid.publicKey)));
  env.VAPID_PRIVATE_KEY = (await webcrypto.subtle.exportKey("jwk", vapid.privateKey)).d as string;
  vi.stubGlobal("Deno", { serve: () => {}, env: { get: (k: string) => env[k] } });
  await import("../../../../supabase/functions/send-push-notification/index.ts");
});

const send = (body: unknown, token = "service-key") =>
  world.handler!(
    new Request("https://edge.test", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Origin: "https://www.kretopia.com", "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

const pushRequests = () => world.fetch.mock.calls as Array<[string, RequestInit & { headers: Record<string, string>; body: Uint8Array }]>;
const db = () => world.db as MemoryDb;

beforeEach(() => {
  vi.stubGlobal("crypto", webcrypto);
  world.db = new MemoryDb();
  world.verifiedUser = null;
  world.fetch.mockReset();
  world.fetch.mockResolvedValue(new Response(null, { status: 201 }));
  vi.stubGlobal("fetch", world.fetch);
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    if (process.env.PUSH_DEBUG) process.stdout.write(`[console.error] ${args.map(String).join(" ")}\n`);
  });
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("send-push-notification: what leaves the server", () => {
  it("sends an encrypted request to the browser's push service, readable by that browser, with a deep link and no private extras", async () => {
    const phone = await device("sub-1", "https://fcm.googleapis.com/fcm/send/abc");
    db().seed("push_subscriptions", [phone.row]);

    const res = await send({
      userId: "member-1",
      title: "New message from Alex",
      body: "Are you free on Friday?",
      tag: "message",
      data: { type: "message", link: "/messages?user=alex-1", email: "alex@example.com", token: "bearer-secret" },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, sent: 1, total: 1, removed: 0 });
    expect(pushRequests()).toHaveLength(1);
    const [url, init] = pushRequests()[0];
    expect(url).toBe("https://fcm.googleapis.com/fcm/send/abc");
    expect(init.method).toBe("POST");
    expect(init.redirect).toBe("manual");
    expect(init.headers["Content-Encoding"]).toBe("aes128gcm");
    expect(init.headers["Content-Type"]).toBe("application/octet-stream");
    expect(init.headers.TTL).toBe("86400");
    expect(init.headers.Urgency).toBe("high");
    expect(init.headers.Topic).toMatch(/^[A-Za-z0-9_-]{1,32}$/);
    expect(init.headers).not.toHaveProperty("Crypto-Key");
    expect(init.headers.Authorization).toBe(
      `vapid t=${init.headers.Authorization.slice(8, init.headers.Authorization.indexOf(", k="))}, k=${env.VAPID_PUBLIC_KEY}`,
    );

    // The body is bytes only the subscribing browser can open; the text is not in it.
    expect(init.body).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(init.body)).not.toContain("Alex");
    const message = JSON.parse(await readAsBrowser(init.body, phone));
    expect(message).toEqual({ title: "New message from Alex", body: "Are you free on Friday?", url: "/messages?user=alex-1", tag: "message", type: "message" });
    expect(JSON.stringify(message)).not.toMatch(/alex@example|bearer-secret/);
  });

  it("reaches every device of the member once, each with a message only that device can read", async () => {
    const phone = await device("sub-1", "https://fcm.googleapis.com/fcm/send/phone");
    const laptop = await device("sub-2", "https://updates.push.services.mozilla.com/wpush/v2/laptop");
    const other = await device("sub-3", "https://fcm.googleapis.com/fcm/send/not-mine", "member-2");
    db().seed("push_subscriptions", [phone.row, laptop.row, other.row]);

    const res = await send({ userId: "member-1", title: "Hi", body: "There" });
    expect(await res.json()).toMatchObject({ sent: 2, total: 2 });
    expect(pushRequests().map(([u]) => u).sort()).toEqual([phone.endpoint, laptop.endpoint].sort());
    const toPhone = pushRequests().find(([u]) => u === phone.endpoint)![1].body;
    expect(JSON.parse(await readAsBrowser(toPhone, phone)).title).toBe("Hi");
    await expect(readAsBrowser(toPhone, laptop)).rejects.toThrow();
  });

  it("sends once to an endpoint registered twice", async () => {
    const phone = await device("sub-1", "https://fcm.googleapis.com/fcm/send/abc");
    db().seed("push_subscriptions", [phone.row, { ...phone.row, id: "sub-1-again" }]);
    const res = await send({ userId: "member-1", title: "Hi", body: "There" });
    expect(await res.json()).toMatchObject({ sent: 1, total: 1 });
    expect(pushRequests()).toHaveLength(1);
  });

  it("never calls an address that is not a push service", async () => {
    const phone = await device("sub-1", "https://169.254.169.254/latest/meta-data/");
    db().seed("push_subscriptions", [phone.row]);
    const res = await send({ userId: "member-1", title: "Hi", body: "There" });
    expect(await res.json()).toMatchObject({ sent: 0, total: 1 });
    expect(pushRequests()).toHaveLength(0);
    expect(db().rows("push_subscriptions")).toHaveLength(1);
  });

  it("falls back to the home page for a link that would leave the app", async () => {
    const phone = await device("sub-1", "https://fcm.googleapis.com/fcm/send/abc");
    db().seed("push_subscriptions", [phone.row]);
    await send({ userId: "member-1", title: "Hi", body: "There", data: { link: "https://evil.test/phish" } });
    expect(JSON.parse(await readAsBrowser(pushRequests()[0][1].body, phone)).url).toBe("/");
  });
});

describe("send-push-notification: expired and refused subscriptions", () => {
  it.each([410, 404])("drops a subscription the push service reports gone (%i)", async (status) => {
    const gone = await device("sub-gone", "https://fcm.googleapis.com/fcm/send/gone");
    const live = await device("sub-live", "https://fcm.googleapis.com/fcm/send/live");
    db().seed("push_subscriptions", [gone.row, live.row]);
    world.fetch.mockImplementation(async (u: string) => new Response("gone", { status: u.endsWith("/gone") ? status : 201 }));

    const res = await send({ userId: "member-1", title: "Hi", body: "There" });
    expect(await res.json()).toEqual({ success: true, sent: 1, total: 2, removed: 1 });
    expect(db().rows("push_subscriptions").map((r) => r.id)).toEqual(["sub-live"]);
  });

  it.each([401, 403, 429, 503])("keeps every subscription when the push service answers %i: the sender is at fault, not the device", async (status) => {
    const phone = await device("sub-1", "https://fcm.googleapis.com/fcm/send/abc");
    db().seed("push_subscriptions", [phone.row]);
    world.fetch.mockResolvedValue(new Response("nope", { status }));
    const res = await send({ userId: "member-1", title: "Hi", body: "There" });
    expect(await res.json()).toMatchObject({ sent: 0, total: 1, removed: 0 });
    expect(db().rows("push_subscriptions")).toHaveLength(1);
  });

  it("reports no subscriptions without calling anyone", async () => {
    const res = await send({ userId: "member-1", title: "Hi", body: "There" });
    expect(await res.json()).toEqual({ success: false, message: "No subscriptions" });
    expect(pushRequests()).toHaveLength(0);
  });
});

describe("send-push-notification: who may call it", () => {
  it("answers 401 to a caller with no token or a token the auth server does not know, and sends nothing", async () => {
    const phone = await device("sub-1", "https://fcm.googleapis.com/fcm/send/abc");
    db().seed("push_subscriptions", [phone.row]);
    const anonymous = await world.handler!(new Request("https://edge.test", { method: "POST", body: JSON.stringify({ userId: "member-1" }) }));
    expect(anonymous.status).toBe(401);
    world.verifiedUser = null;
    expect((await send({ userId: "member-1", title: "Hi", body: "There" }, "forged-token")).status).toBe(401);
    expect(pushRequests()).toHaveLength(0);
  });

  it("lets a signed-in member notify their own devices", async () => {
    const phone = await device("sub-1", "https://fcm.googleapis.com/fcm/send/abc");
    db().seed("push_subscriptions", [phone.row]);
    world.verifiedUser = "member-1";
    const res = await send({ userId: "member-1", title: "Hi", body: "There" }, "member-token");
    expect(await res.json()).toMatchObject({ sent: 1 });
  });

  it("refuses a malformed body with 400, and a missing VAPID configuration with 500, without sending", async () => {
    expect((await send("{not json")).status).toBe(400);
    expect((await send({ title: "no user" })).status).toBe(400);
    const saved = env.VAPID_PRIVATE_KEY;
    delete env.VAPID_PRIVATE_KEY;
    try {
      expect((await send({ userId: "member-1", title: "Hi", body: "There" })).status).toBe(500);
    } finally {
      env.VAPID_PRIVATE_KEY = saved;
    }
    expect(pushRequests()).toHaveLength(0);
  });
});
