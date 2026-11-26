/**
 * What the hero search finds. One field, no mode to pick: as someone types, the answers come back in three sections, each saying
 * which feature it belongs to, and Enter goes to the section that has something. Nothing here reads user data: it is public
 * vocabulary and routing, so a guest gets all of it.
 *
 *   People        -> Passport   a name, or creative profiles
 *   Skills        -> Match      professionals by discipline, skill or expertise (the Grid, with the words in its search bar)
 *   Opportunities -> Scout      jobs, projects and collaborations
 */

export type SearchIntent = "people" | "skills" | "opportunities";

export interface SearchIntentMeta {
  id: SearchIntent;
  /** The section's title in the results. */
  label: string;
  /** The feature the section belongs to. */
  destination: "Passport" | "Match" | "Scout";
  /** What the section's rows are, in a few words under the title. */
  caption: string;
}

export const SEARCH_INTENTS: readonly SearchIntentMeta[] = [
  { id: "people", label: "People", destination: "Passport", caption: "Passports on Kretopia" },
  { id: "skills", label: "Skills", destination: "Match", caption: "Professionals in Match" },
  { id: "opportunities", label: "Opportunities", destination: "Scout", caption: "Open now in Scout" },
];

export const searchIntentMeta = (intent: SearchIntent): SearchIntentMeta =>
  SEARCH_INTENTS.find((i) => i.id === intent) ?? SEARCH_INTENTS[0];

/** What the field says before anything is typed. */
export const HERO_SEARCH_PLACEHOLDER = "Search a name, a skill or an opportunity";

/** Match's Grid: where people are searched. The words travel as ?q= and arrive typed into the Grid's own search bar. */
const MATCH_GRID = "/match?tab=browse&view=grid";

/**
 * Where a search lands. People and Skills open Match's Grid with the words already in its search bar; Opportunities opens Scout.
 * The term travels as ?q=, which both read.
 */
export function searchIntentTarget(intent: SearchIntent, query: string): string {
  const q = encodeURIComponent(query.trim());
  if (intent === "opportunities") return `/scout?q=${q}`;
  return `${MATCH_GRID}&q=${q}`;
}

/**
 * Where Enter goes when nothing was picked. People and Skills share the Grid, so a name, a craft or a skill all land there; only a
 * search whose single answer is an open opportunity goes to Scout. With no answer at all it is still the Grid, which searches in full.
 */
export function searchEnterTarget(query: string, found: { people: number; skills: number; opportunities: number }): string {
  const scoutOnly = found.opportunities > 0 && found.people === 0 && found.skills === 0;
  return searchIntentTarget(scoutOnly ? "opportunities" : "people", query);
}

// ── Skills → "Explore by" ────────────────────────────────────────────────────────────────────────────────────────────────

export type ExploreByCategoryId = "disciplines" | "crew" | "skills" | "studios" | "music";

export interface ExploreByItem {
  label: string;
  /**
   * What is searched in Match. Profiles say "Photographer", not "Photography", so the term is a stem that finds both; it is what
   * the person sees in the directory's search field after choosing the item.
   */
  term: string;
  description: string;
}

export interface ExploreByCategory {
  id: ExploreByCategoryId;
  label: string;
  description: string;
  items: readonly ExploreByItem[];
}

const item = (label: string, term: string, description: string): ExploreByItem => ({ label, term, description });

