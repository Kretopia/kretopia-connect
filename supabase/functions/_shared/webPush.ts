// Web Push for edge functions: payload encryption (RFC 8291, the "aes128gcm" content coding of RFC 8188) and VAPID signing
// (RFC 8292). WebCrypto only, no dependency. Pure: imported by send-push-notification (Deno) and by tests (Vite/Node).
//
// Why: send-push-notification used to POST the notification as plain JSON while announcing "Content-Encoding: aes128gcm", and it
// never read the subscription's p256dh/auth keys. A push service forwards the body untouched and the browser decrypts it with
// those keys, so a plain body can never be read: no browser ever showed a notification. The keys a browser reports when it
// subscribes are what make a message readable by that browser alone, and they have to be used.

const encoder = new TextEncoder();

/** Accepts both base64 and base64url (the app stores the browser's keys as plain base64), with or without padding. */
export function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** HKDF-SHA-256 (RFC 5869): extract with `salt`, expand with `info`, return `length` bytes. */
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, length * 8));
}

/** What a browser reports when it subscribes (PushSubscription.getKey): its public key and a 16-byte authentication secret. */
export interface PushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

/** Test seam: RFC 8291 gives a worked example with a fixed salt and sender key. Production never passes this. */
export interface EncryptOverrides {
  salt?: Uint8Array;
  senderKeys?: CryptoKeyPair;
}

/** One record of 4096 bytes minus the 86-byte header and 17 bytes of delimiter and tag (RFC 8291, section 4). */
export const MAX_PUSH_PLAINTEXT_BYTES = 3993;

const RECORD_SIZE = 4096;

/**
 * Encrypts one push message for one subscription and returns the request body: the RFC 8188 header (salt, record size,
 * sender public key) followed by the single AES-128-GCM record. Send it with `Content-Encoding: aes128gcm`.
 */
export async function encryptWebPushPayload(
  plaintext: Uint8Array,
  subscription: PushSubscriptionKeys,
  overrides: EncryptOverrides = {},
): Promise<Uint8Array> {
  const uaPublic = base64UrlToBytes(subscription.p256dh);
  const authSecret = base64UrlToBytes(subscription.auth);
  if (uaPublic.length !== 65 || uaPublic[0] !== 0x04) throw new Error("push subscription p256dh is not an uncompressed P-256 key");
  if (authSecret.length !== 16) throw new Error("push subscription auth secret must be 16 bytes");
  if (plaintext.length > MAX_PUSH_PLAINTEXT_BYTES) throw new Error("push payload is too large");

  const salt = overrides.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const senderKeys =
    overrides.senderKeys ?? ((await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", senderKeys.publicKey));

  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, senderKeys.privateKey, 256));

  // RFC 8291, section 3.4: combine the shared secret with the subscription's auth secret, bound to both public keys.
  const keyInfo = concat(encoder.encode("WebPush: info\0"), uaPublic, asPublic);
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32);

  // RFC 8188, section 2.2 and 2.3: the content-encryption key and the nonce come from the salt.
  const cek = await hkdf(salt, ikm, encoder.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, encoder.encode("Content-Encoding: nonce\0"), 12);

  // A single, final record: the message followed by the 0x02 delimiter.
  const record = concat(plaintext, new Uint8Array([0x02]));
  const aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, record));

  const header = concat(salt, new Uint8Array([0, 0, RECORD_SIZE >> 8, RECORD_SIZE & 0xff, asPublic.length]), asPublic);
  return concat(header, ciphertext);
}

// ─── VAPID (RFC 8292) ──────────────────────────────────────────────────────────

export interface VapidAuth {
  authorization: string;
}

/**
 * The Authorization header that proves the request comes from the application server the browser subscribed to: a short-lived
 * ES256 token for the push service's origin, plus the public key. `vapidPrivateKey` is the 32-byte P-256 scalar, base64url.
 */
