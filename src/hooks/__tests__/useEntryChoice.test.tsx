import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ value: { user: null as null | { id: string }, loading: false } }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth.value }));

import { useEntryChoice } from "@/hooks/useEntryChoice";
import { AUTH_WAIT_MS, entryChoiceKey } from "@/lib/entryChoice";

beforeEach(() => {
  auth.value = { user: null, loading: false };
  window.sessionStorage.clear();
  window.localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("useEntryChoice", () => {
  it("asks a signed-out visitor to choose, before anything else", () => {
    const { result } = renderHook(() => useEntryChoice("meet:a"));
    expect(result.current.needsChoice).toBe(true);
    expect(result.current.isGuest).toBe(false);
    expect(result.current.pending).toBe(false);
  });

  it("never asks a signed-in person, and never flashes the choice while it is still finding out", () => {
    auth.value = { user: null, loading: true };
    const waiting = renderHook(() => useEntryChoice("meet:a"));
    expect(waiting.result.current.pending).toBe(true);
    expect(waiting.result.current.needsChoice).toBe(false);

    auth.value = { user: { id: "u1" }, loading: false };
    const signedIn = renderHook(() => useEntryChoice("meet:a"));
    expect(signedIn.result.current.needsChoice).toBe(false);
    expect(signedIn.result.current.isGuest).toBe(false);
  });

  it("does not need the session to show the choice: it appears anyway if the account check is slow", () => {
    vi.useFakeTimers();
    auth.value = { user: null, loading: true };
    const { result } = renderHook(() => useEntryChoice("meet:a"));
    expect(result.current.needsChoice).toBe(false);
    act(() => {
      vi.advanceTimersByTime(AUTH_WAIT_MS + 10);
    });
    expect(result.current.pending).toBe(false);
    expect(result.current.needsChoice).toBe(true);
  });

  it("remembers 'guest' for this tab's session, for this entry only", () => {
    const first = renderHook(() => useEntryChoice("meet:a"));
    act(() => first.result.current.continueAsGuest());
    expect(first.result.current.isGuest).toBe(true);
    expect(first.result.current.needsChoice).toBe(false);
    expect(window.sessionStorage.getItem(entryChoiceKey("meet:a"))).toBe('"guest"');

    // a reload of the same link in the same tab does not ask again
    const reloaded = renderHook(() => useEntryChoice("meet:a"));
    expect(reloaded.result.current.isGuest).toBe(true);
    // another invitation still asks
    const other = renderHook(() => useEntryChoice("meet:b"));
    expect(other.result.current.needsChoice).toBe(true);
  });

  it("never persists beyond the session: nothing goes to localStorage", () => {
    const { result } = renderHook(() => useEntryChoice("meet:a"));
    act(() => result.current.continueAsGuest());
    expect(window.localStorage.length).toBe(0);
    expect(document.cookie).toBe("");
  });

  it("stops being a guest the moment the person signs in", () => {
    const first = renderHook(() => useEntryChoice("meet:a"));
    act(() => first.result.current.continueAsGuest());
    auth.value = { user: { id: "u1" }, loading: false };
    const afterSignIn = renderHook(() => useEntryChoice("meet:a"));
    expect(afterSignIn.result.current.isGuest).toBe(false);
    expect(afterSignIn.result.current.needsChoice).toBe(false);
  });
});
