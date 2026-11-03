import type { KretoSceneId } from "@/components/brand/kretoScenes";
import { CATEGORY_IDS, classifyOpportunity, type CategoryId } from "@/lib/opportunityTaxonomy";

/**
 * Which Kretopia illustration an opportunity wears, by the kind of role it is. One lookup, two small tables:
 *
 *  - ROLE_ART maps each family of the opportunity taxonomy (the same one Scout's filters use) to one of Kreto's scenes.
 *  - TITLE_ART names the few roles whose scene is more exact than their family's (a podcast host is "Audio & music" or "Writing", but
 *    the microphone scene is theirs), matched on the title.
 *
 * Every picture is a local asset in src/assets/brand/kreto: nothing is fetched from anywhere else, and a listing's own (third-party)
 * image is never used for the cover. Each scene is a different room, so the card's background changes with the role.
 *
 * `fit` says how true the picture is to the role, so the gaps are not hidden:
 *   exact    Kreto doing that very job (a music studio for audio and music).
 *   close    Kreto in the right kind of place, not at that exact job (a laptop with a moodboard for design and video).
 *   missing  no illustration of that role exists yet: a stand-in is shown and the role is waiting for its own art.
 *   default  the role did not match any family: the Scout scene, which is also what Scout itself wears.
 */
export type RoleArtFit = "exact" | "close" | "missing" | "default";

export interface RoleArt {
  scene: KretoSceneId;
  fit: RoleArtFit;
  /** The illustration that would make it exact, for a role that has none (`fit: "missing"`). */
  wanted?: string;
}

/** What an opportunity wears when its role matches nothing. */
export const DEFAULT_ROLE_ART: RoleArt = { scene: "scout", fit: "default" };

export const ROLE_ART: Record<CategoryId, RoleArt> = {
  "creative-direction": { scene: "campaign", fit: "close" },
  "design-brand": { scene: "studio", fit: "close" },
  "product-ux": { scene: "studio", fit: "close" },
  "video-motion": { scene: "studio", fit: "close" },
  photo: { scene: "studio", fit: "missing", wanted: "Kretopia photographer" },
  "illustration-art": { scene: "studio", fit: "close" },
  "games-3d": { scene: "workspace", fit: "missing", wanted: "Kretopia 3D artist" },
  "audio-music": { scene: "music-studio", fit: "exact" },
  "writing-content": { scene: "coworking", fit: "missing", wanted: "Kretopia writer" },
  "social-community": { scene: "social", fit: "exact" },
  marketing: { scene: "campaign", fit: "close" },
  engineering: { scene: "workspace", fit: "missing", wanted: "Kretopia developer" },
  "data-ai": { scene: "workspace", fit: "missing", wanted: "Kretopia data analyst" },
  "product-program": { scene: "office", fit: "close" },
  "sales-accounts": { scene: "investor-deck", fit: "close" },
  "ops-finance-people": { scene: "office", fit: "close" },
  other: DEFAULT_ROLE_ART,
};

/** Roles whose scene is more exact than their family's. Checked first, on the title, in this order. */
export const TITLE_ART: Array<{ match: RegExp; art: RoleArt }> = [
  { match: /\b(podcast\w*|voice[- ]?over|voiceover|radio|broadcast\w*|announcer|live audio)\b/i, art: { scene: "soundstages", fit: "exact" } },
  { match: /\b(recruit\w*|talent (acquisition|partner|sourc\w+)|casting|headhunt\w*)\b/i, art: { scene: "talent-search", fit: "exact" } },
];

export interface RoleArtInput {
  /** The taxonomy family when the listing was already classified (Scout's catalog does it). */
  category?: CategoryId | null;
  title?: string | null;
  /** Used only to classify an unclassified listing. */
  excerpt?: string | null;
}

/** The illustration for an opportunity: by title for the few exact cases, else by family, else the documented default. */
export function roleArtFor({ category, title, excerpt }: RoleArtInput): RoleArt {
  const text = (title ?? "").trim();
  for (const entry of TITLE_ART) if (text && entry.match.test(text)) return entry.art;
  const family = category && (CATEGORY_IDS as readonly string[]).includes(category) ? category : text ? classifyOpportunity({ title: text, excerpt: excerpt ?? null, location: null }).category : "other";
  return ROLE_ART[family] ?? DEFAULT_ROLE_ART;
}

/** Every family with the picture it gets and how true it is, for the report and for the test that keeps the table complete. */
export function roleArtCoverage() {
  return CATEGORY_IDS.map((id) => ({ category: id, ...ROLE_ART[id] }));
}
