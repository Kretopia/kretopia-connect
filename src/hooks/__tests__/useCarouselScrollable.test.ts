import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CarouselApi } from "@/components/ui/carousel";
import { useCarouselScrollable } from "../useCarouselScrollable";

function fakeApi(initial: { prev: boolean; next: boolean }) {
  const state = { ...initial };
  const listeners = new Map<string, Set<() => void>>();
  const api = {
    canScrollPrev: () => state.prev,
    canScrollNext: () => state.next,
    on: vi.fn((event: string, fn: () => void) => { (listeners.get(event) ?? listeners.set(event, new Set()).get(event)!).add(fn); return api; }),
    off: vi.fn((event: string, fn: () => void) => { listeners.get(event)?.delete(fn); return api; }),
  };
  const emit = (event: string, next?: Partial<typeof state>) => { Object.assign(state, next); listeners.get(event)?.forEach((fn) => fn()); };
  return { api: api as unknown as CarouselApi, emit, raw: api };
}

describe("useCarouselScrollable", () => {
  it("is false before the carousel exists", () => {
    expect(renderHook(() => useCarouselScrollable(undefined)).result.current).toBe(false);
  });

  it("is false when every slide fits (nothing to scroll either way)", () => {
    const { api } = fakeApi({ prev: false, next: false });
    expect(renderHook(() => useCarouselScrollable(api)).result.current).toBe(false);
  });

  it("is true when it can go forward or back", () => {
    expect(renderHook(() => useCarouselScrollable(fakeApi({ prev: false, next: true }).api)).result.current).toBe(true);
    expect(renderHook(() => useCarouselScrollable(fakeApi({ prev: true, next: false }).api)).result.current).toBe(true);
  });

  it("follows a resize and a re-initialisation", () => {
    const { api, emit } = fakeApi({ prev: false, next: true });
    const { result } = renderHook(() => useCarouselScrollable(api));
    expect(result.current).toBe(true);
    act(() => emit("resize", { next: false }));
    expect(result.current).toBe(false);
    act(() => emit("reInit", { next: true }));
    expect(result.current).toBe(true);
  });

  it("stops listening when it unmounts", () => {
    const { api, raw } = fakeApi({ prev: false, next: true });
    renderHook(() => useCarouselScrollable(api)).unmount();
    expect(raw.off).toHaveBeenCalledTimes(3);
  });
});
