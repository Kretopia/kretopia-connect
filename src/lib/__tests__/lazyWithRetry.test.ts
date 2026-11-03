import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadLazyModule } from "../lazyWithRetry";

describe("finite page-module recovery", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.setItem("__lovable_chunk_reloaded__", "1");
  });
  afterEach(() => {
    vi.useRealTimers();
    sessionStorage.clear();
  });

  it("returns ready modules immediately without leaving a timer", async () => {
    const existingTimers = vi.getTimerCount();
    const module = { default: () => null };
    await expect(loadLazyModule(async () => module)).resolves.toBe(module);
    expect(vi.getTimerCount()).toBe(existingTimers);
  });

  it("recovers a transient chunk failure", async () => {
    const factory = vi.fn().mockRejectedValueOnce(new Error("Failed to fetch dynamically imported module"))
      .mockResolvedValue({ default: "ready" });
    const result = loadLazyModule(factory);
    const assertion = expect(result).resolves.toEqual({ default: "ready" });
    await vi.runAllTimersAsync();
    await assertion;
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it("rejects stalled imports rather than holding the loader forever", async () => {
    const factory = vi.fn(() => new Promise(() => {}));
    const assertion = expect(loadLazyModule(factory)).rejects.toThrow("timed out");
    await vi.runAllTimersAsync();
    await assertion;
    expect(factory).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not retry genuine module execution errors", async () => {
    const factory = vi.fn().mockRejectedValue(new Error("Invalid module state"));
    await expect(loadLazyModule(factory)).rejects.toThrow("Invalid module state");
    expect(factory).toHaveBeenCalledTimes(1);
  });
});