import { afterEach, describe, expect, it, vi } from "vitest";
import { getAuthOrigin, getPostSignupUrl, POST_SIGNUP_PATH } from "../authRedirect";

const at = (href: string) => {
  const u = new URL(href);
  vi.stubGlobal("location", { hostname: u.hostname, origin: u.origin, href: u.href });
  // jsdom exposes location through window as well
  Object.defineProperty(window, "location", { configurable: true, value: { hostname: u.hostname, origin: u.origin, href: u.href } });
};

afterEach(() => vi.unstubAllGlobals());

describe("auth email redirects", () => {
  it("sends the sign-up confirmation to onboarding on www.kretopia.com", () => {
    at("https://www.kretopia.com/auth");
    expect(POST_SIGNUP_PATH).toBe("/onboarding");
    expect(getPostSignupUrl()).toBe("https://www.kretopia.com/onboarding");
  });

  it.each([
    "https://kretopia.lovable.app/unboarding",
    "https://thrivein-new-beta.lovable.app/auth",
    "https://id-preview--abc.lovable.app/auth",
    "https://abc.lovableproject.com/auth?tab=signup",
    "https://kretopia.com/auth", // apex too: one canonical host for every email link
  ])("never sends the member to %s", (href) => {
    at(href);
    expect(getAuthOrigin()).toBe("https://www.kretopia.com");
    expect(getPostSignupUrl()).toBe("https://www.kretopia.com/onboarding");
    expect(getPostSignupUrl()).not.toMatch(/lovable/);
  });

  it("keeps a local dev server local, so developing sign-up still works", () => {
    at("http://localhost:8080/auth");
    expect(getPostSignupUrl()).toBe("http://localhost:8080/onboarding");
    at("http://127.0.0.1:5173/auth");
    expect(getAuthOrigin()).toBe("http://127.0.0.1:5173");
  });
});
