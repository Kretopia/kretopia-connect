import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { makeDiscoveryDb } from "./fakeDiscoveryDb";
import { parseHimalayas, parseOpportunityFeed } from "../../../../supabase/functions/_shared/discovery/feeds";
import { candidateToRaw } from "../../../../supabase/functions/_shared/discovery/candidate";
import { parseExtraction } from "../../../../supabase/functions/_shared/discovery/extract";
import { canonicalizeUrl, identityKey, sourceIdentity } from "../../../../supabase/functions/_shared/discovery/canonical";
import { SOURCE_ADAPTERS, adapterById, adapterForUrl } from "../../../../supabase/functions/_shared/discovery/sources";
import { sourceDisplayName, sourceLinkHref, sourceLinkRel } from "../../../../supabase/functions/_shared/discovery/labels";
import { MAX_CANDIDATES_PER_RUN, runDiscovery, type PipelineDeps } from "../../../../supabase/functions/_shared/discovery/pipeline";
import { safeFetchBounded } from "../../../../supabase/functions/_shared/ssrf";

// Himalayas (https://himalayas.app/docs/remote-jobs-api), terms read 2026-10-29: free, no key; a visible credit and link; every apply action on the job's
// own Himalayas page (applicationLink); jobs shown only on Kretopia; a job removed once it expires; nothing passed on to other boards. The fixture is a
// trimmed copy of the real feed.
const text = readFileSync(resolve(__dirname, "fixtures/himalayas.sample.json"), "utf8");
const sample = JSON.parse(text) as { jobs: Record<string, unknown>[] };
const NOW = new Date("2026-10-29T12:00:00Z");

