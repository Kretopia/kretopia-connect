// Answers a company's criteria with what Kretopia actually holds about a creative, and ranks creatives by that answer.
//
// Rules (so the result can be trusted and tested):
//   - Every criterion gets exactly one of: met, not met, or unknown ("not on Kretopia"). Unknown is never counted as met
//     and never as not met: it is information that is missing, and it is shown.
//   - Every answer carries its basis: "demonstrated" (from their credits or a synced account) or "stated" (written on
//     their own profile). A basis is only given to a met criterion; the evidence line quotes the real field.
//   - "Not met" means "not on their Kretopia record", not "untrue": the copy says so.
//   - Audience is never inferred. A location, a bio or a tag does not prove who follows someone; the audience criterion
//     is always unknown, and an audience SIZE is checked only against a synced follower figure.
//   - There is no percentage, score or probability. The result is a fit level (words), the coverage (how many criteria
//     could be checked at all) and the list of answers. A profile that cannot be checked is "not enough information",
//     never "compatible". The order is a fixed, documented tuple with a stable tie-break, so the same data always gives
//     the same order.

import { classifyCreditEvidence, type CreditEvidenceStatus } from "@/lib/passport/creditEvidence";
import { matchRoleStampCategory, ROLE_STAMP_LABEL, type RoleStampCategory } from "@/lib/passport/roleStamp";
import { stableUnit } from "@/lib/matchRanking";
import { needToCriteria, PLATFORM_LABEL, type Criterion, type MatchNeed, type PlatformId } from "./need";

export interface FactsCredit {
  category?: string | null;
  projectType?: string | null;
  projectName?: string | null;
  role?: string | null;
  clientBrand?: string | null;
  tags?: readonly string[] | null;
  evidence: CreditEvidenceStatus;
}

export interface CandidateFacts {
  userId: string;
  fullName: string;
  avatarUrl?: string | null;
  role: string | null;
  bio: string | null;
  location: string | null;
  skills: readonly string[];
  /** A link to the platform is on their profile (stated, not checked). */
  links: Partial<Record<PlatformId, boolean>>;
  /** The platform is connected and synced to Kretopia; `audience` is the follower figure when the sync stored one. */
  synced: Partial<Record<PlatformId, { audience: number | null }>>;
  credits: readonly FactsCredit[];
}

export type CriterionStatus = "met" | "not_met" | "unknown";
export type EvidenceBasis = "demonstrated" | "stated";

export interface CriterionResult {
  criterion: Criterion;
  status: CriterionStatus;
  /** Only for a met criterion. */
  basis: EvidenceBasis | null;
  /** The real field the answer rests on, or what is missing. */
  evidence: string;
  /** For an unknown answer: what the gap means for the company. */
  consequence: string | null;
}

export type Fit = "meets_all" | "partial" | "unclear" | "weak";

export const FIT_LABEL: Record<Fit, string> = {
  meets_all: "Meets your requirements",
  partial: "Meets some requirements",
  unclear: "Not enough information",
  weak: "Doesn't meet a requirement",
};

export interface Summary {
  fit: Fit;
  label: string;
  /** How many criteria could be checked at all (met or not met) out of all of them. */
  coverage: { checked: number; total: number };
  required: { total: number; met: number; notMet: number; unknown: number };
  preferred: { total: number; met: number };
  demonstrated: number;
  backedCredits: number;
}

export interface Evaluation {
  facts: CandidateFacts;
  results: CriterionResult[];
  summary: Summary;
}

// A product rule, not data about anyone: which credit categories count as work in which craft. It is deliberately short;
// a credit whose category is not here simply does not count as demonstrating a craft.
const CREDIT_CRAFT: Record<RoleStampCategory, readonly string[]> = {
  music: ["music", "single", "album", "ep", "dj_set", "mixtape"],
  photo_video: ["film", "movie", "tv", "film_tv", "short_film", "music_video", "commercial", "photography", "video", "brand_campaign", "editorial_shoot"],
  fashion: ["fashion", "fashion_show"],
  design: ["design", "illustration"],
  writing: ["writing", "article"],
  dance: ["dance"],
  model: ["model"],
  crew: ["live_event", "events", "tour", "stage", "theatre", "musical"],
  creator: ["youtube_series", "podcast", "tiktok", "ugc_campaign", "creator_profile"],
  software: [],
};

