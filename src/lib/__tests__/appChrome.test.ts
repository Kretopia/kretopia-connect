import { describe, expect, it } from "vitest";
import { appChrome } from "../appChrome";

describe("appChrome", () => {
  it("a public Passport wears the Kretopia navbar, for guests and signed-in people", () => {
    expect(appChrome("/epk/abc-123", false).showNavbar).toBe(true);
    expect(appChrome("/epk/abc-123", true).showNavbar).toBe(true);
  });

  it("a public Passport stays a standalone page at the bottom: no bottom nav", () => {
    expect(appChrome("/epk/abc-123", true).showBottomNav).toBe(false);
  });

  it("the other public profile route keeps both, as before", () => {
    expect(appChrome("/profile/abc-123", true)).toEqual({ showNavbar: true, showBottomNav: true });
    expect(appChrome("/profile/abc-123", false)).toEqual({ showNavbar: true, showBottomNav: false });
  });

  it("only the standalone surfaces go without the navbar", () => {
    for (const path of ["/comp/abc", "/site/abc", "/website-builder", "/auth", "/onboarding", "/company-onboarding", "/deck"]) {
      expect(appChrome(path, true)).toEqual({ showNavbar: false, showBottomNav: false });
    }
  });

  it("is not fooled by a longer path under /epk", () => {
    expect(appChrome("/epk/abc/edit", true)).toEqual({ showNavbar: true, showBottomNav: true });
  });
});
