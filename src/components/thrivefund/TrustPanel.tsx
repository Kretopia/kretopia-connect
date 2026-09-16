import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { ShieldCheck, Star, Award, Users, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface TrustPanelProps {
  creatorId: string;
}

/**
 * The headline differentiator for ThriveFund.
 * Backers see verified credits, vouches, and ThriveStatus before pledging —
 * something Kickstarter / Indiegogo cannot show.
 */
export const TrustPanel = ({ creatorId }: TrustPanelProps) => {
  const { data, isLoading } = useQuery({
    queryKey: ["thrivefund", "trust", creatorId],
    queryFn: async () => {
      const [profileRes, creditsRes, vouchesRes] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "user_id, full_name, avatar_url, role, location, verification_status, verification_tier, badge, id_verified"
          )
          .eq("user_id", creatorId)
          .maybeSingle(),
        supabase
          .from("credits")
          .select("id, project_name, role, year, verification_status, thumbnail_url, primary_media_url")
          .eq("user_id", creatorId)
          .order("year", { ascending: false })
          .limit(6),
        supabase
          .from("credit_endorsements")
          .select("id, status")
          .eq("status", "approved"),
      ]);

      const profile = profileRes.data;
      const credits = creditsRes.data ?? [];
      const verifiedCredits = credits.filter((c) => c.verification_status === "verified").length;
      const vouches = vouchesRes.data?.length ?? 0;

      return { profile, credits, verifiedCredits, vouches };
    },
  });

  if (isLoading || !data?.profile) {
    return (
      <Card className="p-6 rounded-2xl border-border/60 shadow-none animate-pulse">
        <div className="h-32 bg-muted rounded-xl" />
      </Card>
    );
  }

  const { profile, credits, verifiedCredits, vouches } = data;
  const isVerified =
    profile.verification_status === "verified" || (profile as any).id_verified;

  return (
    <Card className="p-6 rounded-2xl border-border/60 shadow-none bg-card">
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-black tracking-tight">Trust Panel</h3>
        <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border backdrop-blur-sm bg-energy/15 text-energy border-energy/35">
          Verified
        </span>
      </div>

      {/* Creator identity */}
      <Link
        to={`/profile/${profile.user_id}`}
        className="flex items-center gap-3 mb-5 group"
      >
        <Avatar className="h-14 w-14 border-2 border-primary/30">
          <AvatarImage src={profile.avatar_url ?? undefined} />
          <AvatarFallback>{profile.full_name?.[0] ?? "?"}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-semibold truncate group-hover:text-primary transition-colors">
              {profile.full_name}
            </p>
            {isVerified && <ShieldCheck className="h-4 w-4 text-primary shrink-0" />}
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {profile.role}
            {profile.location && ` · ${profile.location}`}
          </p>
        </div>
      </Link>

      {/* Trust stats */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        <Stat icon={Award} value={verifiedCredits} label="Verified Credits" />
        <Stat icon={Users} value={vouches} label="Vouches" />
        <Stat icon={Star} value={credits.length} label="Total Works" />
      </div>

      {/* Recent verified work */}
      {credits.length > 0 && (
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2 font-medium">
            Recent Work
          </p>
          <div className="grid grid-cols-3 gap-2">
            {credits.slice(0, 3).map((c) => (
              <div
                key={c.id}
                className="aspect-[2/3] rounded-md overflow-hidden bg-muted relative"
              >
                {(c.thumbnail_url || c.primary_media_url) ? (
                  <img
                    src={c.thumbnail_url || c.primary_media_url || ""}
                    alt={c.project_name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Sparkles className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                {c.verification_status === "verified" && (
                  <div className="absolute top-1 right-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-primary drop-shadow" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <Link
        to={`/profile/${profile.user_id}`}
        className="block mt-4 text-center text-xs text-primary hover:underline font-medium"
      >
        View full creator profile →
      </Link>
    </Card>
  );
};

const Stat = ({ icon: Icon, value, label }: { icon: any; value: number; label: string }) => (
  <div className="text-center bg-card/80 border border-border/60 rounded-xl p-2.5 backdrop-blur-sm">
    <Icon className="h-4 w-4 mx-auto mb-1 text-primary" />
    <p className="font-bold text-base">{value}</p>
    <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
  </div>
);
