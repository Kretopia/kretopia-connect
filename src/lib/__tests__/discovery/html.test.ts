import { describe, expect, it } from "vitest";
import { corroborates, factsToRaw, pageFacts } from "../../../../supabase/functions/_shared/discovery/html";
import { parseExtraction } from "../../../../supabase/functions/_shared/discovery/extract";

const NOW = new Date("2026-10-28T12:00:00Z");
// A real page escapes "<" inside JSON-LD (a literal </script> would end the block in a browser too).
const ld = (obj: unknown) => `<html><head><script type="application/ld+json">${JSON.stringify(obj).replace(/</g, "\\u003c")}</script></head><body>x</body></html>`;

describe("pageFacts: only what the page states about itself, never executed", () => {
  it("reads a JobPosting from JSON-LD", () => {
    const f = pageFacts(ld({ "@context": "https://schema.org", "@type": "JobPosting", title: "Brand film editor", datePosted: "2026-10-20", validThrough: "2026-12-01T00:00:00Z", hiringOrganization: { "@type": "Organization", name: "Acme Studio" }, jobLocation: { "@type": "Place", address: { addressLocality: "Lisbon", addressCountry: "PT" } }, description: "<p>We need an editor.</p><script>x()</script>", url: "https://acme.example/jobs/1" }));
    expect(f).toMatchObject({ kind: "gig", title: "Brand film editor", original_publisher: "Acme Studio", location: "Lisbon, PT", source_published_at: "2026-10-20", deadline_at: "2026-12-01T00:00:00Z", apply_url: "https://acme.example/jobs/1", from: "json-ld" });
    expect(f.excerpt).toBe("We need an editor.");
  });

  it("finds the posting inside @graph and arrays, and reads an Event", () => {
    expect(pageFacts(ld({ "@graph": [{ "@type": "WebSite", name: "Board" }, { "@type": "JobPosting", title: "Colourist" }] })).title).toBe("Colourist");
    expect(pageFacts(ld([{ "@type": "Event", name: "Open studio", startDate: "2026-12-05T19:00:00Z", location: { "@type": "Place", name: "Studio 5" }, organizer: { name: "Studio Five" } }]))).toMatchObject({ kind: "event", title: "Open studio", starts_at: "2026-12-05T19:00:00Z", location: "Studio 5", original_publisher: "Studio Five" });
  });

  it("falls back to Open Graph for a title only, and to nothing at all: no body text is guessed from", () => {
    expect(pageFacts('<meta property="og:title" content="Great gig"><meta property="og:description" content="Short">')).toMatchObject({ title: "Great gig", excerpt: "Short", from: "open-graph", original_publisher: null, source_published_at: null });
    expect(pageFacts("<html><body><h1>Senior editor wanted, $90k, apply by Friday</h1></body></html>")).toMatchObject({ title: null, from: "none" });
  });

  it("ignores malformed JSON-LD instead of repairing it, and never evaluates scripts", () => {
    const html = '<script type="application/ld+json">{"@type":"JobPosting","title":"x",</script><script>window.pwned=1</script>';
    expect(pageFacts(html).from).toBe("none");
    expect((globalThis as Record<string, unknown>).pwned).toBeUndefined();
  });

  it("a feed's facts become validated extraction input: a missing date stays unknown, the page is the apply destination", () => {
    const raw = factsToRaw(pageFacts(ld({ "@type": "JobPosting", title: "Colourist", hiringOrganization: { name: "Acme" } })), "https://remoteok.com/remote-jobs/x-1098765", "gig");
    const r = parseExtraction(raw, { now: NOW, kind: "gig" });
    expect(r.ok).toBe(true);
    expect(r.draft).toMatchObject({ title: "Colourist", original_publisher: "Acme", source_published_at: null, apply_url: "https://remoteok.com/remote-jobs/x-1098765" });
  });
});

// The shape Remote OK serves for a posting that has no real address: one word in every field.
const REMOTE_OK = {
  "@type": "JobPosting", title: "Graphic Designer & Video Editor", datePosted: "2026-10-13T00:00:06+00:00", validThrough: "2027-01-11T00:00:06+00:00",
  hiringOrganization: { "@type": "Organization", name: "BlueTuskr" }, jobLocationType: "TELECOMMUTE",
  applicantLocationRequirements: [{ "@type": "Country", name: "Anywhere" }],
  jobLocation: [{ "@type": "Place", address: { "@type": "PostalAddress", addressCountry: "Anywhere", addressRegion: "Anywhere", streetAddress: "Anywhere", postalCode: "Anywhere", addressLocality: "Anywhere" } }],
  baseSalary: { "@type": "MonetaryAmount", currency: "USD", value: { "@type": "QuantitativeValue", minValue: 80000, maxValue: 155000, unitText: "YEAR" } },
};
const draftOf = (posting: Record<string, unknown>) => parseExtraction(factsToRaw(pageFacts(ld(posting)), "https://remoteok.com/remote-jobs/x-1137507", "gig"), { now: NOW, kind: "gig" });

