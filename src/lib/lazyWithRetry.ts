import { lazy, ComponentType } from "react";

const RELOAD_KEY = "__lovable_chunk_reloaded__";
const IMPORT_TIMEOUT_MS = 12_000;

function bounded<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Dynamic module request timed out")), ms);
    work.then(
      value => { clearTimeout(timer); resolve(value); },
      error => { clearTimeout(timer); reject(error); },
    );
  });
}

async function clearStaleChunks() {
  // Cleanup failure or a stalled browser storage API must not prevent reload.
  const jobs: Promise<unknown>[] = [];
  if ("serviceWorker" in navigator) {
    jobs.push(navigator.serviceWorker.getRegistrations().then(registrations =>
      Promise.all(registrations.map(registration => registration.unregister()))));
  }
  if ("caches" in window) {
    jobs.push(caches.keys().then(keys => Promise.all(
      keys.filter(key => key.startsWith("workbox-")).map(key => caches.delete(key)),
    )));
  }
  await bounded(Promise.allSettled(jobs), 1000).catch(() => undefined);
}

/** Finite recovery, shared by all lazy routes. Never leave Suspense unresolved. */
export async function loadLazyModule<T>(factory: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await bounded(Promise.resolve().then(factory), IMPORT_TIMEOUT_MS);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const chunkFailure = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Dynamic module request timed out|Unable to preload CSS/i.test(message);
      if (!chunkFailure) throw error;
      if (attempt < 2) {
        await new Promise(resolve => setTimeout(resolve, 400 * (attempt + 1)));
        continue;
      }
      let shouldReload = false;
      if (typeof window !== "undefined") {
        try {
          shouldReload = !sessionStorage.getItem(RELOAD_KEY);
          if (shouldReload) sessionStorage.setItem(RELOAD_KEY, "1");
        } catch {
          // Storage denied: show the existing retry surface, don't reload-loop.
        }
      }
      if (shouldReload) {
        await clearStaleChunks();
        window.location.reload();
      }
      // A blocked/ineffective reload still reaches the existing error boundary.
      throw error;
    }
  }
  throw new Error("Unable to load page module");
}

export function lazyWithRetry<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>) {
  return lazy(() => loadLazyModule(factory));
}
