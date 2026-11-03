import { describe, expect, it } from "vitest";
import { readRestoreScrollTop, readReturnTo, restoreState, returnState } from "@/lib/passportReturn";

describe("the way back from a detail view", () => {
  it("remembers the Passport's own address, with its tab and filters, and how far down the person was", () => {
    const { returnTo } = returnState("/passport/abc?tab=stamps&filter=verified", "Passport", 640);
    expect(returnTo).toEqual({ path: "/passport/abc?tab=stamps&filter=verified", label: "Passport", scrollTop: 640 });
  });

  it("reads what it stored", () => {
    expect(readReturnTo(returnState("/profile", "Passport", 120))).toEqual({ path: "/profile", label: "Passport", scrollTop: 120 });
  });

  it.each([
    ["no state", null],
    ["a state without a return target", { other: 1 }],
    ["an external address", { returnTo: { path: "https://evil.example/passport", label: "Passport", scrollTop: 0 } }],
    ["a protocol-relative address", { returnTo: { path: "//evil.example", label: "Passport", scrollTop: 0 } }],
    ["a scheme in the path", { returnTo: { path: "/x?next=https://evil.example", label: "Passport", scrollTop: 0 } }],
    ["a path that is not a string", { returnTo: { path: 42, label: "Passport", scrollTop: 0 } }],
  ])("accepts nothing from %s", (_name, state) => {
    expect(readReturnTo(state)).toBeNull();
  });

  it("keeps the label short and falls back to Passport, and ignores a scroll position that is not a real number", () => {
    expect(readReturnTo({ returnTo: { path: "/a", label: "   ", scrollTop: Number.NaN } })).toEqual({ path: "/a", label: "Passport", scrollTop: 0 });
    expect(readReturnTo({ returnTo: { path: "/a", label: "x".repeat(200), scrollTop: -5 } })!.label).toHaveLength(60);
  });

  it("hands the scroll position to the page it returns to", () => {
    expect(readRestoreScrollTop(restoreState(512.4))).toBe(512.4);
    expect(readRestoreScrollTop(null)).toBe(0);
    expect(readRestoreScrollTop({ restoreScrollTop: "x" })).toBe(0);
  });
});
