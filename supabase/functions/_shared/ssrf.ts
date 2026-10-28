// Shared SSRF guard for server-side URL fetching.

// The Deno global, declared so this file also type-checks when the app's tests import it (the edge runtime provides it).
declare const Deno: { resolveDns(host: string, type: "A" | "AAAA"): Promise<string[]> };
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
    if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
    if (a >= 224) return true; // multicast / reserved
    return false;
  }
  // IPv6
  const v6 = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (v6 === "::" || v6 === "::1") return true;
  if (v6.startsWith("fe80") || v6.startsWith("fc") || v6.startsWith("fd")) return true;
  if (/^fe[c-f][0-9a-f]:/.test(v6)) return true; // site-local (fec0::/10)
  // An IPv4 address carried in IPv6: ::ffff:7f00:1, ::7f00:1, 64:ff9b::7f00:1 (the URL parser writes
  // [::ffff:127.0.0.1] in this hex form).
  const carried = v6.match(/^(?:::(?:ffff:)?|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (carried) {
    const hi = parseInt(carried[1], 16);
    const lo = parseInt(carried[2], 16);
    return isBlockedIp(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  }
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


// ── Bounded fetch for discovery (external listings) ─────────────────────────────────────────────
//
// safeFetch above is for "fetch whatever URL the user typed". External discovery needs more: an approved list of
// hosts, HTTPS only, bounded ports, no credentials in the URL, a MIME allowlist and a hard size cap, and every
// redirect hop re-checked against ALL of that. A model-proposed URL never reaches this function: callers pass URLs
// that came from an approved source adapter or from the user's own paste.
//
// Known limit, stated rather than hidden: fetch() resolves the name again when it connects, so a DNS answer that
// changes between our check and the connection (rebinding) cannot be pinned from this runtime. The approved-host list
// is what bounds that risk (only named public sites can be fetched); with `allowedHosts` unset the policy is NOT
// safe for untrusted callers and must not be used for them.

export type FetchErrorCode =
  | "bad_url" | "scheme" | "credentials" | "port" | "host_not_approved" | "blocked_host" | "blocked_address"
  | "unresolvable" | "redirects" | "mime" | "too_large" | "timeout" | "network";

export class FetchPolicyError extends Error {
  constructor(public code: FetchErrorCode, message: string) {
    super(message);
    this.name = "FetchPolicyError";
  }
}

export interface FetchPolicy {
  /** Exact hosts or "*.example.com". Required for untrusted callers. */
  allowedHosts?: string[];
  httpsOnly?: boolean; // default true
  allowedPorts?: number[]; // default [443]
  maxRedirects?: number; // default 2
  timeoutMs?: number; // default 8000
  maxBytes?: number; // default 1 MB
  /** Content-Type prefixes, e.g. ["text/html", "application/json"]. Default: html, json, xml, plain text. */
  allowedMime?: string[];
}

export interface FetchDeps {
  fetch?: typeof fetch;
  resolveDns?: (host: string, type: "A" | "AAAA") => Promise<string[]>;
}

export interface BoundedResult {
  status: number;
  finalUrl: string;
  contentType: string;
  text: string;
}

const DEFAULT_MIME = ["text/html", "application/json", "application/xml", "text/xml", "application/rss+xml", "application/atom+xml", "text/plain"];

export function hostMatches(host: string, patterns: string[]): boolean {
  const h = host.toLowerCase().replace(/\.$/, "");
  return patterns.some((raw) => {
    const p = raw.toLowerCase();
    return p.startsWith("*.") ? h.endsWith(p.slice(1)) && h.length > p.length - 1 : h === p;
  });
}

async function checkHop(url: URL, policy: FetchPolicy, deps: FetchDeps): Promise<void> {
  const httpsOnly = policy.httpsOnly ?? true;
  if (url.protocol !== "https:" && !(url.protocol === "http:" && !httpsOnly)) {
    throw new FetchPolicyError("scheme", "Only https URLs are allowed");
  }
  if (url.username || url.password) throw new FetchPolicyError("credentials", "URLs with credentials are not allowed");
  const port = url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80;
  if (!(policy.allowedPorts ?? [443]).includes(port)) throw new FetchPolicyError("port", "Port not allowed");

  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host) throw new FetchPolicyError("bad_url", "Missing host");
  if (BLOCKED_HOSTNAMES.has(host) || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new FetchPolicyError("blocked_host", "Blocked host");
  }
  if (ipv4ToParts(host) || host.includes(":")) {
    if (isBlockedIp(host)) throw new FetchPolicyError("blocked_address", "Blocked address");
    if (policy.allowedHosts && !hostMatches(host, policy.allowedHosts)) throw new FetchPolicyError("host_not_approved", "Host is not approved");
    return;
  }
  if (policy.allowedHosts && !hostMatches(host, policy.allowedHosts)) throw new FetchPolicyError("host_not_approved", "Host is not approved");

  const resolve = deps.resolveDns ?? (typeof Deno !== "undefined" ? (h: string, t: "A" | "AAAA") => Deno.resolveDns(h, t) : undefined);
  if (!resolve) throw new FetchPolicyError("unresolvable", "No DNS resolver available");
  const [a, aaaa] = await Promise.all([
    resolve(host, "A").catch(() => [] as string[]),
    resolve(host, "AAAA").catch(() => [] as string[]),
  ]);
  const resolved = [...a, ...aaaa];
  if (resolved.length === 0) throw new FetchPolicyError("unresolvable", "Host did not resolve");
  if (resolved.some((ip) => isBlockedIp(ip))) throw new FetchPolicyError("blocked_address", "Blocked address");
}

async function readBounded(res: Response, maxBytes: number): Promise<string> {
  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await res.body?.cancel().catch(() => {});
    throw new FetchPolicyError("too_large", "Response too large");
  }
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new FetchPolicyError("too_large", "Response too large");
    }
    chunks.push(value);
  }
  const all = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    all.set(c, at);
    at += c.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(all);
}

