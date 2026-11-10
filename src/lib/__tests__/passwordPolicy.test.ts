import { describe, expect, it } from "vitest";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, SIGNUP_PASSWORD_RULES, passwordPolicyError } from "../passwordPolicy";

describe("the sign-up password policy, written once", () => {
  it("keeps the words the form has always used, in the order it has always checked them", () => {
    const cases: Array<[string, string | null]> = [
      ["", "Use at least 12 characters."],
      ["Short-1A", "Use at least 12 characters."],
      ["Summer2024", "Use at least 12 characters."],
      ["x".repeat(PASSWORD_MAX_LENGTH + 1), "Use a password of 128 characters or fewer."],
      [" Summer-2024-Night", "Avoid spaces at the beginning or end of your password."],
      ["Summer-2024-Night ", "Avoid spaces at the beginning or end of your password."],
      ["ALLUPPERCASE-1234", "Add a lowercase letter."],
      ["alllowercase-1234", "Add an uppercase letter."],
      ["NoNumbersHere-abc", "Add a number."],
      ["NoSymbolsHere12345", "Add a symbol."],
      ["Summer-2024-Night", null],
      ["a Passphrase with 4 spaces!", null],
    ];
    for (const [password, expected] of cases) expect(passwordPolicyError(password), JSON.stringify(password)).toBe(expected);
  });

  it("is what the checklist lists: a password the checklist shows all green is accepted, and one with a red line is not", () => {
    const samples = ["Summer2024", "Summer-2024-Night", "alllowercase-1234", "NoSymbolsHere12345", "SHORT-sym-1", "Aa1!Aa1!Aa1!"];
    for (const password of samples) {
      const allGreen = SIGNUP_PASSWORD_RULES.every((rule) => rule.isValid(password));
      expect(passwordPolicyError(password) === null, JSON.stringify(password)).toBe(allGreen);
    }
  });

  it("lists the length and the symbol, the two rules the old checklist never mentioned", () => {
    const labels = SIGNUP_PASSWORD_RULES.map((rule) => rule.label);
    expect(labels).toContain(`At least ${PASSWORD_MIN_LENGTH} characters`);
    expect(labels).toContain("Contains a symbol");
    expect(new Set(SIGNUP_PASSWORD_RULES.map((rule) => rule.id)).size).toBe(SIGNUP_PASSWORD_RULES.length);
  });
});
