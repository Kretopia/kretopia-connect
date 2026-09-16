/**
 * The canonical public URL for all shareable links.
 * Use this instead of window.location.origin when generating
 * links that will be shared externally (copy-to-clipboard, emails, etc).
 */
export const APP_URL = "https://www.kretopia.com";

/**
 * Returns a canonical kretopia.com URL for the given path or absolute URL.
 * - Strips preview/staging hosts (lovable.app, lovableproject.com).
 * - Preserves search and hash.
 * - Use this for ANY link that will be shared OUTSIDE the platform
 *   (native share, copy-to-clipboard, email, OG meta tags).
 */
export const getShareUrl = (pathOrUrl?: string): string => {
  try {
    if (!pathOrUrl) {
      if (typeof window === "undefined") return APP_URL;
      const { pathname, search, hash } = window.location;
      return `${APP_URL}${pathname}${search}${hash}`;
    }
    // Absolute URL provided
    if (/^https?:\/\//i.test(pathOrUrl)) {
      const u = new URL(pathOrUrl);
      return `${APP_URL}${u.pathname}${u.search}${u.hash}`;
    }
    // Relative path
    const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
    return `${APP_URL}${path}`;
  } catch {
    return APP_URL;
  }
};
