import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Fires surface-agent-watch (proactive proposal generator) for non-Studio
 * surfaces (home, scout, pay, passport). Throttled per-surface on the client
 * (45min sessionStorage) and again server-side (60min DB throttle).
 */
type Surface = "home" | "scout" | "pay" | "passport";
const SS_KEY = (s: Surface) => `thrive:watch:surface:${s}`;
const CLIENT_THROTTLE_MS = 45 * 60 * 1000;

export function useSurfaceAgentWatch(surface: Surface | null | undefined) {
  useEffect(() => {
    if (!surface) return;

    const run = () => {
      try {
        const last = Number(sessionStorage.getItem(SS_KEY(surface)) || 0);
        if (Date.now() - last < CLIENT_THROTTLE_MS) return;
        sessionStorage.setItem(SS_KEY(surface), String(Date.now()));
        supabase.functions
          .invoke("surface-agent-watch", { body: { surface } })
          .catch((e) => {
            // soft-fail — proactive cards are non-critical
            console.warn("[surface-agent-watch] failed", e);
          });
      } catch {
        /* ignore */
      }
    };

    // Run after first paint settles
    const t = window.setTimeout(run, 3000);
    return () => window.clearTimeout(t);
  }, [surface]);
}
