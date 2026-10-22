/**
 * Session Replay records the DOM. Calls, messages, invoices, wallets and Passport data are all on screen,
 * so every replay is masked: text and inputs become `*`, images, video and other media are blocked, and
 * network payloads are never captured. Do not unmask a region without a written privacy decision.
 */
export const SENTRY_REPLAY_OPTIONS = {
  maskAllText: true,
  maskAllInputs: true,
  blockAllMedia: true,
  networkCaptureBodies: false,
} as const;

/**
 * The SDK is the largest part of the first-load script (about 800 KB before compression, mostly Replay) and does
 * nothing without a DSN, so it is fetched only when there is somewhere to send events. Keep `@sentry/*` out of
 * static imports here: one of them puts the whole SDK back in the entry chunk.
 */
export async function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn || !import.meta.env.PROD) return; // Only enabled in production, and only with a DSN

  try {
    const Sentry = await import("@sentry/react");
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      enabled: import.meta.env.PROD,
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration(SENTRY_REPLAY_OPTIONS),
      ],
      tracesSampleRate: 1.0,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
    });
  } catch {
    // Monitoring must never break the app: an offline or stale-deploy chunk failure just leaves it off.
  }
}
