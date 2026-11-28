import type { PublicSearchSources } from "@/lib/publicSearch";

/**
 * The Search Page's families: what the filter row offers and what each one asks of the public sources. The hero's topics map in
 * through `?scope=` (Scout is Opportunities, Match is Roles & skills); Work has no topic of its own and is only reached here.
 * Organisations and services are not offered: no public source for them is verified yet (spec 29).
 */
export type SearchFamily = "all" | "opportunities" | "people" | "roles" | "work" | "events";

export interface SearchFamilyMeta {
  id: SearchFamily;
  label: string;
  /** The `?scope=` value that selects it (the hero's topic names where one exists). */
  param: string;
}

export const SEARCH_FAMILIES: readonly SearchFamilyMeta[] = [
  { id: "all", label: "All", param: "all" },
  { id: "opportunities", label: "Opportunities", param: "scout" },
  { id: "people", label: "People", param: "people" },
  { id: "roles", label: "Roles & skills", param: "match" },
  { id: "work", label: "Work", param: "work" },
  { id: "events", label: "Events", param: "events" },
];

/** The family a `?scope=` value selects; anything unknown is All. */
export const familyFromScope = (scope: string | null | undefined): SearchFamily =>
  SEARCH_FAMILIES.find((f) => f.param === scope)?.id ?? "all";

export const scopeParamFor = (family: SearchFamily): string => SEARCH_FAMILIES.find((f) => f.id === family)?.param ?? "all";

/** The public reads a family asks for, and whether the roles-and-skills vocabulary answers too. */
export function familySources(family: SearchFamily): PublicSearchSources & { roles: boolean } {
  return {
    people: family === "all" || family === "people",
    opportunities: family === "all" || family === "opportunities",
    work: family === "all" || family === "work",
    events: family === "all" || family === "events",
    roles: family === "all" || family === "roles",
  };
}

/** The Search Page's own address. */
export const searchPageHref = (query: string, family: SearchFamily = "all"): string => {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  if (family !== "all") params.set("scope", scopeParamFor(family));
  const qs = params.toString();
  return qs ? `/search?${qs}` : "/search";
};

/**
 * "Try a broader role or skill": the same words without the last one ("Editorial Motion Designer Penang" -> "Editorial Motion
 * Designer"), only when that still leaves something to search. Null for a single word.
 */
export function broaderQuery(query: string): string | null {
  const words = query.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return null;
  const broader = words.slice(0, -1).join(" ");
  return broader.length >= 2 ? broader : null;
}

/** How many rows came back across the families, for the summary line. */
export const countResults = (groups: object): number => Object.values(groups).reduce((n: number, g) => n + (Array.isArray(g) ? g.length : 0), 0);
