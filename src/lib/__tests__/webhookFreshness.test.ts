import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  WEBHOOK_TOLERANCE_SECONDS,
  checkWebhookTimestamp,
} from "../../../supabase/functions/_shared/webhookFreshness";

const NOW = 1_800_000_000;

describe("checkWebhookTimestamp", () => {
  it("accepts a fresh timestamp and reports its age", () => {
    expect(checkWebhookTimestamp(String(NOW - 5), NOW)).toEqual({ ok: true, ageSeconds: 5 });
    expect(checkWebhookTimestamp(String(NOW), NOW)).toEqual({ ok: true, ageSeconds: 0 });
  });

  it("accepts the edge of the window and rejects just past it, in both directions", () => {
    const tol = WEBHOOK_TOLERANCE_SECONDS;
    expect(checkWebhookTimestamp(String(NOW - tol), NOW).ok).toBe(true);
    expect(checkWebhookTimestamp(String(NOW - tol - 1), NOW)).toEqual({ ok: false, reason: "timestamp_outside_tolerance" });
    expect(checkWebhookTimestamp(String(NOW + tol), NOW).ok).toBe(true);
    expect(checkWebhookTimestamp(String(NOW + tol + 1), NOW)).toEqual({ ok: false, reason: "timestamp_outside_tolerance" });
  });

  it("rejects a capture from last week", () => {
    expect(checkWebhookTimestamp(String(NOW - 7 * 86_400), NOW).ok).toBe(false);
  });

  it("normalises a millisecond epoch instead of rejecting a working provider", () => {
    expect(checkWebhookTimestamp(String(NOW * 1000 - 3000), NOW)).toEqual({ ok: true, ageSeconds: 3 });
    expect(checkWebhookTimestamp(String((NOW - 7 * 86_400) * 1000), NOW).ok).toBe(false);
  });

  it.each([undefined, null, "", "   ", "abc", "12.5", "-5", "0", "1e9", "99999999999999999"])(
    "treats %p as invalid (fail closed)",
    (value) => {
      expect(checkWebhookTimestamp(value as string | null | undefined, NOW)).toEqual({
        ok: false,
        reason: "timestamp_invalid",
      });
    },
  );

  it("honours an explicit tolerance", () => {
    expect(checkWebhookTimestamp(String(NOW - 61), NOW, 60).ok).toBe(false);
    expect(checkWebhookTimestamp(String(NOW - 60), NOW, 60).ok).toBe(true);
  });
});

describe("daily-recording-webhook wiring", () => {
  const source = readFileSync(
    resolve(__dirname, "../../../supabase/functions/daily-recording-webhook/index.ts"),
    "utf8",
  );

  it("checks freshness only on the timestamped signature, before the payload is parsed or any event acted on", () => {
    const freshness = source.indexOf("checkWebhookTimestamp(timestamp");
    const parse = source.indexOf("JSON.parse(raw)");
    const findCall = source.indexOf("findCall(admin");
    expect(freshness).toBeGreaterThan(-1);
    expect(parse).toBeGreaterThan(freshness);
    expect(findCall).toBeGreaterThan(freshness);
    expect(source).toContain("if (timestampedOk)");
  });

  it("still verifies the signature before anything else and keeps the legacy raw-body form, logged", () => {
    expect(source.indexOf("bad signature")).toBeLessThan(source.indexOf("checkWebhookTimestamp(timestamp"));
    expect(source).toContain("rawBodyOk");
    expect(source).toContain("its age cannot be bounded");
  });
});