describe("parseHimalayas", () => {
  const jobs = parseHimalayas(sample);

  it("reads every job that has its own Himalayas page, credited to Himalayas", () => {
    expect(jobs).toHaveLength(4);
    for (const j of jobs) {
      expect(j.source_name).toBe("Himalayas");
      expect(j.source_url).toMatch(/^https:\/\/himalayas\.app\/companies\/[a-z0-9-]+\/jobs\/[a-z0-9-]+/);
      expect(j.apply_url).toBe(j.source_url); // every apply action uses applicationLink, never the employer's link
      expect(j.remote).toBe(true);
      expect(j.company).toBeTruthy();
    }
  });

  it("keeps only a short excerpt, never the full description", () => {
    for (const j of jobs) expect(j.description ?? "").not.toContain("full description omitted");
    const base = { title: "Editor", applicationLink: "https://himalayas.app/companies/a/jobs/b", description: "<p>THE FULL JOB TEXT</p>" };
    expect(parseHimalayas({ jobs: [{ ...base, excerpt: "x".repeat(3000) }] })[0].description).toHaveLength(900);
    expect(parseHimalayas({ jobs: [{ ...base, excerpt: "A short summary." }] })[0].description).toBe("A short summary.");
    expect(parseHimalayas({ jobs: [base] })[0].description).toBeNull(); // no excerpt: nothing, not the description
    expect(parseHimalayas({ jobs: [{ ...base, excerpt: "   " }] })[0].description).toBeNull();
  });

  it("a long list of countries is 'N countries', a short one is printed, none is unknown rather than 'worldwide'", () => {
    expect(jobs.find((j) => /Brand Designer/.test(j.title))!.location).toBe("12 countries");
    expect(jobs.find((j) => /Fotógrafo/.test(j.title))!.location).toBeNull();
    expect(jobs.find((j) => /Lead Visual Designer/.test(j.title))!.location).toBe("United States");
  });

  it("a stated pay range with a currency code and a period is structured; anything less stays unknown", () => {
    expect(jobs.find((j) => /Senior Brand Designer/.test(j.title))!.budget).toEqual({ min: 128000, max: 160000, currency: "USD", period: "year" });
    expect(jobs.find((j) => /Fotógrafo/.test(j.title))!.budget).toBeNull();
    const base = { title: "Editor", applicationLink: "https://himalayas.app/companies/a/jobs/b", companyName: "A" };
    for (const pay of [{ minSalary: 0, maxSalary: 0, currency: "USD", salaryPeriod: "annual" }, { minSalary: 50, currency: "usd$", salaryPeriod: "annual" }, { minSalary: 50, currency: "USD", salaryPeriod: "sometimes" }, { minSalary: "lots", currency: "USD", salaryPeriod: "annual" }]) {
      expect(parseHimalayas({ jobs: [{ ...base, ...pay }] })[0].budget, JSON.stringify(pay)).toBeNull();
    }
    expect(parseHimalayas({ jobs: [{ ...base, minSalary: "25", maxSalary: null, currency: "eur", salaryPeriod: "hourly" }] })[0].budget).toEqual({ min: 25, max: null, currency: "EUR", period: "hour" });
  });

  it("dates are the source's own: the posting date and the date it stops listing the job", () => {
    const j = jobs.find((x) => /Senior Brand Designer/.test(x.title))!;
    expect(j.posted_at).toBe(new Date(1793246098 * 1000).toISOString());
    expect(j.expires_at).toBe(new Date(1798430096 * 1000).toISOString());
    const bad = parseHimalayas({ jobs: [{ title: "T", applicationLink: "https://himalayas.app/companies/a/jobs/b", pubDate: "yesterday", expiryDate: -5 }] })[0];
    expect(bad.posted_at).toBeNull();
    expect(bad.expires_at).toBeNull();
  });

  it("skips what cannot be credited or applied to: no Himalayas page (an employer link), no title, not an object", () => {
    const ok = { title: "Editor", applicationLink: "https://himalayas.app/companies/a/jobs/b" };
    const out = parseHimalayas({ jobs: [ok, { ...ok, applicationLink: "https://employer.example/jobs/1" }, { ...ok, applicationLink: "http://himalayas.app/companies/a/jobs/b" }, { applicationLink: ok.applicationLink }, null, "x", 3] });
    expect(out).toHaveLength(1);
  });

  it("an unreadable or unexpected answer is an empty feed, never a partial one", () => {
    expect(parseOpportunityFeed("himalayas", "not json")).toEqual([]);
    expect(parseOpportunityFeed("himalayas", JSON.stringify({ jobs: "nope" }))).toEqual([]);
    expect(parseOpportunityFeed("himalayas", JSON.stringify([]))).toEqual([]);
    expect(parseOpportunityFeed("himalayas", text)).toHaveLength(4);
  });
});

describe("a Himalayas job through the strict extraction", () => {
  const first = parseHimalayas(sample).find((x) => /Senior Brand Designer/.test(x.title))!;
  const r = parseExtraction(candidateToRaw(first), { now: NOW, kind: "gig" });

  it("becomes a draft whose deadline is the source's expiry and whose pay is structured, with nothing guessed", () => {
    expect(r.ok).toBe(true);
    expect(r.draft!.deadline_at).toBe(first.expires_at);
    expect(r.draft!.budget).toEqual({ min: 128000, max: 160000, currency: "USD", period: "year" });
    expect(r.draft!.source_published_at).toBe(first.posted_at);
    expect(r.draft!.flagged_instructions).toBe(false);
  });

  it("other feeds' candidates are mapped exactly as before: no deadline, no budget", () => {
    const raw = candidateToRaw({ source: "gigboard", source_name: "Jobicy", source_url: "https://jobicy.com/jobs/1-a", apply_url: "https://jobicy.com/jobs/1-a", title: "T", company: "C", location: "L", remote: true, description: "d", compensation: "$1", posted_at: null, tags: [] });
    expect(raw).not.toHaveProperty("deadline_at");
    expect(raw).not.toHaveProperty("budget");
  });
});

