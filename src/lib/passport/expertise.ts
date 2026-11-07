/**
 * What the Passport's Expertise section is made of: only fields the member or a confirmed source already put on the record. Nothing is
 * inferred (no seniority, no years per skill, no languages), and nothing is added to make a CV look fuller than the data is.
 */
export interface ExpertiseCredential {
  id: string;
  title: string;
  value?: string | null;
  issuer?: string | null;
}
export interface ExpertiseAward {
  id: string;
  title: string;
  organization?: string | null;
  year?: number | string | null;
}
export interface ExpertisePress {
  id: string;
  title: string;
  publication?: string | null;
  url: string;
}

export interface Expertise {
  /** The title first, then the other roles; no repeats. */
  roles: string[];
  skills: string[];
  /** The passion / hobby skills the member listed, minus any already shown as skills. */
  interests: string[];
  credentials: ExpertiseCredential[];
  awards: ExpertiseAward[];
  featuredIn: ExpertisePress[];
}

export const EXPERTISE_LIMITS = { skills: 12, interests: 8, credentials: 6, awards: 4, featuredIn: 4 } as const;

const clean = (value: unknown): string => (typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "");

/** Strings and `{ skill }` / `{ name }` objects, as the two skill columns store them; unique without regard to case. */
export function skillNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of value) {
    const raw = typeof entry === "string" ? entry : entry && typeof entry === "object" ? ((entry as { skill?: unknown; name?: unknown }).skill ?? (entry as { name?: unknown }).name) : "";
    const name = clean(raw);
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

const unique = (values: string[]) => {
  const seen = new Set<string>();
  return values.filter((v) => {
    const key = v.toLowerCase();
    if (!v || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export interface ExpertiseInput {
  jobTitle?: string | null;
  role?: string | null;
  subRoles?: readonly string[] | null;
  professionalSkills?: unknown;
  passionSkills?: unknown;
  credentials?: readonly ExpertiseCredential[];
  awards?: readonly ExpertiseAward[];
  press?: readonly ExpertisePress[];
}

export function buildExpertise(input: ExpertiseInput): Expertise {
  const skills = skillNames(input.professionalSkills).slice(0, EXPERTISE_LIMITS.skills);
  const shown = new Set(skills.map((s) => s.toLowerCase()));
  return {
    roles: unique([clean(input.jobTitle) || clean(input.role), ...(input.subRoles ?? []).map(clean)]),
    skills,
    interests: skillNames(input.passionSkills)
      .filter((s) => !shown.has(s.toLowerCase()))
      .slice(0, EXPERTISE_LIMITS.interests),
    credentials: (input.credentials ?? []).filter((c) => clean(c.title)).slice(0, EXPERTISE_LIMITS.credentials),
    awards: (input.awards ?? []).filter((a) => clean(a.title)).slice(0, EXPERTISE_LIMITS.awards),
    featuredIn: (input.press ?? []).filter((p) => clean(p.title) && clean(p.url)).slice(0, EXPERTISE_LIMITS.featuredIn),
  };
}

export const expertiseIsEmpty = (e: Expertise) =>
  e.roles.length + e.skills.length + e.interests.length + e.credentials.length + e.awards.length + e.featuredIn.length === 0;
