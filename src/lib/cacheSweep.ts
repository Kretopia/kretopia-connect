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
  // Old HTTP caches from previous builds (keeps only the newest one).
  if ("caches" in window) {
    caches.keys().then((keys) => keys.slice(0, -1).forEach((k) => caches.delete(k))).catch(() => {});
  }
}

export function startCacheSweep() {
  sweepClientCaches();
  window.setInterval(sweepClientCaches, 30 * 60 * 1000);
}
