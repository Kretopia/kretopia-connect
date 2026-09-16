import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ReplySLABadge — compact "Usually replies in <1hr" chip driven by REAL
 * inbound/outbound message timings over the last 30 days. Falls back to the
 * stored profiles.avg_response_hours when no recent traffic is available.
 *
 * Returns null when the creator is not fast enough to brag about (>= 12hr) —
 * we never want this badge to undersell. Self-fetching so it can drop into
 * any card (Swipe, Scout, Passport hero) without prop plumbing.
 */
export function ReplySLABadge({
  userId,
  fallbackHours,
  className,
  variant = "dark",
}: {
  userId?: string;
  fallbackHours?: number | null;
  className?: string;
  variant?: "dark" | "light";
}) {
  const [hours, setHours] = useState<number | null>(fallbackHours ?? null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { data } = await (supabase as any)
          .from("messages")
          .select("sender_id, receiver_id, created_at, match_id")
          .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
          .gte("created_at", since)
          .order("created_at", { ascending: true })
          .limit(400)
          .then((r: any) => r, () => ({ data: null }));
        if (!data || cancelled) return;

        // Group by conversation; find inbound→outbound reply deltas
        const byConv = new Map<string, any[]>();
        for (const m of data as any[]) {
          const k = m.match_id || `${m.sender_id}:${m.receiver_id}`;
          if (!byConv.has(k)) byConv.set(k, []);
          byConv.get(k)!.push(m);
        }
        const deltas: number[] = [];
        for (const msgs of byConv.values()) {
          let pendingInbound: string | null = null;
          for (const m of msgs) {
            if (m.receiver_id === userId) {
              if (!pendingInbound) pendingInbound = m.created_at;
            } else if (m.sender_id === userId && pendingInbound) {
              const diff = (new Date(m.created_at).getTime() - new Date(pendingInbound).getTime()) / 3600000;
              if (diff >= 0 && diff < 24 * 14) deltas.push(diff);
              pendingInbound = null;
            }
          }
        }
        if (deltas.length >= 3) {
          deltas.sort((a, b) => a - b);
          const median = deltas[Math.floor(deltas.length / 2)];
          if (!cancelled) setHours(median);
        }
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  if (hours == null || hours >= 12) return null;

  const label =
    hours < 1 ? "Replies in <1hr"
    : hours < 6 ? `Replies in ~${Math.round(hours)}hr`
    : `Replies same day`;

  const palette = variant === "light"
    ? "bg-[hsl(var(--signal-amber))]/15 text-[hsl(var(--signal-amber))] border-[hsl(var(--signal-amber))]/40"
    : "bg-[hsl(var(--signal-amber))]/20 text-[hsl(var(--signal-amber))] border-[hsl(var(--signal-amber))]/40 backdrop-blur-sm";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
        palette,
        className,
      )}
    >
      <Zap className="h-3 w-3" />
      {label}
    </span>
  );
}

export default ReplySLABadge;
