import { describe, expect, it } from "vitest";
import { RATE_LIMIT_NOTICE, classifySignupError } from "../authErrors";
import { categorizeAuthError } from "../landingMetrics";

describe("classifySignupError", () => {
  it("names a limit as a limit, from the server's status or code before its words, and before the word 'email'", () => {
    expect(classifySignupError({ message: "email rate limit exceeded", status: 429, code: "over_email_send_rate_limit" })).toBe("rate_limited");
    expect(classifySignupError({ message: "email rate limit exceeded" })).toBe("rate_limited");
    expect(classifySignupError({ message: "For security purposes, you can only request this after 42 seconds." })).toBe("rate_limited");
    expect(classifySignupError({ message: "anything", status: 429 })).toBe("rate_limited");
    expect(classifySignupError({ message: "anything", code: "over_request_rate_limit" })).toBe("rate_limited");
  });

  it("keeps what it already recognised: an existing account, a refused password, a lost connection, a bad address", () => {
    expect(classifySignupError({ message: "User already registered" })).toBe("already_registered");
    expect(classifySignupError({ message: "x", code: "user_already_exists" })).toBe("already_registered");
    expect(classifySignupError({ message: "Password should be at least 12 characters" })).toBe("weak_password");
    expect(classifySignupError({ message: "x", code: "weak_password" })).toBe("weak_password");
    expect(classifySignupError({ message: "Failed to fetch" })).toBe("network_error");
    expect(classifySignupError({ message: "x", name: "AuthRetryableFetchError" })).toBe("network_error");
    expect(classifySignupError({ message: "Unable to validate email address: invalid format" })).toBe("invalid_email");
    expect(classifySignupError({ message: "Database error saving new user" })).toBe("other");
  });

  it("tolerates a thrown string or nothing at all", () => {
    expect(classifySignupError("boom")).toBe("other");
    expect(classifySignupError(undefined)).toBe("other");
    expect(classifySignupError(null)).toBe("other");
  });

  it("tells a person about a limit honestly and says what to do, without the server's sentence", () => {
    expect(RATE_LIMIT_NOTICE.title).toBe("Too many sign-up attempts");
    expect(RATE_LIMIT_NOTICE.description).toMatch(/try again/i);
    expect(RATE_LIMIT_NOTICE.description).not.toMatch(/rate limit exceeded/i);
  });
});

describe("categorizeAuthError (the funnel's category)", () => {
  it("files a limit as one, so the funnel can see it, instead of as a bad input", () => {
    expect(categorizeAuthError(new Error("email rate limit exceeded"))).toBe("rate_limited");
    expect(categorizeAuthError(new Error("Request rate limit reached"))).toBe("rate_limited");
  });

  it("leaves the other categories as they were", () => {
    expect(categorizeAuthError(new Error("User already registered"))).toBe("account_exists");
    expect(categorizeAuthError(new Error("Invalid login credentials"))).toBe("invalid_input");
    expect(categorizeAuthError(new Error("Failed to fetch"))).toBe("network_error");
    expect(categorizeAuthError(new Error("something else"))).toBe("unknown_error");
  });
});
