import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
  cleanPhoneNumber,
  decideOtpSend,
  encodeStoredOtp,
  generateOtp,
  hashOtp,
  parseStoredOtp,
  planOtpAttempt,
} from "../../../supabase/functions/_shared/phoneOtp";

// The jsdom test environment has no SubtleCrypto; Deno (where this code runs)
// has it. Use Node's Web Crypto, which is the same API.
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
}

const USER = "user-1";
const NOW = Date.parse("2026-10-14T12:00:00Z");
const inMinutes = (m: number) => new Date(NOW + m * 60_000).toISOString();

describe("generateOtp", () => {
  it("is always six digits, from 100000 to 999999", () => {
    expect(generateOtp(() => 0)).toBe("100000");
    expect(generateOtp(() => 899_999)).toBe("999999");
    for (let i = 0; i < 200; i++) expect(generateOtp()).toMatch(/^[1-9]\d{5}$/);
  });

  it("redraws a value in the biased tail instead of folding it", () => {
    const limit = Math.floor(0x100000000 / 900000) * 900000;
    const draws = [0xffffffff, limit + 1, 5];
    let i = 0;
    expect(generateOtp(() => draws[i++])).toBe("100005");
    expect(i).toBe(3);
  });
});

describe("cleanPhoneNumber", () => {
  it("accepts an international number and strips separators", () => {
    expect(cleanPhoneNumber("+1 (868) 555-0100")).toBe("+18685550100");
    expect(cleanPhoneNumber("  +447911123456 ")).toBe("+447911123456");
  });

  it("refuses short, long, non-numeric and non-string input", () => {
    for (const v of ["", "123", "+1234567", `+${"1".repeat(16)}`, "abcdefghij", "+0123456789", null, undefined, 5551234567]) {
      expect(cleanPhoneNumber(v)).toBeNull();
    }
  });
});

describe("decideOtpSend: a new code is not sent while the last one is fresh", () => {
  it("allows the first code", () => {
    expect(decideOtpSend({ nowMs: NOW, expiresAtIso: null })).toEqual({ ok: true });
    expect(decideOtpSend({ nowMs: NOW, expiresAtIso: undefined })).toEqual({ ok: true });
  });

  it("refuses with 429 and a retry delay when the previous code was sent seconds ago", () => {
    const sentTenSecondsAgo = new Date(NOW - 10_000 + OTP_TTL_MS).toISOString();
    expect(decideOtpSend({ nowMs: NOW, expiresAtIso: sentTenSecondsAgo })).toEqual({
      ok: false,
      status: 429,
      retryAfterSeconds: Math.ceil((OTP_RESEND_COOLDOWN_MS - 10_000) / 1000),
    });
  });

  it("allows another code once the cooldown has passed, and after expiry", () => {
    const sentTwoMinutesAgo = new Date(NOW - 120_000 + OTP_TTL_MS).toISOString();
    expect(decideOtpSend({ nowMs: NOW, expiresAtIso: sentTwoMinutesAgo })).toEqual({ ok: true });
    expect(decideOtpSend({ nowMs: NOW, expiresAtIso: inMinutes(-5) })).toEqual({ ok: true });
  });

  it("does not trust an unreadable expiry as a lock", () => {
    expect(decideOtpSend({ nowMs: NOW, expiresAtIso: "not a date" })).toEqual({ ok: true });
  });
});

describe("stored value", () => {
  it("round-trips a hashed value and still reads a pre-change plain code", async () => {
    const hash = await hashOtp(USER, "123456");
    expect(parseStoredOtp(encodeStoredOtp(hash, 2))).toEqual({ kind: "hashed", attempts: 2, hash });
    expect(parseStoredOtp("123456")).toEqual({ kind: "legacy", code: "123456" });
  });

  it("does not parse anything else", () => {
    for (const v of [null, undefined, "", "12345", "v2:1:xyz", 123456, "v2:x:" + "a".repeat(64)]) {
      expect(parseStoredOtp(v)).toBeNull();
    }
  });

  it("salts the hash with the user, so one code is not one hash for everyone", async () => {
    expect(await hashOtp("user-1", "123456")).not.toBe(await hashOtp("user-2", "123456"));
  });
});

