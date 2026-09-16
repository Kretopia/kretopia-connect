// Shared SSRF guard for server-side URL fetching.
// Blocks loopback, private, link-local, metadata and reserved ranges,
// re-validating after every redirect hop.

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata",
  "metadata.google.internal",
]);

function ipv4ToParts(host: string): number[] | null {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  if (parts.some((p) => p > 255)) return null;
  return parts;
}

export function isBlockedIp(ip: string): boolean {
  const v4 = ipv4ToParts(ip);
  if (v4) {
    const [a, b] = v4;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local + cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 192 && b === 0) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // multicast / reserved
    return false;
  }
  // IPv6
  const v6 = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (v6 === "::" || v6 === "::1") return true;
  if (v6.startsWith("fe80") || v6.startsWith("fc") || v6.startsWith("fd")) return true;
  if (v6.startsWith("::ffff:")) return isBlockedIp(v6.slice(7));
  return false;
}

async function assertHostAllowed(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http(s) URLs are allowed");
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (BLOCKED_HOSTNAMES.has(host) || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("Blocked host");
  }
  if (ipv4ToParts(host) || host.includes(":")) {
    if (isBlockedIp(host)) throw new Error("Blocked address");
    return;
  }

  let resolved: string[] = [];
  try {
    const [a, aaaa] = await Promise.all([
      Deno.resolveDns(host, "A").catch(() => [] as string[]),
      Deno.resolveDns(host, "AAAA").catch(() => [] as string[]),
    ]);
    resolved = [...a, ...aaaa];
  } catch {
    resolved = [];
  }
  // Fail closed when a hostname resolves to anything internal.
  if (resolved.some((ip) => isBlockedIp(ip))) throw new Error("Blocked address");
}

/**
 * Fetch a user-supplied URL safely: validates every hop manually,
 * caps redirects, and enforces a timeout.
 */
export async function safeFetch(
  rawUrl: string | URL,
  init: RequestInit = {},
  opts: { maxRedirects?: number; timeoutMs?: number } = {},
): Promise<{ response: Response; finalUrl: URL }> {
  const maxRedirects = opts.maxRedirects ?? 3;
  const timeoutMs = opts.timeoutMs ?? 8000;

  let current = new URL(String(rawUrl));
  for (let hop = 0; hop <= maxRedirects; hop++) {
    await assertHostAllowed(current);

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(current.toString(), {
        ...init,
        redirect: "manual",
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      await res.body?.cancel().catch(() => {});
      if (!loc) return { response: res, finalUrl: current };
      current = new URL(loc, current);
      continue;
    }
    return { response: res, finalUrl: current };
  }
  throw new Error("Too many redirects");
}
