import { APP_URL } from "@/lib/constants";
import { safeQrPayload } from "@/lib/safeUrl";

/**
 * What a QR code or a share sheet may carry: a link, never a bare id.
 *
 * A code is read by the phone's camera, outside the app, and a share sheet hands its payload to WhatsApp or Mail. A bare identifier (a hash,
 * a uuid, a token) there is just text: the Event pass used to encode its check-in token alone, so scanning it offered "255ec752…" to copy and
 * send. So both take an absolute https URL on a public host (safeQrPayload's rules, plus https and a real host), or nothing.
 */

// A host a stranger's phone cannot reach.
const PRIVATE_HOST = /^(localhost|.*\.local|.*\.internal|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/i;

/** The URL, normalised, when it is absolute https on a public host; undefined for anything else (a bare id, a path, http, localhost). */
export function publicUrl(raw: string | null | undefined): string | undefined {
  const url = safeQrPayload(raw);
  if (!url) return undefined;
  const { protocol, hostname } = new URL(url);
  if (protocol !== "https:" || !hostname.includes(".") || PRIVATE_HOST.test(hostname)) return undefined;
  return url;
}

export const isPublicUrl = (raw: string | null | undefined): boolean => publicUrl(raw) !== undefined;

/**
 * The guest pass as a link: the public page that shows the pass (/event/:id/pass, open to a visitor who is not signed in), carrying the pass
 * token the guest was given. It is the same link the confirmation email sends; the token is what the pass is, so it is not hidden, but nothing
 * else about the guest (no name, no email) is in it.
 */
export const buildPassUrl = (eventId: string, token: string): string =>
  `${APP_URL}/event/${encodeURIComponent(eventId)}/pass?token=${encodeURIComponent(token)}`;

/**
 * What the check-in desk reads from a scanned code or a pasted value: the token inside a pass link, or the value itself when it is a bare
 * token (the passes issued before the code carried a link, still in emails and screenshots, keep working).
 */
export function parsePassToken(scanned: string | null | undefined): string {
  const value = (scanned ?? "").trim();
  if (!/^https?:\/\//i.test(value)) return value;
  try {
    return new URL(value).searchParams.get("token")?.trim() || value;
  } catch {
    return value;
  }
}

// A message that is only an identifier (hex, uuid) says nothing to the person who receives it.
const BARE_IDENTIFIER = /^[0-9a-f]{16,}$|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * What a share sheet gets: the link, and a short message for people that neither is the link nor repeats it. Null when the link is not a
 * public absolute URL, so a caller falls back to copying instead of sharing something unusable.
 */
export function buildShareData({ title, message, url }: { title: string; message?: string | null; url: string }): { title: string; text: string; url: string } | null {
  const link = publicUrl(url);
  if (!link) return null;
  const text = (message ?? "").split(link).join("").trim();
  return { title, text: !text || BARE_IDENTIFIER.test(text) ? title : text, url: link };
}
