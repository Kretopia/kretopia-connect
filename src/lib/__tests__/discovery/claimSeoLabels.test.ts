import { describe, expect, it } from "vitest";
import {
  challengeLine, claimExpiry, domainChallenge, fileProvesChallenge, looksLikeClaimToken, mintClaimToken, sha256Hex, sourceDomainFor, WELL_KNOWN_PATH,
} from "../../../../supabase/functions/_shared/discovery/claim";
import {
  canonicalFor, eventJsonLd, externalJobPosting, isExpired, isSitemapEligible, MIN_INDEXABLE_CHARS, nativeGigJobPosting, nativeGigRobots, robotsFor, type ListingSeoInput,
} from "../../../../supabase/functions/_shared/discovery/seo";
import { listingLabels, relativeDays } from "../../../../supabase/functions/_shared/discovery/labels";
import { costCents, jobKey, scopesFor, utcDay } from "../../../../supabase/functions/_shared/discovery/budget";
import { adapterById } from "../../../../supabase/functions/_shared/discovery/sources";

const NOW = new Date("2026-10-28T12:00:00Z");
const LONG = "A real description of the role. ".repeat(12);

describe("claim tokens: random, hashed, shaped", () => {
  it("mints a 256-bit token whose stored form is only its SHA-256, and two tokens never match", async () => {
    const a = await mintClaimToken();
    const b = await mintClaimToken();
    expect(looksLikeClaimToken(a.token)).toBe(true);
    expect(a.token).not.toBe(b.token);
    expect(a.tokenHash).toBe(await sha256Hex(a.token));
    expect(a.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.tokenHash).not.toContain(a.token);
  });

  it("uses the platform's randomness: a fixed byte source gives a fixed token (so it is not derived from anything else)", async () => {
    const t = await mintClaimToken((n) => new Uint8Array(n).fill(7));
    const u = await mintClaimToken((n) => new Uint8Array(n).fill(7));
    expect(t.token).toBe(u.token);
    expect(t.token.length).toBe(3 + 43);
  });

  it("rejects anything that is not the token shape before it reaches the database", () => {
    for (const bad of ["", "kc_short", "abc", null, undefined, 5, "kc_" + "!".repeat(43), "kc_" + "a".repeat(44), "' OR 1=1 --"]) expect(looksLikeClaimToken(bad)).toBe(false);
  });

  it("expires in 14 days by default and never beyond 30", () => {
    expect(claimExpiry(NOW).toISOString()).toBe("2026-11-11T12:00:00.000Z");
    expect(claimExpiry(NOW, 9999).toISOString()).toBe("2026-11-27T12:00:00.000Z");
    expect(claimExpiry(NOW, -3).getTime()).toBeGreaterThan(NOW.getTime());
  });
});

