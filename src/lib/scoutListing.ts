/**
 * A scouted listing that is an empty shell: no real description, no pay, no
 * company, or a link to a category or search page instead of one posting.
 * Scout hides these; anything else that shows scouted gigs (Today's Radar)
 * must hide the same ones, so the two never disagree.
 */
export interface ListingFields {
  description?: string | null;
  full_description?: string | null;
  compensation?: string | null;
  company?: string | null;
  apply_url?: string | null;
  source_url?: string | null;
}

const GENERIC_LAST_SEGMENTS = ["jobs", "careers", "search", "browse", "explore", "listings", "opportunities", "gigs", "tags", "postings", "apply", "casting"];

export const isThinListing = (g: ListingFields): boolean => {
  const desc = (g.full_description || g.description || "").trim();
  if (desc.length < 40 && !g.compensation && !g.company) return true;
  const url = g.apply_url || g.source_url || "";
  try {
    const u = new URL(url);
    const segs = u.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
    const last = (segs[segs.length - 1] || "").toLowerCase();
    if (GENERIC_LAST_SEGMENTS.includes(last)) return true;
    if (segs.length < 2 && last.length < 8) return true;
    if (/linkedin\.com$/.test(u.hostname.replace(/^www\./, "")) && !/\/jobs\/view\//.test(u.pathname)) return true;
  } catch {
    return true;
  }
  return false;
};