describe("pageFacts: what the first real import showed", () => {
  it("a word repeated across the address fields is said once, and real places keep every part", () => {
    expect(pageFacts(ld(REMOTE_OK)).location).toBe("Anywhere");
    expect(draftOf(REMOTE_OK).draft?.location).toBe("Anywhere");
    expect(pageFacts(ld({ "@type": "JobPosting", title: "x", jobLocation: { address: { addressLocality: "Lisbon", addressCountry: "PT" } } })).location).toBe("Lisbon, PT");
    expect(pageFacts(ld({ "@type": "JobPosting", title: "x", jobLocation: { address: { addressLocality: "Paris", addressRegion: "Île-de-France", addressCountry: "France" } } })).location).toBe("Paris, Île-de-France, France");
    // the same word in another case is still the same word; a place named like its country is not repeated either
    expect(pageFacts(ld({ "@type": "JobPosting", title: "x", jobLocation: { address: { addressLocality: "Singapore", addressCountry: "singapore" } } })).location).toBe("Singapore");
  });

  it("a stated salary range is read as a structured budget, with its currency and period", () => {
    expect(draftOf(REMOTE_OK).draft?.budget).toEqual({ min: 80000, max: 155000, currency: "USD", period: "year" });
    expect(draftOf(REMOTE_OK).issues).toEqual([]); // read, so nothing is "left unknown"
  });

  it("other ways a page states a salary: one amount, numeric strings, an hourly rate", () => {
    const one = draftOf({ "@type": "JobPosting", title: "Colourist", baseSalary: { currency: "EUR", value: { value: 55000, unitText: "YEAR" } } });
    expect(one.draft?.budget).toEqual({ min: 55000, max: 55000, currency: "EUR", period: "year" });
    const plain = draftOf({ "@type": "JobPosting", title: "Colourist", baseSalary: { currency: "GBP", value: 400 } });
    expect(plain.draft?.budget).toEqual({ min: 400, max: 400, currency: "GBP", period: null });
    const strings = draftOf({ "@type": "JobPosting", title: "Colourist", baseSalary: { currency: "usd", value: { minValue: "45", maxValue: "60.5", unitText: "HOUR" } } });
    expect(strings.draft?.budget).toEqual({ min: 45, max: 60.5, currency: "USD", period: "hour" });
  });

  it("a salary the page states but does not state usably is reported as left unknown, never dropped silently or guessed", () => {
    const noCurrency = draftOf({ "@type": "JobPosting", title: "Colourist", baseSalary: { value: { minValue: 50000, maxValue: 60000, unitText: "YEAR" } } });
    expect(noCurrency.draft?.budget).toBeNull();
    expect(noCurrency.issues.map((i) => i.code)).toContain("no_currency");
    const text = draftOf({ "@type": "JobPosting", title: "Colourist", baseSalary: { currency: "USD", value: "competitive" } });
    expect(text.draft?.budget).toBeNull();
    expect(text.issues.map((i) => i.code)).toContain("no_amount");
    const bare = draftOf({ "@type": "JobPosting", title: "Colourist", baseSalary: 60000 });
    expect(bare.draft?.budget).toBeNull();
    expect(bare.issues.map((i) => i.code)).toContain("no_currency");
    const bareText = draftOf({ "@type": "JobPosting", title: "Colourist", baseSalary: "competitive" });
    expect(bareText.draft?.budget).toBeNull();
    expect(bareText.issues.map((i) => i.code)).toContain("no_amount");
    const backwards = draftOf({ "@type": "JobPosting", title: "Colourist", baseSalary: { currency: "USD", value: { minValue: 90000, maxValue: 50000 } } });
    expect(backwards.draft?.budget).toBeNull();
    expect(backwards.issues.map((i) => i.code)).toContain("range");
  });

  it("a page that states no salary leaves the budget unknown and reports nothing about it; events and Open Graph never carry one", () => {
    const none = draftOf({ "@type": "JobPosting", title: "Colourist" });
    expect(none.draft?.budget).toBeNull();
    expect(none.issues).toEqual([]);
    expect(pageFacts(ld({ "@type": "Event", name: "Open studio", baseSalary: { currency: "USD", value: 5 } })).budget).toBeNull();
    expect(pageFacts('<meta property="og:title" content="Great gig">').budget).toBeNull();
  });

  it("validThrough is kept as when the listing stops being open (the public page says 'Listed until'), never as an invented deadline", () => {
    expect(pageFacts(ld(REMOTE_OK)).deadline_at).toBe("2027-01-11T00:00:06+00:00");
    expect(pageFacts(ld({ "@type": "JobPosting", title: "x" })).deadline_at).toBeNull();
  });
});

describe("corroborates: a pasted draft is only as public as the source that backs it", () => {
  it("accepts alike titles and refuses unrelated or missing ones", () => {
    expect(corroborates("Senior Video Editor (m/f/d)", "Senior Video Editor - Acme Studio")).toBe(true);
    expect(corroborates("Senior Video Editor", "Junior Accountant")).toBe(false);
    expect(corroborates("Senior Video Editor", null)).toBe(false);
    expect(corroborates("", "Senior Video Editor")).toBe(false);
  });
});
