import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { extractInvokeError } from "@/lib/extractInvokeError";
import { isThinListing } from "@/lib/scoutListing";
import {
  LIVE_INTERVAL_MS,
  degradedNote,
  describeScan,
  friendlyScanError,
  isScanStale,
  type ScanResult,
} from "@/lib/scoutScan";
import type { ScoutActionRow, ScoutedGig } from "./scout.types";
import { ScoutScanContext, type ScoutScanResult, type ScoutScanValue } from "./scoutScanContext";

interface ScoutScanProviderProps {
  /** Compact embeds (Today's "More from today") read the list but never refresh it on their own. */
  embedded?: boolean;
  children: ReactNode;
}

/**
 * One owner for what Scout knows about its own list and its own scans, so the
 * Wrapped surface above the tabs and the For You list below them are the same
 * state: one list in the query cache, one scan in flight, one timer.
 *
 * Nothing here is new behaviour: the queries, the scan call and the automatic
 * refresh rules are the ones that lived inside the For You section. What
 * changed is that a failed read is now an error instead of an empty list, and
 * that a second request while one is in flight is ignored, not only the
 * automatic ones.
 */
export function ScoutScanProvider({ embedded = false, children }: ScoutScanProviderProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const userId = user?.id;
  const queryKey = ["scouted-gigs", userId] as const;

  const [scanning, setScanning] = useState(false);
  const [liveRefreshing, setLiveRefreshing] = useState(false);
  const [scanElapsed, setScanElapsed] = useState(0);
  const [scanUnavailable, setScanUnavailable] = useState<string | null>(null);
  const [scanNote, setScanNote] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ScoutScanResult | null>(null);
  const scanTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const busyRef = useRef(false);

  // While a scan runs the list is re-read every few seconds, so gigs appear as
  // the scan saves them instead of at the end.
  const { data: gigs = [], isLoading: loading, isError: listError } = useQuery({
    queryKey,
    refetchInterval: scanning ? 3_000 : 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scouted_gigs")
        .select("*")
        .eq("target_user_id", userId!)
        .gt("expires_at", new Date().toISOString())
        .order("fit_score", { ascending: false })
        .order("scouted_at", { ascending: false })
        .limit(40);
      if (error) throw error;

      const { data: dismissedRows, error: dismissedError } = await supabase
        .from("scouted_gig_actions")
        .select("scouted_gig_id, action")
        .eq("user_id", userId!)
        .eq("action", "dismissed");
      if (dismissedError) throw dismissedError;
      const dismissed = new Set((dismissedRows || []).map((a) => a.scouted_gig_id));
      return ((data || []) as ScoutedGig[]).filter((g) => !dismissed.has(g.id) && !isThinListing(g));
    },
    enabled: !!userId,
  });

  // This person's own actions: the counts under the list and the Wrapped signals.
  const { data: actions = [], isFetched: actionsReady } = useQuery({
    queryKey: ["scout-progress", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scouted_gig_actions")
        .select("scouted_gig_id, action, outcome")
        .eq("user_id", userId!)
        .limit(2000);
      if (error) throw error;
      return (data || []) as ScoutActionRow[];
    },
    enabled: !!userId,
  });
  const progress = {
    saved: actions.filter((a) => a.action === "saved").length,
    applied: actions.filter((a) => a.action === "applied").length,
    won: actions.filter((a) => a.action === "applied" && a.outcome === "won").length,
  };

  const { data: lastRunAt = null, isFetched: lastRunKnown } = useQuery({
    queryKey: ["scout-last-run", userId],
    queryFn: async () => {
      const { data } = await supabase.from("scout_preferences").select("last_run_at").eq("user_id", userId!).maybeSingle();
      return (data?.last_run_at as string | null | undefined) ?? null;
    },
    enabled: !!userId,
    refetchInterval: 60_000,
  });

  // `auto` = a scan we start ourselves. It must never greet someone with a red
  // failure toast for something they didn't ask for.
  // `mode`: "full" is Scan now / first arrival (job boards, plus web search and
  // AI when the workspace has them); "live" is the quiet background refresh of
  // the public job boards (free; the server throttles it).
  const scanNow = async ({ auto = false, mode = "full" }: { auto?: boolean; mode?: "full" | "live" } = {}) => {
    if (!userId) return;
    // One scan at a time, whoever asked: a second click or a timer firing during a
    // scan is the same request twice.
    if (busyRef.current) return;
    busyRef.current = true;
    const live = mode === "live";
    if (live) {
      setLiveRefreshing(true);
    } else {
      setScanning(true);
      setScanElapsed(0);
      scanTimerRef.current = setInterval(() => setScanElapsed((s) => s + 1), 1000);
    }

    let data: unknown = null;
    let error: unknown = null;
    try {
      const res = await supabase.functions.invoke("scout-gigs", { body: { trigger: live ? "live" : "manual" } });
      data = res.data;
      error = res.error;
    } catch (thrown) {
      error = thrown;
    }

    busyRef.current = false;
    if (live) {
      setLiveRefreshing(false);
    } else {
      if (scanTimerRef.current) clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
      setScanning(false);
    }

    if (error) {
      // The SDK's own message is a generic "non-2xx status code": the
      // function's real error (config, auth, rate limit) lives in the body.
      const detail = friendlyScanError(await extractInvokeError(error as Parameters<typeof extractInvokeError>[0]));
      if (auto) {
        if (!live) setScanUnavailable(detail);
        return;
      }
      toast({ title: "Scout failed", description: detail, variant: "destructive" });
      setScanUnavailable(detail);
      return;
    }

    const result = (data ?? {}) as ScanResult;
    setScanUnavailable(null);
    setScanNote(degradedNote(result.degraded));
    const message = describeScan(result, auto);
    if (message) {
      toast(message);
      setLastResult({ ...message, at: Date.now() });
    }
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: ["scout-last-run", userId] });
  };

  useEffect(() => () => { if (scanTimerRef.current) clearInterval(scanTimerRef.current); }, []);

  // On arrival, once per mount: nothing scouted yet -> a full scan (waiting for
  // a manual click was the whole complaint); otherwise, if the last check is
  // stale -> a quiet live refresh, so the list is current the moment it is
  // looked at. Marking the ref in both cases keeps it from looping or burning
  // through the server-side weekly limit (e.g. after dismissing everything).
  const hasAutoScannedRef = useRef(false);
  useEffect(() => {
    if (hasAutoScannedRef.current) return;
    if (loading || scanning || !userId || !lastRunKnown || listError) return;
    hasAutoScannedRef.current = true;
    if (gigs.length === 0) void scanNow({ auto: true });
    else if (!embedded && isScanStale(lastRunAt)) void scanNow({ auto: true, mode: "live" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, userId, gigs.length, lastRunKnown, lastRunAt, listError]);

  // While Scout stays open and visible, look again every few minutes. The
  // boards update about hourly and the server skips a refresh that comes too
  // soon after the last one, so this costs nothing.
  useEffect(() => {
    if (!userId || embedded) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void scanNow({ auto: true, mode: "live" });
    }, LIVE_INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, embedded]);

  const value: ScoutScanValue = {
    userId,
    gigs,
    loading,
    listError,
    queryKey,
    actions,
    actionsReady,
    progress,
    lastRunAt,
    scanning,
    liveRefreshing,
    busy: scanning || liveRefreshing,
    scanElapsed,
    scanUnavailable,
    scanNote,
    lastResult,
    scanNow,
  };

  return <ScoutScanContext.Provider value={value}>{children}</ScoutScanContext.Provider>;
}

export default ScoutScanProvider;
