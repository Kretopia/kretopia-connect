import { describe, expect, it, vi } from "vitest";
import { FetchPolicyError, hostMatches, isBlockedIp, safeFetchBounded, type FetchPolicy } from "../../../supabase/functions/_shared/ssrf";

// The discovery fetch gateway: an approved list of hosts, https only, bounded ports, no credentials, a MIME allowlist,
// a hard size cap, and every redirect hop re-checked against all of it. Real DNS and real network are replaced by
// injected fakes, so a blocked destination is proved blocked BEFORE any connection would be made.
const POLICY: FetchPolicy = { allowedHosts: ["jobs.example.com", "*.feeds.example.org"] };

const DNS: Record<string, string[]> = {
  "jobs.example.com": ["93.184.216.34"],
  "api.feeds.example.org": ["93.184.216.35"],
  "evil.feeds.example.org": ["10.0.0.5"], // an approved name that resolves inside the network
  "rebind.feeds.example.org": ["93.184.216.36", "169.254.169.254"], // one public and one metadata answer
  "empty.feeds.example.org": [],
};
const resolveDns = vi.fn(async (host: string, type: "A" | "AAAA") => (type === "A" ? DNS[host] ?? [] : []));

function reply(body: string, init: { status?: number; headers?: Record<string, string> } = {}) {
  return new Response(body, { status: init.status ?? 200, headers: { "content-type": "text/html", ...(init.headers ?? {}) } });
}
const redirect = (to: string, status = 302) => new Response(null, { status, headers: { location: to } });

const run = (url: string, fetchImpl: typeof fetch, policy: FetchPolicy = POLICY) => safeFetchBounded(url, policy, { fetch: fetchImpl, resolveDns });
const failsWith = async (p: Promise<unknown>, code: string) => {
  await expect(p).rejects.toBeInstanceOf(FetchPolicyError);
  await expect(p).rejects.toMatchObject({ code });
};

describe("safeFetchBounded: what it refuses before connecting", () => {
  const never = vi.fn(async () => reply("never"));

  it("a private, loopback, link-local or metadata address as the host", async () => {
    for (const url of ["https://127.0.0.1/", "https://10.1.2.3/", "https://192.168.0.9/", "https://169.254.169.254/latest/meta-data", "https://[::1]/", "https://[fe80::1]/", "https://[::ffff:127.0.0.1]/", "https://[fec0::1]/", "https://198.18.0.1/"]) {
      await failsWith(run(url, never, { allowedHosts: undefined }), "blocked_address");
    }
    expect(never).not.toHaveBeenCalled();
  });

  it("an approved name that resolves to an internal address, or to a mix with one", async () => {
    await failsWith(run("https://evil.feeds.example.org/", never), "blocked_address");
    await failsWith(run("https://rebind.feeds.example.org/", never), "blocked_address");
    expect(never).not.toHaveBeenCalled();
  });

  it("a name that does not resolve fails closed", async () => {
    await failsWith(run("https://empty.feeds.example.org/", never), "unresolvable");
  });

  it("a host that is not on the approved list, even if it is public", async () => {
    await failsWith(run("https://www.google.com/", never), "host_not_approved");
    await failsWith(run("https://jobs.example.com.attacker.net/", never), "host_not_approved");
    await failsWith(run("https://feeds.example.org/", never), "host_not_approved"); // the wildcard needs a subdomain
    expect(never).not.toHaveBeenCalled();
  });

  it("plain http, other ports, credentials in the URL, non-web schemes and nonsense", async () => {
    await failsWith(run("http://jobs.example.com/", never), "scheme");
    await failsWith(run("https://jobs.example.com:8443/", never), "port");
    await failsWith(run("https://user:pass@jobs.example.com/", never), "credentials");
    await failsWith(run("file:///etc/passwd", never), "scheme");
    await failsWith(run("ftp://jobs.example.com/", never), "scheme");
    await failsWith(run("not a url", never), "bad_url");
    expect(never).not.toHaveBeenCalled();
  });

  it("local names", async () => {
    for (const url of ["https://localhost/", "https://metadata.google.internal/", "https://printer.local/"]) {
      await failsWith(run(url, never, { allowedHosts: undefined }), "blocked_host");
    }
  });
});

