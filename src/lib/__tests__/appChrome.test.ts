import { describe, expect, it } from "vitest";
import { appChrome, appFooter, footerBottomReserve, showKretoMascotOnMobile } from "../appChrome";

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

  it("a join link to a call is a standalone surface too: no site navbar or bottom nav around its screens", () => {
    for (const path of ["/meet/abc-123", "/call/abc-123"]) {
      expect(appChrome(path, true)).toEqual({ showNavbar: false, showBottomNav: false });
      expect(appChrome(path, false)).toEqual({ showNavbar: false, showBottomNav: false });
    }
  });

  it("is not fooled by a longer path under /meet or /call", () => {
    expect(appChrome("/meet/abc/extra", true)).toEqual({ showNavbar: true, showBottomNav: true });
    expect(appChrome("/call", true)).toEqual({ showNavbar: true, showBottomNav: true });
    expect(appChrome("/meetup", true)).toEqual({ showNavbar: true, showBottomNav: true });
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

describe("appFooter: the Landing page's footer, drawn once by the layout", () => {
  it("is under the feature pages: Today (signed in), Studio, Scout, the private Passport, Match, Events and one event", () => {
    for (const path of ["/", "/desk", "/scout", "/profile", "/match", "/meetup", "/event/abc-123"]) {
      expect(appFooter(path, true), path).toBe("balanced");
    }
  });

  it("is under a Passport anybody can open, for a visitor and for the signed-in owner alike", () => {
    for (const signedIn of [false, true]) {
      expect(appFooter("/epk/abc-123", signedIn)).toBe("balanced");
      expect(appFooter("/profile/abc-123", signedIn)).toBe("balanced");
    }
  });

  it("keeps the footers the shared layout already gave: the default layout for the audience pages, the evened-out one for the legal pages", () => {
    for (const path of ["/discover", "/passport", "/post-opportunity"]) expect(appFooter(path, false)).toBe("default");
    for (const path of ["/terms", "/privacy", "/community-guidelines"]) {
      expect(appFooter(path, false)).toBe("balanced");
      expect(appFooter(path, true)).toBe("balanced");
    }
  });

  it("does not give a signed-out visitor a second footer on Today: they see the Landing page there, which ends in its own", () => {
    expect(appFooter("/", false)).toBeNull();
  });

  it("leaves the pages that draw their own footer alone: the Landing page, Pricing and Subscription", () => {
    for (const path of ["/landing", "/pricing", "/subscription"]) {
      expect(appFooter(path, true), path).toBeNull();
      expect(appFooter(path, false), path).toBeNull();
    }
  });

  it("keeps the dedicated and full-screen workflows whole: a Studio project room, the new-room form, chats, live stages, call links", () => {
    for (const path of [
      "/desk/abc-123", "/desk/new-room", "/desk/abc/crew", "/messages", "/messages/abc", "/inbox", "/kreto",
      "/circle/stage/abc", "/circle/speed/abc", "/call/abc", "/meet/abc", "/guest-call/abc", "/thrive/generate",
    ]) {
      expect(appFooter(path, true), path).toBeNull();
    }
  });

  it("has none wherever the page has no navbar: sign-in, onboarding, creator sites, the deck, a comp card", () => {
    for (const path of ["/auth", "/onboarding", "/company-onboarding", "/site/abc", "/website-builder", "/deck", "/comp/abc"]) {
      expect(appFooter(path, true), path).toBeNull();
      expect(appFooter(path, false), path).toBeNull();
    }
  });

  it("is not fooled by a longer path: an event's confirmation and pass pages, a Passport's sub-pages", () => {
    for (const path of ["/event/abc/confirmed", "/event/abc/pass", "/epk/abc/edit", "/profile/abc/extra", "/scout/anything", "/matches"]) {
      expect(appFooter(path, true), path).toBeNull();
    }
  });

  it("an unknown route has no footer: a new page opts in by being named here", () => {
    expect(appFooter("/some-new-page", true)).toBeNull();
  });
});

describe("footerBottomReserve: room at the foot of the footer for what is fixed to a phone screen", () => {
  it("is kept under the signed-in bottom nav, and only below lg", () => {
    const reserve = footerBottomReserve("/scout", true);
    expect(reserve).toContain("env(safe-area-inset-bottom");
    expect(reserve).toContain("lg:pb-0");
    expect(footerBottomReserve("/scout", false)).toBe("");
  });

  it("is larger on an event, whose booking bar is fixed to the bottom of the screen for a visitor too", () => {
    expect(footerBottomReserve("/event/abc", false)).toContain("7rem");
    expect(footerBottomReserve("/event/abc", true)).toContain("7rem");
    expect(footerBottomReserve("/event/abc", false)).not.toBe(footerBottomReserve("/scout", true));
  });
});
