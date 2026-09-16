/**
 * Passport Role Stamp — the gold metallic seal shown on a Passport that
 * replaces the old numeric "L1" level badge with something that actually
 * says what the person does. A different, purpose-built taxonomy from
 * ProfessionKey (professionProfiles.ts) on purpose: that one drives which
 * Passport *sections* render for a profession and shouldn't be perturbed
 * for existing users; this one only picks a badge and follows the exact
 * 10-craft list the stamp redesign specified.
 */

export type RoleStampCategory =
  | "software"
  | "fashion"
  | "music"
  | "photo_video"
  | "design"
  | "writing"
  | "dance"
  | "crew"
  | "model"
  | "creator";

export interface RoleStampMeta {
  category: RoleStampCategory;
  /** English label shown in the stamp's tooltip / sr-only text. */
  label: string;
}

export const ROLE_STAMP_LABEL: Record<RoleStampCategory, string> = {
  software: "Software",
  fashion: "Fashion",
  music: "Music",
  photo_video: "Photo & Video",
  design: "Design",
  writing: "Writing",
  dance: "Dance",
  crew: "Crew",
  model: "Model",
  creator: "Creator",
};

// Ordered, most-specific-first so a role that could plausibly match more
// than one bucket (e.g. "Music Producer" vs. "Event Producer") lands on
// the intended one. Same shape as professionProfiles.ts's inferProfession
// -- lowercased "role + sub_roles" haystack tested against word-boundary
// regexes -- deliberately, for anyone reading both side by side.
const MATCHERS: Array<[RoleStampCategory, RegExp]> = [
  ["dance", /\b(dance|dancer|choreograph)/],
  ["fashion", /\b(fashion|stylist|wardrobe|costume design|makeup|hair styl|textile|jewelry design|nail tech|wig maker|mas design)/],
  ["music", /\b(music|musician|singer|rapper|soca|songwrit|composer|beatmaker|dj\b|audio engineer|sound design|mixing engineer|mastering engineer|a&r|band\b)/],
  // Screenwriter's craft is writing, not filming -- checked before
  // photo_video so its "film" root doesn't steal the match.
  ["writing", /\b(screenwrit|writer|journalist|copywrit|author\b|poet|technical writ)/],
  ["photo_video", /\b(photo|videograph|cinematograph|filmmak|film director|\bdop\b|\bdp\b|video editor|colorist|camera operator|vfx)/],
  ["design", /\b(graphic design|illustrat|art director|3d artist|3d design|motion design|animator|concept artist|muralist|fine artist|tattoo artist|creative director|set design)/],
  ["model", /\bmodels?\b/],
  ["software", /\b(software|web dev|app dev|developer|programmer|full.?stack|backend|frontend|product design|ui\/?ux|ux design|ui design|data analyst)/],
  ["crew", /\b(crew|gaffer|\bgrip\b|production assistant|stage manager|assistant director|\bad\b|casting director|stunt|line producer|event producer|executive producer|talent manager|booking agent|\bpromoter\b|project manager)/],
  ["creator", /\b(creator|influencer|youtuber|tiktoker|streamer|podcast|blog|\bugc\b|brand ambassador|community manager|social media manager)/],
];

/**
 * Infers the Role Stamp category from a profile's role + sub_roles.
 * Always falls back to "creator" -- Kretopia's own universal term for
 * "someone active here", never a blank/unknown state.
 */
export function getRoleStampCategory(profile: {
  role?: string | null;
  sub_roles?: string[] | null;
}): RoleStampCategory {
  const haystack = [profile.role ?? "", ...(profile.sub_roles ?? [])]
    .join(" ")
    .toLowerCase();
  if (!haystack.trim()) return "creator";

  for (const [category, re] of MATCHERS) {
    if (re.test(haystack)) return category;
  }
  return "creator";
}
