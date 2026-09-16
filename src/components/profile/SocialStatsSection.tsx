import { useState } from "react";
import { Instagram, Music, Twitter, Linkedin, Youtube, ExternalLink, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SocialStatsSectionProps {
  youtubeSubscribers?: number;
  instagramFollowers?: number;
  tiktokFollowers?: number;
  spotifyListeners?: number;
  twitterFollowers?: number;
  linkedinConnections?: number;
  youtubeUrl?: string;
  instagramUrl?: string;
  tiktokUrl?: string;
  spotifyUrl?: string;
  twitterUrl?: string;
  linkedinUrl?: string;
  verifiedMetrics?: boolean;
  isOwner?: boolean;
  onRefreshed?: () => void;
}

export const SocialStatsSection = ({
  youtubeSubscribers,
  instagramFollowers,
  tiktokFollowers,
  spotifyListeners,
  twitterFollowers,
  linkedinConnections,
  youtubeUrl,
  instagramUrl,
  tiktokUrl,
  spotifyUrl,
  twitterUrl,
  linkedinUrl,
  verifiedMetrics,
  isOwner,
  onRefreshed,
}: SocialStatsSectionProps) => {
  const [refreshing, setRefreshing] = useState(false);

  const stats = [
    { icon: Youtube, label: "YouTube", value: youtubeSubscribers, url: youtubeUrl, color: "text-red-500" },
    { icon: Instagram, label: "Instagram", value: instagramFollowers, url: instagramUrl, color: "text-primary" },
    { icon: Music, label: "TikTok", value: tiktokFollowers, url: tiktokUrl, color: "text-primary" },
    { icon: Music, label: "Spotify", value: spotifyListeners, url: spotifyUrl, color: "text-green-500" },
    { icon: Twitter, label: "Twitter/X", value: twitterFollowers, url: twitterUrl, color: "text-primary" },
    { icon: Linkedin, label: "LinkedIn", value: linkedinConnections, url: linkedinUrl, color: "text-primary" },
  ].filter((s) => s.value && s.value > 0);

  const hasAnyUrl = !!(youtubeUrl || instagramUrl || tiktokUrl || spotifyUrl || twitterUrl || linkedinUrl);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-social-stats");
      if (error) throw error;
      const updated = data?.updated ?? 0;
      toast.success(updated > 0 ? `Updated ${updated} platform${updated === 1 ? "" : "s"}` : "No new stats found");
      onRefreshed?.();
    } catch (e: any) {
      toast.error(e?.message || "Could not refresh stats");
    } finally {
      setRefreshing(false);
    }
  };

  // Show empty-state for owner with linked accounts but no fetched stats yet
  if (stats.length === 0) {
    if (!isOwner || !hasAnyUrl) return null;
    return (
      <div className="rounded-2xl border border-border bg-card p-4 md:p-6 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg md:text-xl font-semibold">Social</h3>
          <Button size="sm" variant="outline" onClick={refresh} disabled={refreshing}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
            Fetch stats
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Your linked accounts are saved. Tap "Fetch stats" to pull live follower counts.
        </p>
      </div>
    );
  }

  const formatNumber = (num: number) => {
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + "M";
    if (num >= 1_000) return (num / 1_000).toFixed(1) + "K";
    return num.toString();
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 md:p-6 shadow-card">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-lg md:text-xl font-semibold">Social</h3>
        <div className="flex items-center gap-2">
          {verifiedMetrics && (
            <Badge variant="secondary" className="text-xs">✓ Verified</Badge>
          )}
          {isOwner && (
            <Button size="sm" variant="ghost" onClick={refresh} disabled={refreshing} aria-label="Refresh stats">
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col items-center gap-2 p-3 rounded-xl bg-background border border-border hover:border-primary transition-colors"
          >
            <stat.icon className={`h-5 w-5 ${stat.color}`} />
            <div className="text-center">
              <div className="text-xl md:text-2xl font-bold text-foreground">
                {formatNumber(stat.value!)}
              </div>
              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                {stat.label}
                {stat.url && (
                  <a
                    href={stat.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="opacity-60 hover:opacity-100 transition-opacity"
                    aria-label={`Verify ${stat.label} stats`}
                    title="Verify on platform"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
