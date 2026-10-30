import { describe, expect, it } from "vitest";
import { NO_FILTERS, buildCatalog, includeScoutedGigs, compactAmount, externalToItem, facets, filterCatalog, filtersActive, groupByCategory, kretopiaToItem, payLabel, shortLocation, type CatalogFilters, type ExternalRow, type KretopiaRow } from "../scoutCatalog";

const NOW = Date.parse("2026-10-29T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

const ext = (over: Partial<ExternalRow> = {}): ExternalRow => ({
  id: "e1",
  title: "Senior Product Designer",
  original_publisher: "Acme",
  location: "Lisbon",
  remote_scope: "remote",
  source_published_at: daysAgo(3),
  deadline_at: null,
  apply_url: "https://jobicy.com/jobs/1-a",
  excerpt: "Join our team.",
  last_checked_at: daysAgo(1),
  source_provider: "jobicy",
  claimed: false,
  budget: null,
  ...over,
});
const kre = (over: Partial<KretopiaRow> = {}): KretopiaRow => ({ id: "k1", title: "Wedding photographer wanted", type: "job", description: "Two days in Porto.", compensation: "$800", location: "Porto", created_at: daysAgo(2), ...over });

describe("compactAmount", () => {
  it("prints thousands and millions with at most one decimal and never a trailing .0, the same on every engine", () => {
    expect(compactAmount(128000)).toBe("128K");
    expect(compactAmount(27500)).toBe("27.5K");
    expect(compactAmount(1500)).toBe("1.5K");
    expect(compactAmount(1000)).toBe("1K");
    expect(compactAmount(2500000)).toBe("2.5M");
    expect(compactAmount(3e9)).toBe("3B");
    expect(compactAmount(999)).toBe("999");
    expect(compactAmount(35)).toBe("35");
    expect(compactAmount(12.5)).toBe("12.5");
    expect(compactAmount(19999)).toBe("20K");
  });
});

describe("payLabel", () => {
  it("prints a stated range with its currency and period, and nothing when none was stated", () => {
    expect(payLabel({ min: 128000, max: 160000, currency: "USD", period: "year" })).toBe("$128K–$160K / yr");
    expect(payLabel({ min: 25, max: null, currency: "EUR", period: "hour" })).toBe("from €25 / hr");
    expect(payLabel({ min: null, max: 90000, currency: "GBP", period: "year" })).toBe("up to £90K / yr");
    expect(payLabel({ min: 5000, max: 5000, currency: "USD", period: "month" })).toBe("$5K / mo");
    expect(payLabel(null)).toBeNull();
    expect(payLabel({ min: null, max: null, currency: "USD", period: "year" })).toBeNull();
  });

  it("a currency code the browser does not know is printed as the code, not dropped", () => {
    // the code, then a space, as a symbol-less amount reads best ("ZZZ 10–ZZZ 20"); an engine that prints the generic currency sign keeps it
    expect(payLabel({ min: 10, max: 20, currency: "ZZZ", period: "day" })).toMatch(/^(ZZZ 10–ZZZ 20|¤10–¤20) \/ day$/);
  });

  it("a stated range reads the same whatever the engine: no '.0', a symbol that says which dollar", () => {
    expect(payLabel({ min: 22000, max: 27500, currency: "PHP", period: "month" })).toMatch(/22K.*27\.5K \/ mo$/);
    expect(payLabel({ min: 90000, max: 120000, currency: "CAD", period: "year" })).toMatch(/90K.*120K \/ yr$/);
    expect(payLabel({ min: 90000, max: 120000, currency: "CAD", period: "year" })).not.toBe("$90K–$120K / yr"); // Canadian dollars are not US dollars
    expect(payLabel({ min: 128000, max: 160000, currency: "USD", period: "year" })).not.toMatch(/\.0/);
  });
});

describe("shortLocation", () => {
  it("keeps a place of up to three parts, and cuts a long list to the first two and a count", () => {
    expect(shortLocation("Lisbon")).toBe("Lisbon");
    expect(shortLocation("Lisbon, Portugal")).toBe("Lisbon, Portugal");
    expect(shortLocation("New York, NY, USA")).toBe("New York, NY, USA");
    expect(shortLocation("Belgium, Denmark, France, Germany, Ireland, UK, USA")).toBe("Belgium, Denmark +5 more");
    expect(shortLocation("  ")).toBeNull();
    expect(shortLocation(null)).toBeNull();
  });

  it("an item prints the short place and keeps the full one for the tooltip and the search", () => {
    const it = externalToItem(ext({ location: "Belgium, Denmark, France, Germany, Ireland, UK, USA" }));
    expect(it.location).toBe("Belgium, Denmark +5 more");
    expect(it.locationFull).toBe("Belgium, Denmark, France, Germany, Ireland, UK, USA");
    expect(filterCatalog([it], { ...NO_FILTERS, q: "ireland" }, NOW)).toHaveLength(1);
  });
});

describe("rows to items", () => {
  it("an external row keeps its own page, its source's credit and its honest dates", () => {
    const it = externalToItem(ext());
    expect(it).toMatchObject({
      id: "ext:e1",
      origin: "external",
      sourceId: "jobicy",
      sourceName: "Jobicy",
      title: "Senior Product Designer",
      company: "Acme",
      category: "product-ux",
      level: "senior",
      workMode: "remote",
      detailTo: "/listing/e1",
      openUrl: "https://jobicy.com/jobs/1-a",
      openRel: "noopener noreferrer nofollow",
      pay: null,
      claimed: false,
    });
    expect(it.postedAt).toBe(daysAgo(3));
    expect(it.sortAt).toBe(NOW - 3 * 86_400_000);
  });

  it("Remote OK's link stays followed and Himalayas' keeps its utm_source, as their terms ask", () => {
    expect(externalToItem(ext({ source_provider: "remoteok", apply_url: "https://remoteok.com/remote-jobs/x-1" })).openRel).toBe("noopener noreferrer");
    const him = externalToItem(ext({ source_provider: "himalayas", apply_url: "https://himalayas.app/companies/a/jobs/b" }));
    expect(him.openUrl).toBe("https://himalayas.app/companies/a/jobs/b?utm_source=api");
    expect(him.sourceName).toBe("Himalayas");
  });

  it("a stated pay range shows; a date the source did not give is not invented (the last look orders it)", () => {
    const it = externalToItem(ext({ budget: { min: 90000, max: 120000, currency: "USD", period: "year" }, source_published_at: null, last_checked_at: daysAgo(5) }));
    expect(it.pay).toBe("$90K–$120K / yr");
    expect(it.postedAt).toBeNull();
    expect(it.sortAt).toBe(NOW - 5 * 86_400_000);
    expect(externalToItem(ext({ source_published_at: "not a date", last_checked_at: null })).sortAt).toBe(0);
  });

  it("an unknown source id is shown as it is, never hidden", () => {
    expect(externalToItem(ext({ source_provider: "newboard" })).sourceName).toBe("newboard");
    expect(externalToItem(ext({ source_provider: null })).sourceName).toBe("Other source");
  });

  it("the title is cleaned (company taken off the end, tags dropped) and the family comes from it", () => {
    const it = externalToItem(ext({ title: "🎨 MOTION DESIGNER at Acme (Remote)", original_publisher: "Acme", location: null, remote_scope: null }));
    expect(it.title).toBe("Motion Designer");
    expect(it.category).toBe("video-motion");
  });

  it("a Kretopia gig links to its own page, has no company, and shows pay only when it states one", () => {
    const it = kretopiaToItem(kre());
    expect(it).toMatchObject({ id: "kre:k1", origin: "kretopia", sourceName: "Kretopia", category: "photo", detailTo: "/opportunity/k1", openUrl: null, company: null, pay: "$800" });
    expect(kretopiaToItem(kre({ compensation: "Not specified" })).pay).toBeNull();
    expect(kretopiaToItem(kre({ compensation: null })).pay).toBeNull();
  });
});

describe("buildCatalog", () => {
  it("lists both kinds newest first", () => {
    const list = buildCatalog([ext({ id: "a", source_published_at: daysAgo(10) }), ext({ id: "b", title: "Art Director", source_published_at: daysAgo(1) })], [kre({ created_at: daysAgo(5) })]);
    expect(list.map((i) => i.id)).toEqual(["ext:b", "kre:k1", "ext:a"]);
  });

  it("shows the same job under two sources once (same company, title and place), keeping the newest", () => {
    const list = buildCatalog([ext({ id: "a", source_provider: "jobicy", source_published_at: daysAgo(4) }), ext({ id: "b", source_provider: "remoteok", apply_url: "https://remoteok.com/x", source_published_at: daysAgo(2) })], []);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe("ext:b");
  });

  it("one job posted for several places is ONE card: the newest is the card, the others are listed on it, every place is searchable", () => {
    const list = buildCatalog(
      [
        ext({ id: "a", title: "Creative Design Team Lead", original_publisher: "CapsLock", location: "Armenia", source_published_at: daysAgo(1), apply_url: "https://jobicy.com/jobs/a" }),
        ext({ id: "b", title: "Creative Design Team Lead", original_publisher: "CapsLock", location: "Estonia", source_published_at: daysAgo(2), apply_url: "https://jobicy.com/jobs/b" }),
        ext({ id: "c", title: "Creative Design Team Lead", original_publisher: "CapsLock", location: "Italy", source_published_at: daysAgo(3), apply_url: "https://jobicy.com/jobs/c" }),
      ],
      [],
    );
    expect(list).toHaveLength(1);
    const card = list[0];
    expect(card.id).toBe("ext:a");
    expect(card.openUrl).toBe("https://jobicy.com/jobs/a");
    expect(card.more).toEqual([
      { id: "ext:b", place: "Estonia", openUrl: "https://jobicy.com/jobs/b", detailTo: "/listing/b" },
      { id: "ext:c", place: "Italy", openUrl: "https://jobicy.com/jobs/c", detailTo: "/listing/c" },
    ]);
    expect(card.locationFull).toBe("Armenia, Estonia, Italy");
    expect(filterCatalog(list, { ...NO_FILTERS, q: "italy" }, NOW)).toHaveLength(1);
  });

  it("a long list of places on a merged card is cut for the card and kept in full for the tooltip", () => {
    const rows = ["Armenia", "Estonia", "Italy", "Poland", "Croatia"].map((l, i) => ext({ id: `p${i}`, title: "Art Director", original_publisher: "CapsLock", location: l, source_published_at: daysAgo(i + 1) }));
    const [card] = buildCatalog(rows, []);
    expect(card.more).toHaveLength(4);
    expect(card.location).toBe("Armenia, Estonia +3 more");
    expect(card.locationFull).toBe("Armenia, Estonia, Italy, Poland, Croatia");
  });

  it("is not merged across sources, across titles or companies, nor when the company is unknown", () => {
    const base = { title: "Art Director", original_publisher: "CapsLock" };
    expect(buildCatalog([ext({ id: "a", ...base, location: "USA" }), ext({ id: "b", ...base, location: "LATAM", source_provider: "remoteok", apply_url: "https://remoteok.com/b" })], [])).toHaveLength(2);
    expect(buildCatalog([ext({ id: "a", ...base, location: "USA" }), ext({ id: "b", ...base, title: "Senior Art Director", location: "LATAM" })], [])).toHaveLength(2);
    expect(buildCatalog([ext({ id: "a", ...base, location: "USA" }), ext({ id: "b", ...base, original_publisher: "Other", location: "LATAM" })], [])).toHaveLength(2);
    expect(buildCatalog([ext({ id: "a", title: "Art Director", original_publisher: null, location: "USA" }), ext({ id: "b", title: "Art Director", original_publisher: null, location: "LATAM" })], [])).toHaveLength(2);
  });

  it("an empty read is an empty catalog", () => {
    expect(buildCatalog([], [])).toEqual([]);
  });
});

describe("filters and counts", () => {
  const rows: ExternalRow[] = [
    ext({ id: "1", title: "Senior Product Designer", source_provider: "jobicy", source_published_at: daysAgo(2), budget: { min: 100000, max: 120000, currency: "USD", period: "year" } }),
    ext({ id: "2", title: "Motion Designer", original_publisher: "Studio", source_provider: "jobicy", source_published_at: daysAgo(12) }),
    ext({ id: "3", title: "Graphic Designer & Video Editor", original_publisher: "Superside", source_provider: "remoteok", apply_url: "https://remoteok.com/3", source_published_at: daysAgo(25) }),
    ext({ id: "4", title: "Senior Software Engineer", original_publisher: "Tech", source_provider: "remoteok", apply_url: "https://remoteok.com/4", location: null, remote_scope: null, source_published_at: daysAgo(40) }),
    ext({ id: "5", title: "Werkstudent Grafikdesign (m/w/d)", original_publisher: "Agentur", source_provider: "himalayas", apply_url: "https://himalayas.app/companies/a/jobs/5", location: "Berlin", remote_scope: null, excerpt: "Wir suchen eine Werkstudentin für unser Team und die Gestaltung.", source_published_at: null, last_checked_at: null }),
  ];
  const items = buildCatalog(rows, []);
  const f = (over: Partial<CatalogFilters> = {}): CatalogFilters => ({ ...NO_FILTERS, ...over });
  const ids = (list: ReturnType<typeof filterCatalog>) => list.map((i) => i.id.replace("ext:", "")).sort();

  it("no filter shows everything, 'filtersActive' is false", () => {
    expect(filterCatalog(items, NO_FILTERS, NOW)).toHaveLength(5);
    expect(filtersActive(NO_FILTERS)).toBe(false);
    expect(filtersActive(f({ q: "x" }))).toBe(true);
    expect(filtersActive(f({ sources: ["jobicy"] }))).toBe(true);
  });

  it("a family finds every posting that names it, first or second", () => {
    expect(ids(filterCatalog(items, f({ category: "video-motion" }), NOW))).toEqual(["2", "3"]); // 3 is Design & brand first, Video & motion second
    expect(ids(filterCatalog(items, f({ category: "design-brand" }), NOW))).toEqual(["3", "5"]);
    expect(ids(filterCatalog(items, f({ category: "engineering" }), NOW))).toEqual(["4"]);
  });

  it("search matches every word across title, company, place, source and family", () => {
    expect(ids(filterCatalog(items, f({ q: "motion studio" }), NOW))).toEqual(["2"]);
    expect(ids(filterCatalog(items, f({ q: "superside" }), NOW))).toEqual(["3"]);
    expect(ids(filterCatalog(items, f({ q: "remote ok" }), NOW))).toEqual(["3", "4"]);
    expect(ids(filterCatalog(items, f({ q: "engineering" }), NOW))).toEqual(["4"]);
    expect(filterCatalog(items, f({ q: "zzzz" }), NOW)).toEqual([]);
  });

  it("source, mode, level, language, freshness and pay each narrow the list", () => {
    expect(ids(filterCatalog(items, f({ sources: ["remoteok"] }), NOW))).toEqual(["3", "4"]);
    expect(ids(filterCatalog(items, f({ sources: ["jobicy", "himalayas"] }), NOW))).toEqual(["1", "2", "5"]);
    expect(ids(filterCatalog(items, f({ workMode: "onsite" }), NOW))).toEqual(["5"]);
    expect(ids(filterCatalog(items, f({ level: "senior" }), NOW))).toEqual(["1", "4"]);
    expect(ids(filterCatalog(items, f({ language: "de" }), NOW))).toEqual(["5"]);
    expect(ids(filterCatalog(items, f({ days: 14 }), NOW))).toEqual(["1", "2"]);
    expect(ids(filterCatalog(items, f({ days: 30 }), NOW))).toEqual(["1", "2", "3"]); // 4 is 40 days old, 5 has no date
    expect(ids(filterCatalog(items, f({ payOnly: true }), NOW))).toEqual(["1"]);
  });

  it("filters combine", () => {
    expect(ids(filterCatalog(items, f({ category: "design-brand", sources: ["remoteok"] }), NOW))).toEqual(["3"]);
    expect(filterCatalog(items, f({ category: "engineering", payOnly: true }), NOW)).toEqual([]);
  });

  it("each count is computed with every OTHER filter applied, never its own", () => {
    const fa = facets(items, f({ sources: ["remoteok"], category: "engineering" }), NOW);
    expect(fa.total).toBe(1); // remote ok AND engineering
    // the family counts ignore the family filter: they show what picking each family would give within remote ok
    expect(fa.anyFamily).toBe(2);
    expect(fa.categories.get("design-brand")).toBe(1);
    expect(fa.categories.get("video-motion")).toBe(1); // a second-family hit counts
    expect(fa.categories.get("engineering")).toBe(1);
    // the source counts ignore the source filter: what picking each source would give within engineering
    expect(fa.sources.get("remoteok")).toBe(1);
    expect(fa.sources.get("jobicy") ?? 0).toBe(0);
  });

  it("a source's count ignores the source filter: picking Remote OK still shows what Jobicy and Himalayas would add", () => {
    const fa = facets(items, f({ sources: ["remoteok"] }), NOW);
    expect(fa.total).toBe(2);
    expect(fa.sources.get("remoteok")).toBe(2);
    expect(fa.sources.get("jobicy")).toBe(2);
    expect(fa.sources.get("himalayas")).toBe(1);
  });

  it("counts the levels, modes, languages and paid postings that pass the others", () => {
    const fa = facets(items, NO_FILTERS, NOW);
    expect(fa.total).toBe(5);
    expect(fa.anyFamily).toBe(5);
    expect(fa.levels.get("senior")).toBe(2);
    expect(fa.levels.get("intern")).toBe(1);
    expect(fa.workModes.get("remote")).toBe(3);
    expect(fa.workModes.get("onsite")).toBe(1);
    expect(fa.workModes.get("unknown")).toBe(1);
    expect(fa.languages.get("de")).toBe(1);
    expect(fa.paid).toBe(1);
  });

  it("groups by each posting's own family, creative first, newest first inside", () => {
    const groups = groupByCategory(filterCatalog(items, NO_FILTERS, NOW));
    expect(groups.map((g) => g.id)).toEqual(["design-brand", "product-ux", "video-motion", "engineering"]);
    expect(groups[0].items.map((i) => i.id)).toEqual(["ext:3", "ext:5"]); // dated before undated
    // a posting named under two families is listed once, under its first
    expect(groups.reduce((n, g) => n + g.items.length, 0)).toBe(5);
  });
});


describe("For You records in All Sources", () => {
  const gig = { id: "personal-1", title: "Motion Designer", company: "Studio", location: "Remote", remote: true, source: "gigboard", source_name: "Real Board", source_url: "https://board.example/jobs/1", apply_url: null, description: "Animate films", full_description: null, image_url: "/actual-artwork.webp", compensation: "$800", contact_email: null, fit_score: 80, fit_reason: "Motion", scouted_at: daysAgo(1), posted_at: null, details_fetched_at: null };
  it("includes actual For You artwork, title, pay and source without changing the source destination", () => {
    const result = includeScoutedGigs([], [gig]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ title: "Motion Designer", image: "/actual-artwork.webp", pay: "$800", detailTo: "https://board.example/jobs/1" });
  });
  it("keeps one source record when the same gig already exists in the catalog", () => {
    const catalog = buildCatalog([ext({ title: "Motion Designer", original_publisher: "Studio", apply_url: gig.source_url })], []);
    const result = includeScoutedGigs(catalog, [gig]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("ext:e1");
    expect(result[0].image).toBe("/actual-artwork.webp");
  });
});
