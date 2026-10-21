// Turns what is typed into the criteria form into a MatchNeed, or says what is wrong. Pure, so the form's behaviour is
// tested without rendering it. Free text is split on commas, trimmed, de-duplicated and capped; whatever remains is
// validated by the same schema Kreto's output will have to satisfy.

import { matchNeedSchema, PLATFORM_IDS, type Importance, type MatchNeed, type PlatformId } from "./need";
import type { RoleStampCategory } from "@/lib/passport/roleStamp";

export interface CriteriaForm {
  craft: { category: RoleStampCategory | ""; importance: Importance };
  skills: { text: string; importance: Importance };
  themes: { text: string; importance: Importance };
  location: { text: string; remoteOk: boolean; importance: Importance };
  platforms: { selected: PlatformId[]; minAudience: string; importance: Importance };
  audience: { text: string; importance: Importance };
  backedWork: { on: boolean; importance: Importance };
}

export const emptyForm = (): CriteriaForm => ({
  craft: { category: "", importance: "required" },
  skills: { text: "", importance: "required" },
  themes: { text: "", importance: "preferred" },
  location: { text: "", remoteOk: false, importance: "preferred" },
  platforms: { selected: [], minAudience: "", importance: "required" },
  audience: { text: "", importance: "required" },
  backedWork: { on: false, importance: "preferred" },
});

const MAX_TERM = 40;

/** "a, b ,, a" -> ["a", "b"]: trimmed, no empties, no repeats (case-insensitive), each cut to the term limit. */
export function splitTerms(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/[,\n;]/)) {
    const term = raw.trim().slice(0, MAX_TERM).trim();
    if (term.length < 2 || seen.has(term.toLowerCase())) continue;
    seen.add(term.toLowerCase());
    out.push(term);
  }
  return out;
}

export type NeedResult = { ok: true; need: MatchNeed } | { ok: false; error: string };

export function formToNeed(form: CriteriaForm): NeedResult {
  const minAudience = form.platforms.minAudience.trim() ? Number(form.platforms.minAudience.replace(/[,\s]/g, "")) : undefined;
  if (minAudience !== undefined && (!Number.isInteger(minAudience) || minAudience <= 0)) {
    return { ok: false, error: "Minimum audience must be a whole number above zero." };
  }

  const candidate = {
    craft: form.craft.category ? { category: form.craft.category, importance: form.craft.importance } : undefined,
    skills: splitTerms(form.skills.text).map((term) => ({ term, importance: form.skills.importance })),
    themes: splitTerms(form.themes.text).map((term) => ({ term, importance: form.themes.importance })),
    location: form.location.text.trim() ? { text: form.location.text.trim(), remoteOk: form.location.remoteOk, importance: form.location.importance } : undefined,
    platforms: PLATFORM_IDS.filter((id) => form.platforms.selected.includes(id)).map((platform) => ({ platform, minAudience, importance: form.platforms.importance })),
    audience: form.audience.text.trim() ? { description: form.audience.text.trim(), importance: form.audience.importance } : undefined,
    backedWork: form.backedWork.on ? form.backedWork.importance : undefined,
  };

  const parsed = matchNeedSchema.safeParse(candidate);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = String(issue.path[0] ?? "criteria");
    const hint: Record<string, string> = {
      skills: "Use at most 8 skills.",
      themes: "Use at most 6 themes.",
      platforms: "Pick at most 4 platforms.",
      location: "Give a place of at least 2 characters.",
      audience: "Describe the audience in at least 3 characters.",
    };
    return { ok: false, error: hint[field] ?? "Check the criteria and try again." };
  }

  const need = parsed.data;
  const any = need.craft || need.skills.length || need.themes.length || need.location || need.platforms.length || need.audience || need.backedWork;
  return any ? { ok: true, need } : { ok: false, error: "Add at least one criterion." };
}
