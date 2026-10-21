// The criteria form and its two-way conversion with a MatchNeed. The form is what a person edits; a MatchNeed is what is
// checked. Kreto fills the form from a brief through needToForm, and the person reviews and edits it before anything is
// searched, so nothing Kreto read is used without being shown. Importance is kept per term and per platform, because a
// brief can say "must know Premiere, After Effects is a plus".
//
// Pure, so the form's behaviour is tested without rendering it. Free text is split on commas, trimmed, de-duplicated and
// capped; whatever remains is validated by the same schema Kreto's output has to satisfy.

import { matchNeedSchema, PLATFORM_IDS, type Importance, type MatchNeed, type PlatformId } from "./need";
import type { RoleStampCategory } from "@/lib/passport/roleStamp";

export interface TermItem { term: string; importance: Importance }
export interface PlatformItem { platform: PlatformId; importance: Importance; /** Digits only, or empty. */ minAudience: string }

export interface CriteriaForm {
  craft: { category: RoleStampCategory | ""; importance: Importance };
  /** `draft` is text typed but not yet added; it is added as a term when the form is submitted. */
  skills: { items: TermItem[]; draft: string };
  themes: { items: TermItem[]; draft: string };
  location: { text: string; remoteOk: boolean; importance: Importance };
  platforms: PlatformItem[];
  audience: { text: string; importance: Importance };
  backedWork: { on: boolean; importance: Importance };
}

export const emptyForm = (): CriteriaForm => ({
  craft: { category: "", importance: "required" },
  skills: { items: [], draft: "" },
  themes: { items: [], draft: "" },
  location: { text: "", remoteOk: false, importance: "preferred" },
  platforms: [],
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

/** Adds the terms in `text` to the list with the given importance, skipping ones already there (case-insensitive). */
export function addTerms(items: readonly TermItem[], text: string, importance: Importance): TermItem[] {
  const have = new Set(items.map((i) => i.term.toLowerCase()));
  const added = splitTerms(text).filter((t) => !have.has(t.toLowerCase())).map((term) => ({ term, importance }));
  return [...items, ...added];
}

/** A need as the form shows it, for review and editing. The inverse of formToNeed. */
export function needToForm(input: MatchNeed): CriteriaForm {
  const need = matchNeedSchema.parse(input);
  const form = emptyForm();
  if (need.craft) form.craft = { category: need.craft.category, importance: need.craft.importance };
  form.skills.items = need.skills.map((s) => ({ term: s.term, importance: s.importance }));
  form.themes.items = need.themes.map((t) => ({ term: t.term, importance: t.importance }));
  if (need.location) form.location = { text: need.location.text, remoteOk: need.location.remoteOk, importance: need.location.importance };
  form.platforms = need.platforms.map((p) => ({ platform: p.platform, importance: p.importance, minAudience: p.minAudience ? String(p.minAudience) : "" }));
  if (need.audience) form.audience = { text: need.audience.description, importance: need.audience.importance };
  if (need.backedWork) form.backedWork = { on: true, importance: need.backedWork };
  return form;
}

export type NeedResult = { ok: true; need: MatchNeed } | { ok: false; error: string };

export function formToNeed(form: CriteriaForm): NeedResult {
  const platforms: Array<{ platform: PlatformId; minAudience?: number; importance: Importance }> = [];
  for (const id of PLATFORM_IDS) {
    const item = form.platforms.find((p) => p.platform === id);
    if (!item) continue;
    const raw = item.minAudience.replace(/[,\s]/g, "");
    const minAudience = raw ? Number(raw) : undefined;
    if (minAudience !== undefined && (!Number.isInteger(minAudience) || minAudience <= 0)) {
      return { ok: false, error: "Minimum audience must be a whole number above zero." };
    }
    platforms.push({ platform: id, minAudience, importance: item.importance });
  }

  const skills = addTerms(form.skills.items, form.skills.draft, "required");
  const themes = addTerms(form.themes.items, form.themes.draft, "preferred");

  const candidate = {
    craft: form.craft.category ? { category: form.craft.category, importance: form.craft.importance } : undefined,
    skills,
    themes,
    location: form.location.text.trim() ? { text: form.location.text.trim(), remoteOk: form.location.remoteOk, importance: form.location.importance } : undefined,
    platforms,
    audience: form.audience.text.trim() ? { description: form.audience.text.trim(), importance: form.audience.importance } : undefined,
    backedWork: form.backedWork.on ? form.backedWork.importance : undefined,
  };

  const parsed = matchNeedSchema.safeParse(candidate);
  if (!parsed.success) {
    const field = String(parsed.error.issues[0].path[0] ?? "criteria");
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
