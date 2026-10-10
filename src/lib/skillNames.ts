/**
 * Skill names from a profile column that is not always a list of strings.
 * profiles.professional_skills / passion_skills are jsonb: some profiles hold
 * strings, some hold { skill, category, level } objects, a few hold a record
 * keyed by skill, many hold nothing. Anything else is dropped.
 */
export function skillNames(value: unknown): string[] {
  const out: string[] = [];
  const push = (v: unknown) => {
    if (typeof v === "string" && v.trim()) out.push(v.trim());
  };
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "string") push(item);
      else if (item && typeof item === "object") {
        const rec = item as Record<string, unknown>;
        push(rec.skill ?? rec.name ?? rec.label ?? rec.title);
      }
    }
  } else if (value && typeof value === "object") {
    Object.keys(value as Record<string, unknown>).forEach(push);
  }
  return out;
}
