/**
 * Extract thumbnail URLs from known platform URLs (YouTube, Vimeo, Spotify, etc.)
 * These are deterministic URL patterns — no API calls needed.
 */

export function extractThumbnailFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  try {
    // YouTube
    const ytMatch = url.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    );
    if (ytMatch) {
      return `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`;
    }

    // Vimeo
    // Vimeo thumbnails require API, but we can use the oEmbed endpoint via a proxy
    // For now, skip Vimeo — it needs an API call

    // Spotify — oEmbed returns JSON, not usable as direct img src
    // Thumbnails for Spotify need to be fetched server-side and stored

    // SoundCloud — no deterministic thumbnail

    // SoundCloud — no deterministic thumbnail

    // Direct image URLs
    if (/\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(url)) {
      return url;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Given a credit's available URLs, try to resolve the best thumbnail.
 */
/**
 * Given a URL (e.g. YouTube, direct image), pre-extract a thumbnail
 * to store at credit creation time.
 */
export function extractThumbnailForStorage(
  url: string | null | undefined,
  primaryMediaUrl?: string | null
): string | null {
  const fromUrl = extractThumbnailFromUrl(url);
  if (fromUrl) return fromUrl;
  const fromMedia = extractThumbnailFromUrl(primaryMediaUrl);
  if (fromMedia) return fromMedia;
  return null;
}

export function resolveCreditThumbnail(
  thumbnailUrl: string | null | undefined,
  primaryMediaUrl: string | null | undefined,
  externalUrl?: string | null
): string | null {
  // Already has a thumbnail
  if (thumbnailUrl && !thumbnailUrl.endsWith('.wav') && !thumbnailUrl.endsWith('.mp3') && !thumbnailUrl.endsWith('.ogg')) {
    return thumbnailUrl;
  }

  // Try extracting from media URL
  const fromMedia = extractThumbnailFromUrl(primaryMediaUrl);
  if (fromMedia) return fromMedia;

  // Try extracting from external URL
  const fromExternal = extractThumbnailFromUrl(externalUrl);
  if (fromExternal) return fromExternal;

  return null;
}
