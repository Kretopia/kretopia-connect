/**
 * The landing hero's search scope. One field, one default (All), and a dropdown that narrows where the words are looked for. The
 * dropdown is not navigation: it says in which context the search runs. The query always travels with its scope, so the same
 * words can mean different things ("photographer" in People, in Scout, in Events) and the sources queried follow the scope.
 *
 *   All         every source at once; Enter opens the area that has an answer
 *   People      members and creative profiles                  -> Match's Grid (where people are searched)
 *   Scout       scouting and discovery: open opportunities      -> Scout
 *   Match       professionals by craft, discipline, skill       -> Match's Grid, with the vocabulary ("Explore by") as suggestions
 *   Events      what is on                                      -> Meetup (events)
 *   SoundStages live creative rooms                             -> SoundStages
 *
 * Pure vocabulary and routing: it reads no user data, so a guest gets all of it. Every destination is an existing route that
 * reads the words from `?q=`.
 */

export type SearchScope = "all" | "people" | "scout" | "match" | "events" | "soundstages";

export interface SearchScopeMeta {
  id: SearchScope;
  label: string;
  /** One line in the dropdown, under the label. */
  description: string;
  /** What the field says once this scope is chosen. */
  placeholder: string;
  /** The same on a phone, where the field is narrow. */
  placeholderCompact: string;
}

export const DEFAULT_SEARCH_SCOPE: SearchScope = "all";

export const SEARCH_SCOPES: readonly SearchScopeMeta[] = [
  { id: "all", label: "All", description: "Everything on Kretopia", placeholder: "Search people, skills, opportunities and events", placeholderCompact: "Search Kretopia" },
  { id: "people", label: "People", description: "Members and creative profiles", placeholder: "Search people, members and creative profiles", placeholderCompact: "Search people" },
  { id: "scout", label: "Scout", description: "Scouting and discovery", placeholder: "Search opportunities to scout and discover", placeholderCompact: "Search opportunities" },
  { id: "match", label: "Match", description: "Relevant matches and connections", placeholder: "Search a craft, skill or discipline to match with", placeholderCompact: "Search a craft or skill" },
  { id: "events", label: "Events", description: "Events and related activities", placeholder: "Search events by title, venue or topic", placeholderCompact: "Search events" },
  { id: "soundstages", label: "SoundStages", description: "Live creative rooms", placeholder: "Search SoundStages and live sessions", placeholderCompact: "Search SoundStages" },
];

/** The short line under the field. */
export const HERO_SEARCH_GUIDANCE = "Search all of Kretopia, or narrow it to one area.";

export const searchScopeMeta = (scope: SearchScope): SearchScopeMeta =>
  SEARCH_SCOPES.find((s) => s.id === scope) ?? SEARCH_SCOPES[0];

export const isSearchScope = (value: unknown): value is SearchScope => SEARCH_SCOPES.some((s) => s.id === value);

export const scopePlaceholder = (scope: SearchScope, narrow: boolean): string => {
  const meta = searchScopeMeta(scope);
  return narrow ? meta.placeholderCompact : meta.placeholder;
};

/** What a search is: the words and where they are looked for. */
export interface ScopedQuery {
  query: string;
  scope: SearchScope;
}

const MATCH_GRID = "/match?tab=browse&view=grid";

/** What the dropdown found, when Enter has to choose among areas (All). */
export interface ScopeFound {
  people: number;
  skills: number;
  opportunities: number;
  events: number;
}

const enc = (query: string) => encodeURIComponent(query.trim());

/**
 * Where a search lands. A chosen scope always goes to its own area; All goes to the first area that has an answer (people and
 * skills share the Grid, then Scout, then Events) and, with no answer anywhere, to the Grid, which searches in full.
 */
export function scopeSearchTarget(scope: SearchScope, query: string, found?: ScopeFound): string {
  const q = enc(query);
  switch (scope) {
    case "people":
    case "match":
      return `${MATCH_GRID}&q=${q}`;
    case "scout":
      return `/scout?q=${q}`;
    case "events":
      return `/meetup?q=${q}`;
    case "soundstages":
      return `/soundstages?q=${q}`;
    case "all":
    default: {
      if (found && found.people === 0 && found.skills === 0) {
        if (found.opportunities > 0) return `/scout?q=${q}`;
        if (found.events > 0) return `/meetup?q=${q}`;
      }
      return `${MATCH_GRID}&q=${q}`;
    }
  }
}

/** Which sources the dropdown asks while someone types, by scope. */
export const scopeSources = (scope: SearchScope) => ({
  people: scope === "all" || scope === "people",
  skills: scope === "all" || scope === "match",
  opportunities: scope === "all" || scope === "scout",
  events: scope === "all" || scope === "events",
  stages: scope === "soundstages",
});
