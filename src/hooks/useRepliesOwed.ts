import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * "Replies owed" — count of distinct chat threads where someone sent you a
 * message 24h+ ago and you haven't sent anything since.
 *
 * Best-effort: any error returns 0 quietly so the badge never breaks the UI.
 */
export function useRepliesOwed(pollMs = 60_000) {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) { setCount(0); return; }
    let cancelled = false;

    const compute = async () => {
      try {
        // Pull recent inbound messages (last 14 days) addressed to this user.
        const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
        const day = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: inbound } = await (supabase as any)
          .from("messages")
          .select("sender_id, created_at")
          .eq("receiver_id", user.id)
          .gte("created_at", cutoff)
          .order("created_at", { ascending: false })
          .limit(200);

        const lastInbound = new Map<string, string>();
        for (const m of (inbound || [])) {
          if (!lastInbound.has(m.sender_id)) lastInbound.set(m.sender_id, m.created_at);
        }

        const senderIds = [...lastInbound.keys()];
        if (senderIds.length === 0) {
          if (!cancelled) setCount(0);
          return;
        }

        const { data: outbound } = await (supabase as any)
          .from("messages")
          .select("receiver_id, created_at")
          .eq("sender_id", user.id)
          .in("receiver_id", senderIds)
          .gte("created_at", cutoff)
          .order("created_at", { ascending: false })
          .limit(400);

        const lastOutbound = new Map<string, string>();
        for (const m of (outbound || [])) {
          if (!lastOutbound.has(m.receiver_id)) lastOutbound.set(m.receiver_id, m.created_at);
        }

        let owed = 0;
        for (const [sid, inAt] of lastInbound.entries()) {
          if (inAt > day) continue; // newer than 24h — fine
          const outAt = lastOutbound.get(sid);
          if (!outAt || outAt < inAt) owed += 1;
        }
        if (!cancelled) setCount(owed);
      } catch {
        if (!cancelled) setCount(0);
      }
    };

    compute();
    const id = setInterval(compute, pollMs);
    return () => { cancelled = true; clearInterval(id); };
  }, [user, pollMs]);

  return count;
}
