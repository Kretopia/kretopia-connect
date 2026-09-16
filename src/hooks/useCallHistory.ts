import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface CallHistoryEntry {
  id: string;
  room_name: string;
  room_url: string;
  started_by: string;
  invited_user_id: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  was_missed: boolean;
  missed_at: string | null;
  /** Computed: the *other* party from current user's POV */
  partnerId: string | null;
  partnerName: string;
  partnerAvatar: string | null;
  /** "incoming" | "outgoing" */
  direction: "incoming" | "outgoing";
  /** ID of the AI-generated recap, if one exists for this call. */
  transcriptId: string | null;
  transcriptStatus: "pending" | "transcribing" | "ready" | "failed" | null;
}

/**
 * Fetches the user's recent 1:1 call history (last 50) with the other party
 * resolved to display name + avatar. Subscribes to realtime inserts so missed
 * calls and new calls appear without refresh.
 */
export function useCallHistory() {
  const { user } = useAuth();
  const [calls, setCalls] = useState<CallHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("direct_video_calls")
      .select("*")
      .or(`started_by.eq.${user.id},invited_user_id.eq.${user.id}`)
      .order("started_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[useCallHistory]", error);
      setLoading(false);
      return;
    }

    const partnerIds = Array.from(
      new Set(
        (data || [])
          .map((c) => (c.started_by === user.id ? c.invited_user_id : c.started_by))
          .filter((id): id is string => !!id),
      ),
    );

    let profileMap = new Map<string, { full_name: string | null; avatar_url: string | null }>();
    if (partnerIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url")
        .in("user_id", partnerIds);
      (profs || []).forEach((p) =>
        profileMap.set(p.user_id, { full_name: p.full_name, avatar_url: p.avatar_url }),
      );
    }

    const callIds = (data || []).map((c) => c.id);
    const transcriptMap = new Map<string, { id: string; status: any }>();
    if (callIds.length) {
      const { data: ts } = await supabase
        .from("call_transcripts")
        .select("id, call_id, status")
        .eq("call_kind", "direct")
        .in("call_id", callIds);
      (ts || []).forEach((t) => transcriptMap.set(t.call_id, { id: t.id, status: t.status }));
    }

    const entries: CallHistoryEntry[] = (data || []).map((c) => {
      const isOutgoing = c.started_by === user.id;
      const partnerId = isOutgoing ? c.invited_user_id : c.started_by;
      const p = partnerId ? profileMap.get(partnerId) : null;
      const tr = transcriptMap.get(c.id);
      return {
        ...c,
        partnerId,
        partnerName: p?.full_name || "Unknown",
        partnerAvatar: p?.avatar_url || null,
        direction: isOutgoing ? "outgoing" : "incoming",
        transcriptId: tr?.id ?? null,
        transcriptStatus: tr?.status ?? null,
      };
    });

    setCalls(entries);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime: refresh whenever a row touching this user changes.
  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel(`call-history:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "direct_video_calls" },
        (payload: any) => {
          const row = payload.new || payload.old;
          if (row?.started_by === user.id || row?.invited_user_id === user.id) {
            void load();
          }
        },
      )
      .subscribe();
    return () => {
      try { supabase.removeChannel(ch); } catch {}
    };
  }, [user?.id, load]);

  return { calls, loading, refresh: load };
}

/**
 * Counts unread missed calls (missed within the last 30 days, not yet
 * acknowledged via the Calls tab opening). Used to badge the tab.
 */
export function useMissedCallBadge() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { count: c } = await supabase
      .from("direct_video_calls")
      .select("id", { count: "exact", head: true })
      .eq("invited_user_id", user.id)
      .eq("was_missed", true)
      .gte("missed_at", cutoff);
    setCount(c || 0);
  }, [user?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel(`missed-calls:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "direct_video_calls",
          filter: `invited_user_id=eq.${user.id}`,
        },
        () => void refresh(),
      )
      .subscribe();
    return () => {
      try { supabase.removeChannel(ch); } catch {}
    };
  }, [user?.id, refresh]);

  return { count, refresh };
}
