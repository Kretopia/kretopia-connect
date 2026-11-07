/**
 * The contributions a visitor could have a role on, as a Passport already shows them: its credits, one entry per project. A portfolio
 * piece is not a project with a roll call, and a credit with no name has nothing to open, so neither is offered. Which roles of a
 * project are still open is the project page's own answer; this list never decides it.
 */
export interface ClaimableProject {
  id: string;
  name: string;
  /** How this Passport's owner is credited on it: the attribution stays in the credit detail. */
  role?: string | null;
  year?: number | null;
}

interface CreditLike {
  id: string;
  project_name?: string | null;
  title?: string | null;
  role?: string | null;
  year?: number | null;
  source?: string | null;
}

export function claimableProjects(credits: readonly CreditLike[]): ClaimableProject[] {
  const seen = new Set<string>();
  const out: ClaimableProject[] = [];
  for (const credit of credits) {
    if (credit.source === "portfolio") continue;
    const name = (credit.project_name || credit.title || "").trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push({ id: credit.id, name, role: credit.role ?? null, year: credit.year ?? null });
  }
  return out;
}

/** The project page that lists a project's roles and takes the claim (the same address a credit on a Passport opens). */
export const projectPagePath = (projectName: string) => `/production?name=${encodeURIComponent(projectName)}`;
