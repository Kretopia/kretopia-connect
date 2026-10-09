import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearFeedCache,
  firecrawlToCandidate,
  hasTerm,
  htmlToText,
  isEligible,
  isGenericListingUrl,
  loadPublicFeeds,
  parseArbeitnow,
  parseJobicy,
  parseRemoteOk,
  parseWeWorkRemotely,
  rankCandidates,
  scoreCandidate,
  type ScoutCandidate,
  type ScoutPrefsLite,
  type ScoutProfile,
} from "../../../supabase/functions/_shared/scoutSources";

const NOW = new Date("2026-10-09T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

const PREFS: ScoutPrefsLite = {
  extra_keywords: null, exclude_keywords: null, remote_only: false, min_fit_score: 60,
  job_types: null, employment_types: null, locations: null, travel_ok: false,
};
const MOTION: ScoutProfile = {
  role: "Motion Designer", sub_roles: ["3D Animator"], skills: ["After Effects", "Cinema 4D"], location: "Paris, France", bio: "",
};
const THIN: ScoutProfile = { role: null, sub_roles: null, skills: null, location: null, bio: null };

const job = (over: Partial<ScoutCandidate> = {}): ScoutCandidate => ({
  source: "gigboard", source_name: "Remote OK", source_url: "https://remoteok.com/remote-jobs/motion-designer-123",
  apply_url: "https://remoteok.com/remote-jobs/motion-designer-123", title: "Motion Designer", company: "Acme",
  location: "Worldwide", remote: true, description: "Make things move with After Effects.", compensation: null,
  posted_at: daysAgo(1), tags: ["design", "motion"], ...over,
});

describe("text helpers", () => {
  it("turns escaped and plain HTML into readable text", () => {
    expect(htmlToText("&lt;p&gt;Hello &amp;amp; welcome&lt;/p&gt;&lt;p&gt;Second&lt;/p&gt;")).toBe("Hello & welcome\nSecond");
    expect(htmlToText("<h3>About us</h3><p>We&nbsp;make <b>films</b></p><script>x()</script>")).toBe("About us\nWe make films");
    expect(htmlToText(null)).toBe("");
  });

  it("matches word starts, not the middle of words", () => {
    expect(hasTerm("Senior Animator", "animat")).toBe(true);
    expect(hasTerm("Luxury Retail Lead", "ux")).toBe(false);
    expect(hasTerm("UX Designer", "ux")).toBe(true);
    expect(hasTerm("", "ux")).toBe(false);
  });

  it("recognises listing pages versus one posting", () => {
    expect(isGenericListingUrl("https://example.com/jobs")).toBe(true);
    expect(isGenericListingUrl("https://example.com")).toBe(true);
    expect(isGenericListingUrl("https://www.linkedin.com/jobs/search?q=motion")).toBe(true);
    expect(isGenericListingUrl("https://remoteok.com/remote-jobs/motion-designer-123")).toBe(false);
  });
});

describe("feed parsers", () => {
  it("Remote OK: skips the legal notice, keeps the original URL and a salary range", () => {
    const out = parseRemoteOk([
      { legal: "link back to us" },
      {
        slug: "x", id: "1", date: "2026-10-08T10:00:00+00:00", company: "Nord", position: "Motion Designer",
        tags: ["design", "video"], location: "Worldwide", url: "https://remoteOK.com/remote-jobs/motion-designer-1",
        apply_url: "https://remoteOK.com/remote-jobs/motion-designer-1", description: "&lt;p&gt;Great job&lt;/p&gt;",
        salary_min: 60000, salary_max: 90000,
      },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      title: "Motion Designer", company: "Nord", remote: true, source_name: "Remote OK", description: "Great job",
      compensation: "$60k–$90k / year", posted_at: "2026-10-08T10:00:00.000Z", tags: ["design", "video"],
    });
    expect(out[0].apply_url).toContain("remote-jobs/motion-designer-1");
  });

  it("Remote OK: no salary means no compensation, never a made-up one", () => {
    const [c] = parseRemoteOk([{ position: "Editor", company: "A", url: "https://remoteok.com/remote-jobs/e-1", salary_min: 0, salary_max: 0 }]);
    expect(c.compensation).toBeNull();
  });

  it("Jobicy: geo becomes the location and seniority is not a tag", () => {
    const [c] = parseJobicy({
      jobs: [{
        url: "https://jobicy.com/jobs/1-head-of-design", jobTitle: "Head of Design", companyName: "Ruby",
        jobGeo: "USA", jobIndustry: ["Design & Multimedia"], jobType: ["Full-Time"], jobLevel: "Director",
        jobDescription: "<p>Lead design</p>", pubDate: "2026-10-09T06:22:42+00:00", annualSalaryMin: 150000, annualSalaryMax: 190000, salaryCurrency: "USD",
      }],
    });
    expect(c.location).toBe("USA");
    expect(c.tags).toEqual(["Design & Multimedia", "Full-Time"]);
    expect(c.compensation).toBe("$150k–$190k / year");
  });

  it("Arbeitnow: decodes escaped HTML, reads epoch seconds and the remote flag", () => {
    const [c] = parseArbeitnow({
      data: [{
        slug: "a", title: "Motion Designer (m/w/d)", company_name: "Gismart", description: "&lt;p&gt;Animate &amp;amp; ship&lt;/p&gt;",
        remote: true, url: "https://www.arbeitnow.com/jobs/companies/gismart/motion-1", tags: ["Design"], job_types: [],
        location: "Berlin", created_at: 1791536119,
      }],
    });
    expect(c).toMatchObject({ title: "Motion Designer (m/w/d)", remote: true, location: "Berlin", description: "Animate & ship" });
    expect(c.posted_at).toBe(new Date(1791536119 * 1000).toISOString());
  });

  it("We Work Remotely: splits 'Company: Role' and reads CDATA and escaped descriptions", () => {
    const xml = `<?xml version="1.0"?><rss><channel><item>
      <title><![CDATA[Affirm: Senior Brand Designer]]></title>
      <region>Anywhere in the World</region><category>Design</category><type>Full-Time</type>
      <description>&lt;p&gt;Shape the &lt;b&gt;brand&lt;/b&gt;&lt;/p&gt;</description>
      <pubDate>Thu, 08 Oct 2026 10:00:00 +0000</pubDate>
      <link>https://weworkremotely.com/remote-jobs/affirm-senior-brand-designer</link>
    </item><item><title>No link</title></item></channel></rss>`;
    const out = parseWeWorkRemotely(xml);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      company: "Affirm", title: "Senior Brand Designer", location: "Anywhere in the World", description: "Shape the brand",
      source_name: "We Work Remotely", tags: ["Design", "Full-Time"],
    });
    expect(out[0].posted_at).toBe("2026-10-08T10:00:00.000Z");
  });

  it("returns nothing, not an exception, for garbage", () => {
    expect(parseRemoteOk({ nope: true })).toEqual([]);
    expect(parseJobicy(null)).toEqual([]);
    expect(parseArbeitnow("x")).toEqual([]);
    expect(parseWeWorkRemotely("<html></html>")).toEqual([]);
  });
});

