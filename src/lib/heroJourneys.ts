/**
 * The example searches that rotate under the landing hero's search field. Pure data, tested without mounting the hero.
 * (The hero's journeys and secondary actions that once sat under the field were removed: the search scope now says where to look,
 * see heroSearchScope.ts.)
 */

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