describe("Himalayas in the registry, the identity rules and the links", () => {
  it("is an approved free source, off by default, reading only its own host with tested search queries", () => {
    const a = adapterById("himalayas")!;
    expect(a).toMatchObject({ name: "Himalayas", kind: "gig", hosts: ["himalayas.app"], requiresCredential: null, costPerCallCents: 0, enabledByDefault: false, feedFormat: "json" });
    expect(a.feedUrls.length).toBeGreaterThan(0);
    expect(a.feedUrls.length).toBeLessThanOrEqual(20); // discovery_sources.max_fetches_per_run is capped at 20
    for (const u of a.feedUrls) {
      const url = new URL(u);
      expect([url.protocol, url.hostname, url.pathname]).toEqual(["https:", "himalayas.app", "/jobs/api/search"]);
      expect(url.searchParams.get("q")).toBeTruthy();
      expect(url.searchParams.get("sort")).toBe("recent");
    }
    expect(a.terms).toMatch(/Credit Himalayas/);
    expect(adapterForUrl("https://himalayas.app/companies/a/jobs/b")?.id).toBe("himalayas");
    expect(SOURCE_ADAPTERS.map((x) => x.id)).toContain("himalayas");
  });

  it("a Himalayas job is identified by company and slug, so the same job from two queries is one listing", () => {
    expect(sourceIdentity("https://himalayas.app/companies/customer-io/jobs/senior-brand-designer")).toEqual({ provider: "himalayas", sourceId: "customer-io/senior-brand-designer" });
    expect(identityKey(canonicalizeUrl("https://himalayas.app/companies/customer-io/jobs/senior-brand-designer?utm_source=api")!)).toBe("himalayas:customer-io/senior-brand-designer");
  });

  it("is credited by name, and its link is the applicationLink as supplied (utm_source=api put back), followed or not as for any other source", () => {
    expect(sourceDisplayName("himalayas")).toBe("Himalayas");
    expect(sourceLinkRel("himalayas")).toBe("noopener noreferrer nofollow");
    const page = "https://himalayas.app/companies/customer-io/jobs/senior-brand-designer";
    expect(sourceLinkHref("himalayas", page)).toBe(`${page}?utm_source=api`);
    expect(sourceLinkHref("himalayas", `${page}?utm_source=api`)).toBe(`${page}?utm_source=api`);
    expect(sourceLinkHref("himalayas", `${page}?ref=x`)).toBe(`${page}?ref=x&utm_source=api`);
    expect(sourceLinkHref("jobicy", "https://jobicy.com/jobs/1-a")).toBe("https://jobicy.com/jobs/1-a");
    expect(sourceLinkHref("himalayas", "https://employer.example/x")).toBe("https://employer.example/x");
    expect(sourceLinkHref("himalayas", null)).toBeUndefined();
  });
});

