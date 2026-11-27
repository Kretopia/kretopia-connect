/**
 * What a public search result says about itself, and where an unmistakable match goes straight to. Pure and dependency-free: no user
 * data, no network. The dropdown builds each row from public-safe fields only (the public profile view, the public opportunity
 * columns, public events and credits) and uses this to answer, for every row, the three questions the product spec asks of a
 * result: what is this, why is it relevant, what can I do next. Nothing here ranks or scores anyone; "why" only names the field
 * that matched the words.
 */

export type ResultKind = "person" | "opportunity" | "work" | "event";

/** The next action each kind offers, in specific words (not "View" everywhere). */
export const RESULT_ACTION: Record<ResultKind, string> = {
  person: "View profile",
  opportunity: "View opportunity",
  work: "View work",
  event: "View event",
};

const fold = (value: string) => value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

/** The words of a query, folded, in order, without empties. */
export const queryWords = (query: string): string[] => fold(query).split(" ").filter(Boolean).slice(0, 12);

const clip = (text: string, max: number) => (text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`);

/** A short stretch of `text` around the first word that matches, so a bio shows the part that is relevant. */
export function snippetAround(text: string | null | undefined, query: string, max = 76): string | null {
  const source = (text ?? "").replace(/\s+/g, " ").trim();
  if (!source) return null;
  const folded = fold(source);
  const hit = queryWords(query).map((w) => folded.indexOf(w)).filter((i) => i >= 0).sort((a, b) => a - b)[0];
  if (hit === undefined || hit < max / 3) return clip(source, max);
  const start = Math.max(0, hit - Math.floor(max / 4));
  return `…${clip(source.slice(start), max)}`;
}

const hasAll = (text: string | null | undefined, words: string[]) => {
  if (!text || !words.length) return false;
  const folded = fold(text);
  return words.every((w) => folded.includes(w));
};
const hasAny = (text: string | null | undefined, words: string[]) => {
  if (!text || !words.length) return false;
  const folded = fold(text);
  return words.some((w) => folded.includes(w));
};

interface PersonFields {
  name?: string | null;
  role?: string | null;
  bio?: string | null;
  location?: string | null;
}

/** Why a person appears: the field that matched, in plain words. Null when nothing can be said honestly. */
export function whyPerson(query: string, person: PersonFields): string | null {
  const words = queryWords(query);
  if (hasAll(person.name, words)) return "Name match";
  if (hasAny(person.role, words)) return person.role ? `Role: ${person.role}` : null;
  if (hasAny(person.bio, words)) return snippetAround(person.bio, query);
  if (hasAny(person.location, words)) return person.location ? `Based in ${person.location}` : null;
  return null;
}

interface OpportunityFields {
  title?: string | null;
  type?: string | null;
  skills?: string[] | null;
  location?: string | null;
}

export function whyOpportunity(query: string, opportunity: OpportunityFields): string | null {
  const words = queryWords(query);
  if (hasAll(opportunity.title, words)) return "Title match";
  const skill = (opportunity.skills ?? []).find((s) => hasAny(s, words));
  if (skill) return `Skill: ${skill}`;
  if (hasAny(opportunity.type, words)) return opportunity.type ? `Type: ${opportunity.type}` : null;
  if (hasAny(opportunity.location, words)) return opportunity.location ? `In ${opportunity.location}` : null;
  return null;
}

const DAY = 86_400_000;

/**
 * Timing for an opportunity, honestly: a deadline in the future is a deadline, one in the past says so (never "active"), and with no
 * deadline the age of the post is the only thing known.
 */
export function opportunityTiming(
  deadline: string | null | undefined,
  createdAt: string | null | undefined,
  now: Date = new Date(),
  locale?: string,
): { label: string; closed: boolean } | null {
  const fmt = (d: Date) => d.toLocaleDateString(locale, { day: "numeric", month: "short" });
  if (deadline) {
    const due = new Date(deadline);
    if (!Number.isNaN(due.getTime())) {
      return due.getTime() < now.getTime() ? { label: `Deadline passed ${fmt(due)}`, closed: true } : { label: `Apply by ${fmt(due)}`, closed: false };
    }
  }
  if (createdAt) {
    const created = new Date(createdAt);
    if (!Number.isNaN(created.getTime())) {
      const days = Math.floor((now.getTime() - created.getTime()) / DAY);
      if (days <= 0) return { label: "Posted today", closed: false };
      if (days === 1) return { label: "Posted yesterday", closed: false };
      if (days < 31) return { label: `Posted ${days} days ago`, closed: false };
      return { label: `Posted ${fmt(created)}`, closed: false };
    }
  }
  return null;
}

/** "Results for “x”": neutral words that never assume the visitor wants a job. */
export const resultsSummary = (query: string): string => `Results for “${query.trim()}”`;

export interface RoutableResult {
  kind: ResultKind;
  id: string;
  title: string;
}

/**
 * Where a search goes straight to, or null (open the mixed results instead). Deterministic and conservative: only an exact, unique
 * name or title match is confident enough to skip the results; two people with the same name, or a name that is also an
 * opportunity's title, stay in the results so the visitor can tell them apart. People and opportunities are only considered in the
 * scopes that look for them.
 */
export function directTarget(
  scope: "all" | "people" | "scout" | "match" | "events" | "soundstages",
  query: string,
  results: readonly RoutableResult[],
): string | null {
  const q = fold(query);
  if (q.length < 3) return null;
  const exact = (kind: ResultKind) => results.filter((r) => r.kind === kind && fold(r.title) === q);
  const people = scope === "all" || scope === "people" ? exact("person") : [];
  const opportunities = scope === "all" || scope === "scout" ? exact("opportunity") : [];
  if (people.length + opportunities.length !== 1) return null;
  if (people.length === 1) return `/profile/${people[0].id}`;
  return `/opportunity/${opportunities[0].id}`;
}

/** A query class for analytics: what was asked, never the words themselves. */
export function queryClass(query: string, results: readonly RoutableResult[]): "exact_person" | "exact_opportunity" | "generic" | "no_result" {
  if (!results.length) return "no_result";
  const q = fold(query);
  if (results.some((r) => r.kind === "person" && fold(r.title) === q)) return "exact_person";
  if (results.some((r) => r.kind === "opportunity" && fold(r.title) === q)) return "exact_opportunity";
  return "generic";
}
