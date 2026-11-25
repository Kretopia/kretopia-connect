// Runs the real rsvp-curated-stage: registering for a scheduled Stage queues one confirmation email through
// send-transactional-email (service role, recipient resolved from the user id), a repeat RSVP sends nothing and keeps a spot the
// person already holds, a full Stage gives a waitlist email (no spot promised), waitlist -> spot sends again, a failed email never
// fails the registration, and a private Stage's link keeps the invite the person used.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryDb } from "./memoryDb";
import { formatStageStartUtc, shouldSendRegistrationEmail, stageRegistrationTemplateData } from "../../../../supabase/functions/_shared/stageRegistrationEmail";

const world = vi.hoisted(() => ({
  handler: null as null | ((req: Request) => Promise<Response>),
  db: null as unknown,
  user: null as null | { id: string; email: string; user_metadata: Record<string, unknown> },
  emails: [] as Array<{ url: string; auth: string | null; body: { idempotencyKey: string; templateData: Record<string, string> } & Record<string, unknown> }>,
  emailStatus: 200,
}));

vi.mock("https://deno.land/std@0.190.0/http/server.ts", () => ({ serve: (h: (req: Request) => Promise<Response>) => { world.handler = h; } }));
vi.mock("https://esm.sh/@supabase/supabase-js@2.57.2", () => ({
  createClient: () => ({
    from: (t: string) => (world.db as MemoryDb).from(t),
    auth: { getUser: async () => ({ data: { user: world.user }, error: null }) },
  }),
}));

const env: Record<string, string> = { SUPABASE_URL: "https://legacy.test", SUPABASE_SERVICE_ROLE_KEY: "service-key", SUPABASE_ANON_KEY: "anon-key" };
const STAGE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const stage = (over: Record<string, unknown> = {}) => ({
  id: STAGE, title: "Night Shoot Showcase", starts_at: "2026-12-17T20:00:00Z", ends_at: "2026-12-17T21:30:00Z", status: "scheduled",
  capacity: 2, is_paid: false, rsvp_count: 0, visibility: "public", invite_token: null, host_user_id: "host-1", ...over,
});

beforeAll(async () => {
  vi.stubGlobal("Deno", { env: { get: (k: string) => env[k] } });
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    world.emails.push({ url: String(url), auth: new Headers(init.headers).get("Authorization"), body: JSON.parse(String(init.body)) });
    return new Response("{}", { status: world.emailStatus });
  }));
  // Deno has AbortSignal.timeout; jsdom does not.
  if (typeof AbortSignal.timeout !== "function") (AbortSignal as unknown as { timeout: () => AbortSignal }).timeout = () => new AbortController().signal;
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  await import("../../../../supabase/functions/rsvp-curated-stage/index.ts");
});
afterAll(() => vi.unstubAllGlobals());

beforeEach(() => {
  world.db = new MemoryDb()
    .seed("curated_stages", [stage()])
    .seed("profiles", [{ user_id: "host-1", full_name: "Ana Lima" }]);
  world.user = { id: "fan-1", email: "fan@example.com", user_metadata: { full_name: "Dee" } };
  world.emails = [];
  world.emailStatus = 200;
});

const rsvp = (body: Record<string, unknown> = {}) =>
  world.handler!(new Request("https://edge.test", { method: "POST", headers: { Authorization: "Bearer user-token", "Content-Type": "application/json" }, body: JSON.stringify({ stage_id: STAGE, ...body }) }));
const db = () => world.db as MemoryDb;

