// Real opportunity-match scoring — replaces the fake hash-based "70-98%
// match" badge that used to live in GigCard/GigRailCard (a deterministic
// function of the opportunity's UUID, unrelated to the viewer at all).
//
// Mirrors the skills/role/location overlap heuristic already computed
// client-side in UnifiedHome.tsx for the Today gigs rail, so this isn't a
// new invented signal — it's the same real logic, just made reusable and
// honest: when there isn't enough signal to say anything meaningful, it
// returns null and callers must hide the badge rather than fabricate one.

export interface OpportunityMatchInput {
  title: string;
  type?: string | null;
  location?: string | null;
  skills?: string[] | null;
  tags?: string[] | null;
}

export interface ViewerProfileForMatch {
  skills: string[];
  role: string;
  location: string;
}

export function computeOpportunityMatch(
  opp: OpportunityMatchInput,
  viewer: ViewerProfileForMatch | null | undefined,
): number | null {
  if (!viewer) return null;
  if (viewer.skills.length === 0 && !viewer.role.trim()) return null;

  const skillsLower = viewer.skills.map((s) => s.toLowerCase());
  const roleLower = viewer.role.toLowerCase();
  const title = (opp.title || "").toLowerCase();
  const type = (opp.type || "").toLowerCase();
  const required = [...(opp.skills || []), ...(opp.tags || [])].map((s) => (s || "").toLowerCase());

  let relevance = 0;
  skillsLower.forEach((sk) => {
    if (required.some((r) => r.includes(sk) || sk.includes(r))) relevance += 3;
    if (title.includes(sk)) relevance += 2;
  });
  if (roleLower && (title.includes(roleLower) || type.includes(roleLower))) relevance += 2;
  if (viewer.location && opp.location) {
    const viewerCity = viewer.location.toLowerCase().split(",")[0].trim();
    if (viewerCity && opp.location.toLowerCase().includes(viewerCity)) relevance += 1;
  }

  if (relevance === 0) return null;

  return Math.min(97, 55 + relevance * 6);
}
