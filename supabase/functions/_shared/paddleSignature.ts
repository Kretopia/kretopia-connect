// Paddle Billing webhook signature verification. Pure, Web Crypto only: it runs the same in Deno (edge functions) and in
// Vitest, never reads the environment and never talks to Paddle.
//
// Paddle signs `${ts}:${rawBody}` with HMAC-SHA256 under the endpoint's secret key and sends
//   Paddle-Signature: ts=1671552777;h1=<hex>[;h1=<hex>]
// (a second h1 appears while a secret is being rotated). The RAW body must be verified before it is parsed: re-serialised JSON
// does not reproduce the signed bytes.

export type PaddleVerifyFailure =
  | "missing_signature_header"
  | "malformed_signature_header"
  | "timestamp_outside_tolerance"
  | "signature_mismatch"
  | "invalid_json";

export type PaddleVerifyResult =
  | { ok: true; timestamp: number; payload: unknown }
  | { ok: false; reason: PaddleVerifyFailure };

const encoder = new TextEncoder();

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const toHex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");

export async function computePaddleSignature(rawBody: string, timestamp: number, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}:${rawBody}`)));
}

/** Builds a header the way Paddle does. For tests and local fixtures only. */
export async function buildPaddleSignatureHeader(rawBody: string, secret: string, timestamp: number): Promise<string> {
  return `ts=${timestamp};h1=${await computePaddleSignature(rawBody, timestamp, secret)}`;
}

function parseHeader(header: string): { ts: number; h1: string[] } | null {
  let ts: number | null = null;
  const h1: string[] = [];
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 1) return null;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    if (k === "ts" && /^\d{1,12}$/.test(v)) ts = Number(v);
    else if (k === "h1" && /^[0-9a-f]{64}$/i.test(v)) h1.push(v.toLowerCase());
  }
  return ts === null || h1.length === 0 ? null : { ts, h1 };
}

/**
 * Fails closed: an empty secret, a missing or malformed header, a stale timestamp or any mismatch is a rejection, and the body is
 * only parsed after the signature held. `nowSeconds` is injectable so replay tolerance is testable.
 */
export async function verifyPaddleSignature(
  rawBody: string,
  header: string | null | undefined,
  secret: string,
  toleranceSeconds = 300,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<PaddleVerifyResult> {
  if (!header) return { ok: false, reason: "missing_signature_header" };
  if (!secret) return { ok: false, reason: "signature_mismatch" };
  const parsed = parseHeader(header);
  if (!parsed) return { ok: false, reason: "malformed_signature_header" };
  if (Math.abs(nowSeconds - parsed.ts) > toleranceSeconds) return { ok: false, reason: "timestamp_outside_tolerance" };
  const expected = await computePaddleSignature(rawBody, parsed.ts, secret);
  if (!parsed.h1.some((candidate) => timingSafeEqual(candidate, expected))) return { ok: false, reason: "signature_mismatch" };
  try {
    return { ok: true, timestamp: parsed.ts, payload: JSON.parse(rawBody) };
  } catch {
    return { ok: false, reason: "invalid_json" };
  }
}

// ── Checkout binding ───────────────────────────────────────────────────────────────────────────────────────────────
// The user id travels to Paddle in the transaction's custom_data and comes back on the webhook. A browser that opens Paddle.js on
// its own could put any user id there, so the id is only trusted together with a tag only the server can produce: an HMAC of the
// id under the webhook secret. Without a valid tag the event is not attributed to anyone.

const bindingMessage = (userId: string) => `kretopia-checkout:${userId}`;

export async function signCheckoutBinding(userId: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(bindingMessage(userId))));
}

export async function verifyCheckoutBinding(userId: unknown, tag: unknown, secret: string): Promise<boolean> {
  if (typeof userId !== "string" || typeof tag !== "string" || !secret) return false;
  return timingSafeEqual(tag.toLowerCase(), await signCheckoutBinding(userId, secret));
}
