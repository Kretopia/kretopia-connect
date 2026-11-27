/**
 * The landing hero's search scope. One field, one default (All), and a dropdown that narrows where the words are looked for. The
 * dropdown is not navigation: it says in which context the search runs. The query always travels with its scope, so the same
 * words can mean different things ("photographer" in People, in Scout, in Events) and the sources queried follow the scope.
 *
 *   All         every source at once                            -> Search Page
 *   People      members and creative profiles                   -> Search Page, People
 *   Scout       scouting and discovery: open opportunities      -> Search Page, Opportunities
 *   Match       professionals by craft, discipline, skill       -> Search Page, Roles & skills
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

/**
 * The topics the landing hero shows as compact labels on its search bar, in order. Only scopes whose destination exists and whose
 * words that destination reads from ?q= are offered; Events and SoundStages exist as scopes for other hosts but are not promoted here.
 */
export const HERO_TOPICS: readonly SearchScope[] = ["all", "scout", "people", "match"];

/** What the hero's field says, whatever the topic: the topic labels carry the context. */
export const HERO_TOPIC_PLACEHOLDER = "Search creatives, skills or opportunities…";

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

const enc = (query: string) => encodeURIComponent(query.trim());

/**
 * Where a search lands. A generic query goes to the Search Page (/search), which groups what the public sources answer; the topic
 * travels as `?scope=` and opens the page narrowed to it (Scout: opportunities, People, Match: roles and skills). Events and
 * SoundStages are not families of the Search Page: they open their own pages with the words in them.
 */
export function scopeSearchTarget(scope: SearchScope, query: string): string {
  const q = enc(query);
  switch (scope) {
    case "events":
      return `/meetup?q=${q}`;
    case "soundstages":
      return `/soundstages?q=${q}`;
    case "all":
      return `/search?q=${q}`;
    default:
      return `/search?q=${q}&scope=${scope}`;
  }
}

/** Which sources the dropdown asks while someone types, by scope. */
export const scopeSources = (scope: SearchScope) => ({
  people: scope === "all" || scope === "people",
  skills: scope === "all" || scope === "match",
  opportunities: scope === "all" || scope === "scout",
  events: scope === "all" || scope === "events",
  /** Public work records (project credits): only under All, where a name can be a person, an opportunity or a project. */
  work: scope === "all",
  stages: scope === "soundstages",
});