describe("source-domain verification: the domain comes from the listing, never from the claimant", () => {
  it("takes the publisher's own host from the listing's URLs", () => {
    expect(sourceDomainFor({ apply_url: "https://www.acme-studio.com/careers/editor", source_url: "https://remoteok.com/remote-jobs/x-1098765" })).toBe("acme-studio.com");
    expect(sourceDomainFor({ apply_url: "https://remoteok.com/l/1098765", source_url: "https://careers.acme-studio.com/jobs/1" })).toBe("careers.acme-studio.com");
  });

  it("returns null when the listing only lives on a job board or a shared platform: then only an admin review can verify", () => {
    for (const url of ["https://remoteok.com/l/1", "https://jobicy.com/jobs/1-x", "https://www.linkedin.com/jobs/view/1", "https://boards.greenhouse.io/acme/jobs/1", "https://acme.notion.site/job", "https://forms.gle/abc", "http://acme.com/jobs", "https://10.0.0.1/x", "https://localhost/x"]) {
      expect(sourceDomainFor({ apply_url: url, source_url: null }), url).toBeNull();
    }
    expect(sourceDomainFor({ apply_url: null, source_url: null })).toBeNull();
  });

  it("a challenge is bound to the listing, the claimant and the domain, and is not guessable", async () => {
    const c = await domainChallenge("server-secret", "listing-1", "user-1", "acme-studio.com");
    expect(c).toMatch(/^[0-9a-f]{40}$/);
    expect(await domainChallenge("server-secret", "listing-1", "user-1", "acme-studio.com")).toBe(c);
    expect(await domainChallenge("server-secret", "listing-2", "user-1", "acme-studio.com")).not.toBe(c);
    expect(await domainChallenge("server-secret", "listing-1", "user-2", "acme-studio.com")).not.toBe(c);
    expect(await domainChallenge("server-secret", "listing-1", "user-1", "other.com")).not.toBe(c);
    expect(await domainChallenge("another-secret", "listing-1", "user-1", "acme-studio.com")).not.toBe(c);
  });

  it("a file proves control only with the exact challenge line", async () => {
    const c = await domainChallenge("s", "l", "u", "d.com");
    expect(WELL_KNOWN_PATH).toBe("/.well-known/kretopia-claim.txt");
    expect(fileProvesChallenge(`# Kretopia\n${challengeLine(c)}\n`, c)).toBe(true);
    expect(fileProvesChallenge(`${challengeLine(c)}\r\n`, c)).toBe(true);
    for (const bad of ["", challengeLine(c) + "x", `kretopia-claim=${c.slice(0, 39)}`, `prefix ${challengeLine(c)}`, c, "<html>" + challengeLine(c.toUpperCase()) + "</html>"]) {
      expect(fileProvesChallenge(bad, c), bad).toBe(false);
    }
  });
});

const listing = (over: Partial<ListingSeoInput> = {}): ListingSeoInput => ({
  kind: "gig", status: "published", visibility: "public", title: "Senior video editor", original_publisher: "Acme Studio", excerpt: LONG,
  description_full: null, apply_url: "https://acme-studio.com/jobs/9", source_published_at: "2026-10-20T00:00:00.000Z", deadline_at: null, starts_at: null,
  location: "Berlin, Germany", remote_scope: null, budget: null, flagged_instructions: false, applications_enabled: false, url: "https://www.kretopia.com/listing/abc", ...over,
});

