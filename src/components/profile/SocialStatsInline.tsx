import { Youtube, Instagram, Music, Twitter, Linkedin } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SocialStatsInlineProps {
  youtubeSubscribers?: number;
  instagramFollowers?: number;
  tiktokFollowers?: number;
  spotifyListeners?: number;
  twitterFollowers?: number;
  linkedinConnections?: number;
  verifiedMetrics?: boolean;
}

const formatNumber = (num: number) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toString();
};

export const SocialStatsInline = ({
  youtubeSubscribers,
  instagramFollowers,
  tiktokFollowers,
  spotifyListeners,
  twitterFollowers,
  linkedinConnections,
  verifiedMetrics,
}: SocialStatsInlineProps) => {
  const stats = [
    { icon: Youtube, label: "YouTube", value: youtubeSubscribers, color: "text-red-500", bg: "bg-red-500/10" },
    { icon: Instagram, label: "Instagram", value: instagramFollowers, color: "text-pink-500", bg: "bg-pink-500/10" },
    { icon: Music, label: "TikTok", value: tiktokFollowers, color: "text-foreground", bg: "bg-foreground/10" },
    { icon: Music, label: "Spotify", value: spotifyListeners, color: "text-green-500", bg: "bg-green-500/10" },
    { icon: Twitter, label: "X", value: twitterFollowers, color: "text-primary", bg: "bg-primary/10" },
    { icon: Linkedin, label: "LinkedIn", value: linkedinConnections, color: "text-primary", bg: "bg-primary/10" },
  ].filter((s) => s.value && s.value > 0);

  if (stats.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reach</span>
        {verifiedMetrics && (
          <Badge variant="secondary" className="h-4 text-[9px] px-1.5 gap-0.5">
            ✓ Verified
          </Badge>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ${stat.bg} border border-border/50`}
          >
            <stat.icon className={`h-3.5 w-3.5 ${stat.color}`} />
            <span className="text-xs font-bold text-foreground">{formatNumber(stat.value!)}</span>
            <span className="text-[10px] text-muted-foreground">{stat.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
