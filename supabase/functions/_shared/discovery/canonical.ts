// Canonical URL and source identity for external listings. Pure: no Deno globals, no remote imports.
//
// Two imports of the same posting must collapse to ONE listing whatever tracking parameters, fragment or trailing
// slash the link carries, and two different postings must never collapse. Identity is `provider:sourceId` when an
// approved adapter exposes a stable id, otherwise the canonical URL itself.

const TRACKING_PARAMS = new Set([
  "fbclid", "gclid", "dclid", "msclkid", "mc_cid", "mc_eid", "igshid", "ref", "ref_src", "referrer", "source", "src",
  "campaign", "cmpid", "trk", "trkid", "_hsenc", "_hsmi", "vero_id", "yclid", "twclid", "li_fat_id", "gh_src",
]);

export function canonicalizeUrl(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (u.username || u.password) return null; // never store or compare credentials
  u.hash = "";
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
  if ((u.protocol === "https:" && u.port === "443") || (u.protocol === "http:" && u.port === "80")) u.port = "";
  const kept: [string, string][] = [];
  for (const [k, v] of u.searchParams) {
    const key = k.toLowerCase();
    if (key.startsWith("utm_") || TRACKING_PARAMS.has(key)) continue;
    kept.push([k, v]);
  }
  kept.sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])));
  u.search = "";
  for (const [k, v] of kept) u.searchParams.append(k, v);
  let path = u.pathname.replace(/\/index\.html?$/i, "/").replace(/\/{2,}/g, "/");
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  u.pathname = path;
  u.protocol = "https:"; // a posting is the same posting over http and https
  return u.toString();
}

export interface SourceIdentity {
  provider: string;
  /** The provider's own id for the posting, or null when only the URL identifies it. */
  sourceId: string | null;
}

export function sourceIdentity(canonicalUrl: string): SourceIdentity {
  let u: URL;
  try {
    u = new URL(canonicalUrl);
  } catch {
    return { provider: "unknown", sourceId: null };
  }
  const host = u.hostname;
  const path = u.pathname;
  if (host === "remoteok.com") {
    const m = path.match(/-(\d{5,})$/) ?? path.match(/^\/l\/(\d{5,})$/);
    return { provider: "remoteok", sourceId: m ? m[1] : null };
  }
  if (host === "jobicy.com") {
    const m = path.match(/^\/jobs\/(\d+)(?:-|$)/);
    return { provider: "jobicy", sourceId: m ? m[1] : null };
  }
  if (host === "weworkremotely.com") {
    const m = path.match(/^\/remote-jobs\/([a-z0-9-]+)$/);
    return { provider: "weworkremotely", sourceId: m ? m[1] : null };
  }
  if (host === "arbeitnow.com") {
    const m = path.match(/^\/jobs\/([a-z0-9-]+)$/);
    return { provider: "arbeitnow", sourceId: m ? m[1] : null };
  }
  if (host === "himalayas.app") {
    const m = path.match(/^\/companies\/([a-z0-9-]+)\/jobs\/([a-z0-9-]+)\/?$/);
    return { provider: "himalayas", sourceId: m ? `${m[1]}/${m[2]}` : null };
  }
  return { provider: host, sourceId: null };
}

/** The key two imports are deduplicated on. Stable across tracking parameters and fragments. */
export function identityKey(canonicalUrl: string): string {
  const { provider, sourceId } = sourceIdentity(canonicalUrl);
  return sourceId ? `${provider}:${sourceId}` : `url:${canonicalUrl}`;
}
