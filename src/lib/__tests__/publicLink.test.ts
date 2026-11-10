import { describe, expect, it } from "vitest";
import { APP_URL } from "@/lib/constants";
import { buildPassUrl, buildShareData, isPublicUrl, parsePassToken, publicUrl } from "../publicLink";

// What the CPO's phone showed after scanning an Event pass: a bare check-in token.
const TOKEN = "255ec7525f6ed8a3c3b584859cad351e";
const EVENT_ID = "9b2f6a1e-3c4d-4e5f-8a7b-1c2d3e4f5a6b";

describe("publicUrl: what a QR code or a share sheet may carry", () => {
  it("accepts an absolute https link on a public host", () => {
    for (const url of [`${APP_URL}/event/${EVENT_ID}`, `${APP_URL}/share/event/${EVENT_ID}/?ref=ada`, `${APP_URL}/profile/${EVENT_ID}`, "https://www.kretopia.com/join/ABC123"]) {
      expect(publicUrl(url), url).toBe(new URL(url).href);
    }
  });

  it("refuses a bare id, hash, uuid or token, which is only text to a phone's camera", () => {
    for (const bare of [TOKEN, EVENT_ID, TOKEN.toUpperCase(), "ABC123", "9b2f6a1e3c4d4e5f8a7b1c2d3e4f5a6b", ""]) {
      expect(publicUrl(bare), bare).toBeUndefined();
      expect(isPublicUrl(bare), bare).toBe(false);
    }
  });

  it("refuses a relative path, http, a host nobody else can reach, and unsafe schemes", () => {
    for (const bad of [`/event/${EVENT_ID}`, `event/${EVENT_ID}`, `http://www.kretopia.com/event/${EVENT_ID}`, "https://localhost:5173/event/x", "https://127.0.0.1/event/x", "https://192.168.1.20/event/x", "https://printer.local/x", "https://intranet/x", "javascript:alert(1)", "mailto:a@b.co", "data:text/plain,hi"]) {
      expect(publicUrl(bad), bad).toBeUndefined();
    }
  });

  it("refuses null, undefined and non-strings", () => {
    expect(publicUrl(null)).toBeUndefined();
    expect(publicUrl(undefined)).toBeUndefined();
  });
});

describe("buildPassUrl and parsePassToken: the pass is a link, and the desk can still read it", () => {
  it("the pass link is absolute, public, on the pass page of that event, and is not the token alone", () => {
    const url = buildPassUrl(EVENT_ID, TOKEN);
    expect(url).toBe(`${APP_URL}/event/${EVENT_ID}/pass?token=${TOKEN}`);
    expect(url).not.toBe(TOKEN);
    expect(isPublicUrl(url)).toBe(true);
    expect(new URL(url).searchParams.get("token")).toBe(TOKEN);
  });

  it("carries nothing but the token: no name, no email", () => {
    expect([...new URL(buildPassUrl(EVENT_ID, TOKEN)).searchParams.keys()]).toEqual(["token"]);
  });

  it("encodes what needs encoding", () => {
    const url = buildPassUrl("a b", "t&k=1");
    expect(new URL(url).pathname).toBe("/event/a%20b/pass");
    expect(new URL(url).searchParams.get("token")).toBe("t&k=1");
  });

  it("reads the token out of a scanned pass link", () => {
    expect(parsePassToken(buildPassUrl(EVENT_ID, TOKEN))).toBe(TOKEN);
    expect(parsePassToken(`  ${buildPassUrl(EVENT_ID, TOKEN)}  `)).toBe(TOKEN);
    expect(parsePassToken(`${APP_URL}/event/${EVENT_ID}/pass?name=Ari&token=${TOKEN}`)).toBe(TOKEN);
  });

  it("still reads a bare token, so passes issued before the code carried a link keep working", () => {
    expect(parsePassToken(TOKEN)).toBe(TOKEN);
    expect(parsePassToken(`  ${TOKEN}\n`)).toBe(TOKEN);
  });

  it("leaves a link without a token as it is, so it is refused as an invalid pass rather than guessed at", () => {
    expect(parsePassToken(`${APP_URL}/event/${EVENT_ID}`)).toBe(`${APP_URL}/event/${EVENT_ID}`);
    expect(parsePassToken("")).toBe("");
    expect(parsePassToken(undefined)).toBe("");
  });
});

describe("buildShareData: the link as the link, with a message for people", () => {
  const url = `${APP_URL}/share/event/${EVENT_ID}/`;

  it("returns the absolute URL and a short human message that does not repeat it", () => {
    const data = buildShareData({ title: "Studio Night", message: `Check this out: "Studio Night".\n\n📅 Thu\n\n${url}`, url });
    expect(data).toEqual({ title: "Studio Night", text: 'Check this out: "Studio Night".\n\n📅 Thu', url });
    expect(data!.text).not.toContain(url);
  });

  it("never shares a raw identifier as the message: it falls back to the title", () => {
    expect(buildShareData({ title: "Studio Night", message: TOKEN, url })!.text).toBe("Studio Night");
    expect(buildShareData({ title: "Studio Night", message: EVENT_ID, url })!.text).toBe("Studio Night");
    expect(buildShareData({ title: "Studio Night", message: "", url })!.text).toBe("Studio Night");
    expect(buildShareData({ title: "Studio Night", url })!.text).toBe("Studio Night");
  });

  it("refuses to build a share for something that is not a public URL, so the caller copies instead", () => {
    expect(buildShareData({ title: "Studio Night", message: "hi", url: TOKEN })).toBeNull();
    expect(buildShareData({ title: "Studio Night", message: "hi", url: `/event/${EVENT_ID}` })).toBeNull();
    expect(buildShareData({ title: "Studio Night", message: "hi", url: "https://localhost:8080/event/x" })).toBeNull();
  });
});
