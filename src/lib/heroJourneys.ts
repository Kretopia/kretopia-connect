/**
 * What the landing hero offers besides the search field: the three journeys, the secondary calls to action, and the example
 * searches that rotate under the field. Pure data, so the routes are checked in one place and tested without mounting the hero.
 * Every destination is an existing route: nothing here creates one.
 */
import { SCOUT_PATH } from "@/lib/opportunityRoutes";

export type JourneyId = "people" | "skills" | "opportunities";

export interface HeroJourney {
  id: JourneyId;
  label: string;
  /** The feature the journey opens, shown small next to the label. */
  feature: "Passport" | "Match" | "Scout";
  to: string;
  analyticsId: string;
}

/**
 * People opens Match's Grid, where people are searched (the old Passport directory lives there now); Skills opens Match on its deck,
 * people matched to what you do; Opportunities opens Scout.
 */
export const HERO_JOURNEYS: readonly HeroJourney[] = [
  { id: "people", label: "People", feature: "Passport", to: "/match?tab=browse&view=grid", analyticsId: "hero_journey_people" },
  { id: "skills", label: "Skills", feature: "Match", to: "/match", analyticsId: "hero_journey_skills" },
  { id: "opportunities", label: "Opportunities", feature: "Scout", to: SCOUT_PATH, analyticsId: "hero_journey_opportunities" },
];

export interface HeroSecondaryCta {
  label: string;
  to: string;
  analyticsId: string;
}

/** The same destinations as the navbar's "Discover", "For Creatives" and "For Companies". */
export const HERO_SECONDARY_CTAS: readonly HeroSecondaryCta[] = [
  { label: "Explore Kretopia", to: "/discover", analyticsId: "hero_explore_kretopia" },
  { label: "For Creatives", to: "/passport", analyticsId: "hero_for_creatives" },
  { label: "For Companies", to: "/post-opportunity", analyticsId: "hero_for_companies" },
];

export interface HeroPrompt {
  /** What is shown. */
  label: string;
  /** What is typed into the search when it is picked: the words, not the sentence. */
  query: string;
}

export const HERO_PROMPTS: readonly HeroPrompt[] = [
  { label: "Find a film editor", query: "film editor" },
  { label: "Find a tattoo artist", query: "tattoo artist" },
  { label: "Find a music producer", query: "music producer" },
  { label: "Find a creative team", query: "creative team" },
  { label: "Find opportunities for photographers", query: "photographer" },
  { label: "Find people behind a project", query: "project" },
];

/** How long each example stays, in milliseconds. */
export const HERO_PROMPT_INTERVAL_MS = 3800;

export const nextPromptIndex = (current: number, length: number): number => (length <= 0 ? 0 : (current + 1) % length);