export async function createVapidAuthHeader(
  endpoint: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  subject: string,
  now: number = Date.now(),
): Promise<VapidAuth> {
  const publicBytes = base64UrlToBytes(vapidPublicKey);
  if (publicBytes.length !== 65 || publicBytes[0] !== 0x04) throw new Error("VAPID public key must be an uncompressed P-256 key");

  const header = bytesToBase64Url(encoder.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = bytesToBase64Url(
    encoder.encode(
      JSON.stringify({
        aud: new URL(endpoint).origin,
        exp: Math.floor(now / 1000) + 12 * 60 * 60, // under the 24 hours a push service accepts
        sub: /^(mailto:|https:)/i.test(subject) ? subject : `mailto:${subject}`,
      }),
    ),
  );
  const unsigned = `${header}.${claims}`;

  const key = await crypto.subtle.importKey(
    "jwk",
    {
      kty: "EC",
      crv: "P-256",
      x: bytesToBase64Url(publicBytes.slice(1, 33)),
      y: bytesToBase64Url(publicBytes.slice(33, 65)),
      d: bytesToBase64Url(base64UrlToBytes(vapidPrivateKey)),
    },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  // WebCrypto already returns the raw r||s form a JWS ES256 signature uses; no DER conversion is needed.
  const signature = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, encoder.encode(unsigned)));
  return { authorization: `vapid t=${unsigned}.${bytesToBase64Url(signature)}, k=${bytesToBase64Url(publicBytes)}` };
}

// ─── What a notification carries ────────────────────────────────────────────────

/** The whole payload a device receives: enough to show a notification and open the right page, nothing else. */
export interface PushMessage {
  title: string;
  body: string;
  url: string;
  tag?: string;
  type?: string;
}

export interface PushInput {
  title?: unknown;
  body?: unknown;
  tag?: unknown;
  url?: unknown;
  data?: unknown;
}

function clean(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  // eslint-disable-next-line no-control-regex
  const text = value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** A notification may only open a page of this app: a relative path. Anything that could leave the site becomes the home page. */
export function safePushUrl(value: unknown): string {
  if (typeof value !== "string") return "/";
  const url = value.trim();
  // eslint-disable-next-line no-control-regex
  if (!url.startsWith("/") || url.startsWith("//") || url.length > 500 || /[\u0000-\u001f\u007f\\]/.test(url)) return "/";
  return url;
}

/**
 * Builds the payload from what a caller sent. Caller-supplied `data` is never forwarded as is: only a deep link and a short type
 * survive, so a notification cannot smuggle ids, tokens or markup to the device, and lengths stay a lock screen's size.
 */
export function buildPushMessage(input: PushInput): PushMessage {
  const data = input.data && typeof input.data === "object" ? (input.data as Record<string, unknown>) : {};
  return {
    title: clean(input.title, 80) || "Kretopia",
    body: clean(input.body, 160) || "You have a new notification",
    url: safePushUrl(input.url ?? data.url ?? data.link),
    tag: clean(input.tag, 64) || undefined,
    type: clean(data.type, 32) || undefined,
  };
}

/**
 * A push service keeps one undelivered message per topic and replaces it when the same topic arrives again (RFC 8030, section
 * 5.4), so a request sent twice reaches a phone that was off once. The topic is a URL-safe string of at most 32 characters.
 */
export async function pushTopic(tag: string | undefined): Promise<string | undefined> {
  if (!tag) return undefined;
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(tag)));
  return bytesToBase64Url(digest).slice(0, 32);
}

export type PushOutcome = "delivered" | "gone" | "retry" | "rejected";

/** 404 and 410 mean the browser no longer has the subscription (RFC 8030, section 7.3): it is dropped. 401/403 are not. */
export function classifyPushStatus(status: number): PushOutcome {
  if (status >= 200 && status < 300) return "delivered";
  if (status === 404 || status === 410) return "gone";
  if (status === 429 || status >= 500) return "retry";
  return "rejected";
}
