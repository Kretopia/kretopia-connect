import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Loaded dynamically: the module uses the Deno global, which the app's type check does not know.
let isBlockedIp: (ip: string) => boolean;
let safeFetch: (url: string, init?: RequestInit) => Promise<{ response: Response; finalUrl: URL }>;

const dns = vi.hoisted(() => ({ answers: {} as Record<string, string[]> }));
const fetchMock = vi.fn();

beforeAll(async () => {
  (globalThis as any).Deno = {
    resolveDns: async (host: string, type: string) => (type === "A" ? dns.answers[host] ?? ["93.184.216.34"] : []),
  };
  const dir = "_shared";
  ({ isBlockedIp, safeFetch } = await import(`../../../supabase/functions/${dir}/ssrf.ts`));
});
beforeEach(() => {
  dns.answers = {};
  fetchMock.mockReset();
  vi.stubGlobal("fetch", (...a: unknown[]) => fetchMock(...a));
});
afterEach(() => vi.unstubAllGlobals());

describe("isBlockedIp", () => {
  it.each([
    "127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "169.254.170.2",
    "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "::", "fe80::1", "fd00::1", "fc00::1",
    // IPv4 carried inside IPv6, including the hex form the URL parser produces
    "::ffff:127.0.0.1", "::ffff:7f00:1", "[::ffff:a9fe:a9fe]", "::7f00:1", "64:ff9b::7f00:1", "::ffff:a00:1", "::ffff:c0a8:101",
  ])("blocks %s", (ip) => {
    expect(isBlockedIp(ip)).toBe(true);
  });

  it.each(["8.8.8.8", "1.1.1.1", "172.15.0.1", "172.32.0.1", "93.184.216.34", "2606:4700:4700::1111", "::ffff:808:808", "64:ff9b::808:808"])(
    "allows %s",
    (ip) => {
      expect(isBlockedIp(ip)).toBe(false);
    },
  );
});

describe("safeFetch", () => {
  it.each([
    "http://[::ffff:127.0.0.1]/",
    "http://[::ffff:169.254.169.254]/latest/meta-data",
    "http://0x7f000001/",
    "http://2130706433/",
    "http://127.1/",
    "http://localhost/",
    "http://metadata.google.internal/",
    "http://printer.local/",
    "http://[::1]:8080/",
  ])("refuses %s without making a request", async (url) => {
    await expect(safeFetch(url)).rejects.toThrow(/Blocked/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses schemes other than http(s)", async () => {
    await expect(safeFetch("file:///etc/passwd")).rejects.toThrow(/Only http/);
    await expect(safeFetch("ftp://example.com/x")).rejects.toThrow(/Only http/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a hostname that resolves to an internal address", async () => {
    dns.answers["sneaky.example"] = ["10.0.0.5"];
    await expect(safeFetch("https://sneaky.example/")).rejects.toThrow(/Blocked address/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("validates every redirect hop: a public page cannot bounce the request to an internal address", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data" } }));
    await expect(safeFetch("https://good.example/start")).rejects.toThrow(/Blocked address/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://good.example/start");
  });

  it("follows a harmless redirect, never lets fetch follow on its own, and reports the final URL", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: "/final" } }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    const { response, finalUrl } = await safeFetch("https://good.example/start");
    expect(await response.text()).toBe("ok");
    expect(finalUrl.toString()).toBe("https://good.example/final");
    expect(fetchMock.mock.calls.every((c) => (c[1] as RequestInit).redirect === "manual")).toBe(true);
  });

  it("gives up after too many redirects", async () => {
    fetchMock.mockImplementation(async () => new Response(null, { status: 302, headers: { location: "https://good.example/loop" } }));
    await expect(safeFetch("https://good.example/loop")).rejects.toThrow(/Too many redirects/);
  });
});
