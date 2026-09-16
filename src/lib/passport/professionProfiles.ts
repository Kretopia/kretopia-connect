/**
 * Passport profession archetypes.
 *
 * Each archetype defines which sections of the Passport are emphasized,
 * which are hidden, and which share targets are preferred. The layout is
 * inferred from `profiles.role` + `profiles.sub_roles` unless the user
 * overrides via `profiles.passport_profession`.
 *
 * No section components are duplicated — `PassportLayout` reads these
 * configs and composes existing section components in the right order.
 */

export type ProfessionKey =
  | "model"
  | "photographer"
  | "musician"
  | "filmmaker"
  | "designer"
  | "writer"
  | "creator"
  | "crew"
  | "default";

export type HeroVariant =
  | "reel"
  | "gallery"
  | "waveform"
  | "editorial"
  | "showreel"
  | "compcard"
  | "default";

export type SectionKey =
  | "about"
  | "credits"
  | "portfolio"
  | "reel"
  | "rate_card"
  | "services"
  | "availability"
  | "press"
  | "reviews"
  | "skills"
  | "social_stats"
  | "comp_card"
  | "music_splits"
  | "releases"
  | "collab_history"
  | "industry_stats"
  | "experience"
  | "awards"
  | "digital_products"
  | "work_with_me";

export type ShareTarget =
  | "epk"
  | "compcard"
  | "reel"
  | "press"
  | "rate"
  | "site"
  | "rollcall"
  | "portfolio_pdf"
  | "profile";

export interface ProfessionLayout {
  key: ProfessionKey;
  label: string;
  heroVariant: HeroVariant;
  primarySections: SectionKey[];
  secondarySections: SectionKey[];
  hiddenSections: SectionKey[];
  shareTargets: ShareTarget[];
  /** One-line pitch used in empty states and the layout picker. */
  tagline: string;
}

export const PROFESSION_LAYOUTS: Record<ProfessionKey, ProfessionLayout> = {
  model: {
    key: "model",
    label: "Model / Talent",
    heroVariant: "compcard",
    primarySections: ["comp_card", "portfolio", "credits", "experience"],
    secondarySections: ["awards", "press", "reviews", "availability", "social_stats"],
    hiddenSections: ["music_splits", "releases", "digital_products", "rate_card"],
    shareTargets: ["compcard", "epk", "profile", "site"],
    tagline: "Comp card, polaroids and bookings.",
  },
  photographer: {
    key: "photographer",
    label: "Photographer / Videographer",
    heroVariant: "gallery",
    primarySections: ["portfolio", "credits", "rate_card", "services"],
    secondarySections: ["reviews", "press", "availability", "experience", "awards"],
    hiddenSections: ["music_splits", "releases", "comp_card"],
    shareTargets: ["site", "reel", "epk", "profile"],
    tagline: "Gallery-first, gear & rate ready.",
  },
  musician: {
    key: "musician",
    label: "Musician / Producer",
    heroVariant: "waveform",
    primarySections: ["releases", "credits", "press", "social_stats"],
    secondarySections: ["music_splits", "awards", "reviews", "rate_card", "experience"],
    hiddenSections: ["comp_card", "services"],
    shareTargets: ["epk", "site", "reel", "profile"],
    tagline: "Releases, splits and a press-ready EPK.",
  },
  filmmaker: {
    key: "filmmaker",
    label: "Filmmaker / Director / Editor",
    heroVariant: "showreel",
    primarySections: ["reel", "credits", "awards", "press"],
    secondarySections: ["experience", "reviews", "rate_card", "services"],
    hiddenSections: ["comp_card", "music_splits", "releases"],
    shareTargets: ["reel", "rollcall", "epk", "profile"],
    tagline: "Showreel + IMDb-style roll call.",
  },
  designer: {
    key: "designer",
    label: "Designer / Illustrator / Art Director",
    heroVariant: "editorial",
    primarySections: ["portfolio", "credits", "services", "experience"],
    secondarySections: ["awards", "press", "reviews", "rate_card", "skills"],
    hiddenSections: ["comp_card", "music_splits", "releases"],
    shareTargets: ["site", "portfolio_pdf", "profile", "epk"],
    tagline: "Case studies and craft, presented like a portfolio.",
  },
  writer: {
    key: "writer",
    label: "Writer / Journalist / Editorial",
    heroVariant: "editorial",
    primarySections: ["press", "credits", "experience", "about"],
    secondarySections: ["awards", "rate_card", "services", "reviews"],
    hiddenSections: ["comp_card", "music_splits", "releases", "reel"],
    shareTargets: ["press", "profile", "epk", "site"],
    tagline: "Bylines, beats and clips up front.",
  },
  creator: {
    key: "creator",
    label: "Content Creator / Influencer",
    heroVariant: "reel",
    primarySections: ["social_stats", "portfolio", "credits", "rate_card"],
    secondarySections: ["reviews", "press", "services", "digital_products", "work_with_me"],
    hiddenSections: ["comp_card", "music_splits"],
    shareTargets: ["epk", "rate", "profile", "site"],
    tagline: "Platforms, audience and brand-work ready media kit.",
  },
  crew: {
    key: "crew",
    label: "Crew / Production (HMUA, Stylist, Gaffer, AD…)",
    heroVariant: "default",
    primarySections: ["credits", "rate_card", "availability", "experience"],
    secondarySections: ["portfolio", "reviews", "press", "skills", "services"],
    hiddenSections: ["comp_card", "music_splits", "releases", "digital_products"],
    shareTargets: ["rollcall", "rate", "profile", "epk"],
    tagline: "Roll-call credits, day rates and availability.",
  },
  default: {
    key: "default",
    label: "All-rounder",
    heroVariant: "default",
    primarySections: ["about", "credits", "portfolio", "experience"],
    secondarySections: ["awards", "press", "reviews", "rate_card", "services", "skills"],
    hiddenSections: [],
    shareTargets: ["profile", "epk", "site", "reel"],
    tagline: "Balanced layout — everything visible.",
  },
};

