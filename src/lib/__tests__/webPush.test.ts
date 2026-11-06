import { webcrypto } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  MAX_PUSH_PLAINTEXT_BYTES,
  base64UrlToBytes,
  buildPushMessage,
  bytesToBase64Url,
  classifyPushStatus,
  createVapidAuthHeader,
  encryptWebPushPayload,
  pushTopic,
  safePushUrl,
} from "../../../supabase/functions/_shared/webPush";

// jsdom has no WebCrypto; the edge runtime and every browser do. Node's is the same API.
beforeAll(() => {
  vi.stubGlobal("crypto", webcrypto);
});
afterAll(() => {
  vi.unstubAllGlobals();
});

const decoder = new TextDecoder();
const ecdh = { name: "ECDH", namedCurve: "P-256" } as const;
const text = (bytes: Uint8Array) => decoder.decode(bytes);

// The worked example of RFC 8291, Appendix A (https://www.rfc-editor.org/rfc/rfc8291#appendix-A), values copied verbatim.
const RFC = {
  plaintext: "V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24",
  asPublic: "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
  asPrivate: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
  uaPublic: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  uaPrivate: "q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94",
  salt: "DGv6ra1nlYgDCS1FRnbzlw",
  authSecret: "BTBZMqHH6r4Tts7J_aSIgg",
  header:
    "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
  ciphertext: "8pfeW0KbunFT06SuDKoJH9Ql87S1QUrdirN6GcG7sFz1y1sqLgVi1VhjVkHsUoEsbI_0LpXMuGvnzQ",
};

async function p256Keys(publicB64: string, privateB64: string): Promise<CryptoKeyPair> {
  const pub = base64UrlToBytes(publicB64);
  const publicKey = await webcrypto.subtle.importKey("raw", pub, ecdh, true, []);
  const privateKey = await webcrypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", x: bytesToBase64Url(pub.slice(1, 33)), y: bytesToBase64Url(pub.slice(33)), d: privateB64 },
    ecdh,
    true,
    ["deriveBits"],
  );
  return { publicKey, privateKey } as CryptoKeyPair;
}

/** The browser's side (RFC 8291, section 4): what a subscription does with a message it receives. */
async function decryptAsBrowser(body: Uint8Array, ua: CryptoKeyPair, authSecret: Uint8Array): Promise<Uint8Array> {
  const salt = body.slice(0, 16);
  const recordSize = new DataView(body.buffer, body.byteOffset + 16, 4).getUint32(0);
  const idLength = body[20];
  const asPublic = body.slice(21, 21 + idLength);
  const ciphertext = body.slice(21 + idLength);
  expect(recordSize).toBe(4096);
  expect(ciphertext.length).toBeLessThanOrEqual(recordSize);

  const uaPublic = new Uint8Array(await webcrypto.subtle.exportKey("raw", ua.publicKey));
  const senderKey = await webcrypto.subtle.importKey("raw", asPublic, ecdh, false, []);
  const secret = new Uint8Array(await webcrypto.subtle.deriveBits({ name: "ECDH", public: senderKey }, ua.privateKey, 256));
  const derive = async (salt0: Uint8Array, ikm: Uint8Array, info: Uint8Array, bytes: number) =>
    new Uint8Array(
      await webcrypto.subtle.deriveBits(
        { name: "HKDF", hash: "SHA-256", salt: salt0, info },
        await webcrypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]),
        bytes * 8,
      ),
    );
  const enc = new TextEncoder();
  const keyInfo = new Uint8Array([...enc.encode("WebPush: info\0"), ...uaPublic, ...asPublic]);
  const ikm = await derive(authSecret, secret, keyInfo, 32);
  const cek = await derive(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await derive(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const key = await webcrypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);
  const record = new Uint8Array(await webcrypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, key, ciphertext));
  expect(record[record.length - 1]).toBe(0x02); // the delimiter of the last record
  return record.slice(0, -1);
}

