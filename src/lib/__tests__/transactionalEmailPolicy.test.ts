import { describe, expect, it } from "vitest";
import {
  authorizeTransactionalSend,
  idFromUrl,
  safeAppUrl,
  type EmailPolicyDeps,
} from "../../../supabase/functions/_shared/transactionalEmailPolicy";
import { bearerToken, identifyCaller, timingSafeEqualStr } from "../../../supabase/functions/_shared/callerAuth";

const EVENT = "11111111-1111-4111-8111-111111111111";
const OPP = "22222222-2222-4222-8222-222222222222";
const OWNER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const APPLICANT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const STRANGER = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function deps(over: Partial<EmailPolicyDeps> = {}): EmailPolicyDeps {
  return {
    recentSendCount: async () => 0,
    eventFacts: async (id) =>
      id === EVENT
        ? { id, title: "Real Event", start_time: "2026-11-02T22:00:00Z", venue_name: "The Hall", venue_address: "1 Main St" }
        : null,
    participantRegistered: async (e, u) => e === EVENT && u === APPLICANT,
    guestRsvpRecent: async (e, email) => e === EVENT && email === "guest@example.com",
    opportunityFacts: async (id) => (id === OPP ? { created_by: OWNER, title: "Real Gig" } : null),
    applicationExists: async (o, a) => o === OPP && a === APPLICANT,
    ...over,
  };
}

const anon = { kind: "anonymous" } as const;
const service = { kind: "service" } as const;
const applicant = { kind: "user", userId: APPLICANT, email: "me@example.com" } as const;
const owner = { kind: "user", userId: OWNER, email: "owner@example.com" } as const;

const rsvpInput = (over: Record<string, unknown> = {}) => ({
  templateName: "event-registration-confirmation",
  recipientEmail: "Guest@Example.com",
  templateData: {
    attendeeName: "Guest Person",
    eventTitle: "CLICK http://evil.example to claim a prize",
    eventUrl: `https://evil.example/event/${EVENT}`,
    passUrl: "https://evil.example/pass",
    checkInToken: "tok_abcdefgh1234",
    isGuest: true,
    ...over,
  },
});

