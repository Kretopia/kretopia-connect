// Hosts the app may fetch on a caller's behalf (link previews, portfolio and
// profile imports). Any other destination is not fetched server-side.
const ALLOWED_HOSTS = [
  "youtube.com", "youtu.be", "vimeo.com", "spotify.com", "soundcloud.com", "apple.com",
  "behance.net", "dribbble.com", "artstation.com", "instagram.com", "tiktok.com",
  "twitter.com", "x.com", "facebook.com", "linkedin.com", "imdb.com", "discogs.com",
  "allmusic.com", "bandcamp.com", "deezer.com", "tidal.com", "mixcloud.com",
  "wikipedia.org", "github.com", "medium.com", "substack.com", "notion.site",
  "linktr.ee", "pinterest.com", "flickr.com", "500px.com", "twitch.tv",
  "forbes.com", "variety.com", "hollywoodreporter.com", "billboard.com",
  "rollingstone.com", "kretopia.com",
];

export function isAllowedFetchUrl(raw: string | URL): boolean {
  try {
    const u = typeof raw === "string" ? new URL(raw) : raw;
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    if (u.username || u.password || (u.port && u.port !== "443" && u.port !== "80")) return false;
    const h = u.hostname.toLowerCase().replace(/\.$/, "");
    return ALLOWED_HOSTS.some((d) => h === d || h.endsWith(`.${d}`));
  } catch {
    return false;
  }
}