describe("payload encryption (RFC 8291)", () => {
  it("reproduces the RFC's worked example byte for byte", async () => {
    const body = await encryptWebPushPayload(
      base64UrlToBytes(RFC.plaintext),
      { p256dh: RFC.uaPublic, auth: RFC.authSecret },
      { salt: base64UrlToBytes(RFC.salt), senderKeys: await p256Keys(RFC.asPublic, RFC.asPrivate) },
    );
    const header = base64UrlToBytes(RFC.header);
    const expected = new Uint8Array([...header, ...base64UrlToBytes(RFC.ciphertext)]);
    expect(header.length).toBe(86);
    expect(body).toEqual(expected);
  });

  it("is readable by the subscribing browser, and only by it", async () => {
    const browser = await webcrypto.subtle.generateKey(ecdh, true, ["deriveBits"]);
    const stranger = await webcrypto.subtle.generateKey(ecdh, true, ["deriveBits"]);
    const authSecret = webcrypto.getRandomValues(new Uint8Array(16));
    const subscription = {
      p256dh: bytesToBase64Url(new Uint8Array(await webcrypto.subtle.exportKey("raw", browser.publicKey))),
      auth: bytesToBase64Url(authSecret),
    };
    const message = JSON.stringify({ title: "Alex asked you to co-sign a credit", url: "/credit-verify?token=abc" });
    const body = await encryptWebPushPayload(new TextEncoder().encode(message), subscription);

    expect(text(await decryptAsBrowser(body, browser, authSecret))).toBe(message);
    // Neither another browser's key nor a wrong auth secret opens it.
    await expect(decryptAsBrowser(body, stranger, authSecret)).rejects.toThrow();
    await expect(decryptAsBrowser(body, browser, webcrypto.getRandomValues(new Uint8Array(16)))).rejects.toThrow();
    // The plaintext is not in the body (the old function sent it as is).
    expect(text(body)).not.toContain("co-sign");
  });

  it("accepts the keys as the app stores them (plain base64 with padding) and as base64url", async () => {
    const standard = (b64url: string) => {
      const bytes = base64UrlToBytes(b64url);
      return Buffer.from(bytes).toString("base64");
    };
    const options = { salt: base64UrlToBytes(RFC.salt), senderKeys: await p256Keys(RFC.asPublic, RFC.asPrivate) };
    const a = await encryptWebPushPayload(base64UrlToBytes(RFC.plaintext), { p256dh: RFC.uaPublic, auth: RFC.authSecret }, options);
    const b = await encryptWebPushPayload(
      base64UrlToBytes(RFC.plaintext),
      { p256dh: standard(RFC.uaPublic), auth: standard(RFC.authSecret) },
      options,
    );
    expect(b).toEqual(a);
  });

  it("refuses a malformed subscription and an oversized message instead of sending something unreadable", async () => {
    const good = { p256dh: RFC.uaPublic, auth: RFC.authSecret };
    await expect(encryptWebPushPayload(new Uint8Array(3), { ...good, p256dh: "AAAA" })).rejects.toThrow(/p256dh/);
    await expect(encryptWebPushPayload(new Uint8Array(3), { ...good, auth: "AAAA" })).rejects.toThrow(/auth/);
    await expect(encryptWebPushPayload(new Uint8Array(MAX_PUSH_PLAINTEXT_BYTES + 1), good)).rejects.toThrow(/too large/);
    // The largest allowed message still fits one 4096-byte body.
    const body = await encryptWebPushPayload(new Uint8Array(MAX_PUSH_PLAINTEXT_BYTES), good);
    expect(body.length).toBe(4096);
  });
});

