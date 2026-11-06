/**
 * A press result found by searching a NAME is not yet about THIS member: "Plantier" matches every Plantier. This decides whether
 * a result is worth showing the member as a candidate at all. It needs the full name as a phrase AND at least one thing that ties
 * the page to this person (their role, a project of theirs, a collaborator who co-signed their work, their own website, their
 * city). A name alone is rejected. The result is only ever a candidate: the member confirms it before it appears on their Passport.
 */
export interface PressSearchResult {
  url?: string | null;
  title?: string | null;
  description?: string | null;
  siteName?: string | null;
}

export interface PressIdentity {
  fullName: string;
  role?: string | null;
  location?: string | null;
  website?: string | null;
  /** Names of the member's own projects. */
  projectNames?: string[];
  /** Names of people who accepted a co-sign request from this member. */
  collaboratorNames?: string[];
}

const norm = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const hasPhrase = (haystack: string, phrase: string) => phrase.length >= 3 && ` ${haystack} `.includes(` ${phrase} `);
const hostOf = (value: string) => {
  try {
    return new URL(/^https?:/i.test(value) ? value : `https://${value}`).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

export function assessPressCandidate(identity: PressIdentity, result: PressSearchResult): { accept: boolean; matchedOn: string[] } {
  const text = norm([result.title, result.description, result.siteName, result.url].filter(Boolean).join(" "));
  const name = norm(identity.fullName);
  if (!name.includes(" ") || !hasPhrase(text, name)) return { accept: false, matchedOn: [] };

  const matchedOn: string[] = [];
  const roleWords = norm(identity.role ?? "").split(" ").filter((word) => word.length >= 5);
  if (roleWords.some((word) => hasPhrase(text, word))) matchedOn.push("role");
  if ((identity.projectNames ?? []).some((project) => hasPhrase(text, norm(project)))) matchedOn.push("project");
  if ((identity.collaboratorNames ?? []).some((person) => norm(person).includes(" ") && hasPhrase(text, norm(person)))) matchedOn.push("collaborator");
  const ownHost = identity.website ? hostOf(identity.website) : "";
  if (ownHost && (hostOf(result.url ?? "") === ownHost || hasPhrase(text, norm(ownHost)))) matchedOn.push("website");
  const city = norm((identity.location ?? "").split(",")[0] ?? "");
  if (city.length >= 3 && hasPhrase(text, city)) matchedOn.push("location");

  return { accept: matchedOn.length > 0, matchedOn };
}