export async function safeFetchBounded(rawUrl: string | URL, policy: FetchPolicy = {}, deps: FetchDeps = {}): Promise<BoundedResult> {
  const doFetch = deps.fetch ?? fetch;
  const maxRedirects = policy.maxRedirects ?? 2;
  const timeoutMs = policy.timeoutMs ?? 8000;
  const maxBytes = policy.maxBytes ?? 1_000_000;
  const mimes = policy.allowedMime ?? DEFAULT_MIME;

  let current: URL;
  try {
    current = new URL(String(rawUrl));
  } catch {
    throw new FetchPolicyError("bad_url", "Not a valid URL");
  }

  for (let hop = 0; hop <= maxRedirects; hop++) {
    await checkHop(current, policy, deps);

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res: Response;
    try {
      res = await doFetch(current.toString(), {
        method: "GET",
        redirect: "manual",
        signal: ctrl.signal,
        headers: { Accept: "text/html,application/json,application/xml;q=0.9,*/*;q=0.1", "User-Agent": "KretopiaBot/1.0 (+https://www.kretopia.com)" },
      });
    } catch (e) {
      clearTimeout(timer);
      if (ctrl.signal.aborted) throw new FetchPolicyError("timeout", "Request timed out");
      throw new FetchPolicyError("network", e instanceof Error ? e.message : "Network error");
    }

    try {
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        await res.body?.cancel().catch(() => {});
        if (!loc) throw new FetchPolicyError("redirects", "Redirect without a location");
        try {
          current = new URL(loc, current);
        } catch {
          throw new FetchPolicyError("bad_url", "Redirect to an invalid URL");
        }
        continue;
      }

      const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
      if (!mimes.some((m) => contentType.startsWith(m))) {
        await res.body?.cancel().catch(() => {});
        throw new FetchPolicyError("mime", `Content type not allowed: ${contentType || "unknown"}`);
      }
      const text = await Promise.race([
        readBounded(res, maxBytes),
        new Promise<never>((_, reject) => ctrl.signal.addEventListener("abort", () => reject(new FetchPolicyError("timeout", "Request timed out")))),
      ]);
      return { status: res.status, finalUrl: current.toString(), contentType, text };
    } finally {
      clearTimeout(timer);
    }
  }
  throw new FetchPolicyError("redirects", "Too many redirects");
}
