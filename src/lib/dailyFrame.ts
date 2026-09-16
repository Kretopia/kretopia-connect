// Daily.co only allows ONE DailyIframe instance globally. React StrictMode,
// HMR, and route transitions can leave a stale instance behind that then
// throws "Duplicate DailyIframe instances are not allowed".
//
// PERF: `@daily-co/daily-js` is a ~400KB dependency. It is loaded lazily via
// dynamic import so it never lands in the main/landing bundle — the module is
// only fetched the first time a user explicitly starts or joins a call.
import type { DailyCall } from "@daily-co/daily-js";

type DailyModule = typeof import("@daily-co/daily-js")["default"];

let dailyPromise: Promise<DailyModule> | null = null;

/** Loads (and caches) the Daily SDK. Safe to call repeatedly. */
export function loadDaily(): Promise<DailyModule> {
  if (!dailyPromise) {
    dailyPromise = import("@daily-co/daily-js")
      .then((m) => (m.default ?? m) as DailyModule)
      .catch((err) => {
        // Allow a retry on the next attempt instead of caching the failure.
        dailyPromise = null;
        throw err;
      });
  }
  return dailyPromise;
}

/**
 * Warms the SDK cache without initializing any media. Call this on intent
 * (e.g. hover/focus of a "Start call" CTA) so the join feels instant.
 * Never requests camera or microphone permission.
 */
export function prefetchDaily(): void {
  void loadDaily().catch(() => {});
}

function getStaleInstance(DailyIframe: any): any {
  try {
    return (
      DailyIframe?.getCallInstance?.() ??
      DailyIframe?.instances?.()?.[0] ??
      null
    );
  } catch {
    return null;
  }
}

/** Async variant — awaits Daily's destroy promise so the singleton slot is
 *  actually free before the next createCallObject/createFrame call. */
export async function destroyExistingDailyFrameAsync(): Promise<void> {
  // If the SDK was never loaded there is nothing to tear down — and we must
  // not pull it in just to check.
  if (!dailyPromise) return;
  let DailyIframe: any;
  try {
    DailyIframe = await loadDaily();
  } catch {
    return;
  }
  const stale = getStaleInstance(DailyIframe);
  if (!stale) return;
  try { await stale.leave?.(); } catch {}
  try { await stale.destroy?.(); } catch {}
}

/** Async variant — awaits the stale singleton's destroy before creating the
 *  new frame. Prevents the "postMessage on null" crash that happens when
 *  React StrictMode / HMR double-mounts the effect and Daily's async destroy
 *  hasn't finished tearing down the previous iframe. */
export async function createDailyFrameAsync(
  container: HTMLElement,
  props: Record<string, any>,
): Promise<DailyCall> {
  const DailyIframe: any = await loadDaily();
  await destroyExistingDailyFrameAsync();
  while (container.firstChild) container.removeChild(container.firstChild);
  try {
    return DailyIframe.createFrame(container, props);
  } catch (err: any) {
    if (String(err?.message || "").includes("Duplicate")) {
      try { await getStaleInstance(DailyIframe)?.destroy?.(); } catch {}
      while (container.firstChild) container.removeChild(container.firstChild);
      return DailyIframe.createFrame(container, props);
    }
    throw err;
  }
}

/**
 * Fully tears down a call object: leaves the meeting, destroys the iframe and
 * releases any camera/microphone tracks the SDK still holds. Always safe to
 * call, including on an already-destroyed frame.
 */
export async function teardownDailyCall(frame: DailyCall | null | undefined): Promise<void> {
  if (!frame) return;
  const f = frame as any;
  try { await f.setLocalVideo?.(false); } catch {}
  try { await f.setLocalAudio?.(false); } catch {}
  try { await f.leave?.(); } catch {}
  try { await f.destroy?.(); } catch {}
}
