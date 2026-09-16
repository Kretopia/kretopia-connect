import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Fires desk-agent-watch (proactive proposal generator) when a Studio mounts
 * AND when a chat burst settles. Throttled per-project on the client (15min
 * sessionStorage) and again server-side (30min DB throttle).
 */
const SS_KEY = (id: string) => `thrive:watch:${id}`;
const CLIENT_THROTTLE_MS = 15 * 60 * 1000;

export function useDeskAgentWatch(projectId?: string | null) {
  useEffect(() => {
    if (!projectId) return;

    const run = () => {
      try {
        const last = Number(sessionStorage.getItem(SS_KEY(projectId)) || 0);
        if (Date.now() - last < CLIENT_THROTTLE_MS) return;
        sessionStorage.setItem(SS_KEY(projectId), String(Date.now()));
        supabase.functions
          .invoke("desk-agent-watch", { body: { project_id: projectId } })
          .catch((e) => {
            // soft-fail — proactive cards are non-critical
            console.warn("[desk-agent-watch] failed", e);
          });
      } catch {
        /* ignore */
      }
    };

    // Run on mount (after a short delay so we don't compete with first paint)
    const mountTimer = window.setTimeout(run, 2500);

    // Debounced run after a chat burst settles
    let burstTimer: number | undefined;
    const channel = supabase
      .channel(`watch:${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "project_messages",
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          if (burstTimer) window.clearTimeout(burstTimer);
          burstTimer = window.setTimeout(run, 90_000); // wait 90s of silence
        },
      )
      .subscribe();

    return () => {
      window.clearTimeout(mountTimer);
      if (burstTimer) window.clearTimeout(burstTimer);
      supabase.removeChannel(channel);
    };
  }, [projectId]);
}