describe("scoreCandidate", () => {
  it("scores a title match to the person's craft highly and says why", () => {
    const s = scoreCandidate(job(), MOTION, PREFS, NOW)!;
    expect(s.fit_score).toBeGreaterThanOrEqual(75);
    expect(s.fit_reason).toMatch(/motion designer/i);
    expect(s.fit_reason).toMatch(/posted yesterday/);
  });

  it("drops work that has nothing to do with the profile", () => {
    expect(scoreCandidate(job({ title: "Enterprise Account Executive", tags: ["sales"], description: "Sell software" }), MOTION, PREFS, NOW)).toBeNull();
  });

  it("does not let a seniority tag like 'Director' make a sales job relevant to a new profile", () => {
    expect(scoreCandidate(job({ title: "Regional Sales Manager", tags: ["Sales", "Director"], description: "" }), THIN, PREFS, NOW)).toBeNull();
  });

  it("a new profile with no skills still gets work that names a craft", () => {
    const s = scoreCandidate(job({ title: "Senior Video Editor", tags: [] }), THIN, PREFS, NOW)!;
    expect(s.fit_score).toBeGreaterThanOrEqual(60);
    expect(s.fit_reason).toMatch(/kind of work you do/);
  });

  it("drops anything older than two weeks and never labels an unknown date", () => {
    expect(scoreCandidate(job({ posted_at: daysAgo(20) }), MOTION, PREFS, NOW)).toBeNull();
    const unknown = scoreCandidate(job({ posted_at: null }), MOTION, PREFS, NOW)!;
    expect(unknown.fit_reason).not.toMatch(/posted/);
  });

  it("honours exclude keywords and remote-only", () => {
    expect(scoreCandidate(job({ description: "Unpaid internship" }), MOTION, { ...PREFS, exclude_keywords: ["unpaid"] }, NOW)).toBeNull();
    expect(scoreCandidate(job({ remote: false, location: "Paris, France" }), MOTION, { ...PREFS, remote_only: true }, NOW)).toBeNull();
  });

  it("on-site work elsewhere is dropped unless the person would travel", () => {
    const berlin = job({ remote: false, location: "Berlin, Germany" });
    expect(scoreCandidate(berlin, MOTION, PREFS, NOW)).toBeNull();
    expect(scoreCandidate(berlin, MOTION, { ...PREFS, travel_ok: true }, NOW)).not.toBeNull();
    expect(scoreCandidate(job({ remote: false, location: "Paris, France" }), MOTION, PREFS, NOW)!.fit_score).toBeGreaterThan(
      scoreCandidate(berlin, MOTION, { ...PREFS, travel_ok: true }, NOW)!.fit_score,
    );
  });

  it("a page that does not say where the work is stays, unless the person wants remote only", () => {
    const unknown = job({ remote: false, location: null });
    expect(scoreCandidate(unknown, MOTION, PREFS, NOW)).not.toBeNull();
    expect(scoreCandidate(unknown, MOTION, { ...PREFS, remote_only: true }, NOW)).toBeNull();
  });

  it("remote work limited to another region is shown but scored lower and labelled", () => {
    const open = scoreCandidate(job({ location: "Worldwide" }), MOTION, PREFS, NOW)!;
    const usOnly = scoreCandidate(job({ location: "USA" }), MOTION, PREFS, NOW)!;
    const france = scoreCandidate(job({ location: "France" }), MOTION, PREFS, NOW)!;
    expect(usOnly.fit_score).toBeLessThan(open.fit_score);
    expect(usOnly.fit_reason).toMatch(/open to USA/);
    expect(france.fit_score).toBeGreaterThanOrEqual(open.fit_score);
  });

  it("drops postings restricted to people the profile does not match", () => {
    expect(scoreCandidate(job({ description: "Open call for women only" }), MOTION, PREFS, NOW)).toBeNull();
    expect(isEligible("Students only", "motion designer")).toBe(false);
    expect(isEligible("Students only", "design student")).toBe(true);
  });
});

