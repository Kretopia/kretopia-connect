import * as Sentry from "@sentry/react";

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

export function initSentry() {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN || "",
    environment: import.meta.env.MODE,
    enabled: import.meta.env.PROD, // Only enable in production
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(SENTRY_REPLAY_OPTIONS),
    ],
    tracesSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}