describe("send-transactional-email policy", () => {
  it("lets other edge functions (service role) send anything unchanged", async () => {
    const data = { anything: "goes", eventTitle: "x" };
    const d = await authorizeTransactionalSend(service, { templateName: "welcome", recipientEmail: "a@b.co", templateData: data }, deps());
    expect(d).toEqual({ allow: true, templateData: data });
  });

  it("refuses templates the browser never sends (open relay closed)", async () => {
    for (const caller of [anon, applicant]) {
      const d = await authorizeTransactionalSend(caller, { templateName: "welcome", recipientEmail: "victim@example.com", templateData: {} }, deps());
      expect(d).toMatchObject({ allow: false, status: 403 });
    }
  });

  describe("event-registration-confirmation", () => {
    it("guest with a fresh RSVP: allowed, text re-read from the event, links pinned to our domain", async () => {
      const d = await authorizeTransactionalSend(anon, rsvpInput(), deps());
      expect(d.allow).toBe(true);
      if (!d.allow) return;
      expect(d.templateData.attendeeEmail).toBe("guest@example.com");
      expect(d.templateData.eventTitle).toBe("Real Event"); // not the injected text
      expect(d.templateData.eventUrl).toBe(`https://www.kretopia.com/event/${EVENT}`);
      expect(d.templateData.passUrl).toBeUndefined(); // evil.example dropped
      expect(d.templateData.eventVenue).toBe("The Hall, 1 Main St");
      expect(d.templateData.checkInToken).toBe("tok_abcdefgh1234");
      expect(String(d.templateData.eventDate)).toMatch(/2026/);
    });

    it("keeps a passUrl on our own domain", async () => {
      const d = await authorizeTransactionalSend(anon, rsvpInput({ passUrl: `https://www.kretopia.com/event/${EVENT}/pass?token=t` }), deps());
      expect(d.allow && d.templateData.passUrl).toBe(`https://www.kretopia.com/event/${EVENT}/pass?token=t`);
    });

    it("refuses an address that never RSVP'd (cannot email a victim)", async () => {
      const d = await authorizeTransactionalSend(anon, { ...rsvpInput(), recipientEmail: "victim@example.com" }, deps());
      expect(d).toMatchObject({ allow: false, status: 403 });
    });

    it("refuses an unknown event and a missing event reference", async () => {
      const other = "99999999-9999-4999-8999-999999999999";
      expect(await authorizeTransactionalSend(anon, rsvpInput({ eventUrl: `https://www.kretopia.com/event/${other}` }), deps())).toMatchObject({ allow: false, status: 404 });
      expect(await authorizeTransactionalSend(anon, rsvpInput({ eventUrl: "https://www.kretopia.com/" }), deps())).toMatchObject({ allow: false, status: 400 });
    });

    it("signed-in member: own address + registered participant is allowed", async () => {
      const d = await authorizeTransactionalSend(applicant, { ...rsvpInput({ isGuest: false, hasAccount: true }), recipientEmail: "me@example.com" }, deps());
      expect(d.allow).toBe(true);
    });

    it("signed-in member cannot email someone else's address without a guest RSVP for it", async () => {
      const d = await authorizeTransactionalSend(applicant, { ...rsvpInput(), recipientEmail: "someone@else.com" }, deps());
      expect(d).toMatchObject({ allow: false, status: 403 });
    });

    it("caps sends per recipient per hour", async () => {
      const d = await authorizeTransactionalSend(anon, rsvpInput(), deps({ recentSendCount: async () => 6 }));
      expect(d).toMatchObject({ allow: false, status: 429 });
    });

    it("fails closed when the lookups fail", async () => {
      const d = await authorizeTransactionalSend(anon, rsvpInput(), deps({ guestRsvpRecent: async () => false, participantRegistered: async () => false }));
      expect(d.allow).toBe(false);
    });
  });

  describe("hiring flow", () => {
    const gigUrl = `https://www.kretopia.com/opportunity/${OPP}`;

    it("application-confirmation: only to yourself, only after applying", async () => {
      const ok = await authorizeTransactionalSend(applicant, { templateName: "application-confirmation", recipientEmail: "me@example.com", templateData: { applicantName: "Me", gigUrl, gigTitle: "spoof" } }, deps());
      expect(ok.allow && ok.templateData.gigTitle).toBe("Real Gig");
      const other = await authorizeTransactionalSend(applicant, { templateName: "application-confirmation", recipientEmail: "victim@example.com", templateData: { gigUrl } }, deps());
      expect(other).toMatchObject({ allow: false, status: 403 });
      const never = await authorizeTransactionalSend({ kind: "user", userId: STRANGER, email: "s@example.com" }, { templateName: "application-confirmation", recipientEmail: "s@example.com", templateData: { gigUrl } }, deps());
      expect(never).toMatchObject({ allow: false, status: 403 });
      expect(await authorizeTransactionalSend(anon, { templateName: "application-confirmation", recipientEmail: "me@example.com", templateData: { gigUrl } }, deps())).toMatchObject({ allow: false, status: 401 });
    });

    it("new-applicant-notification: only to the opportunity owner, from someone who applied", async () => {
      const ok = await authorizeTransactionalSend(applicant, { templateName: "new-applicant-notification", recipientUserId: OWNER, templateData: { gigUrl, applicantName: "Me" } }, deps());
      expect(ok.allow).toBe(true);
      const wrong = await authorizeTransactionalSend(applicant, { templateName: "new-applicant-notification", recipientUserId: STRANGER, templateData: { gigUrl } }, deps());
      expect(wrong).toMatchObject({ allow: false, status: 403 });
    });

    it("application-status-update: owner only, to a real applicant, known status", async () => {
      const base = { templateName: "application-status-update", recipientUserId: APPLICANT, templateData: { gigUrl, status: "accepted", projectUrl: "https://evil.example/x" } };
      const ok = await authorizeTransactionalSend(owner, base, deps());
      expect(ok.allow && ok.templateData.projectUrl).toBeUndefined();
      expect(await authorizeTransactionalSend(applicant, base, deps())).toMatchObject({ allow: false, status: 403 });
      expect(await authorizeTransactionalSend(owner, { ...base, recipientUserId: STRANGER }, deps())).toMatchObject({ allow: false, status: 403 });
      expect(await authorizeTransactionalSend(owner, { ...base, templateData: { gigUrl, status: "hacked" } }, deps())).toMatchObject({ allow: false, status: 400 });
    });
  });
});