describe("Stage registration confirmation", () => {
  it("a new registration queues one confirmation for that person, as the service, with the Stage's facts", async () => {
    const res = await rsvp();
    expect(await res.json()).toMatchObject({ status: "rsvp" });
    expect(world.emails).toHaveLength(1);
    const [email] = world.emails;
    expect(email.url).toBe("https://legacy.test/functions/v1/send-transactional-email");
    expect(email.auth).toBe("Bearer service-key");
    expect(email.body).toMatchObject({
      templateName: "curated-stage-registration-confirmation",
      recipientUserId: "fan-1",
      idempotencyKey: `stage-registration:${STAGE}:fan-1:rsvp`,
      templateData: { stageTitle: "Night Shoot Showcase", status: "rsvp", hostName: "Ana Lima", attendeeName: "Dee", stageUrl: `https://www.kretopia.com/circle/stage/${STAGE}` },
    });
    expect(email.body.templateData.startsWhen).toMatch(/17 Dec 2026.*20:00 UTC/);
    expect(email.body.templateData.googleCalendarUrl).toContain("dates=20261217T200000Z/20261217T213000Z");
  });

  it("a repeat RSVP sends nothing and keeps the spot, even when the Stage is now full", async () => {
    db().seed("curated_stage_rsvps", [{ stage_id: STAGE, user_id: "fan-1", status: "rsvp" }]);
    await db().from("curated_stages").update({ rsvp_count: 2 }).eq("id", STAGE);
    const res = await rsvp();
    expect(await res.json()).toMatchObject({ status: "rsvp" });
    expect(world.emails).toHaveLength(0);
  });

  it("a full Stage gives a waitlist place and a waitlist email; a later spot sends again", async () => {
    await db().from("curated_stages").update({ rsvp_count: 2 }).eq("id", STAGE);
    expect(await (await rsvp()).json()).toMatchObject({ status: "waitlist" });
    expect(world.emails.at(-1)!.body).toMatchObject({ idempotencyKey: `stage-registration:${STAGE}:fan-1:waitlist`, templateData: { status: "waitlist" } });
    await db().from("curated_stages").update({ rsvp_count: 1 }).eq("id", STAGE);
    expect(await (await rsvp()).json()).toMatchObject({ status: "rsvp" });
    expect(world.emails).toHaveLength(2);
    expect(world.emails[1].body.idempotencyKey).toBe(`stage-registration:${STAGE}:fan-1:rsvp`);
  });

  it("a failed email never fails the registration", async () => {
    world.emailStatus = 500;
    const res = await rsvp();
    expect(res.status).toBe(200);
    expect(db().rows("curated_stage_rsvps")).toEqual([expect.objectContaining({ user_id: "fan-1", status: "rsvp" })]);
  });

  it("a private Stage without an invite is refused and sends nothing; with the invite, the link keeps it", async () => {
    await db().from("curated_stages").update({ visibility: "private", invite_token: "door-1" }).eq("id", STAGE);
    expect((await rsvp()).status).toBe(403);
    expect(world.emails).toHaveLength(0);
    expect((await rsvp({ invite_token: "door-1" })).status).toBe(200);
    expect(world.emails[0].body.templateData.stageUrl).toBe(`https://www.kretopia.com/circle/stage/${STAGE}?invite=door-1`);
  });

  it("a refused registration sends nothing (paid Stage, ended Stage, signed out)", async () => {
    await db().from("curated_stages").update({ is_paid: true }).eq("id", STAGE);
    expect((await rsvp()).status).toBe(402);
    await db().from("curated_stages").update({ is_paid: false, status: "ended" }).eq("id", STAGE);
    expect((await rsvp()).status).toBe(400);
    world.user = null;
    expect((await rsvp()).status).toBe(401);
    expect(world.emails).toHaveLength(0);
  });
});

describe("email content rules", () => {
  it("sends only for a new or changed state", () => {
    expect(shouldSendRegistrationEmail(null, "rsvp")).toBe(true);
    expect(shouldSendRegistrationEmail("waitlist", "rsvp")).toBe(true);
    expect(shouldSendRegistrationEmail("rsvp", "rsvp")).toBe(false);
  });

  it("a private Stage's link keeps the person's invite; a public one never carries a token", () => {
    const base = { id: STAGE, title: "T", starts_at: "2026-12-17T20:00:00Z" };
    expect(stageRegistrationTemplateData({ stage: { ...base, visibility: "private" }, status: "rsvp", inviteToken: "tok en" }).stageUrl).toBe(`https://www.kretopia.com/circle/stage/${STAGE}?invite=tok%20en`);
    expect(stageRegistrationTemplateData({ stage: { ...base, visibility: "public" }, status: "rsvp", inviteToken: "tok" }).stageUrl).toBe(`https://www.kretopia.com/circle/stage/${STAGE}`);
  });

  it("states the time in UTC and survives a bad date", () => {
    expect(formatStageStartUtc("2026-12-17T20:00:00Z")).toBe("Thu 17 Dec 2026, 20:00 UTC");
    expect(formatStageStartUtc("not a date")).toBe("See the Stage page");
  });
});