describe("SEO: honest public pages", () => {
  it("indexes a published listing with enough permitted content, a publisher and a destination", () => {
    expect(robotsFor(listing(), NOW)).toBe("index, follow");
    expect(isSitemapEligible(listing(), NOW)).toBe(true);
  });

  it("keeps drafts, private records, flagged imports and thin imports out of the index and the sitemap", () => {
    for (const over of [
      { status: "draft" }, { status: "in_review" }, { status: "rejected" }, { visibility: "private" }, { visibility: "review" },
      { flagged_instructions: true }, { excerpt: "short" }, { excerpt: null }, { original_publisher: null }, { apply_url: null }, { title: null },
    ] as Partial<ListingSeoInput>[]) {
      const l = listing(over);
      expect(robotsFor(l, NOW), JSON.stringify(over)).toBe("noindex, nofollow");
      expect(isSitemapEligible(l, NOW)).toBe(false);
    }
    expect(MIN_INDEXABLE_CHARS).toBeGreaterThan(100);
  });

  it("an expired job is noindex, out of the sitemap, and has no JobPosting", () => {
    const l = listing({ status: "claimed", description_full: LONG, deadline_at: "2026-10-01T00:00:00Z" });
    expect(isExpired(l, NOW)).toBe(true);
    expect(robotsFor(l, NOW)).toBe("noindex, nofollow");
    expect(externalJobPosting(l, NOW)).toBeNull();
    expect(isExpired(listing({ status: "expired" }), NOW)).toBe(true);
    expect(isExpired(listing({ status: "removed" }), NOW)).toBe(true);
  });

  it("an UNCLAIMED external listing never carries JobPosting, however complete it looks", () => {
    expect(externalJobPosting(listing({ status: "published", description_full: LONG }), NOW)).toBeNull();
  });

  it("a claimed gig with the owner's full description gets JobPosting built from its real facts only", () => {
    const jp = externalJobPosting(listing({ status: "claimed", description_full: LONG, deadline_at: "2026-12-01T00:00:00Z" }), NOW)!;
    expect(jp["@type"]).toBe("JobPosting");
    expect(jp.title).toBe("Senior video editor");
    expect(jp.datePosted).toBe("2026-10-20");
    expect(jp.validThrough).toBe("2026-12-01T00:00:00Z");
    expect(jp.hiringOrganization).toEqual({ "@type": "Organization", name: "Acme Studio" });
    expect(jp).not.toHaveProperty("directApply"); // applications are not Kretopia-hosted
    expect(jp).not.toHaveProperty("baseSalary"); // no budget on record
    expect(JSON.stringify(jp)).not.toMatch(/Kretopia"?\}?,"?sameAs|"name":"Kretopia"/);
  });

  it("no datePosted on record means no JobPosting: the crawl time is never used", () => {
    expect(externalJobPosting(listing({ status: "claimed", description_full: LONG, source_published_at: null }), NOW)).toBeNull();
  });

  it("salary appears only from a structured budget with a currency and a period; directApply only when hosted applications are on", () => {
    const base = listing({ status: "claimed", description_full: LONG });
    const withPay = externalJobPosting({ ...base, budget: { min: 60, max: 80, currency: "EUR", period: "hour" }, applications_enabled: true }, NOW)!;
    expect(withPay.baseSalary).toEqual({ "@type": "MonetaryAmount", currency: "EUR", value: { "@type": "QuantitativeValue", minValue: 60, maxValue: 80, unitText: "HOUR" } });
    expect(withPay.directApply).toBe(true);
    expect(externalJobPosting({ ...base, budget: { min: 60, max: null, currency: "EUR", period: null } }, NOW)).not.toHaveProperty("baseSalary");
  });

  it("only gigs get JobPosting: talent and event pages never do", () => {
    expect(externalJobPosting(listing({ kind: "talent", status: "claimed", description_full: LONG }), NOW)).toBeNull();
    expect(externalJobPosting(listing({ kind: "event", status: "claimed", description_full: LONG }), NOW)).toBeNull();
  });

  it("event markup needs a name, a start and a place", () => {
    const ev = listing({ kind: "event", starts_at: "2026-12-05T19:00:00Z", location: "Studio 5, Lisbon" });
    expect(eventJsonLd(ev, NOW)).toMatchObject({ "@type": "Event", name: "Senior video editor", startDate: "2026-12-05T19:00:00Z" });
    expect(eventJsonLd({ ...ev, starts_at: null }, NOW)).toBeNull();
    expect(eventJsonLd({ ...ev, location: null }, NOW)).toBeNull();
    expect(eventJsonLd(listing({ kind: "gig" }), NOW)).toBeNull();
  });
});

describe("canonical: original versus republished", () => {
  it("an unclaimed import points to the original source; only a verified owner's listing is its own canonical", () => {
    const own = "https://www.kretopia.com/listing/abc";
    expect(canonicalFor(listing({ status: "published", source_url: "https://remoteok.com/remote-jobs/x-1098765" }))).toBe("https://remoteok.com/remote-jobs/x-1098765");
    expect(canonicalFor(listing({ status: "published", source_url: null }))).toBe("https://acme-studio.com/jobs/9");
    expect(canonicalFor(listing({ status: "claimed", source_url: "https://remoteok.com/remote-jobs/x-1098765" }))).toBe(own);
  });
});

