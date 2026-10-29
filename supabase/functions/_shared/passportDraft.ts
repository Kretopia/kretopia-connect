// Pure rules for the Passport draft ("Strengthen your Passport"). The model never writes a URL, a name or a credit: it
// only chooses among candidates built from the person's own data and words a bio from the facts it was given. Every
// URL, label and role in the draft is copied from a candidate here, and the bio is rejected when it states something
// the facts do not contain. Nothing in a draft is verified: a saved work item is a self-reported claim.

export type PassportField = "bio" | "photo" | "work_item";

export interface ProfileFacts {
  full_name?: string | null;
  role?: string | null;
  location?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  professional_skills?: string[] | null;
  website?: string | null;
  imdb_url?: string | null;
}

export interface CreditFacts {
  project_name?: string | null;
  role?: string | null;
  url?: string | null;
  thumbnail_url?: string | null;
  primary_media_url?: string | null;
  media_type?: string | null;
}

export interface PhotoCandidate {
  id: string;
  url: string;
  source: "auth_provider" | "credit_media";
}

export interface WorkCandidate {
  id: string;
  url: string;
  project_name: string;
  source_label: string;
}

export interface PassportDraft {
  bio: { text: string } | null;
  photo: { url: string; source: PhotoCandidate["source"] } | null;
  work_item: { project_name: string; role: string; url: string; source_label: string } | null;
}

export type UnavailableReason =
  | "already_complete"
  | "not_enough_facts"
  | "unsupported_claims"
  | "no_candidates"
  | "nothing_suitable";

export const BIO_MIN = 20;
export const BIO_MAX = 300;
export const MAX_PHOTO_CANDIDATES = 4;

/** Mirrors the client's discovery requirements (profileCompletion.getDiscoveryMissingFields). */
export function missingFields(profile: ProfileFacts, creditCount: number): Record<PassportField, boolean> {
  return {
    bio: !profile.bio || profile.bio.length < BIO_MIN,
    photo: !profile.avatar_url,
    work_item: creditCount < 1,
  };
}

const isHttps = (u: unknown): u is string => {
  if (typeof u !== "string" || u.length > 2000) return false;
  try {
    const p = new URL(u);
    return p.protocol === "https:" && !p.username && !p.password;
  } catch {
    return false;
  }
};

const IMAGE_EXT = /\.(avif|gif|jpe?g|png|webp)(\?.*)?$/i;

export function buildPhotoCandidates(authAvatar: unknown, credits: CreditFacts[]): PhotoCandidate[] {
  const out: PhotoCandidate[] = [];
  const seen = new Set<string>();
  const add = (url: unknown, source: PhotoCandidate["source"]) => {
    if (!isHttps(url) || seen.has(url) || out.length >= MAX_PHOTO_CANDIDATES) return;
    seen.add(url);
    out.push({ id: `p${out.length + 1}`, url, source });
  };
  add(authAvatar, "auth_provider");
  for (const c of credits) {
    const imageType = !c.media_type || /image|photo/i.test(c.media_type);
    for (const url of [c.primary_media_url, c.thumbnail_url]) {
      if (imageType && isHttps(url) && IMAGE_EXT.test(url)) add(url, "credit_media");
    }
  }
  return out;
}

const hostOf = (u: string) => new URL(u).hostname.replace(/^www\./, "");

/** Links the person already put on their own profile: a link is a claim of work they point to, not proof of it. */
export function buildWorkCandidates(profile: ProfileFacts): WorkCandidate[] {
  const out: WorkCandidate[] = [];
  const add = (url: unknown, prefix: string, sourceLabel: string) => {
    if (!isHttps(url)) return;
    out.push({ id: `w${out.length + 1}`, url, project_name: `${prefix} · ${hostOf(url)}`.slice(0, 200), source_label: sourceLabel });
  };
  add(profile.website, "Portfolio", "Link already on your profile");
  add(profile.imdb_url, "IMDb", "Link already on your profile");
  return out;
}

/** Everything the bio may rely on, as one lower-cased string. */
export function factsCorpus(profile: ProfileFacts, credits: CreditFacts[]): string {
  const parts = [
    profile.full_name, profile.role, profile.location, ...(profile.professional_skills ?? []),
    ...credits.flatMap((c) => [c.project_name, c.role]),
  ];
  return parts.filter((p): p is string => typeof p === "string" && p.trim().length > 0).join(" \n ").toLowerCase();
}

