/**
 * The host of an event as the page knows them, and the public channels they chose to share. Only http(s) links come out of here: never a
 * phone number, never an email address.
 */

export interface EventHost {
  full_name?: string | null;
  avatar_url?: string | null;
  username?: string | null;
  user_id?: string | null;
  id_verified?: boolean | null;
  hostedCount?: number;
  avg_response_hours?: number | null;
  website_url?: string | null;
  instagram_url?: string | null;
  twitter_url?: string | null;
  linkedin_url?: string | null;
  tiktok_url?: string | null;
  behance_url?: string | null;
  imdb_url?: string | null;
  soundcloud_url?: string | null;
  spotify_url?: string | null;
  youtube_url?: string | null;
  calendly_url?: string | null;
}

const CONTACT_FIELDS = [
  ["Website", "website_url", "website"],
  ["Instagram", "instagram_url", "instagram"],
  ["X", "twitter_url", "x"],
  ["LinkedIn", "linkedin_url", "linkedin"],
  ["TikTok", "tiktok_url", "tiktok"],
  ["Behance", "behance_url", "behance"],
  ["IMDb", "imdb_url", "imdb"],
  ["SoundCloud", "soundcloud_url", "soundcloud"],
  ["Spotify", "spotify_url", "spotify"],
  ["YouTube", "youtube_url", "youtube"],
  ["Calendly", "calendly_url", "calendly"],
] as const;

const PLATFORM_DOMAINS: Record<(typeof CONTACT_FIELDS)[number][2], string> = {
  website: "",
  instagram: "instagram.com",
  x: "x.com",
  linkedin: "linkedin.com",
  tiktok: "tiktok.com",
  behance: "behance.net",
  imdb: "imdb.com",
  soundcloud: "soundcloud.com",
  spotify: "open.spotify.com",
  youtube: "youtube.com",
  calendly: "calendly.com",
};

function getPublicUrl(value: string | null | undefined, platform: (typeof CONTACT_FIELDS)[number][2]): string | null {
  const raw = value?.trim();
  if (!raw) return null;

  // "@maya" and "maya" are handles on the platform, not hosts: only something with a scheme, or a dot, is read as an address.
  const hasScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(raw);
  const looksLikeHandle = !hasScheme && platform !== "website" && (raw.startsWith("@") || !raw.includes("."));
  if (!looksLikeHandle) {
    const withScheme = hasScheme ? raw : `https://${raw}`;
    try {
      const url = new URL(withScheme);
      if ((url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password) return url.toString();
    } catch {
      if (platform === "website" || /\s/.test(raw)) return null;
    }
  }

  const domain = PLATFORM_DOMAINS[platform];
  const handle = raw.replace(/^@/, "").replace(/^\/+|\/+$/g, "");
  return domain && /^[\w.-]+$/.test(handle) ? `https://${domain}/${encodeURIComponent(handle)}` : null;
}

/** The host's public channels, as links: only what the host has shared, and only http(s). Never a phone number or an email. */
export function hostContactLinks(host: EventHost | null): { label: string; url: string }[] {
  return CONTACT_FIELDS.flatMap(([label, field, platform]) => {
    const url = getPublicUrl(host?.[field], platform);
    return url ? [{ label, url }] : [];
  });
}