describe("safeFetchBounded: redirects are checked hop by hop", () => {
  it("follows a redirect inside the approved set and returns the final URL", async () => {
    const f = vi.fn(async (u: string) => (u.endsWith("/old") ? redirect("https://api.feeds.example.org/new") : reply("<p>ok</p>")));
    const r = await run("https://jobs.example.com/old", f as unknown as typeof fetch);
    expect(r.finalUrl).toBe("https://api.feeds.example.org/new");
    expect(r.text).toBe("<p>ok</p>");
  });

  it("refuses a redirect to a private address, to metadata, to http, to another port, and to an unapproved host", async () => {
    for (const [target, code] of [
      ["https://10.0.0.1/admin", "blocked_address"],
      ["https://169.254.169.254/latest/meta-data/", "blocked_address"],
      ["http://api.feeds.example.org/", "scheme"],
      ["https://api.feeds.example.org:9000/", "port"],
      ["https://www.google.com/", "host_not_approved"],
      ["https://evil.feeds.example.org/", "blocked_address"],
    ] as const) {
      const f = vi.fn(async (u: string) => (u === "https://jobs.example.com/start" ? redirect(target) : reply("leaked")));
      await failsWith(run("https://jobs.example.com/start", f as unknown as typeof fetch, target.includes("169.254") || target.includes("10.0.0.1") ? { allowedHosts: ["jobs.example.com", "10.0.0.1", "169.254.169.254"] } : POLICY), code);
      expect(f).toHaveBeenCalledTimes(1); // the second hop was never fetched
    }
  });

  it("caps the number of redirects", async () => {
    const f = vi.fn(async () => redirect("https://jobs.example.com/again"));
    await failsWith(run("https://jobs.example.com/a", f as unknown as typeof fetch), "redirects");
    expect(f).toHaveBeenCalledTimes(3); // the first request plus two redirects
  });

  it("a redirect with no location is an error, not a success", async () => {
    await failsWith(run("https://jobs.example.com/x", (async () => new Response(null, { status: 302 })) as unknown as typeof fetch), "redirects");
  });
});

describe("safeFetchBounded: what it does with the answer", () => {
  it("returns bounded text for an allowed type", async () => {
    const r = await run("https://jobs.example.com/", (async () => reply('{"a":1}', { headers: { "content-type": "application/json; charset=utf-8" } })) as unknown as typeof fetch);
    expect(r.status).toBe(200);
    expect(r.contentType).toContain("application/json");
    expect(r.text).toBe('{"a":1}');
  });

  it("refuses a type that is not on the allowlist (an executable, an archive, an image)", async () => {
    for (const type of ["application/octet-stream", "application/zip", "image/png", "application/x-msdownload"]) {
      await failsWith(run("https://jobs.example.com/", (async () => reply("x", { headers: { "content-type": type } })) as unknown as typeof fetch), "mime");
    }
  });

  it("refuses an oversized answer, declared or streamed", async () => {
    const policy = { ...POLICY, maxBytes: 100 };
    await failsWith(run("https://jobs.example.com/", (async () => reply("x".repeat(50), { headers: { "content-length": "5000" } })) as unknown as typeof fetch, policy), "too_large");
    await failsWith(run("https://jobs.example.com/", (async () => reply("x".repeat(500))) as unknown as typeof fetch, policy), "too_large");
  });

  it("times out on a request that never answers", async () => {
    const hang = ((_: string, init: RequestInit) =>
      new Promise((_resolve, reject) => init.signal!.addEventListener("abort", () => reject(new Error("aborted"))))) as unknown as typeof fetch;
    await failsWith(run("https://jobs.example.com/", hang, { ...POLICY, timeoutMs: 20 }), "timeout");
  });

  it("sends no credentials or cookies of ours and identifies itself", async () => {
    const f = vi.fn(async () => reply("ok"));
    await run("https://jobs.example.com/", f as unknown as typeof fetch);
    const init = (f.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init.redirect).toBe("manual");
    expect(String((init.headers as Record<string, string>)["User-Agent"])).toContain("KretopiaBot");
    expect(Object.keys(init.headers as object).map((k) => k.toLowerCase())).not.toContain("authorization");
    expect(Object.keys(init.headers as object).map((k) => k.toLowerCase())).not.toContain("cookie");
  });
});

describe("hostMatches and isBlockedIp additions", () => {
  it("matches exact hosts and subdomains of a wildcard, never the bare parent or a lookalike", () => {
    expect(hostMatches("a.feeds.example.org", ["*.feeds.example.org"])).toBe(true);
    expect(hostMatches("feeds.example.org", ["*.feeds.example.org"])).toBe(false);
    expect(hostMatches("feeds.example.org.evil.net", ["*.feeds.example.org"])).toBe(false);
    expect(hostMatches("JOBS.EXAMPLE.COM.", ["jobs.example.com"])).toBe(true);
  });

  it("blocks the benchmarking and site-local ranges too", () => {
    expect(isBlockedIp("198.18.5.5")).toBe(true);
    expect(isBlockedIp("198.20.0.1")).toBe(false);
    expect(isBlockedIp("fec0::1")).toBe(true);
    expect(isBlockedIp("2606:4700:4700::1111")).toBe(false);
  });
});