// Words that carry no claim of their own.
const FILLER = new Set([
  "i", "i'm", "ive", "i've", "my", "me", "and", "the", "a", "an", "of", "in", "on", "at", "for", "with", "to", "from", "who",
  "based", "creative", "creator", "work", "works", "working", "helping", "help", "brings", "bring", "focused", "passionate",
  "stories", "story", "projects", "project", "craft", "visual", "professional", "collaborating", "collaborate", "open",
]);

/**
 * A bio is accepted only when it reads as a short first-person sentence and every number and every proper-looking word
 * in it appears in the facts. Plain words may be new; names, places, employers and figures may not.
 */
export function checkBio(text: unknown, corpus: string): { ok: true; text: string } | { ok: false; reason: UnavailableReason } {
  if (typeof text !== "string") return { ok: false, reason: "not_enough_facts" };
  const clean = text.replace(/^["'\s]+|["'\s]+$/g, "").replace(/\s+/g, " ");
  if (clean.length < BIO_MIN) return { ok: false, reason: "not_enough_facts" };
  if (clean.length > BIO_MAX || /https?:\/\/|www\.|@\w|#\w/i.test(clean)) return { ok: false, reason: "unsupported_claims" };
  const tokens = clean.match(/[\p{L}\p{N}][\p{L}\p{N}'’.-]*/gu) ?? [];
  const sentenceStarts = new Set<number>();
  let idx = 0;
  const startRe = /(^|[.!?]\s+)([\p{L}\p{N}])/gu;
  for (let m = startRe.exec(clean); m; m = startRe.exec(clean)) sentenceStarts.add(m.index + m[1].length);
  for (const t of tokens) {
    const at = clean.indexOf(t, idx);
    idx = at + t.length;
    const word = t.replace(/[.'’-]+$/g, "");
    const lower = word.toLowerCase();
    if (FILLER.has(lower)) continue;
    const hasDigit = /\d/.test(word);
    const properLooking = /^[\p{Lu}]/u.test(word) && !sentenceStarts.has(at);
    if ((hasDigit || properLooking) && !corpus.includes(lower)) return { ok: false, reason: "unsupported_claims" };
  }
  return { ok: true, text: clean };
}

export interface ModelPick {
  bio?: unknown;
  photo_id?: unknown;
  work_id?: unknown;
}

/** The model's JSON, tolerant of code fences and surrounding text. null when there is no object to read. */
export function parseModelJson(content: unknown): ModelPick | null {
  if (typeof content !== "string") return null;
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const v = JSON.parse(content.slice(start, end + 1));
    return v && typeof v === "object" && !Array.isArray(v) ? (v as ModelPick) : null;
  } catch {
    return null;
  }
}

export interface ResolveInput {
  pick: ModelPick;
  missing: Record<PassportField, boolean>;
  profile: ProfileFacts;
  corpus: string;
  photos: PhotoCandidate[];
  works: WorkCandidate[];
}

export interface ResolvedDraft {
  draft: PassportDraft;
  unavailable: Partial<Record<PassportField, UnavailableReason>>;
}

/** Turns the model's choices into a draft, copying every concrete value from a candidate and checking the bio. */
export function resolveDraft({ pick, missing, profile, corpus, photos, works }: ResolveInput): ResolvedDraft {
  const draft: PassportDraft = { bio: null, photo: null, work_item: null };
  const unavailable: ResolvedDraft["unavailable"] = {};

  if (!missing.bio) unavailable.bio = "already_complete";
  else {
    const checked = checkBio(pick.bio, corpus);
    // `in` narrows without strictNullChecks, where a boolean `ok` discriminant does not.
    if ("text" in checked) draft.bio = { text: checked.text };
    else unavailable.bio = checked.reason;
  }

  if (!missing.photo) unavailable.photo = "already_complete";
  else if (photos.length === 0) unavailable.photo = "no_candidates";
  else {
    const chosen = photos.find((p) => p.id === pick.photo_id);
    if (chosen) draft.photo = { url: chosen.url, source: chosen.source };
    else unavailable.photo = "nothing_suitable";
  }

  if (!missing.work_item) unavailable.work_item = "already_complete";
  else if (works.length === 0) unavailable.work_item = "no_candidates";
  else {
    const chosen = works.find((w) => w.id === pick.work_id);
    if (chosen) {
      draft.work_item = {
        project_name: chosen.project_name,
        role: (profile.role && profile.role.trim()) || "Creator",
        url: chosen.url,
        source_label: chosen.source_label,
      };
    } else unavailable.work_item = "nothing_suitable";
  }

  return { draft, unavailable };
}