/**
 * Infer the best profession layout for a profile from its `role` and
 * `sub_roles`. Returns `default` when nothing matches. Always lowercases
 * and strips diacritics so loose user input still maps cleanly.
 */
export function inferProfession(profile: {
  role?: string | null;
  sub_roles?: string[] | null;
  passport_profession?: string | null;
}): ProfessionKey {
  if (profile.passport_profession && profile.passport_profession in PROFESSION_LAYOUTS) {
    return profile.passport_profession as ProfessionKey;
  }
  const haystack = [profile.role ?? "", ...(profile.sub_roles ?? [])]
    .join(" ")
    .toLowerCase();
  if (!haystack.trim()) return "default";

  const matchers: Array<[ProfessionKey, RegExp]> = [
    ["model", /\b(model|talent|actor|actress|dancer|presenter)\b/],
    ["photographer", /\b(photo|photographer|videographer|cinematograph|dop|dp)\b/],
    ["musician", /\b(music|musician|producer|artist|singer|rapper|dj|composer|beatmaker|songwriter|band)\b/],
    ["filmmaker", /\b(film|director|editor|filmmaker|screenwriter|vfx)\b/],
    ["designer", /\b(design|designer|illustrator|art director|graphic|3d|ux|ui|brand)\b/],
    ["writer", /\b(writer|journalist|editor|copywriter|author|poet)\b/],
    ["creator", /\b(creator|influencer|youtuber|tiktok|streamer|host|podcaster|blogger)\b/],
    ["crew", /\b(hmua|makeup|stylist|gaffer|grip|assistant director|\bad\b|sound|production|crew|wardrobe|set)\b/],
  ];

  for (const [key, re] of matchers) {
    if (re.test(haystack)) return key;
  }
  return "default";
}

export function getProfessionLayout(profile: {
  role?: string | null;
  sub_roles?: string[] | null;
  passport_profession?: string | null;
}): ProfessionLayout {
  return PROFESSION_LAYOUTS[inferProfession(profile)];
}