const norm = (value: string | null | undefined) => (value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
const escapeRe = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** The term at the start of a word anywhere in the text ("swimwear" also reads "swimwears"). */
const mentions = (text: string | null | undefined, term: string) => !!text && new RegExp(`(^|[^a-z0-9à-ÿ])${escapeRe(term.trim().toLowerCase())}`, "i").test(text);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const creditName = (c: FactsCredit) => c.projectName?.trim() || "a project";
const isBacked = (c: FactsCredit) => c.evidence === "verified" || c.evidence === "co_signed";

const unknown = (criterion: Criterion, evidence: string, consequence: string): CriterionResult => ({ criterion, status: "unknown", basis: null, evidence, consequence });
const met = (criterion: Criterion, basis: EvidenceBasis, evidence: string): CriterionResult => ({ criterion, status: "met", basis, evidence, consequence: null });
const notMet = (criterion: Criterion, evidence: string): CriterionResult => ({ criterion, status: "not_met", basis: null, evidence, consequence: null });

function evalCraft(c: Criterion, f: CandidateFacts): CriterionResult {
  const want = c.term as RoleStampCategory;
  const have = matchRoleStampCategory({ role: f.role });
  const works = f.credits.filter((cr) => CREDIT_CRAFT[want].includes(norm(cr.category)) || CREDIT_CRAFT[want].includes(norm(cr.projectType)));
  const inField = works.length > 0 ? ` and ${plural(works.length, "credit", "credits")} in this field` : "";
  if (have === want) return met(c, works.length > 0 ? "demonstrated" : "stated", `Role: "${f.role}"${inField}`);
  if (works.length > 0) return met(c, "demonstrated", `${plural(works.length, "credit", "credits")} in this field${f.role ? ` (role reads "${f.role}")` : ""}`);
  if (have) return notMet(c, `Role: "${f.role}" (reads as ${ROLE_STAMP_LABEL[have]}); no credits in this field`);
  return unknown(c, f.role ? `Role "${f.role}" does not name a craft Kretopia can compare` : "No role on their profile", "Open their Passport to see what they do.");
}

function evalSkill(c: Criterion, f: CandidateFacts): CriterionResult {
  const term = c.term ?? "";
  if (f.skills.some((s) => mentions(s, term))) return met(c, "stated", `Lists the skill "${f.skills.find((s) => mentions(s, term))}"`);
  const credit = f.credits.find((cr) => mentions(cr.role, term));
  if (credit) return met(c, "demonstrated", `Credited as "${credit.role}" on ${creditName(credit)}`);
  if (mentions(f.bio, term)) return met(c, "stated", "Mentioned in their bio");
  if (f.skills.length > 0 || f.credits.length > 0 || f.bio) return notMet(c, "Not in their skills, credits or bio");
  return unknown(c, "No skills, credits or bio on their profile", "Nothing on Kretopia says either way; ask them directly.");
}

function evalTheme(c: Criterion, f: CandidateFacts): CriterionResult {
  const term = c.term ?? "";
  const onIt = f.credits.filter((cr) => [cr.category, cr.projectType, cr.projectName, cr.clientBrand, ...(cr.tags ?? [])].some((v) => mentions(v, term)));
  if (onIt.length > 0) return met(c, "demonstrated", `${plural(onIt.length, "credit", "credits")} on this, such as ${creditName(onIt[0])}`);
  if (f.skills.some((s) => mentions(s, term)) || mentions(f.bio, term)) return met(c, "stated", "Mentioned in their skills or bio, with no credit to show it");
  if (f.skills.length > 0 || f.credits.length > 0 || f.bio) return notMet(c, "No credit, skill or bio mentions it");
  return unknown(c, "No credits, skills or bio on their profile", "Nothing on Kretopia says either way; ask them directly.");
}

function evalLocation(c: Criterion, f: CandidateFacts): CriterionResult {
  if (!f.location?.trim()) return unknown(c, "No location on their profile", "You cannot tell from Kretopia whether they are near you.");
  const tokens = (c.term ?? "").toLowerCase().split(/[,/]|\s{2,}/).map((t) => t.trim()).filter((t) => t.length >= 3);
  if (tokens.some((t) => f.location!.toLowerCase().includes(t))) return met(c, "stated", `Based in ${f.location}`);
  if (c.remoteOk) return met(c, "stated", `Based in ${f.location}; you said remote is fine`);
  return notMet(c, `Based in ${f.location}`);
}

function evalPlatform(c: Criterion, f: CandidateFacts): CriterionResult {
  const id = c.platform!;
  const name = PLATFORM_LABEL[id];
  if (f.synced[id]) return met(c, "demonstrated", `${name} account connected and synced`);
  if (f.links[id]) return met(c, "stated", `Links to ${name} (not connected, so not checked)`);
  return notMet(c, `No ${name} link or connected account on their profile`);
}

function evalAudienceSize(c: Criterion, f: CandidateFacts): CriterionResult {
  const id = c.platform!;
  const name = PLATFORM_LABEL[id];
  const audience = f.synced[id]?.audience;
  if (typeof audience === "number" && Number.isFinite(audience)) {
    const text = `${name}: ${audience.toLocaleString("en-US")} followers (synced)`;
    return audience >= (c.minAudience ?? 0) ? met(c, "demonstrated", text) : notMet(c, text);
  }
  return unknown(c, `${name} audience size not provided`, `Kretopia has no follower figure for this ${name} account; ask for their platform insights.`);
}

function evalAudience(c: Criterion): CriterionResult {
  return unknown(
    c,
    "Audience data not provided",
    "Kretopia holds no audience demographics, so fit with this audience cannot be shown. A location, bio or tag does not prove who follows someone; ask for platform insights.",
  );
}

function evalBackedWork(c: Criterion, f: CandidateFacts): CriterionResult {
  const backed = f.credits.filter(isBacked).length;
  if (backed > 0) return met(c, "demonstrated", `${plural(backed, "verified or co-signed credit", "verified or co-signed credits")}`);
  if (f.credits.length > 0) return notMet(c, `${plural(f.credits.length, "credit", "credits")}, none verified or co-signed yet`);
  return notMet(c, "No credits on their Passport yet");
}

export function evaluateCriterion(criterion: Criterion, facts: CandidateFacts): CriterionResult {
  switch (criterion.kind) {
    case "craft": return evalCraft(criterion, facts);
    case "skill": return evalSkill(criterion, facts);
    case "theme": return evalTheme(criterion, facts);
    case "location": return evalLocation(criterion, facts);
    case "platform": return evalPlatform(criterion, facts);
    case "audience-size": return evalAudienceSize(criterion, facts);
    case "audience": return evalAudience(criterion);
    case "backed-work": return evalBackedWork(criterion, facts);
  }
}

export function summarize(results: readonly CriterionResult[], facts: CandidateFacts): Summary {
  const total = results.length;
  const checked = results.filter((r) => r.status !== "unknown").length;
  const req = results.filter((r) => r.criterion.importance === "required");
  const pref = results.filter((r) => r.criterion.importance === "preferred");
  const required = { total: req.length, met: req.filter((r) => r.status === "met").length, notMet: req.filter((r) => r.status === "not_met").length, unknown: req.filter((r) => r.status === "unknown").length };
  const preferred = { total: pref.length, met: pref.filter((r) => r.status === "met").length };
  const coverageOk = total > 0 && checked / total >= 0.6;

  let fit: Fit;
  if (total === 0 || checked === 0) fit = "unclear";
  else if (required.notMet > 0) fit = "weak";
  else if (required.total > 0 && required.unknown === 0 && coverageOk) fit = "meets_all";
  else if (required.met + preferred.met > 0) fit = "partial";
  else fit = "unclear";

  return {
    fit,
    label: FIT_LABEL[fit],
    coverage: { checked, total },
    required,
    preferred,
    demonstrated: results.filter((r) => r.basis === "demonstrated").length,
    backedCredits: facts.credits.filter(isBacked).length,
  };
}

export function evaluateCandidate(need: MatchNeed, facts: CandidateFacts): Evaluation {
  const results = needToCriteria(need).map((c) => evaluateCriterion(c, facts));
  return { facts, results, summary: summarize(results, facts) };
}

const FIT_ORDER: Record<Fit, number> = { meets_all: 0, partial: 1, unclear: 2, weak: 3 };

/** Fit level, then fewer required unknowns, more required met, more evidence from their work, more preferred met, more backed credits, then a stable hash of the id. */
export function compareEvaluations(a: Evaluation, b: Evaluation): number {
  const x = a.summary;
  const y = b.summary;
  return (
    FIT_ORDER[x.fit] - FIT_ORDER[y.fit] ||
    x.required.unknown - y.required.unknown ||
    y.required.met - x.required.met ||
    y.demonstrated - x.demonstrated ||
    y.preferred.met - x.preferred.met ||
    y.backedCredits - x.backedCredits ||
    stableUnit(a.facts.userId) - stableUnit(b.facts.userId)
  );
}

export function rankCandidates(need: MatchNeed, pool: readonly CandidateFacts[]): Evaluation[] {
  return pool.map((facts) => evaluateCandidate(need, facts)).sort(compareEvaluations);
}
