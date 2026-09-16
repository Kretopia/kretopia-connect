import { lazy, ComponentType } from "react";

/**
 * Wraps React.lazy() with automatic retry + hard reload fallback for
 * "Failed to fetch dynamically imported module" errors that happen
 * when a user has a stale chunk after a deploy.
 *
 * Strategy:
 *   1. Try the import.
 *   2. On failure, wait 400ms and retry (up to 2 times).
 *   3. If all retries fail AND we haven't already reloaded this session,
 *      force a hard reload to fetch the latest chunk manifest.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    const RELOAD_KEY = "__lovable_chunk_reloaded__";
    const failedOnce = typeof window !== "undefined" && sessionStorage.getItem(RELOAD_KEY);

    const tryImport = async (attempt: number): Promise<{ default: T }> => {
      try {
        return await factory();
      } catch (err: any) {
        const msg = String(err?.message || err);
        const isChunkError =
          msg.includes("Failed to fetch dynamically imported module") ||
          msg.includes("Importing a module script failed") ||
          msg.includes("error loading dynamically imported module");

        if (!isChunkError) throw err;

        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
          return tryImport(attempt + 1);
        }

        // Last resort — hard reload once per session to pick up new chunks
        if (typeof window !== "undefined" && !failedOnce) {
          sessionStorage.setItem(RELOAD_KEY, "1");
          if ("serviceWorker" in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations().catch(() => []);
            await Promise.all(registrations.map((registration) => registration.unregister())).catch(() => undefined);
          }
          if ("caches" in window) {
            const cacheKeys = await caches.keys().catch(() => []);
            await Promise.all(cacheKeys.map((cacheKey) => caches.delete(cacheKey))).catch(() => undefined);
          }
          window.location.reload();
          // Return a never-resolving promise so React keeps Suspense fallback
          return new Promise(() => {}) as any;
        }

        throw err;
      }
    };

    return tryImport(0);
  });
}
