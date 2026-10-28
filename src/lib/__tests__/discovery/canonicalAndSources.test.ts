import { describe, expect, it } from "vitest";
import { canonicalizeUrl, identityKey, sourceIdentity } from "../../../../supabase/functions/_shared/discovery/canonical";
import { adapterById, adapterForUrl, approvedHosts, enableBlocker, SOURCE_ADAPTERS } from "../../../../supabase/functions/_shared/discovery/sources";

describe("canonicalizeUrl: the same posting collapses, different postings never do", () => {
  it("drops tracking parameters, the fragment, www, the default port, a trailing slash and index.html", () => {
    const a = canonicalizeUrl("https://www.Example.com:443/jobs/42/?utm_source=x&b=2&a=1&fbclid=zz#apply");
    const b = canonicalizeUrl("http://example.com/jobs/42?a=1&b=2");
    const c = canonicalizeUrl("https://example.com/jobs/42/index.html?a=1&b=2&ref=newsletter");
    expect(a).toBe("https://example.com/jobs/42?a=1&b=2");
    expect(b).toBe(a);
    expect(c).toBe(a);
  });

  it("keeps parameters that identify the posting", () => {
    expect(canonicalizeUrl("https://boards.example.com/view?id=100")).not.toBe(canonicalizeUrl("https://boards.example.com/view?id=101"));
    expect(canonicalizeUrl("https://example.com/jobs/1")).not.toBe(canonicalizeUrl("https://example.com/jobs/2"));
  });

  it("refuses anything that is not a plain web URL", () => {
    for (const bad of ["javascript:alert(1)", "ftp://x.com/a", "https://user:pw@example.com/a", "not a url", "", null, undefined, "data:text/html,<b>x</b>"]) {
      expect(canonicalizeUrl(bad as string)).toBeNull();
    }
  });
});

describe("source identity and the dedupe key", () => {
  it("uses the provider's own id when an approved adapter exposes one", () => {
    expect(sourceIdentity("https://remoteok.com/remote-jobs/remote-senior-video-editor-acme-1098765")).toEqual({ provider: "remoteok", sourceId: "1098765" });
    expect(sourceIdentity("https://jobicy.com/jobs/12345-motion-designer")).toEqual({ provider: "jobicy", sourceId: "12345" });
    expect(sourceIdentity("https://weworkremotely.com/remote-jobs/acme-brand-designer")).toEqual({ provider: "weworkremotely", sourceId: "acme-brand-designer" });
  });

  it("the same posting with different tracking has ONE key; two postings have two", () => {
    const k1 = identityKey(canonicalizeUrl("https://remoteok.com/remote-jobs/x-editor-1098765?utm_medium=feed")!);
    const k2 = identityKey(canonicalizeUrl("https://www.remoteok.com/remote-jobs/y-editor-1098765#top")!);
    const k3 = identityKey(canonicalizeUrl("https://remoteok.com/remote-jobs/x-editor-1098766")!);
    expect(k1).toBe("remoteok:1098765");
    expect(k2).toBe(k1);
    expect(k3).not.toBe(k1);
  });

  it("falls back to the canonical URL for a site with no adapter", () => {
    expect(identityKey("https://studio.example.com/jobs/7")).toBe("url:https://studio.example.com/jobs/7");
  });
});

describe("the approved source registry", () => {
  it("every adapter is disabled by default", () => {
    expect(SOURCE_ADAPTERS.every((a) => a.enabledByDefault === false)).toBe(true);
  });

  it("matches a URL to its adapter by host, and only by host", () => {
    expect(adapterForUrl("https://remoteok.com/remote-jobs/x-1098765")?.id).toBe("remoteok");
    expect(adapterForUrl("https://www.arbeitnow.com/jobs/abc")?.id).toBe("arbeitnow");
    expect(adapterForUrl("https://remoteok.com.evil.net/x")).toBeNull();
    expect(adapterForUrl("https://www.linkedin.com/jobs/view/1")).toBeNull();
    expect(adapterForUrl("nonsense")).toBeNull();
  });

  it("Remotive is not an approved source (its terms forbid showing jobs behind a sign-up wall)", () => {
    expect(approvedHosts().some((h) => h.includes("remotive"))).toBe(false);
  });

  it("an adapter with an unknown cost, or a missing credential, cannot be enabled", () => {
    const search = adapterById("web-search")!;
    expect(enableBlocker(search, { get: () => "set" })).toBe("cost per call is unknown");
    expect(enableBlocker(adapterById("remoteok")!, { get: () => undefined })).toBeNull();
    expect(enableBlocker({ ...search, costPerCallCents: 3 }, { get: () => undefined })).toBe("missing credential FIRECRAWL_API_KEY");
  });
});
