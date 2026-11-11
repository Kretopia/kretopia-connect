import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { eventIdFromUrl, isEventId, isPassToken, passPageUrl, passQrData, passQrImageUrl } from "../../../supabase/functions/_shared/passLink";
import { buildPassUrl, isPublicUrl, parsePassToken } from "@/lib/publicLink";

/**
 * The pass QR inside the confirmation and reminder emails. It is drawn by a server function from what the email template hands it, so
 * these tests cover the rule both share (_shared/passLink.ts) and check that the templates and the function actually use it.
 */
const EVENT = "7f3c2a1e-5b6d-4c8f-9a0b-1c2d3e4f5a6b";
const TOKEN = "255ec7525f6ed8a3c3b584859cad351e"; // the shape of a real check-in token: 32 hex characters
const BASE = "https://backend.example.com";
const root = join(__dirname, "..", "..", "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("what the emailed pass QR carries", () => {
  it("is an absolute public link to the pass page, never the bare token, when the event is known", () => {
    const data = passQrData(TOKEN, EVENT)!;
    expect(data).toBe(`https://www.kretopia.com/event/${EVENT}/pass?token=${TOKEN}`);
    expect(isPublicUrl(data)).toBe(true);
    expect(data).not.toBe(TOKEN);
    expect(/^[0-9a-f]{16,}$/i.test(data)).toBe(false);
  });

  it("is the same address the app's pass card encodes, so one scanner rule reads both", () => {
    expect(passQrData(TOKEN, EVENT)).toBe(buildPassUrl(EVENT, TOKEN));
    expect(passPageUrl(EVENT, TOKEN)).toBe(buildPassUrl(EVENT, TOKEN));
    // …and the check-in desk gets the token back out of it.
    expect(parsePassToken(passQrData(TOKEN, EVENT))).toBe(TOKEN);
  });

  it("keeps the token alone only for a request with no event id: the image address in emails already sent", () => {
    expect(passQrData(TOKEN)).toBe(TOKEN);
    expect(passQrData(TOKEN, null)).toBe(TOKEN);
    expect(passQrData(TOKEN, "")).toBe(TOKEN);
  });

  it("draws nothing for anything that is not a pass token, or for an event id that is not one", () => {
    expect(passQrData("https://evil.example.com/phish", EVENT)).toBeNull();
    expect(passQrData("short", EVENT)).toBeNull();
    expect(passQrData(undefined, EVENT)).toBeNull();
    expect(passQrData(TOKEN, "not-an-event")).toBeNull();
    expect(passQrData(TOKEN, "../../admin")).toBeNull();
    expect(passQrData(TOKEN, `${EVENT}/pass?token=x`)).toBeNull();
  });

  it("can only ever point at the public site: the link is built from a token and an event id, never taken from the request", () => {
    for (const eventId of [EVENT, EVENT.toUpperCase()]) {
      const url = new URL(passQrData(TOKEN, eventId)!);
      expect(url.origin).toBe("https://www.kretopia.com");
      expect(url.pathname).toBe(`/event/${EVENT}/pass`);
      expect([...url.searchParams.keys()]).toEqual(["token"]);
    }
  });
});

describe("the QR image address an email points at", () => {
  it("carries the token and the event, so the function can draw the pass link", () => {
    expect(passQrImageUrl(BASE, TOKEN, EVENT)).toBe(`${BASE}/functions/v1/event-pass-qr?t=${TOKEN}&e=${EVENT}`);
  });

  it("falls back to the token alone when the event is not known, and to no image when there is no valid token", () => {
    expect(passQrImageUrl(BASE, TOKEN)).toBe(`${BASE}/functions/v1/event-pass-qr?t=${TOKEN}`);
    expect(passQrImageUrl(BASE, TOKEN, "123")).toBe(`${BASE}/functions/v1/event-pass-qr?t=${TOKEN}`);
    expect(passQrImageUrl(BASE, "nope", EVENT)).toBeNull();
    expect(passQrImageUrl(BASE, null, EVENT)).toBeNull();
  });

  it("finds the event id in the event address the senders put in the email", () => {
    expect(eventIdFromUrl(`https://www.kretopia.com/event/${EVENT}`)).toBe(EVENT);
    expect(eventIdFromUrl(`https://www.kretopia.com/event/${EVENT}/pass?token=${TOKEN}`)).toBe(EVENT);
    expect(eventIdFromUrl(`https://preview.example.com/event/${EVENT}?ref=x#top`)).toBe(EVENT);
    expect(eventIdFromUrl("https://www.kretopia.com/event/123")).toBeNull();
    expect(eventIdFromUrl("https://www.kretopia.com/")).toBeNull();
    expect(eventIdFromUrl(undefined)).toBeNull();
  });

  it("recognises real tokens and event ids, and nothing else", () => {
    expect(isPassToken(TOKEN)).toBe(true);
    expect(isPassToken(`${TOKEN}&e=x`)).toBe(false);
    expect(isEventId(EVENT)).toBe(true);
    expect(isEventId("e1")).toBe(false);
  });
});

describe("the emails and the function use that rule (a static check: these files run on the server, not in the app)", () => {
  it("both templates give the QR the event id, so new emails carry the link", () => {
    for (const template of ["event-registration-confirmation.tsx", "event-reminder.tsx"]) {
      const source = read(`supabase/functions/_shared/transactional-email-templates/${template}`);
      const tags = source.match(/<PassQr\b[^>]*>/g) ?? [];
      expect(tags.length, template).toBeGreaterThan(0);
      for (const tag of tags) expect(tag, template).toMatch(/eventId=\{eventIdFromUrl\(eventUrl\)\}/);
    }
  });

  it("the email kit builds the image address from the shared rule, with the event id", () => {
    const kit = read("supabase/functions/_shared/email-kit.tsx");
    expect(kit).toMatch(/passQrImageUrl\(FUNCTIONS_BASE, token, eventId\)/);
    expect(kit).toMatch(/passQrUrl\(token, eventId\)/);
  });

  it("the function draws what the shared rule gives it, not the request's token directly", () => {
    const fn = read("supabase/functions/event-pass-qr/index.ts");
    expect(fn).toMatch(/const data = passQrData\(token, params\.get\('e'\)\)/);
    expect(fn).toMatch(/renderPassQr\(data, /);
    expect(fn).not.toMatch(/renderPassQr\(token\b/);
  });

  it("every sender of these emails gives the template the event's address", () => {
    expect(read("src/utils/eventConfirmationEmail.ts")).toMatch(/eventUrl: `https:\/\/www\.kretopia\.com\/event\/\$\{eventId\}`/);
    expect(read("src/components/sessions/GuestRsvpDialog.tsx")).toMatch(/eventUrl: `\$\{APP_URL\}\/event\/\$\{eventId\}`/);
    expect(read("supabase/functions/send-event-reminders/index.ts")).toMatch(/eventUrl: `https:\/\/www\.kretopia\.com\/event\/\$\{event\.id\}`/);
  });
});
