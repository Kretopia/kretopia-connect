import { describe, expect, it } from "vitest";
import { appChrome, showKretoMascotOnMobile } from "../appChrome";

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

describe("showKretoMascotOnMobile", () => {
  it("shows on the signed-in product pages that wear the bottom nav", () => {
    for (const path of ["/", "/desk", "/desk/abc", "/discover", "/profile", "/opportunities", "/thrivepay"]) {
      expect(showKretoMascotOnMobile(path, true)).toBe(true);
    }
  });

  it("never shows for a guest, because the bottom nav does not", () => {
    for (const path of ["/", "/desk", "/profile"]) {
      expect(showKretoMascotOnMobile(path, false)).toBe(false);
    }
  });

  it("stays off the full-screen, call, message and public surfaces the docked bar was off", () => {
    for (const path of [
      "/auth", "/login", "/signup", "/onboarding", "/claim", "/accept-invite", "/landing", "/check-in",
      "/call/abc", "/guest-call/abc", "/messages", "/messages/abc", "/epk/abc", "/u/someone", "/site/abc", "/website-builder",
    ]) {
      expect(showKretoMascotOnMobile(path, true)).toBe(false);
    }
  });

  it("follows the bottom nav: a route without it never gets the mascot", () => {
    for (const path of ["/comp/abc", "/deck", "/company-onboarding"]) {
      expect(appChrome(path, true).showBottomNav).toBe(false);
      expect(showKretoMascotOnMobile(path, true)).toBe(false);
    }
  });
});