describe("VAPID (RFC 8292)", () => {
  it("signs a token the push service can verify with the public key, scoped to its origin and under a day", async () => {
    const pair = (await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
    const publicRaw = new Uint8Array(await webcrypto.subtle.exportKey("raw", pair.publicKey));
    const jwk = await webcrypto.subtle.exportKey("jwk", pair.privateKey);
    const now = Date.UTC(2026, 10, 6, 12, 0, 0);

    const { authorization } = await createVapidAuthHeader(
      "https://fcm.googleapis.com/fcm/send/abc",
      bytesToBase64Url(publicRaw),
      jwk.d as string,
      "noreply@kretopia.com",
      now,
    );
    const match = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(authorization);
    expect(match).not.toBeNull();
    const [, head, claims, signature, k] = match!;
    expect(k).toBe(bytesToBase64Url(publicRaw));
    expect(JSON.parse(text(base64UrlToBytes(head)))).toEqual({ typ: "JWT", alg: "ES256" });
    const parsed = JSON.parse(text(base64UrlToBytes(claims)));
    expect(parsed.aud).toBe("https://fcm.googleapis.com");
    expect(parsed.sub).toBe("mailto:noreply@kretopia.com");
    expect(parsed.exp - Math.floor(now / 1000)).toBeLessThanOrEqual(24 * 60 * 60);

    const sig = base64UrlToBytes(signature);
    expect(sig.length).toBe(64); // raw r||s, not DER
    const valid = await webcrypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      pair.publicKey,
      sig,
      new TextEncoder().encode(`${head}.${claims}`),
    );
    expect(valid).toBe(true);
  });

  it("refuses a public key that is not an uncompressed P-256 point", async () => {
    await expect(createVapidAuthHeader("https://fcm.googleapis.com/x", "AAAA", "AAAA", "mailto:a@b.co")).rejects.toThrow(/VAPID public key/);
  });
});

describe("what a notification carries", () => {
  it("keeps a deep link inside the app and drops everything a device should not receive", () => {
    expect(safePushUrl("/credit-verify?token=abc")).toBe("/credit-verify?token=abc");
    for (const bad of ["https://evil.test/x", "//evil.test", "/\\evil.test", "javascript:alert(1)", "credit-verify", "/a\nb", 5, null, undefined]) {
      expect(safePushUrl(bad)).toBe("/");
    }
    const message = buildPushMessage({
      title: "  Alex\nasked you ",
      body: "x".repeat(400),
      tag: "cosign:1",
      data: { link: "/messages?user=u1", type: "message", email: "secret@example.com", token: "secret" },
    });
    expect(message.title).toBe("Alex asked you");
    expect(message.body.length).toBeLessThanOrEqual(160);
    expect(message.url).toBe("/messages?user=u1");
    expect(Object.keys(message).sort()).toEqual(["body", "tag", "title", "type", "url"]);
    expect(JSON.stringify(message)).not.toContain("secret");
  });

  it("falls back to a readable notification when the caller sent nothing usable", () => {
    expect(buildPushMessage({})).toEqual({ title: "Kretopia", body: "You have a new notification", url: "/", tag: undefined, type: undefined });
  });

  it("derives a topic a push service accepts (at most 32 URL-safe characters), the same for the same tag", async () => {
    const a = await pushTopic("cosign:request-1");
    expect(a).toMatch(/^[A-Za-z0-9_-]{1,32}$/);
    expect(await pushTopic("cosign:request-1")).toBe(a);
    expect(await pushTopic("cosign:request-2")).not.toBe(a);
    expect(await pushTopic(undefined)).toBeUndefined();
  });

  it("drops a subscription only when the push service says it is gone", () => {
    expect(classifyPushStatus(201)).toBe("delivered");
    expect(classifyPushStatus(410)).toBe("gone");
    expect(classifyPushStatus(404)).toBe("gone");
    expect(classifyPushStatus(429)).toBe("retry");
    expect(classifyPushStatus(503)).toBe("retry");
    // A rejected sender (a VAPID key that does not match) must never delete members' subscriptions.
    expect(classifyPushStatus(401)).toBe("rejected");
    expect(classifyPushStatus(403)).toBe("rejected");
  });
});