describe("native Kretopia gigs: no invented employer, date or salary", () => {
  const gig = { scouted_by: null, status: "active", title: "Brand film editor", description: LONG, created_at: "2026-10-10T08:00:00Z", application_deadline: "2026-12-01T00:00:00Z", organization: "Acme Studio", location: "Lisbon", url: "https://www.kretopia.com/opportunity/1" };

  it("builds JobPosting for a native gig with a named organization and a place", () => {
    const jp = nativeGigJobPosting(gig, NOW)!;
    expect(jp.hiringOrganization).toEqual({ "@type": "Organization", name: "Acme Studio" });
    expect(jp.datePosted).toBe("2026-10-10");
    expect(jp).not.toHaveProperty("baseSalary");
  });

  it("never names Kretopia as the employer: with no organization there is no JobPosting", () => {
    expect(nativeGigJobPosting({ ...gig, organization: null }, NOW)).toBeNull();
  });

  it("a scouted gig (found elsewhere) never gets JobPosting, claimed or not: created_at is when WE found it", () => {
    expect(nativeGigJobPosting({ ...gig, scouted_by: "user-1" }, NOW)).toBeNull();
  });

  it("a closed or expired gig has no markup, and robots follow the same rules", () => {
    expect(nativeGigJobPosting({ ...gig, status: "closed" }, NOW)).toBeNull();
    expect(nativeGigJobPosting({ ...gig, application_deadline: "2026-10-01T00:00:00Z" }, NOW)).toBeNull();
    expect(nativeGigRobots(gig, null, NOW)).toBe("index, follow");
    expect(nativeGigRobots({ ...gig, status: "closed" }, null, NOW)).toBe("noindex, nofollow");
    expect(nativeGigRobots({ ...gig, scouted_by: "user-1" }, "unclaimed", NOW)).toBe("noindex, nofollow");
    expect(nativeGigRobots({ ...gig, scouted_by: "user-1" }, "claimed", NOW)).toBe("index, follow");
  });
});

describe("labels say only what is true", () => {
  it("an external listing is External, Unclaimed until claimed, with its source and when it was last checked", () => {
    expect(listingLabels({ origin: "external", claimed: false, last_checked_at: "2026-10-25T00:00:00Z", source_name: "Remote OK" }, NOW)).toEqual({
      origin: "External", ownership: "Unclaimed", lastChecked: "Last checked 3 days ago", source: "via Remote OK",
    });
    expect(listingLabels({ origin: "external", claimed: true, last_checked_at: null, source_name: null }, NOW)).toMatchObject({ ownership: "Claimed", lastChecked: null, source: null });
  });

  it("a Kretopia listing carries no ownership or last-checked label", () => {
    expect(listingLabels({ origin: "kretopia", claimed: false, last_checked_at: "2026-10-27T00:00:00Z", source_name: "x" }, NOW)).toEqual({ origin: "Kretopia", ownership: null, lastChecked: null, source: null });
  });

  it("relativeDays refuses a future or invalid date rather than inventing one", () => {
    expect(relativeDays("2026-10-29T00:00:00Z", NOW)).toBeNull();
    expect(relativeDays("nope", NOW)).toBeNull();
    expect(relativeDays(null, NOW)).toBeNull();
    expect(relativeDays("2026-10-28T01:00:00Z", NOW)).toBe("today");
    expect(relativeDays("2026-10-27T01:00:00Z", NOW)).toBe("yesterday");
  });
});

describe("spending helpers", () => {
  it("an adapter with an unknown cost has no price and cannot run", () => {
    expect(costCents(adapterById("web-search")!, 3)).toBeNull();
    expect(costCents(adapterById("remoteok")!, 3)).toBe(0);
    expect(costCents({ costPerCallCents: 5 }, 4)).toBe(20);
    expect(costCents({ costPerCallCents: 5 }, -1)).toBeNull();
  });

  it("scopes and job keys are stable, so a retried or overlapping run is the same job", () => {
    expect(scopesFor({ sourceId: "remoteok", userId: "u1" })).toEqual(["global", "source:remoteok", "user:u1"]);
    expect(scopesFor({ sourceId: "remoteok" })).toEqual(["global", "source:remoteok"]);
    expect(utcDay(NOW)).toBe("2026-10-28");
    expect(jobKey("remoteok", NOW)).toBe(jobKey("remoteok", new Date("2026-10-28T23:59:59Z")));
    expect(jobKey("remoteok", NOW)).not.toBe(jobKey("jobicy", NOW));
  });
});
