import { describe, it, expect } from "vitest";
import {
  normalizeUsername,
  validateUsername,
  usernameValidationMessage,
  RESERVED_USERNAMES,
} from "../username";

describe("normalizeUsername", () => {
  it("strips a leading @, trims and lowercases", () => {
    expect(normalizeUsername("@Noe_Plantier ")).toBe("noe_plantier");
    expect(normalizeUsername("@@DJ.Kretopia")).toBe("dj.kretopia");
    expect(normalizeUsername("  ALEX ")).toBe("alex");
  });

  it("handles empty input", () => {
    expect(normalizeUsername("")).toBe("");
    expect(normalizeUsername("@")).toBe("");
  });
});

describe("validateUsername", () => {
  it("accepts valid handles", () => {
    expect(validateUsername("noe_plantier")).toBe("ok");
    expect(validateUsername("abc")).toBe("ok");
    expect(validateUsername("a".repeat(30))).toBe("ok");
    expect(validateUsername("dj_2026")).toBe("ok");
  });

  it("rejects too short / too long", () => {
    expect(validateUsername("ab")).toBe("invalid");
    expect(validateUsername("a".repeat(31))).toBe("invalid");
    expect(validateUsername("")).toBe("required");
  });

  it("rejects characters outside [a-z0-9_]", () => {
    expect(validateUsername("dj-kretopia")).toBe("invalid");
    expect(validateUsername("dj.kretopia")).toBe("invalid");
    expect(validateUsername("dj kretopia")).toBe("invalid");
    expect(validateUsername("dj@kretopia")).toBe("invalid");
  });

  it("rejects leading or trailing underscore", () => {
    expect(validateUsername("_noe")).toBe("invalid");
    expect(validateUsername("noe_")).toBe("invalid");
    expect(validateUsername("_noe_")).toBe("invalid");
    expect(validateUsername("n__e")).toBe("ok"); // inner underscores are fine
  });

  it("blocks every brief-mandated reserved handle", () => {
    for (const r of ["auth", "admin", "api", "settings", "profile", "passport", "desk", "scout", "stages", "match", "circle", "site", "www", "support"]) {
      expect(RESERVED_USERNAMES.has(r)).toBe(true);
      expect(validateUsername(r)).toBe("reserved");
    }
  });

  it("blocks app routes that would shadow real pages", () => {
    for (const r of ["messages", "discover", "wallet", "claim", "kretopia"]) {
      expect(validateUsername(r)).toBe("reserved");
    }
  });
});

describe("usernameValidationMessage", () => {
  it("returns null for ok and a message otherwise", () => {
    expect(usernameValidationMessage("ok")).toBeNull();
    expect(usernameValidationMessage("required")).toBeTruthy();
    expect(usernameValidationMessage("invalid")).toBeTruthy();
    expect(usernameValidationMessage("reserved")).toBeTruthy();
  });
});
