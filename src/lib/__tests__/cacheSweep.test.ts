import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { startCacheSweep, sweepClientCaches } from "../cacheSweep";

describe("selective cache housekeeping", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("keeps current data and removes expired client data without deleting HTTP caches", () => {
    localStorage.setItem("cache:current", JSON.stringify({ timestamp: Date.now() }));
    localStorage.setItem("cache:old", JSON.stringify({ timestamp: Date.now() - 25 * 60 * 60 * 1000 }));
    const keys = vi.fn().mockResolvedValue(["images", "fonts", "workbox"]);
    const remove = vi.fn();
    vi.stubGlobal("caches", { keys, delete: remove });
    sweepClientCaches();
    expect(localStorage.getItem("cache:current")).not.toBeNull();
    expect(localStorage.getItem("cache:old")).toBeNull();
    expect(keys).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it("defers housekeeping until idle instead of blocking startup", () => {
    const idle = vi.fn();
    vi.stubGlobal("requestIdleCallback", idle);
    localStorage.setItem("cache:invalid", "invalid");
    startCacheSweep();
    expect(localStorage.getItem("cache:invalid")).toBe("invalid");
    expect(idle).toHaveBeenCalledOnce();
    idle.mock.calls[0][0]();
    expect(localStorage.getItem("cache:invalid")).toBeNull();
  });
});