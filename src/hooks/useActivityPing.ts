import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const PING_INTERVAL_MS = 5 * 60 * 1000; // 5 min while tab open
const MIN_GAP_MS = 60 * 1000; // never ping more than 1x/min

/**
 * Records a real session ping for WAU/MAU tracking.
 * - Fires on mount (once per signed-in user)
 * - Re-fires every 5 minutes while the tab stays open
 * - Re-fires when tab regains focus / becomes visible
 */
export function useActivityPing() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    let lastPingAt = 0;
    let cancelled = false;

    const ping = async () => {
      const now = Date.now();
      if (now - lastPingAt < MIN_GAP_MS) return;
      lastPingAt = now;
      try {
        await supabase.rpc("record_session_ping");
      } catch (err) {
        // silent — engagement tracking must never break the app
        console.warn("[activity-ping] failed", err);
      }
    };

    ping();
    const interval = setInterval(() => {
      if (!cancelled && document.visibilityState === "visible") ping();
    }, PING_INTERVAL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") ping();
    };
    const onFocus = () => ping();

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [user?.id]);
}
