/**
 * Selective cache sweep: on app start (and every 30 min) drop expired or
 * unused client caches. Never touches auth sessions, theme or user settings.
 */
const MAX_AGE = 24 * 60 * 60 * 1000;
const PREFIXES = ["thrivein_feed_", "kretopia_cache_", "cache:"];

export function sweepClientCaches() {
  try {
    const now = Date.now();
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (!key || !PREFIXES.some((p) => key.startsWith(p))) continue;
      try {
        const ts = JSON.parse(localStorage.getItem(key) || "{}")?.timestamp;
        if (typeof ts !== "number" || now - ts > MAX_AGE) localStorage.removeItem(key);
      } catch {
        localStorage.removeItem(key);
      }
    }
  } catch {
    /* storage unavailable */
  }
  // HTTP caches have different roles, not chronological versions. Workbox
  // owns their expiration and build cleanup; deleting all but one here forced
  // images, fonts and installed-app chunks to download again on every visit.
}

export function startCacheSweep() {
  // Storage parsing is housekeeping, never work for the first paint.
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(sweepClientCaches, { timeout: 5000 });
  } else {
    window.setTimeout(sweepClientCaches, 1500);
  }
  window.setInterval(sweepClientCaches, 30 * 60 * 1000);
}
