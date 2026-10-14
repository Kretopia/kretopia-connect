// Pure, dependency-free helpers for text that an edge function puts into an
// email it sends from our own domain. Imported by edge functions (Deno) and by
// tests (Vite).
//
// Why: several senders interpolated request fields (a name, a title, a free
// message) unescaped into branded HTML, so any caller could add its own markup
// and links to a mail that carries our sender address. Every value that did not
// originate in our own templates goes through these before it is interpolated.

export function escapeHtmlText(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const EMAIL_RE = /^[^\s@<>"',;()[\]\\]+@[^\s@<>"',;()[\]\\]+\.[^\s@<>"',;()[\]\\]+$/;

/** A normalised address, or null when it is not a single plain address. */
export function cleanRecipientEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (email.length === 0 || email.length > 254) return null;
  return EMAIL_RE.test(email) ? email : null;
}

/** Free text, control characters removed, clipped; null when nothing is left. */
export function cleanFreeText(raw: unknown, max: number): string | null {
  if (typeof raw !== "string") return null;
  // eslint-disable-next-line no-control-regex
  const text = raw.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();
  if (text.length === 0) return null;
  return text.slice(0, max);
}

/** A subject or header value: no line breaks, clipped. */
const LINE_BREAKS = new RegExp("[\\r\\n\\v\\f\\u2028\\u2029]+", "g");
export function singleLine(value: unknown, max: number): string {
  return String(value ?? "").replace(LINE_BREAKS, " ").trim().slice(0, max);
}