describe("a bounded run over the Himalayas queries", () => {
  const feedUrls = adapterById("himalayas")!.feedUrls;
  const world = (body: (url: string) => string = () => text) => {
    const calls: string[] = [];
    const fetchImpl = (async (url: string) => {
      calls.push(url);
      return new Response(body(url), { status: 200, headers: { "content-type": "application/json" } });
    }) as unknown as typeof fetch;
    const fetchBounded: PipelineDeps["fetchBounded"] = (url, policy) => safeFetchBounded(url, policy, { fetch: fetchImpl, resolveDns: async (h, t) => (t === "A" && h === "himalayas.app" ? ["104.20.9.9"] : []) });
    return { fetchBounded, calls };
  };
  const source = { id: "himalayas", enabled: true, max_fetches_per_run: feedUrls.length, daily_budget_cents: 0, cost_per_call_cents: 0, lock: false, failures: 0 };
  const job = (n: number) => ({
    title: `Designer ${n}`, companyName: "Acme", applicationLink: `https://himalayas.app/companies/acme/jobs/designer-${n}`, locationRestrictions: [],
    pubDate: 1793246098, expiryDate: 1798430096, excerpt: "A role.",
  });

  it("fetches each query once, imports the same job once, keeps expiry and pay, and publishes nothing", async () => {
    const db = makeDiscoveryDb({ sources: [source] });
    const w = world();
    const res = await runDiscovery({ rpc: db.rpc, from: db.from, fetchBounded: w.fetchBounded, now: () => NOW, claimSecret: "s" });
    expect(w.calls).toEqual(feedUrls);
    // every query returned the same four jobs: they are read 32 times and imported 4 times
    expect(res.ran[0]).toMatchObject({ source: "himalayas", status: "ran", fetched: 4 * feedUrls.length, imported: 4, alreadyKnown: 0, rejected: 0, settledCents: 0 });
    const listings = [...db.listings.values()];
    expect(listings).toHaveLength(4);
    for (const l of listings) expect(l).toMatchObject({ status: "draft", visibility: "private", source_type: "feed", source_provider: "himalayas", created_by: null });
    const brand = listings.find((l) => /Senior Brand Designer/.test(String(l.title)))!;
    expect(brand.identity_key).toBe("himalayas:customer-io/senior-brand-designer");
    expect(brand.deadline_at).toBe(new Date(1798430096 * 1000).toISOString());
    expect(brand.budget).toEqual({ min: 128000, max: 160000, currency: "USD", period: "year" });
    expect(brand.apply_url).toBe("https://himalayas.app/companies/customer-io/jobs/senior-brand-designer");
  });

  it("the next day's run finds them already known and imports nothing twice", async () => {
    const db = makeDiscoveryDb({ sources: [source] });
    const w = world();
    const deps = { rpc: db.rpc, from: db.from, fetchBounded: w.fetchBounded, now: () => NOW, claimSecret: "s" };
    await runDiscovery(deps);
    const next = await runDiscovery({ ...deps, now: () => new Date(NOW.getTime() + 86_400_000) }, { slot: "next" });
    expect(next.ran[0]).toMatchObject({ status: "ran", imported: 0, alreadyKnown: 4 });
    expect(db.listings.size).toBe(4);
  });

  it("queries that overlap do not use up the run's bound: it counts distinct jobs, so the last queries are still read", async () => {
    // Every query returns 20 jobs, 12 of them the same for all queries: 8 x 20 = 160 reads but only 12 + 8 x 8 = 76 distinct jobs.
    const shared = Array.from({ length: 12 }, (_, i) => job(i));
    const body = (url: string) => {
      const q = feedUrls.indexOf(url);
      return JSON.stringify({ jobs: [...shared, ...Array.from({ length: 8 }, (_, i) => job(100 + q * 10 + i))] });
    };
    const db = makeDiscoveryDb({ sources: [source] });
    const w = world(body);
    const res = await runDiscovery({ rpc: db.rpc, from: db.from, fetchBounded: w.fetchBounded, now: () => NOW, claimSecret: "s" });
    expect(res.ran[0]).toMatchObject({ fetched: 160, imported: 76, alreadyKnown: 0, rejected: 0 });
    expect(db.listings.size).toBe(76);
    // the very last query's own jobs are among them
    expect([...db.listings.values()].some((l) => String(l.title) === `Designer ${100 + 7 * 10 + 7}`)).toBe(true);
  });

  it("still never imports more than the run's bound of distinct jobs", async () => {
    const body = (url: string) => JSON.stringify({ jobs: Array.from({ length: 20 }, (_, i) => job(feedUrls.indexOf(url) * 20 + i)) }); // 160 distinct
    const db = makeDiscoveryDb({ sources: [source] });
    const w = world(body);
    const res = await runDiscovery({ rpc: db.rpc, from: db.from, fetchBounded: w.fetchBounded, now: () => NOW, claimSecret: "s" });
    expect(res.ran[0]).toMatchObject({ fetched: 160, imported: MAX_CANDIDATES_PER_RUN });
    expect(db.listings.size).toBe(MAX_CANDIDATES_PER_RUN);
  });
});
