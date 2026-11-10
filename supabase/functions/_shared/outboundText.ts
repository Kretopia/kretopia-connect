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

/** An https URL safe to place in an attribute, or null. */
export function safeHttpsUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "https:") return null;
    return escapeHtmlText(u.toString());
  } catch {
    return null;
  }
}

/**
 * Plain user text -> email paragraphs. All markup is escaped; only the
 * [image:URL|alt] and [video:URL|label] markers become https-only tags.
 */
export function plainTextToEmailHtml(body: unknown): string {
  return String(body ?? "")
    .split("\n\n")
    .map((p) => {
      let html = escapeHtmlText(p);
      html = html.replace(/\[image:(https:\/\/[^\]|\s]+)(?:\|([^\]]*))?\]/gi, (m, url, alt) => {
        const safe = safeHttpsUrl(url.replace(/&amp;/g, "&"));
        if (!safe) return m;
        return `<img src="${safe}" alt="${alt || "Embedded image"}" style="max-width: 100%; height: auto; border-radius: 8px; margin: 12px 0; display: block;" />`;
      });
      html = html.replace(/\[video:(https:\/\/[^\]|\s]+)(?:\|([^\]]*))?\]/gi, (m, url, label) => {
        const safe = safeHttpsUrl(url.replace(/&amp;/g, "&"));
        if (!safe) return m;
        return `<a href="${safe}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 10px 20px; background: #8B5CF6; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; margin: 8px 0;">&#9654; ${label || "Watch Video"}</a>`;
      });
      return `<p style="margin: 0 0 12px 0; color: #333; font-size: 14px; line-height: 1.6;">${html.replace(/\n/g, "<br>")}</p>`;
    })
    .join("");
}

/**
 * Host-written rich text -> HTML with an allowlist: everything is escaped,
 * then only bare p/br/strong/b/em/i/u/ul/ol/li tags and https links are
 * restored, with no other attributes.
 */
export function sanitizeEmailHtml(raw: unknown, max = 20_000): string {
  const escaped = escapeHtmlText(String(raw ?? "").slice(0, max));
  return escaped
    .replace(/&lt;(\/?)(p|br|strong|b|em|i|u|ul|ol|li)\s*\/?&gt;/gi, (_m, slash, tag) => `<${slash}${tag.toLowerCase()}>`)
    .replace(/&lt;a\s+href=&quot;(https:\/\/[^\s"<>]*?)&quot;\s*&gt;/gi, (_m, url) => {
      const safe = safeHttpsUrl(url.replace(/&amp;/g, "&"));
      return safe ? `<a href="${safe}" target="_blank" rel="noopener noreferrer">` : "";
    })
    .replace(/&lt;\/a&gt;/gi, "</a>");
}
