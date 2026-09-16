import { describe, it, expect } from "vitest";
import { validateEmail, validatePassword, validateUrl, validateCredits, validateFileSize, validateFileType } from "@/lib/validation";

describe("Validation Library", () => {
  describe("validateEmail", () => {
    it("accepts valid emails", () => {
      expect(validateEmail("user@example.com").valid).toBe(true);
      expect(validateEmail("test.user+tag@domain.co.uk").valid).toBe(true);
    });

    it("rejects invalid emails", () => {
      expect(validateEmail("").valid).toBe(false);
      expect(validateEmail("not-an-email").valid).toBe(false);
      expect(validateEmail("@domain.com").valid).toBe(false);
      expect(validateEmail("user@").valid).toBe(false);
    });

    it("rejects overly long emails", () => {
      const longEmail = "a".repeat(250) + "@test.com";
      expect(validateEmail(longEmail).valid).toBe(false);
    });
  });

  describe("validatePassword", () => {
    it("accepts valid passwords", () => {
      expect(validatePassword("securePass1!").valid).toBe(true);
      expect(validatePassword("12345678").valid).toBe(true);
    });

    it("rejects short passwords", () => {
      const result = validatePassword("short");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("at least 8");
    });

    it("rejects empty passwords", () => {
      expect(validatePassword("").valid).toBe(false);
    });

    it("rejects overly long passwords", () => {
      const longPass = "a".repeat(101);
      expect(validatePassword(longPass).valid).toBe(false);
    });
  });

  describe("validateUrl", () => {
    it("accepts valid URLs", () => {
      expect(validateUrl("https://example.com").valid).toBe(true);
      expect(validateUrl("http://sub.domain.org/path").valid).toBe(true);
    });

    it("accepts empty strings", () => {
      expect(validateUrl("").valid).toBe(true);
    });

    it("rejects invalid URLs", () => {
      expect(validateUrl("not-a-url").valid).toBe(false);
      expect(validateUrl("ftp://invalid.com").valid).toBe(false);
    });
  });

  describe("validateCredits", () => {
    it("accepts valid credit amounts", () => {
      expect(validateCredits(5, 10).valid).toBe(true);
      expect(validateCredits(0, 10).valid).toBe(true);
      expect(validateCredits(10, 10).valid).toBe(true);
    });

    it("rejects negative amounts", () => {
      const result = validateCredits(-1, 10);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("negative");
    });

    it("rejects amounts exceeding balance", () => {
      const result = validateCredits(15, 10);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Insufficient");
    });
  });

  describe("validateFileSize", () => {
    it("accepts files within size limit", () => {
      const file = new File(["x".repeat(100)], "test.txt", { type: "text/plain" });
      expect(validateFileSize(file, 1)).toBe(true);
    });

    it("rejects files exceeding size limit", () => {
      const file = new File(["x".repeat(11 * 1024 * 1024)], "large.txt", { type: "text/plain" });
      expect(validateFileSize(file, 10)).toBe(false);
    });
  });

  describe("validateFileType", () => {
    it("accepts allowed file types", () => {
      const file = new File([""], "photo.jpg", { type: "image/jpeg" });
      expect(validateFileType(file, ["image/"])).toBe(true);
    });

    it("rejects disallowed file types", () => {
      const file = new File([""], "script.js", { type: "application/javascript" });
      expect(validateFileType(file, ["image/"])).toBe(false);
    });
  });
});
