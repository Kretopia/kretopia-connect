/**
 * Service Worker update detection & forced reload.
 * 
 * Listens for VitePWA's "controlling" event — when a new SW takes over,
 * it reloads the page so users always get the latest code.
 * Also periodically checks for updates every 5 minutes.
 * 
 * Capacitor-aware: checks more aggressively inside native shells
 * where visibilitychange doesn't always fire reliably.
 */

import { getAppServiceWorkerRegistration, isStandalonePWA } from './serviceWorker';

const isCapacitor = typeof (window as any)?.Capacitor !== 'undefined';

export function initSWUpdateListener() {
  if (!isStandalonePWA()) return;
  if (!('serviceWorker' in navigator)) return;

  // When a new SW takes control, reload to get fresh assets
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    console.log('[SW Update] New service worker active — reloading for latest version');
    window.location.reload();
  });

  // Force-skip waiting on any new SW immediately
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'SW_UPDATED') {
      window.location.reload();
    }
  });

  // Check for updates IMMEDIATELY on load
  checkForUpdate();

  // Capacitor: check every 60s (WebView doesn't reliably fire visibilitychange)
  // Browser: check every 2 min
  const intervalMs = isCapacitor ? 60 * 1000 : 2 * 60 * 1000;
  setInterval(checkForUpdate, intervalMs);

  // Also check on page visibility change (user returns to tab/app)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkForUpdate();
    }
  });

  // Capacitor: also check on resume (more reliable than visibilitychange in native)
  if (isCapacitor) {
    document.addEventListener('resume', () => {
      console.log('[SW Update] Capacitor resume — checking for updates');
      checkForUpdate();
    });
  }
}

async function checkForUpdate() {
  try {
    const reg = await getAppServiceWorkerRegistration();
    if (reg) {
      await reg.update();
      // If there's a waiting SW, force it to activate
      if (reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
      // Listen for future waiting SWs
      reg.addEventListener('updatefound', () => {
        const newSW = reg.installing;
        if (newSW) {
          newSW.addEventListener('statechange', () => {
            if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
              // New SW installed while old one still controls — force skip
              newSW.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        }
      });
    }
  } catch (e) {
    // Silently ignore — network may be offline
  }
}