export const EXPLORE_BY: readonly ExploreByCategory[] = [
  {
    id: "disciplines",
    label: "Creative Disciplines",
    description: "The crafts people practise",
    items: [
      item("Motion Design", "Motion", "Animated graphics, titles and identities"),
      item("Graphic Design", "Graphic", "Visual identity, layout and print"),
      item("Photography", "Photograph", "Editorial, fashion, commercial, documentary"),
      item("Filmmaking", "Film", "Directing and making films"),
      item("Animation", "Animat", "2D and 3D motion for film, ads and games"),
      item("Illustration", "Illustrat", "Drawn and digital artwork"),
      item("Fashion & Styling", "Fashion", "Design, styling and wardrobe"),
      item("Writing", "Writer", "Copy, scripts, journalism, fiction"),
      item("UX & Web Design", "UX", "Product experiences for apps and web"),
      item("Acting & Performance", "Actor", "Screen, stage and voice"),
      item("Dance & Choreography", "Danc", "Movement for stage, video and events"),
      item("Painting & Fine Art", "Paint", "Original works and commissions"),
    ],
  },
  {
    id: "crew",
    label: "Production & Crew",
    description: "The people who make a shoot happen",
    items: [
      item("Directors", "Director", "Lead film, commercial and music video sets"),
      item("Producers", "Producer", "Budget, team and delivery"),
      item("Cinematographers", "Cinematograph", "Directors of photography"),
      item("Editors", "Editor", "Cut footage into a story"),
      item("Colorists", "Colorist", "Grade footage for mood and consistency"),
      item("Gaffers & Lighting", "Gaffer", "Lighting on set"),
      item("Production Designers", "Production Design", "Build the visual world of a set"),
      item("Set & Costume", "Costume", "Sets, props and wardrobe"),
      item("Casting Directors", "Casting", "Find and book the right talent"),
      item("Hair & Makeup", "Makeup", "Beauty, editorial and SFX"),
      item("VFX Artists", "VFX", "Visual effects and compositing"),
    ],
  },
  {
    id: "skills",
    label: "Skills & Expertise",
    description: "Tools and techniques",
    items: [
      item("After Effects", "After Effects", "Motion graphics and compositing"),
      item("Premiere & Final Cut", "Premiere", "Professional video editing"),
      item("DaVinci Resolve", "DaVinci", "Editing, colour and audio finishing"),
      item("Color Grading", "Color", "Look and finish"),
      item("3D Modeling", "3D", "Blender, Cinema 4D, Maya"),
      item("Unreal Engine", "Unreal", "Real-time 3D and virtual production"),
      item("Figma & Product Design", "Figma", "Interface and product design"),
      item("Storyboarding", "Storyboard", "Visual planning before the shoot"),
      item("Scriptwriting", "Script", "Story structure and dialogue"),
      item("Retouching", "Retouch", "High-end photo cleanup"),
      item("Drone Piloting", "Drone", "Aerial photo and video"),
      item("Social Media Strategy", "Social", "Plans content that performs"),
    ],
  },
  {
    id: "studios",
    label: "Studios & Companies",
    description: "Teams, houses and labels",
    items: [
      item("Production Companies", "Production Company", "Film, TV and commercial production"),
      item("Creative Agencies", "Agency", "Brand, campaign and content agencies"),
      item("Recording Studios", "Recording Studio", "Studios to record, mix and master"),
      item("Post-production Houses", "Post", "Edit, colour, sound and VFX"),
      item("Photo & Video Studios", "Studio", "Studios for shoots and hire"),
      item("Record Labels", "Label", "Labels and music companies"),
      item("Fashion Houses", "Fashion House", "Design houses and labels"),
      item("Event Companies", "Event", "Live experiences and activations"),
      item("Collectives", "Collective", "Creative collectives and crews"),
    ],
  },
  {
    id: "music",
    label: "Music & Sound",
    description: "Artists, producers and engineers",
    items: [
      item("Music Producers", "Producer", "Shape songs from idea to master"),
      item("Beatmakers", "Beat", "Instrumentals and rhythm tracks"),
      item("Composers", "Composer", "Original scores for film, games and media"),
      item("Songwriters", "Songwriter", "Lyrics and melodies for artists"),
      item("Singers & Vocalists", "Sing", "Lead and session vocals"),
      item("Rappers", "Rapper", "Write and perform rap"),
      item("Musicians", "Musician", "Session and live instruments"),
      item("DJs", "DJ", "Live sets for clubs, festivals and brands"),
      item("Mixing & Mastering", "Mixing", "Balance and polish recorded tracks"),
      item("Sound Designers", "Sound Design", "Effects and soundscapes for media"),
      item("Podcasters", "Podcast", "Host and produce audio shows"),
    ],
  },
];

export const exploreByCategory = (id: ExploreByCategoryId | null | undefined): ExploreByCategory | undefined =>
  EXPLORE_BY.find((c) => c.id === id);

/** Where choosing an "Explore by" item lands: the matching professionals in Match. */
export const exploreByTarget = (entry: ExploreByItem): string => searchIntentTarget("skills", entry.term);

const fold = (value: string) => value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export interface ExploreByMatch {
  category: ExploreByCategory;
  item: ExploreByItem;
}

/** Items matching what was typed, across every category: prefix of the label or a word first, then anywhere in label or description. */
export function searchExploreBy(query: string, limit = 8): ExploreByMatch[] {
  const q = fold(query.trim());
  if (!q) return [];
  const scored: Array<ExploreByMatch & { score: number }> = [];
  for (const category of EXPLORE_BY) {
    for (const entry of category.items) {
      const label = fold(entry.label);
      let score = 0;
      if (label.startsWith(q)) score = 3;
      else if (label.split(/[\s&-]+/).some((word) => word.startsWith(q))) score = 2;
      else if (q.length >= 2 && (label.includes(q) || fold(entry.term).includes(q) || fold(entry.description).includes(q))) score = 1;
      if (score) scored.push({ category, item: entry, score });
    }
  }
  scored.sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label));
  return scored.slice(0, limit).map(({ category, item: entry }) => ({ category, item: entry }));
}