describe("planOtpAttempt: guessing a code", () => {
  const live = async (code = "654321", attempts = 0) => ({
    stored: encodeStoredOtp(await hashOtp(USER, code), attempts),
    expiresAtIso: inMinutes(5),
  });

  it("matches the right code and records the attempt", async () => {
    const { stored, expiresAtIso } = await live();
    const plan = await planOtpAttempt({ userId: USER, code: "654321", stored, expiresAtIso, nowMs: NOW });
    expect(plan).toMatchObject({ ok: true, matches: true, burned: false });
    if (plan.ok) expect(parseStoredOtp(plan.nextStored)).toMatchObject({ kind: "hashed", attempts: 1 });
  });

  it("does not match a wrong code and counts it", async () => {
    const { stored, expiresAtIso } = await live();
    const plan = await planOtpAttempt({ userId: USER, code: "111111", stored, expiresAtIso, nowMs: NOW });
    expect(plan).toMatchObject({ ok: true, matches: false, burned: false });
  });

  it("burns the code on the last allowed guess", async () => {
    const { stored, expiresAtIso } = await live("654321", OTP_MAX_ATTEMPTS - 1);
    const plan = await planOtpAttempt({ userId: USER, code: "111111", stored, expiresAtIso, nowMs: NOW });
    expect(plan).toMatchObject({ ok: true, matches: false, burned: true });
  });

  it("refuses everything, even the right code, once the attempts are used up", async () => {
    const { stored, expiresAtIso } = await live("654321", OTP_MAX_ATTEMPTS);
    const plan = await planOtpAttempt({ userId: USER, code: "654321", stored, expiresAtIso, nowMs: NOW });
    expect(plan).toMatchObject({ ok: false, status: 429, clear: true });
  });

  it("refuses an expired code and a missing one", async () => {
    const { stored } = await live();
    expect(await planOtpAttempt({ userId: USER, code: "654321", stored, expiresAtIso: inMinutes(-1), nowMs: NOW }))
      .toMatchObject({ ok: false, status: 410 });
    expect(await planOtpAttempt({ userId: USER, code: "654321", stored: null, expiresAtIso: inMinutes(5), nowMs: NOW }))
      .toMatchObject({ ok: false, status: 410, clear: false });
    expect(await planOtpAttempt({ userId: USER, code: "654321", stored, expiresAtIso: null, nowMs: NOW }))
      .toMatchObject({ ok: false, status: 410 });
  });

  it("refuses a submitted value that is not six digits", async () => {
    const { stored, expiresAtIso } = await live();
    for (const code of ["12345", "1234567", "abcdef", "", null, 654321]) {
      expect(await planOtpAttempt({ userId: USER, code, stored, expiresAtIso, nowMs: NOW }))
        .toMatchObject({ ok: false, status: 400 });
    }
  });

  it("does not accept another user's stored value", async () => {
    const other = encodeStoredOtp(await hashOtp("someone-else", "654321"), 0);
    const plan = await planOtpAttempt({ userId: USER, code: "654321", stored: other, expiresAtIso: inMinutes(5), nowMs: NOW });
    expect(plan).toMatchObject({ ok: true, matches: false });
  });

  it("still verifies a plain code written before this change, then switches it to a hash", async () => {
    const plan = await planOtpAttempt({ userId: USER, code: "246810", stored: "246810", expiresAtIso: inMinutes(5), nowMs: NOW });
    expect(plan).toMatchObject({ ok: true, matches: true });
    if (plan.ok) expect(parseStoredOtp(plan.nextStored)).toMatchObject({ kind: "hashed", attempts: 1 });
    const wrong = await planOtpAttempt({ userId: USER, code: "000000", stored: "246810", expiresAtIso: inMinutes(5), nowMs: NOW });
    expect(wrong).toMatchObject({ ok: true, matches: false });
  });
});

describe("function wiring", () => {
  const read = (p: string) => readFileSync(resolve(__dirname, "../../../supabase/functions", p), "utf8");

  it("send-phone-otp: CSPRNG code, cooldown before sending, attempt recorded by compare-and-set, number change unverifies", () => {
    const source = read("send-phone-otp/index.ts");
    expect(source).not.toContain("Math.random");
    expect(source.indexOf("decideOtpSend(")).toBeLessThan(source.indexOf("api.twilio.com"));
    expect(source).toContain('.eq("phone_otp", profile.phone_otp)');
    expect(source.indexOf('.eq("phone_otp", profile.phone_otp)')).toBeLessThan(source.indexOf("phone_verified: true"));
    expect(source).toContain("phone_verified: false");
    expect(source).not.toMatch(/phone_otp:\s*otp\b/);
  });

  it("merge-accounts-init: no code in the logs, a cap before anything is created, an explicit failure when delivery fails", () => {
    const source = read("merge-accounts-init/index.ts");
    expect(source).not.toContain("Math.random");
    expect(source).not.toMatch(/console\.(log|warn|error)\([^)]*otp/i);
    expect(source.indexOf("MAX_MERGE_REQUESTS_PER_HOUR")).toBeGreaterThan(-1);
    expect(source.indexOf("recentRequests ?? 0")).toBeLessThan(source.indexOf('.insert({'));
    expect(source).toContain("code_delivery_failed");
    expect(source).toContain("face_match_score: null");
    expect(source).not.toContain("mask(sourceEmail)");
  });

  it("send-outreach-email: validated recipient, single-line subject, scoped leads", () => {
    const source = read("send-outreach-email/index.ts");
    expect(source).toContain("cleanRecipientEmail(rawTo)");
    expect(source).toContain("singleLine(rawSubject, 200)");
    expect(source.match(/\.eq\("user_id", user\.id\)\s*\.maybeSingle\(\)/g)?.length).toBeGreaterThanOrEqual(1);
    const leadReads = source.split('.from("leads")').slice(1);
    for (const chunk of leadReads) expect(chunk.slice(0, 220)).toContain('.eq("user_id", user.id)');
  });

  it("verify-brand-credit: one validated brand address, escaped text", () => {
    const source = read("verify-brand-credit/index.ts");
    expect(source).toContain("to: [cleanBrandEmail]");
    expect(source).not.toContain("to: [brandEmail]");
    expect(source).toContain("escapeHtmlText(creatorName)");
    expect(source).toContain("escapeHtmlText(cleanBrandName)");
    expect(source.indexOf("cleanRecipientEmail(brandEmail)")).toBeLessThan(source.indexOf("icdb_brand_verifications"));
  });
});
