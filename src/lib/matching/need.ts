// What a company says it needs, as a checkable list of criteria. Every criterion is either required or preferred, and
// every criterion is later answered with one of three things: met, not met, or "not on Kretopia" (unknown). That third
// answer is the point: a profile with missing information is never made to look compatible, and a criterion Kretopia has
// no data for (who a creator's audience is) says so instead of being guessed from a bio, a tag or a city.
//
// The shape is validated with zod because it also crosses a boundary: Kreto, when it turns a free-text brief into
// criteria, must produce exactly this and nothing else (see matchNeedSchema).

import { z } from "zod";
import { ROLE_STAMP_LABEL, type RoleStampCategory } from "@/lib/passport/roleStamp";

export const IMPORTANCE = ["required", "preferred"] as const;
export type Importance = (typeof IMPORTANCE)[number];

/** Crafts a need can name. "creator" is the influencer / UGC group (matched by its words, never as a fallback). */
export const CRAFT_CATEGORIES = Object.keys(ROLE_STAMP_LABEL) as RoleStampCategory[];

/** Platforms a profile can link to or sync. */
export const PLATFORM_IDS = ["tiktok", "instagram", "youtube", "spotify", "soundcloud", "behance"] as const;
export type PlatformId = (typeof PLATFORM_IDS)[number];
export const PLATFORM_LABEL: Record<PlatformId, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
  spotify: "Spotify",
  soundcloud: "SoundCloud",
  behance: "Behance",
};

const importance = z.enum(IMPORTANCE);
const term = z.string().trim().min(2).max(40);

export const matchNeedSchema = z.object({
  craft: z.object({ category: z.enum(CRAFT_CATEGORIES as [RoleStampCategory, ...RoleStampCategory[]]), importance }).optional(),
  skills: z.array(z.object({ term, importance })).max(8).default([]),
  themes: z.array(z.object({ term, importance })).max(6).default([]),
  location: z.object({ text: z.string().trim().min(2).max(80), remoteOk: z.boolean().default(false), importance }).optional(),
  platforms: z
    .array(z.object({ platform: z.enum(PLATFORM_IDS), minAudience: z.number().int().positive().max(1_000_000_000).optional(), importance }))
    .max(4)
    .default([]),
  /** Who the audience must be ("women 18 to 24 in the US"). Kretopia holds no audience demographics, so this is never verifiable. */
  audience: z.object({ description: z.string().trim().min(3).max(120), importance }).optional(),
  /** At least one credit that is verified or co-signed. */
  backedWork: importance.optional(),
});

export type MatchNeed = z.infer<typeof matchNeedSchema>;

export type CriterionKind = "craft" | "skill" | "theme" | "location" | "platform" | "audience-size" | "audience" | "backed-work";

export interface Criterion {
  id: string;
  kind: CriterionKind;
  importance: Importance;
  /** What is being asked, in the company's words. */
  label: string;
  /** The value to look for, where the kind has one. */
  term?: string;
  platform?: PlatformId;
  minAudience?: number;
  remoteOk?: boolean;
}

const lower = (value: string) => value.trim().toLowerCase();

/** Flattens a need into its criteria, in a fixed order, dropping duplicates of the same term. */
export function needToCriteria(input: MatchNeed): Criterion[] {
  const need = matchNeedSchema.parse(input);
  const out: Criterion[] = [];
  const seen = new Set<string>();
  const add = (c: Criterion) => { if (!seen.has(c.id)) { seen.add(c.id); out.push(c); } };

  if (need.craft) add({ id: `craft:${need.craft.category}`, kind: "craft", importance: need.craft.importance, label: `Works as ${ROLE_STAMP_LABEL[need.craft.category]}`, term: need.craft.category });
  for (const s of need.skills) add({ id: `skill:${lower(s.term)}`, kind: "skill", importance: s.importance, label: `Skill: ${s.term}`, term: s.term });
  for (const t of need.themes) add({ id: `theme:${lower(t.term)}`, kind: "theme", importance: t.importance, label: `Has worked on: ${t.term}`, term: t.term });
  if (need.location) add({ id: "location", kind: "location", importance: need.location.importance, label: need.location.remoteOk ? `Based in ${need.location.text}, or remote` : `Based in ${need.location.text}`, term: need.location.text, remoteOk: need.location.remoteOk });
  for (const p of need.platforms) {
    add({ id: `platform:${p.platform}`, kind: "platform", importance: p.importance, label: `Present on ${PLATFORM_LABEL[p.platform]}`, platform: p.platform });
    if (p.minAudience) add({ id: `audience-size:${p.platform}`, kind: "audience-size", importance: p.importance, label: `${PLATFORM_LABEL[p.platform]} audience of at least ${p.minAudience.toLocaleString("en-US")}`, platform: p.platform, minAudience: p.minAudience });
  }
  if (need.audience) add({ id: "audience", kind: "audience", importance: need.audience.importance, label: `Audience: ${need.audience.description}`, term: need.audience.description });
  if (need.backedWork) add({ id: "backed-work", kind: "backed-work", importance: need.backedWork, label: "Has a verified or co-signed credit" });
  return out;
}
