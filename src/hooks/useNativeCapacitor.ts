import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Hook for Capacitor-specific native features:
 * - Deep link handling (App Links / Universal Links)
 * - Status bar styling
 * - Keyboard behavior
 * 
 * Only activates when running inside a Capacitor native shell.
 */
export function useNativeCapacitor() {
  const navigate = useNavigate();

  useEffect(() => {
    // Only run in Capacitor context
    const isCapacitor = !!(window as any).Capacitor;
    if (!isCapacitor) return;

    let cleanup: (() => void) | undefined;

    const init = async () => {
      try {
        // Deep link handling
        const { App } = await import("@capacitor/app");

        const listener = await App.addListener("appUrlOpen", (event) => {
          // Parse the URL and navigate to the right route
          // e.g. https://kretopia.com/profile/abc123 → /profile/abc123
          const url = new URL(event.url);
          const path = url.pathname + url.search + url.hash;
          if (path && path !== "/") {
            navigate(path);
          }
        });

        // Handle back button on Android
        const backListener = await App.addListener("backButton", ({ canGoBack }) => {
          if (canGoBack) {
            window.history.back();
          } else {
            App.minimizeApp();
          }
        });

        cleanup = () => {
          listener.remove();
          backListener.remove();
        };
      } catch (e) {
        // Capacitor plugins not available (PWA mode) — silently ignore
        console.debug("Capacitor native features not available:", e);
      }
    };

    init();
    return () => cleanup?.();
  }, [navigate]);
}
