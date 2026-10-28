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

describe("corroborates: a pasted draft is only as public as the source that backs it", () => {
  it("accepts alike titles and refuses unrelated or missing ones", () => {
    expect(corroborates("Senior Video Editor (m/f/d)", "Senior Video Editor - Acme Studio")).toBe(true);
    expect(corroborates("Senior Video Editor", "Junior Accountant")).toBe(false);
    expect(corroborates("Senior Video Editor", null)).toBe(false);
    expect(corroborates("", "Senior Video Editor")).toBe(false);
  });
});
