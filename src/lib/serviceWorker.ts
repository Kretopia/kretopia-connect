type IOSNavigator = Navigator & { standalone?: boolean };

export function isStandalonePWA() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as IOSNavigator).standalone === true;
}

export async function getAppServiceWorkerRegistration() {
  if (!("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.getRegistration();
}

export async function ensureAppServiceWorkerRegistered() {
  if (!("serviceWorker" in navigator)) return null;

  const existingRegistration = await navigator.serviceWorker.getRegistration();
  if (existingRegistration) return existingRegistration;

  return navigator.serviceWorker.register("/sw.js");
}

export async function clearAppServiceWorkerData() {
  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }

  if ("caches" in window) {
    const cacheKeys = await caches.keys();
    await Promise.all(cacheKeys.map((cacheKey) => caches.delete(cacheKey)));
  }
}