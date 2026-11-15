// What Kreto may learn on its own from a message. Pure, so the rule can be tested without a model.
//
// - Never: secrets (passwords, keys, card or bank numbers, ID numbers). Not even when asked.
// - Only when the person explicitly asks ("remember that…", "note that…"): money figures (rates, budgets, amounts) and
//   other people's contact details (emails, phone numbers).
// - Everything else the extractor judges durable (a preferred vendor's name, a recurring constraint) may be learned.

/** The person asked Kreto to keep this. */
export const EXPLICIT_REMEMBER_RE = /\b(remember( that| this|:)?|note that|make a note|keep in mind|save (this|that)|don'?t forget|for future reference)\b/i;

const SECRET_RE = /\b(passwords?|passcodes?|pin( code)?|api[ -]?keys?|secret|access tokens?|iban|swift|bic|routing numbers?|account numbers?|sort codes?|card numbers?|cvv|cvc|social security|ssn|passport numbers?|tax id)\b/i;
const MONEY_RE = /(?:[$€£¥]\s?\d|\d[\d.,]*\s?(?:usd|eur|gbp|chf|cad|aud|k)\b|\d[\d.,]*\s?[€£$]|\b\d[\d.,]*\s?(?:dollars?|euros?|pounds?|bucks)\b)/i;
const EMAIL_RE = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i;
const digitCount = (s: string) => (s.match(/\d/g) ?? []).length;

/** A card, bank or ID number: 13 or more digits in one run (spaces and dashes allowed), not an international phone number. */
function hasLongNumber(text: string): boolean {
  for (const m of text.matchAll(/(\+)?\d(?:[ -]?\d){12,}/g)) if (!m[1]) return true;
  return false;
}

/** A phone number: at least 9 digits in one run (so a date such as 2026-11-15 is not one). */
function hasPhone(text: string): boolean {
  for (const m of text.matchAll(/\+?\(?\d[\d\s().-]{6,}\d/g)) if (digitCount(m[0]) >= 9) return true;
  return false;
}
const MONEY_KINDS = new Set(["rate", "budget"]);

export interface MemoryCandidate {
  kind: string;
  label: string;
  body?: string | null;
}

/** The message carries a secret: learn nothing from it at all. */
export function messageHasSecret(message: string): boolean {
  return SECRET_RE.test(message) || hasLongNumber(message);
}

/** Whether one extracted memory may be stored, and why not. */
export function memoryWriteAllowed(message: string, mem: MemoryCandidate): { allowed: true } | { allowed: false; reason: "secret" | "money" | "contact" } {
  const text = `${mem.label} ${mem.body ?? ""}`;
  if (messageHasSecret(message) || messageHasSecret(text)) return { allowed: false, reason: "secret" };
  const explicit = EXPLICIT_REMEMBER_RE.test(message);
  if (!explicit && (MONEY_KINDS.has(mem.kind) || MONEY_RE.test(text))) return { allowed: false, reason: "money" };
  if (!explicit && (EMAIL_RE.test(text) || hasPhone(text))) return { allowed: false, reason: "contact" };
  return { allowed: true };
}
