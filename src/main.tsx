import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";
import * as Sentry from "@sentry/react";
import App from "./App.tsx";
import { initSWUpdateListener } from "./lib/sw-update";
import { checkForNewVersion } from "./lib/version-check";
import { setupGlobalErrorLogging } from "./lib/errorLogger";
import { clearAppServiceWorkerData, ensureAppServiceWorkerRegistered, isStandalonePWA } from "./lib/serviceWorker";
import "./i18n";
import "./index.css";

const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

if (isInIframe || isPreviewHost) {
  navigator.serviceWorker?.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister());
  });
}

// Initialize Sentry for error monitoring
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN || "",
  environment: import.meta.env.MODE,
  enabled: import.meta.env.PROD, // Only enable in production
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

if (!isInIframe && !isPreviewHost) {
  if (isStandalonePWA()) {
    // Installed app keeps the service worker for offline/push support.
    ensureAppServiceWorkerRegistered().then(() => {
      initSWUpdateListener();
      checkForNewVersion();
    });
  } else {
    // Browser sessions should never get stuck on stale precached builds after publish.
    clearAppServiceWorkerData();
  }
}

// Log unhandled errors to the database for monitoring
setupGlobalErrorLogging();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <App />
    </ThemeProvider>
  </StrictMode>
);