describe("link helpers", () => {
  it("safeAppUrl keeps only https links on our domains", () => {
    expect(safeAppUrl("https://www.kretopia.com/x")).toBe("https://www.kretopia.com/x");
    expect(safeAppUrl("https://thrivein.io/x")).toBe("https://thrivein.io/x");
    for (const bad of ["http://www.kretopia.com/x", "https://kretopia.com.evil.example/x", "https://evil.example/", "javascript:alert(1)", "//evil.example", "", undefined, 5]) {
      expect(safeAppUrl(bad)).toBeUndefined();
    }
  });

  it("idFromUrl extracts the uuid after the segment", () => {
    expect(idFromUrl("event", `https://www.kretopia.com/event/${EVENT}?x=1`)).toBe(EVENT);
    expect(idFromUrl("event", "https://www.kretopia.com/event/not-a-uuid")).toBeNull();
    expect(idFromUrl("opportunity", `https://www.kretopia.com/event/${EVENT}`)).toBeNull();
  });
});

describe("caller identification", () => {
  const req = (auth?: string) => new Request("https://x.test/fn", { headers: auth ? { Authorization: auth } : {} });
  const admin = (user: { id: string; email?: string } | null) => ({
    auth: { getUser: async () => ({ data: user ? { user } : { user: null }, error: user ? null : { message: "bad jwt" } }) },
  });

  it("the service-role key is service, compared exactly", async () => {
    expect(await identifyCaller(req("Bearer SERVICEKEY"), { serviceRoleKey: "SERVICEKEY", admin: admin(null) })).toEqual({ kind: "service" });
    expect((await identifyCaller(req("Bearer SERVICEKEY2"), { serviceRoleKey: "SERVICEKEY", admin: admin(null) })).kind).toBe("anonymous");
  });

  it("a verified session is a user; the public anon key and junk are anonymous", async () => {
    expect(await identifyCaller(req("Bearer usertoken"), { serviceRoleKey: "S", admin: admin({ id: APPLICANT, email: "me@example.com" }) }))
      .toEqual({ kind: "user", userId: APPLICANT, email: "me@example.com" });
    expect((await identifyCaller(req("Bearer anonkey"), { serviceRoleKey: "S", admin: admin(null) })).kind).toBe("anonymous");
    expect((await identifyCaller(req(), { serviceRoleKey: "S", admin: admin(null) })).kind).toBe("anonymous");
    expect((await identifyCaller(req("Bearer x"), { serviceRoleKey: "S", admin: { auth: { getUser: async () => { throw new Error("net"); } } } })).kind).toBe("anonymous");
  });

  it("never treats an empty service key as a match", async () => {
    expect((await identifyCaller(req("Bearer anything"), { serviceRoleKey: "", admin: admin(null) })).kind).toBe("anonymous");
  });

  it("timingSafeEqualStr and bearerToken", () => {
    expect(timingSafeEqualStr("abc", "abc")).toBe(true);
    expect(timingSafeEqualStr("abc", "abd")).toBe(false);
    expect(timingSafeEqualStr("abc", "abcd")).toBe(false);
    expect(bearerToken(req("Bearer t1"))).toBe("t1");
    expect(bearerToken(req("Basic t1"))).toBeNull();
  });
});
