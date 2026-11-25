import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  POST_SIGNUP_META_KEY,
  POST_SIGNUP_STASH_KEY,
  destinationFromAccount,
  signupDestinationData,
  takePostSignupDestination,
  usableDestination,
} from "../postSignupDestination";

/** Where someone was going when they had to sign up survives the confirmation email, in this browser or on another device. */
beforeEach(() => sessionStorage.clear());

describe("which addresses are kept", () => {
  it("keeps an address inside the app, with its query", () => {
    expect(usableDestination("/event/abc")).toBe("/event/abc");
    expect(usableDestination("/cosign/tok_123?from=email")).toBe("/cosign/tok_123?from=email");
    expect(usableDestination("/opportunities/9?apply=1")).toBe("/opportunities/9?apply=1");
  });

  it("drops anything that could leave the app", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "evil", "", null, undefined, 42]) {
      expect(usableDestination(bad), String(bad)).toBeNull();
    }
    expect(usableDestination("/x".padEnd(401, "a"))).toBeNull();
  });

  it("drops the start-up pages and the home page: nothing to continue to", () => {
    for (const same of ["/", "/profile", "/profile?tab=credits", "/onboarding", "/auth", "/auth?tab=signup"]) {
      expect(usableDestination(same), same).toBeNull();
    }
    expect(usableDestination("/profiles-directory")).toBe("/profiles-directory");
    // someone else's Passport is a real destination (sign up to connect with them)
    expect(usableDestination("/profile/abc")).toBe("/profile/abc");
    expect(usableDestination("/profile/abc?showClaim=true")).toBe("/profile/abc?showClaim=true");
  });
});

describe("the account carries it", () => {
  it("adds metadata only for a usable destination", () => {
    expect(signupDestinationData("/event/abc")).toEqual({ [POST_SIGNUP_META_KEY]: "/event/abc" });
    expect(signupDestinationData("/profile")).toEqual({});
    expect(signupDestinationData("https://evil.example")).toEqual({});
  });

  it("reads it back, and ignores anything that is not an in-app address", () => {
    expect(destinationFromAccount({ user_metadata: { [POST_SIGNUP_META_KEY]: "/event/abc" } })).toBe("/event/abc");
    expect(destinationFromAccount({ user_metadata: { [POST_SIGNUP_META_KEY]: "https://evil.example" } })).toBeNull();
    expect(destinationFromAccount({ user_metadata: {} })).toBeNull();
    expect(destinationFromAccount(null)).toBeNull();
  });
});

describe("continuing once the Passport is built", () => {
  it("uses this browser's stash first, once", () => {
    sessionStorage.setItem(POST_SIGNUP_STASH_KEY, "/cosign/tok_1");
    expect(takePostSignupDestination(null)).toBe("/cosign/tok_1");
    expect(sessionStorage.getItem(POST_SIGNUP_STASH_KEY)).toBeNull();
    expect(takePostSignupDestination(null)).toBeNull();
  });

  it("falls back to the account's copy (the confirmation email was opened on another device) and clears it", () => {
    const clear = vi.fn();
    const user = { user_metadata: { [POST_SIGNUP_META_KEY]: "/opportunities/9" } };
    expect(takePostSignupDestination(user, clear)).toBe("/opportunities/9");
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it("a stash and an account copy give one destination, and the account's copy is still cleared", () => {
    sessionStorage.setItem(POST_SIGNUP_STASH_KEY, "/cosign/tok_1");
    const clear = vi.fn();
    expect(takePostSignupDestination({ user_metadata: { [POST_SIGNUP_META_KEY]: "/event/abc" } }, clear)).toBe("/cosign/tok_1");
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it("nothing to continue to means the Passport, as before", () => {
    const clear = vi.fn();
    expect(takePostSignupDestination({ user_metadata: {} }, clear)).toBeNull();
    expect(clear).not.toHaveBeenCalled();
  });

  it("an unsafe stash is dropped, not followed", () => {
    sessionStorage.setItem(POST_SIGNUP_STASH_KEY, "https://evil.example");
    expect(takePostSignupDestination(null)).toBeNull();
  });
});
