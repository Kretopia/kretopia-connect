/**
 * The password rules of sign-up, written once.
 *
 * Three places used to decide what a good password is, and they disagreed: the checklist beside the field (8 characters, an uppercase
 * letter, a lowercase letter, a number), the wizard's own check (any 8 to 100 characters) and, last, the page's submit handler (12
 * characters, upper and lower case, a number and a symbol). A person could follow the checklist to four green ticks, pass the wizard, and
 * only then be turned down by a toast that named a rule the form had never mentioned. They all read this file now.
 */

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export interface PasswordRule {
  id: "length" | "lowercase" | "uppercase" | "number" | "symbol";
  /** The words of the checklist beside the field. */
  label: string;
  isValid: (value: string) => boolean;
}

/** What the checklist lists, in order. A password is accepted when every one of them is met (and it is not too long or padded with spaces). */
export const SIGNUP_PASSWORD_RULES: readonly PasswordRule[] = [
  { id: "length", label: `At least ${PASSWORD_MIN_LENGTH} characters`, isValid: (value) => value.length >= PASSWORD_MIN_LENGTH },
  { id: "lowercase", label: "Contains a lowercase letter", isValid: (value) => /[a-z]/.test(value) },
  { id: "uppercase", label: "Contains an uppercase letter", isValid: (value) => /[A-Z]/.test(value) },
  { id: "number", label: "Contains a number", isValid: (value) => /[0-9]/.test(value) },
  { id: "symbol", label: "Contains a symbol", isValid: (value) => /[^A-Za-z0-9]/.test(value) },
];

/** What to tell the person when a rule is not met: the form's own words, unchanged. */
const FIX: Record<PasswordRule["id"], string> = {
  length: `Use at least ${PASSWORD_MIN_LENGTH} characters.`,
  lowercase: "Add a lowercase letter.",
  uppercase: "Add an uppercase letter.",
  number: "Add a number.",
  symbol: "Add a symbol.",
};

/** The first thing wrong with a password, or null. Length first, then its upper limit and padding, then the character rules in checklist order. */
export function passwordPolicyError(value: string): string | null {
  const [length, ...characterRules] = SIGNUP_PASSWORD_RULES;
  if (!length.isValid(value)) return FIX.length;
  if (value.length > PASSWORD_MAX_LENGTH) return `Use a password of ${PASSWORD_MAX_LENGTH} characters or fewer.`;
  if (/^\s|\s$/.test(value)) return "Avoid spaces at the beginning or end of your password.";
  const failed = characterRules.find((rule) => !rule.isValid(value));
  return failed ? FIX[failed.id] : null;
}