describe("rankCandidates", () => {
  it("de-duplicates, applies the minimum fit and puts the best first", () => {
    const a = job();
    const dup = job();
    const weaker = job({ source_url: "https://remoteok.com/remote-jobs/designer-9", apply_url: "https://remoteok.com/remote-jobs/designer-9", title: "Designer", tags: [], posted_at: daysAgo(3) });
    const belowMinimum = job({ source_url: "https://remoteok.com/remote-jobs/designer-10", apply_url: "https://remoteok.com/remote-jobs/designer-10", title: "Designer", tags: [], posted_at: daysAgo(10), location: "USA" });
    const junk = job({ source_url: "https://remoteok.com/remote-jobs/sales-1", apply_url: "https://remoteok.com/remote-jobs/sales-1", title: "Sales Rep", tags: [] });
    const listing = job({ source_url: "https://remoteok.com/jobs", apply_url: "https://remoteok.com/jobs", title: "Motion Designer" });
    const out = rankCandidates([weaker, a, dup, junk, listing, belowMinimum], MOTION, PREFS, NOW);
    expect(out.map((g) => g.title)).toEqual(["Motion Designer", "Designer"]);
    expect(out[0].fit_score).toBeGreaterThan(out[1].fit_score);
  });
});

describe("loadPublicFeeds", () => {
  beforeEach(() => clearFeedCache());

  it("one dead feed costs only its own results, and the report says which", async () => {
    const fetchStub = vi.fn(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes("remoteok.com")) {
        return new Response(JSON.stringify([{ legal: "x" }, { position: "Motion Designer", company: "Nord", url: "https://remoteok.com/remote-jobs/md-1", date: "2026-10-08T10:00:00+00:00", tags: ["motion"] }]), { status: 200 });
      }
      if (u.includes("arbeitnow")) return new Response("nope", { status: 503 });
      if (u.includes("jobicy")) return new Response(JSON.stringify({ jobs: [] }), { status: 200 });
      if (u.includes("weworkremotely")) return new Response("<rss></rss>", { status: 200 });
      return new Response("{}", { status: 404 });
    }) as unknown as typeof fetch;

    const { candidates, report } = await loadPublicFeeds(MOTION, PREFS, fetchStub);
    expect(candidates.map((c) => c.title)).toEqual(["Motion Designer"]);
    expect(report.find((r) => r.name === "Remote OK")).toMatchObject({ ok: true, count: 1 });
    expect(report.find((r) => r.name === "Arbeitnow")).toMatchObject({ ok: false, error: "HTTP 503" });
    // the profile's own craft is used to ask Jobicy for more of the same
    expect(report.some((r) => /^Jobicy \(motion/.test(r.name))).toBe(true);
  });

  it("serves a repeat scan from memory instead of hitting the board again", async () => {
    const fetchStub = vi.fn(async () => new Response(JSON.stringify([]), { status: 200 })) as unknown as typeof fetch;
    await loadPublicFeeds(THIN, PREFS, fetchStub);
    const first = (fetchStub as unknown as ReturnType<typeof vi.fn>).mock.calls.length;
    await loadPublicFeeds(THIN, PREFS, fetchStub);
    expect((fetchStub as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(first);
  });
});

describe("firecrawlToCandidate", () => {
  it("keeps the page URL, trims the site suffix and never claims a post date", () => {
    const c = firecrawlToCandidate(
      { url: "https://www.backstage.com/casting/colorist-for-feature-4821", title: "Colorist for feature film | Backstage", markdown: "Paid remote role", description: "" },
      "web",
    )!;
    expect(c.title).toBe("Colorist for feature film");
    expect(c.source_name).toBe("backstage.com");
    expect(c.posted_at).toBeNull();
    expect(c.apply_url).toBe("https://www.backstage.com/casting/colorist-for-feature-4821");
  });

  it("rejects roundups, guides and category pages", () => {
    for (const title of ["Top 10 freelance video jobs", "How to become a colorist", "Video editor jobs in Paris", "Freelance salary guide 2026"]) {
      expect(firecrawlToCandidate({ url: "https://a.com/blog/some-long-post-slug", title }, "web")).toBeNull();
    }
  });

  it("rejects results without a usable title or URL", () => {
    expect(firecrawlToCandidate({ url: "not a url", title: "Colorist" }, "web")).toBeNull();
    expect(firecrawlToCandidate({ url: "https://a.com/x/y", title: "" }, "web")).toBeNull();
  });
});
