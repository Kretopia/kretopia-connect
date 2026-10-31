import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";
import App from "./App.tsx";
import { initSentry } from "./lib/sentryInit";
import { initSWUpdateListener } from "./lib/sw-update";
import { checkForNewVersion } from "./lib/version-check";
import { setupGlobalErrorLogging } from "./lib/errorLogger";
import { clearAppServiceWorkerData, ensureAppServiceWorkerRegistered, isStandalonePWA } from "./lib/serviceWorker";
import { startCacheSweep } from "./lib/cacheSweep";
import { getStoredVibe } from "./components/VibeThemeSync";
import { installUnsafeLinkGuard } from "./lib/safeUrl";
import "./i18n";
import "./index.css";

installUnsafeLinkGuard();

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

// Initialize Sentry for error monitoring (Replay is fully masked: see sentryInit.ts)
initSentry();

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
startCacheSweep();

const initialTheme = getStoredVibe() === "daylight" ? "light" : "dark";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* One source of truth for the first render: the vibe index.html already
        applied. A fixed "light" default made next-themes strip `.dark` at
        mount (and its own stale `theme` key could keep doing it) before
        VibeThemeSync put it back, so Midnight painted a Light pass first. */}
    <ThemeProvider attribute="class" defaultTheme={initialTheme} storageKey="kretopia-theme" enableSystem={false}>
      <App />
    </ThemeProvider>
  </StrictMode>
);
