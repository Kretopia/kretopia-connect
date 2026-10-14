// Pure rules for the phone verification code (send-phone-otp). Imported by edge
// functions (Deno) and by tests (Vite). The only dependency is Web Crypto.
//
// Why: the function sent a code to any number a signed-in user typed, with no
// limit, drew the code from Math.random, stored it in clear text, and let a
// code be guessed without limit for its ten minutes. That made it an SMS pump on
// our Twilio account, and made the public "phone verified" trust badge
// guessable.
//
// Rules, none of which needs a schema change (the code and its expiry already
// live in `phone_otp` and `phone_otp_expires_at`):
//   - a new code is refused for 60 seconds after the previous one was sent (the
//     send time is the expiry minus the ten minute lifetime);
//   - the code is drawn from the platform CSPRNG and stored as a salted hash
//     with an attempt counter: `v2:<attempts>:<sha256 hex>`; a pre-change plain
//     six-digit value is still accepted until it expires;
//   - five wrong guesses burn the code; the attempt is recorded before the guess
//     is evaluated, so parallel guesses cannot share one counter value.

export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;

const HASHED_RE = /^v2:(\d{1,2}):([0-9a-f]{64})$/;
const LEGACY_RE = /^\d{6}$/;

/** Six digits, uniform, from the platform CSPRNG (rejection sampling, no modulo bias). */
export function generateOtp(randomUint32: () => number = secureUint32): string {
  const range = 900000;
  const limit = Math.floor(0x100000000 / range) * range;
  let x = randomUint32();
  while (x >= limit) x = randomUint32();
  return String(100000 + (x % range));
}

function secureUint32(): number {
  const a = new Uint32Array(1);
  globalThis.crypto.getRandomValues(a);
  return a[0];
}

export async function hashOtp(userId: string, otp: string): Promise<string> {
  const data = new TextEncoder().encode(`kretopia-phone-otp:${userId}:${otp}`);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function encodeStoredOtp(hash: string, attempts: number): string {
  return `v2:${attempts}:${hash}`;
}

export type StoredOtp =
  | { kind: "hashed"; attempts: number; hash: string }
  | { kind: "legacy"; code: string };

export function parseStoredOtp(value: unknown): StoredOtp | null {
  if (typeof value !== "string") return null;
  const m = HASHED_RE.exec(value);
  if (m) return { kind: "hashed", attempts: Number(m[1]), hash: m[2] };
  if (LEGACY_RE.test(value)) return { kind: "legacy", code: value };
  return null;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** A digits-only number of 8 to 15 digits, optionally with a leading +; null otherwise. */
export function cleanPhoneNumber(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.trim().replace(/(?!^\+)\D/g, "");
  return /^\+?[1-9]\d{7,14}$/.test(cleaned) ? cleaned : null;
}

export type OtpSendDecision = { ok: true } | { ok: false; status: 429; retryAfterSeconds: number };

/** May a new code be sent now? `expiresAtIso` is the expiry of the code currently stored, if any. */
export function decideOtpSend(f: { nowMs: number; expiresAtIso: string | null | undefined }): OtpSendDecision {
  if (!f.expiresAtIso) return { ok: true };
  const expires = Date.parse(f.expiresAtIso);
  if (!Number.isFinite(expires)) return { ok: true };
  const sentAt = expires - OTP_TTL_MS;
  const elapsed = f.nowMs - sentAt;
  if (elapsed >= 0 && elapsed < OTP_RESEND_COOLDOWN_MS) {
    return { ok: false, status: 429, retryAfterSeconds: Math.ceil((OTP_RESEND_COOLDOWN_MS - elapsed) / 1000) };
  }
  return { ok: true };
}

export type OtpAttemptPlan =
  | { ok: false; status: 400 | 410 | 429; error: string; clear: boolean }
  | {
      ok: true;
      /** What to write (compare-and-set against the value that was read) before the answer is used. */
      nextStored: string;
      /** The submitted code is the stored one. */
      matches: boolean;
      /** This attempt used up the last guess of a code that did not match. */
      burned: boolean;
    };

export async function planOtpAttempt(f: {
  userId: string;
  code: unknown;
  stored: unknown;
  expiresAtIso: string | null | undefined;
  nowMs: number;
}): Promise<OtpAttemptPlan> {
  if (typeof f.code !== "string" || !/^\d{6}$/.test(f.code.trim())) {
    return { ok: false, status: 400, error: "Invalid code", clear: false };
  }
  const code = f.code.trim();

  const expires = f.expiresAtIso ? Date.parse(f.expiresAtIso) : NaN;
  const stored = parseStoredOtp(f.stored);
  if (!stored || !Number.isFinite(expires) || expires < f.nowMs) {
    return { ok: false, status: 410, error: "Code expired. Please request a new one.", clear: stored !== null };
  }

  if (stored.kind === "hashed" && stored.attempts >= OTP_MAX_ATTEMPTS) {
    return { ok: false, status: 429, error: "Too many attempts. Please request a new code.", clear: true };
  }

  const attempts = stored.kind === "hashed" ? stored.attempts : 0;
  const expectedHash = stored.kind === "hashed" ? stored.hash : await hashOtp(f.userId, stored.code);
  const submittedHash = await hashOtp(f.userId, code);
  const matches = constantTimeEqual(submittedHash, expectedHash);

  const used = attempts + 1;
  return {
    ok: true,
    nextStored: encodeStoredOtp(expectedHash, used),
    matches,
    burned: !matches && used >= OTP_MAX_ATTEMPTS,
  };
}
