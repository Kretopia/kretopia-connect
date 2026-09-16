import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface RunningEntry {
  id: string;
  project_id: string;
  started_at: string;
  hourly_rate: number | null;
  currency: string | null;
}

interface UseProjectTimerOptions {
  projectId: string;
  userId?: string | null;
}

/**
 * Tracks billable time on a project. Persists in `project_time_entries`.
 * Survives reloads — re-attaches to any user-owned entry where ended_at is null.
 */
export function useProjectTimer({ projectId, userId }: UseProjectTimerOptions) {
  const [running, setRunning] = useState<RunningEntry | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [hourlyRate, setHourlyRate] = useState<number | null>(null);
  const [currency, setCurrency] = useState<string>("USD");
  const [loading, setLoading] = useState(true);
  const tickRef = useRef<number | null>(null);

  // Load profile rate + any running entry on mount / project change
  useEffect(() => {
    if (!projectId || !userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [{ data: profile }, { data: entry }] = await Promise.all([
          supabase
            .from("profiles")
            .select("hourly_rate, rate_currency, preferred_currency")
            .eq("user_id", userId)
            .maybeSingle(),
          supabase
            .from("project_time_entries")
            .select("id, project_id, started_at, hourly_rate, currency")
            .eq("project_id", projectId)
            .eq("user_id", userId)
            .is("ended_at", null)
            .order("started_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);
        if (cancelled) return;
        const rate = (profile as any)?.hourly_rate ?? null;
        const ccy =
          (profile as any)?.rate_currency ||
          (profile as any)?.preferred_currency ||
          "USD";
        setHourlyRate(rate);
        setCurrency(ccy);
        if (entry) {
          setRunning(entry as RunningEntry);
        }
      } catch (err) {
        console.error("[useProjectTimer] init", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })().catch(() => setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [projectId, userId]);

  // Tick when running
  useEffect(() => {
    if (!running) {
      setElapsedSec(0);
      if (tickRef.current) window.clearInterval(tickRef.current);
      return;
    }
    const update = () => {
      const start = new Date(running.started_at).getTime();
      setElapsedSec(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    };
    update();
    tickRef.current = window.setInterval(update, 1000);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, [running]);

  const start = useCallback(async () => {
    if (!projectId || !userId || running) return;
    const { data, error } = await supabase
      .from("project_time_entries")
      .insert({
        project_id: projectId,
        user_id: userId,
        hourly_rate: hourlyRate,
        currency,
      })
      .select("id, project_id, started_at, hourly_rate, currency")
      .single();
    if (error) {
      toast.error("Couldn't start timer", { description: error.message });
      return;
    }
    setRunning(data as RunningEntry);
    toast.success("Timer started");
  }, [projectId, userId, running, hourlyRate, currency]);

  const stop = useCallback(
    async (note?: string) => {
      if (!running) return;
      const { error } = await supabase
        .from("project_time_entries")
        .update({ ended_at: new Date().toISOString(), note: note ?? null })
        .eq("id", running.id);
      if (error) {
        toast.error("Couldn't stop timer", { description: error.message });
        return;
      }
      setRunning(null);
      setElapsedSec(0);
      toast.success("Time logged");
    },
    [running],
  );

  return {
    loading,
    running,
    elapsedSec,
    hourlyRate,
    currency,
    setHourlyRate,
    setCurrency,
    start,
    stop,
    isRunning: !!running,
  };
}

export const formatHMS = (totalSec: number) => {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};
