import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ANALYTICS_THROTTLE, createAnalyticsThrottle } from "@/lib/analyticsThrottle";

function clock() {
  let t = 1_000_000;
  return { now: () => t, advance: (ms: number) => { t += ms; } };
}

describe("createAnalyticsThrottle", () => {
  it("lets a first event through and drops the same event repeated within the window", () => {
    const c = clock();
    const throttle = createAnalyticsThrottle(ANALYTICS_THROTTLE, c.now);
    expect(throttle.check("page_view", "/desk", { page: "thrivedesk" })).toBe("allow");
    c.advance(1_000);
    expect(throttle.check("page_view", "/desk", { page: "thrivedesk" })).toBe("duplicate");
  });

  it("lets the same event through again once it has been quiet for the window", () => {
    const c = clock();
    const throttle = createAnalyticsThrottle(ANALYTICS_THROTTLE, c.now);
    throttle.check("page_view", "/desk", {});
    c.advance(ANALYTICS_THROTTLE.duplicateWindowMs + 1);
    expect(throttle.check("page_view", "/desk", {})).toBe("allow");
  });

  it("treats a different name, page or properties as a different event, whatever the key order", () => {
    const c = clock();
    const throttle = createAnalyticsThrottle(ANALYTICS_THROTTLE, c.now);
    expect(throttle.check("feature_used", "/a", { feature: "x", n: 1 })).toBe("allow");
    expect(throttle.check("feature_used", "/b", { feature: "x", n: 1 })).toBe("allow");
    expect(throttle.check("feature_used", "/a", { feature: "y", n: 1 })).toBe("allow");
    expect(throttle.check("page_view", "/a", { feature: "x", n: 1 })).toBe("allow");
    expect(throttle.check("feature_used", "/a", { n: 1, feature: "x" })).toBe("duplicate");
  });

  it("reduces a loop that fires every few milliseconds to its first event, not to one per window", () => {
    const c = clock();
    const throttle = createAnalyticsThrottle(ANALYTICS_THROTTLE, c.now);
    let allowed = 0;
    for (let i = 0; i < 20_000; i++) { // about 10 minutes at one call every 30 ms
      if (throttle.check("page_view", "/desk/1", { page: "thrivedesk" }) === "allow") allowed++;
      if (throttle.check("feature_used", "/desk/1", { feature: "thrivedesk_opened" }) === "allow") allowed++;
      c.advance(30);
    }
    expect(allowed).toBe(2);
  });

  it("caps a flood of different events at the per-minute limit, then starts again the next minute", () => {
    const c = clock();
    const throttle = createAnalyticsThrottle(ANALYTICS_THROTTLE, c.now);
    const burst = () => {
      let allowed = 0;
      for (let i = 0; i < 500; i++) {
        if (throttle.check("tick", "/p", { i: Math.random() }) === "allow") allowed++;
        c.advance(10);
      }
      return allowed;
    };
    expect(burst()).toBe(ANALYTICS_THROTTLE.maxPerWindow);
    c.advance(ANALYTICS_THROTTLE.windowMs);
    expect(burst()).toBe(ANALYTICS_THROTTLE.maxPerWindow);
  });

  it("does not count dropped duplicates against the per-minute limit", () => {
    const c = clock();
    const throttle = createAnalyticsThrottle(ANALYTICS_THROTTLE, c.now);
    for (let i = 0; i < 1_000; i++) throttle.check("same", "/p", {});
    expect(throttle.check("another", "/p", {})).toBe("allow");
  });

  it("keeps ordinary use untouched: 30 different events in a minute all pass", () => {
    const c = clock();
    const throttle = createAnalyticsThrottle(ANALYTICS_THROTTLE, c.now);
    const results = Array.from({ length: 30 }, (_, i) => {
      c.advance(1_500);
      return throttle.check(`event_${i % 10}`, `/page/${i}`, { i });
    });
    expect(results.every((r) => r === "allow")).toBe(true);
  });

  it("does not throw on properties that cannot be serialised", () => {
    const throttle = createAnalyticsThrottle();
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => throttle.check("e", "/p", circular)).not.toThrow();
    expect(() => throttle.check("e", "/p", { big: BigInt(10) as unknown })).not.toThrow();
  });
});

describe("trackEvent", () => {
  const insert = vi.fn();
  const getUser = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-20T10:00:00Z"));
    insert.mockReset().mockResolvedValue({ error: null });
    getUser.mockReset().mockResolvedValue({ data: { user: { id: "user-1" } } });
    vi.doMock("@/integrations/supabase/client", () => ({
      supabase: { auth: { getUser }, from: () => ({ insert }) },
    }));
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.doUnmock("@/integrations/supabase/client");
  });

  it("writes one row for a loop of identical calls and asks the auth server once", async () => {
    const { analytics } = await import("@/lib/analytics");
    for (let i = 0; i < 1_000; i++) {
      await analytics.pageView("thrivedesk");
      vi.advanceTimersByTime(30);
    }
    expect(insert).toHaveBeenCalledTimes(1);
    expect(getUser).toHaveBeenCalledTimes(1);
    expect(insert.mock.calls[0][0]).toMatchObject({ event_name: "page_view", event_properties: { page: "thrivedesk" } });
  });

  it("writes at most the per-minute limit for a flood of different events, and warns once", async () => {
    const { analytics } = await import("@/lib/analytics");
    for (let i = 0; i < 400; i++) {
      await analytics.featureUsed(`feature_${i}`);
      vi.advanceTimersByTime(20);
    }
    expect(insert).toHaveBeenCalledTimes(ANALYTICS_THROTTLE.maxPerWindow);
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it("still records a normal sequence of different events", async () => {
    const { analytics } = await import("@/lib/analytics");
    await analytics.pageView("home");
    await analytics.featureUsed("search");
    await analytics.pageView("profile");
    expect(insert).toHaveBeenCalledTimes(3);
  });

  it("never throws if the write fails", async () => {
    insert.mockRejectedValue(new Error("offline"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { analytics } = await import("@/lib/analytics");
    await expect(analytics.pageView("home")).resolves.toBeUndefined();
  });
});
