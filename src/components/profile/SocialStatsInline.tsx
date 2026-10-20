import { useCallback, useEffect, useState } from "react";
import { Youtube, Instagram, Music, Twitter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface SocialStatsInlineProps {
  userId: string;
}

const formatNumber = (num: number) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toString();
};

// The YouTube sync stores the audience as `subscriberCount`, usually a numeric string; the others use one numeric field.
const platforms = [
  { id: "youtube", icon: Youtube, label: "YouTube", fields: ["subscribers", "subscriberCount"] },
  { id: "instagram", icon: Instagram, label: "Instagram", fields: ["followers"] },
  { id: "tiktok", icon: Music, label: "TikTok", fields: ["followers"] },
  { id: "twitter", icon: Twitter, label: "X", fields: ["followers"] },
  { id: "spotify", icon: Music, label: "Spotify listeners", fields: ["monthlyListeners"] },
] as const;

/** A count the sync really stored: a non-negative number, or a string of digits. Anything else is not shown. */
export const readAudienceCount = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : null;
  if (typeof value === "string" && /^\d{1,12}$/.test(value.trim())) return Number(value.trim());
  return null;
};

type ReachMetric = { label: string; value: number; icon: typeof Youtube; syncedAt: string | null };

export const SocialStatsInline = ({ userId }: SocialStatsInlineProps) => {
  const [stats, setStats] = useState<ReachMetric[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.from("connected_platforms")
      .select("platform, platform_data, last_synced_at")
      .eq("user_id", userId);
    if (error) { setStats([]); setLoaded(true); return; }
    const next = (data || []).flatMap((row) => {
      const platform = platforms.find((item) => item.id === row.platform);
      const details = row.platform_data;
      if (!platform || !details || typeof details !== "object" || Array.isArray(details)) return [];
      const value = platform.fields.map((field) => readAudienceCount(details[field])).find((count) => count !== null) ?? null;
      return value !== null
        ? [{ label: platform.label, value, icon: platform.icon, syncedAt: row.last_synced_at }]
        : [];
    });
    setStats(next);
    setLoaded(true);
  }, [userId]);

  useEffect(() => {
    setLoaded(false);
    setStats([]);
    void refresh();
    const channel = supabase.channel(`passport-reach:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "connected_platforms", filter: `user_id=eq.${userId}` }, () => { void refresh(); })
      .subscribe();
    const onFocus = () => { void refresh(); };
    window.addEventListener("focus", onFocus);
    const interval = window.setInterval(() => { if (!document.hidden) void refresh(); }, 60_000);
    return () => { window.removeEventListener("focus", onFocus); window.clearInterval(interval); void supabase.removeChannel(channel); };
  }, [refresh, userId]);

  return (
    <div className="space-y-2 border-t border-border pt-3">
      <span className="text-[11px] font-semibold uppercase text-muted-foreground">Reach · connected accounts</span>
      {loaded && stats.length === 0 && <p className="text-xs text-muted-foreground">No synced audience metrics yet.</p>}
      <div className="flex flex-wrap gap-1.5">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2.5 py-1.5"
            title={stat.syncedAt ? `Last synced ${new Date(stat.syncedAt).toLocaleString()}` : "Sync time unavailable"}
          >
            <stat.icon className="h-3.5 w-3.5 text-energy" />
            <span className="text-xs font-bold tabular-nums text-foreground">{formatNumber(stat.value)}</span>
            <span className="text-[10px] text-muted-foreground">{stat.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
