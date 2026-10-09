import { deriveEvidenceState, type CreditEvidenceInput } from "@/lib/creditEvidence";

/**
 * Discover Creatives: the pure part. Which public Passports to show, and what
 * can truthfully be said about their credits. The data is whatever
 * public_profiles_safe and the credits RLS already allow; nothing here adds to
 * it or fills a gap with a guess.
 */

export interface CreativeRow {
  user_id: string | null;
  username: string | null;
  full_name: string | null;
  role: string | null;
  avatar_url: string | null;
  cover_image_url: string | null;
  location: string | null;
  verification_tier: string | null;
}

export const STANDING_LABEL: Record<string, string> = {
  elite: "Elite Verified",
  industry: "Industry Verified",
  verified: "Verified",
};

export const MAX_CREATIVES = 12;

/**
 * A cross-section across disciplines (one per distinct role where possible)
 * rather than whoever has the highest level, which would just repeat the
 * Passport Directory's own top of list. Rows without an id are dropped.
 */
export function spreadAcrossRoles(list: CreativeRow[], max = MAX_CREATIVES): CreativeRow[] {
  const usable = list.filter((r) => !!r.user_id);
  const seen = new Set<string>();
  const spread: CreativeRow[] = [];
  for (const r of usable) {
    const key = (r.role || "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    spread.push(r);
    if (spread.length >= max) break;
  }
  // Too few distinct roles to be a cross-section: fall back to the plain top.
  return spread.length >= 6 ? spread : usable.slice(0, max);
}

export const profileHref = (r: Pick<CreativeRow, "user_id" | "username">): string =>
  r.username ? `/@${r.username.replace(/^@/, "")}` : `/profile/${r.user_id}`;

export const standingLabel = (tier: string | null | undefined): string | null =>
  tier ? STANDING_LABEL[tier.toLowerCase()] ?? null : null;

/**
 * "3 credits · 2 confirmed", from the credit rows the viewer is allowed to
 * see. "Confirmed" means co-signed or confirmed by an organization (the same
 * derivation the Passport uses); a credit still waiting on review does not
 * count. Null when there is nothing to say.
 */
export function summarizeCredits(rows: CreditEvidenceInput[]): string | null {
  const counted = rows.map(deriveEvidenceState).filter((s) => s !== "pending_review");
  const total = counted.length;
  if (total === 0) return null;
  const confirmed = counted.filter((s) => s === "co_signed" || s === "organization_confirmed").length;
  const noun = `credit${total === 1 ? "" : "s"}`;
  if (confirmed === total) return `${total} confirmed ${noun}`;
  if (confirmed > 0) return `${total} ${noun} · ${confirmed} confirmed`;
  if (counted.every((s) => s === "claimed")) return `${total} ${noun} · self-reported`;
  return `${total} ${noun}`;
}
