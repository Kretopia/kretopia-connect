import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSessionState } from "@/hooks/useSessionState";

afterEach(() => {
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("useSessionState", () => {
  it("starts from the default and keeps what was set across a remount in the same tab", () => {
    const first = renderHook(() => useSessionState("passport-tab:/profile", "stamps"));
    expect(first.result.current[0]).toBe("stamps");
    act(() => first.result.current[1]("reviews"));
    expect(first.result.current[0]).toBe("reviews");
    first.unmount();
    const second = renderHook(() => useSessionState("passport-tab:/profile", "stamps"));
    expect(second.result.current[0]).toBe("reviews");
  });

  it("keeps one value per key", () => {
    const a = renderHook(() => useSessionState("passport-tab:/profile", "stamps"));
    act(() => a.result.current[1]("reviews"));
    const b = renderHook(() => useSessionState("passport-tab:/passport/x", "work"));
    expect(b.result.current[0]).toBe("work");
  });

  it("is plain state when storage is blocked: nothing throws and the value still changes", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    const { result } = renderHook(() => useSessionState("k", "a"));
    expect(result.current[0]).toBe("a");
    act(() => result.current[1]("b"));
    expect(result.current[0]).toBe("b");
  });
});
