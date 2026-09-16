/**
 * Build-version cache busting.
 *
 * Every build embeds a unique BUILD_VERSION via Vite's define config.
 * On app load we fetch /version.json (cache-busted) from the server.
 * If the server version differs from the embedded one, we nuke every
 * SW cache + unregister the service worker and hard-reload so the user
 * always sees the latest deploy.
 *
 * IMPORTANT: Only runs in production builds. In dev mode the version.json
 * contains "dev" which would never match the build hash, causing an
 * infinite reload loop.
 */

const EMBEDDED_VERSION = __BUILD_VERSION__;

const isCapacitor = typeof (window as any)?.Capacitor !== 'undefined';

import { clearAppServiceWorkerData, isStandalonePWA } from './serviceWorker';

export async function checkForNewVersion() {
  if (!isStandalonePWA()) return;
  // In dev the embedded version is "dev" and version.json also says "dev" — no-op
  if (EMBEDDED_VERSION === 'dev') return;

  // Guard against infinite reload: only attempt once per 30s window
  // Capacitor: reduce to 15s since update detection is more critical
  const cooldown = isCapacitor ? 15_000 : 30_000;
  const key = 'version_check_ts';
  const last = sessionStorage.getItem(key);
  const now = Date.now();
  if (last && now - Number(last) < cooldown) return;
  sessionStorage.setItem(key, String(now));

  try {
    // Bypass ALL caches — service worker, disk cache, CDN
    const res = await fetch(`/version.json?_=${now}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
    });
    if (!res.ok) return;

    const { version } = await res.json();

    if (version && version !== 'dev' && version !== EMBEDDED_VERSION) {
      console.log(
        `[Version Check] Stale build detected (have: ${EMBEDDED_VERSION}, server: ${version}). Purging caches…`
      );
      await purgeAllCaches();
      // Use replace so back-button doesn't loop
      window.location.replace(window.location.href);
    }
  } catch {
    // Offline or first deploy without version.json — ignore
  }
}

// Re-check on Capacitor resume and visibility changes
if (isCapacitor) {
  document.addEventListener('resume', () => checkForNewVersion());
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    checkForNewVersion();
  }
});

async function purgeAllCaches() {
  await clearAppServiceWorkerData();
}

// TypeScript: declare the global injected by Vite define
declare const __BUILD_VERSION__: string;
