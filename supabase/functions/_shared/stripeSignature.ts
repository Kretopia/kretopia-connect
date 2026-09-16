// Pure, runtime-agnostic Stripe webhook signature verification + event dedupe
// helpers. Uses only Web Crypto so it runs identically in Deno (edge functions)
// and in the Vitest/Node test runner.
//
// This module is intentionally side-effect free: it never talks to Stripe, never
// reads secrets from the environment, and never mutates database state. It exists
// so webhook signature behaviour can be tested deterministically offline while
// Stripe Dashboard access is blocked.

export type VerifyResult =
  | { ok: true; timestamp: number; payload: unknown }
  | { ok: false; reason: VerifyFailure };

export type VerifyFailure =
  | "missing_signature_header"
  | "malformed_signature_header"
  | "timestamp_outside_tolerance"
  | "signature_mismatch"
  | "invalid_json";

const encoder = new TextEncoder();

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Computes the Stripe v1 HMAC-SHA256 signature for `${timestamp}.${rawBody}`. */
export async function computeSignature(
  rawBody: string,
  timestamp: number,
  secret: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${rawBody}`));
  return toHex(sig);
}

/** Builds a `Stripe-Signature` header value. Test/fixture helper only. */
export async function buildSignatureHeader(
  rawBody: string,
  secret: string,
  timestamp: number = Math.floor(Date.now() / 1000),
): Promise<string> {
  const v1 = await computeSignature(rawBody, timestamp, secret);
  return `t=${timestamp},v1=${v1}`;
}

export function parseSignatureHeader(
  header: string | null,
): { timestamp: number; signatures: string[] } | null {
  if (!header) return null;
  let timestamp: number | null = null;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [k, v] = part.split("=", 2);
    if (!k || !v) continue;
    if (k.trim() === "t") {
      const n = Number(v.trim());
      if (Number.isFinite(n)) timestamp = n;
    } else if (k.trim() === "v1") {
      signatures.push(v.trim());
    }
  }
  if (timestamp === null || signatures.length === 0) return null;
  return { timestamp, signatures };
}

/**
 * Verifies a raw request body against a `Stripe-Signature` header.
 * Fails closed: every failure path returns ok:false and never parses/returns a payload.
 */
export async function verifyStripeSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  toleranceSeconds = 300,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<VerifyResult> {
  if (!header) return { ok: false, reason: "missing_signature_header" };
  const parsed = parseSignatureHeader(header);
  if (!parsed) return { ok: false, reason: "malformed_signature_header" };

  if (Math.abs(nowSeconds - parsed.timestamp) > toleranceSeconds) {
    return { ok: false, reason: "timestamp_outside_tolerance" };
  }

  const expected = await computeSignature(rawBody, parsed.timestamp, secret);
  const matched = parsed.signatures.some((s) => timingSafeEqual(s, expected));
  if (!matched) return { ok: false, reason: "signature_mismatch" };

  try {
    return { ok: true, timestamp: parsed.timestamp, payload: JSON.parse(rawBody) };
  } catch {
    return { ok: false, reason: "invalid_json" };
  }
}

/**
 * In-memory model of the `stripe_webhook_events` unique-key dedupe used by the
 * live handlers. Returns true when the event has already been recorded.
 */
export class EventLedger {
  private seen = new Map<string, { type: string; recordedAt: number }>();

  /** @returns true when this is a NEW event (should be processed). */
  record(eventId: string, type: string, at: number = Date.now()): boolean {
    if (this.seen.has(eventId)) return false;
    this.seen.set(eventId, { type, recordedAt: at });
    return true;
  }

  has(eventId: string): boolean {
    return this.seen.has(eventId);
  }

  get size(): number {
    return this.seen.size;
  }
}
