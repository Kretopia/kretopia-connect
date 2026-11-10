/**
 * A caller-supplied profile/page URL accepted for server-side fetching or
 * third-party scraping: an absolute http(s) URL on a public DNS name, default
 * port, no credentials, no IP literal or internal-looking host. safeFetch still
 * re-checks resolved addresses; this keeps the same rule for the scraping
 * provider, which never goes through safeFetch.
 */
export function parsePublicPageUrl(raw: unknown): URL | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value || value.length > 2048) return null;
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (u.username || u.password || u.port) return null;
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  if (!host.includes(".")) return null;
  if (/^[\d.]+$/.test(host) || host.includes(":") || host.startsWith("[")) return null;
  if (/(^|\.)(localhost|local|internal|intranet|lan|home|corp|localdomain)$/.test(host)) return null;
  if (host.endsWith(".supabase.co") || host.endsWith(".supabase.in")) return null;
  return u;
}
