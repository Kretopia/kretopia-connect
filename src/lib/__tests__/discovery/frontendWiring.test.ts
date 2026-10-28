import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(__dirname, "../../../..", p), "utf8");

// The pure rules are tested in claimSeoLabels.test.ts; these keep the existing pages wired to them.
describe("existing pages follow the honest SEO rules", () => {
  const detail = read("src/pages/OpportunityDetail.tsx");

  it("OpportunityDetail no longer names Kretopia as the employer, hard-codes USD, or dates a posting by created_at unconditionally", () => {
    expect(detail).not.toMatch(/"hiringOrganization"\s*:/);
    expect(detail).not.toContain('currency": "USD"');
    expect(detail).not.toContain('"@type": "JobPosting"');
    expect(detail).toContain("nativeGigJobPosting(");
    expect(detail).toContain("nativeGigRobots(");
    expect(detail).toMatch(/\{jobPosting && <script type="application\/ld\+json">/);
  });

  it("an unclaimed scouted gig is noindex through the SEO component", () => {
    expect(detail).toMatch(/noindex=\{nativeGigRobots\(/);
    expect(read("src/components/SEO.tsx")).toMatch(/content=\{noindex \? "noindex, nofollow" : "index, follow"\}/);
  });

  it("Scout cards say External and Unclaimed", () => {
    expect(read("src/components/opportunity/ScoutedGigsSection.tsx")).toContain("External · Unclaimed");
  });

  it("the new routes exist, the claim page needs a sign-in, the admin page too, and all three are prefetched", () => {
    const app = read("src/App.tsx");
    expect(app).toContain('<Route path="/listing/:id" element={<ExternalListing />} />');
    expect(app).toContain('<Route path="/claim-listing/:id/:token" element={<ProtectedRoute><ClaimListing /></ProtectedRoute>} />');
    expect(app).toContain('<Route path="/admin/external" element={<ProtectedRoute><AdminExternal /></ProtectedRoute>} />');
    const prefetch = read("src/lib/routePrefetch.ts");
    for (const r of ["/listing", "/claim-listing", "/admin/external"]) expect(prefetch).toContain(`["${r}"`);
  });

  it("Discover keeps sourced gigs in the Gigs lane, as their own kind", () => {
    const discover = read("src/pages/Discover.tsx");
    expect(discover).toContain('<PublishedExternalListings kind="gig" />');
    expect(discover).toContain('{ id: "sourced", label: "Sourced", icon: Globe }');
  });

  it("the sitemap lists only eligible sourced listings and skips quietly before the migration exists", () => {
    const sitemap = read("supabase/functions/generate-sitemap/index.ts");
    expect(sitemap).toContain("isSitemapEligible(input, new Date())");
    expect(sitemap).toContain("from('public_external_listings')");
    expect(sitemap).toMatch(/catch \(e\) \{\s*console\.warn\('Sitemap: sourced listings skipped'/);
  });
});
