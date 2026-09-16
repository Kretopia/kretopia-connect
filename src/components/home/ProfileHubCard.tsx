import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Search, ShieldCheck, Share2, ExternalLink, ArrowRight, Sparkles, TrendingUp, Fingerprint, Copy } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { calculateProfileStrength } from "@/components/profile/ProfileStrengthScore";
import { ProfileShareModal } from "@/components/profile/ProfileShareModal";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ProfileHubCardProps {
  userId: string;
  profile: any;            // full profile row
  creditsCount: number;
  connectionsCount: number;
  className?: string;
}

/**
 * Wave 3 Profile Hub: hybrid hero card combining identity, strength ring,
 * 'Today' reach panel (views, search appearances, verification rate) and a
 * primary 'Share my profile' CTA. Becomes the top of /home for auth users.
 */
export const ProfileHubCard = ({
  userId,
  profile,
  creditsCount,
  connectionsCount,
  className,
}: ProfileHubCardProps) => {
  const [shareOpen, setShareOpen] = useState(false);
  const [viewsWeek, setViewsWeek] = useState<number | null>(null);
  const [searchAppearances, setSearchAppearances] = useState<number | null>(null);
  const [verifiedCredits, setVerifiedCredits] = useState(0);
  const [topCredit, setTopCredit] = useState<string | null>(null);

  // Profile strength
  const { score, items } = useMemo(
    () => calculateProfileStrength(profile, 0, creditsCount, 0, 0),
    [profile, creditsCount]
  );
  const nextItem = items.find((i) => !i.completed);

  // Verification rate
  const verificationRate = creditsCount > 0
    ? Math.round((verifiedCredits / creditsCount) * 100)
    : 0;

  // Fetch reach metrics
  useEffect(() => {
    if (!userId) return;
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    Promise.all([
      supabase
        .from("analytics_events")
        .select("*", { count: "exact", head: true })
        .eq("event_name", "profile_viewed")
        .eq("event_properties->>profile_user_id", userId)
        .gte("created_at", since),
      supabase
        .from("analytics_events")
        .select("*", { count: "exact", head: true })
        .eq("event_name", "search_result_shown")
        .eq("event_properties->>profile_user_id", userId)
        .gte("created_at", since),
      supabase
        .from("credits")
        .select("project_name, verification_status", { count: "exact" })
        .eq("user_id", userId)
        .eq("verification_status", "verified")
        .order("year", { ascending: false })
        .limit(1),
    ])
      .then(([viewsRes, searchRes, creditsRes]) => {
        setViewsWeek(viewsRes.count ?? 0);
        setSearchAppearances(searchRes.count ?? 0);
        setVerifiedCredits(creditsRes.count ?? 0);
        setTopCredit(creditsRes.data?.[0]?.project_name || null);
      })
      .catch(() => {
        // Resilience: silently degrade — Hub should still render.
        setViewsWeek(0);
        setSearchAppearances(0);
      });
  }, [userId]);

  const firstName = profile?.full_name?.split(" ")[0] || "Creator";
  const ringPct = Math.max(0, Math.min(100, score));

  // SVG ring
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (ringPct / 100) * circumference;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className={cn(
          "relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm",
          className
        )}
      >
        {/* Top: identity + strength ring */}
        <div className="relative bg-gradient-to-br from-primary/10 via-card to-energy/5 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            {/* Avatar with strength ring */}
            <div className="relative shrink-0">
              <svg className="absolute inset-0 -rotate-90" width="68" height="68" viewBox="0 0 68 68">
                <circle
                  cx="34" cy="34" r={radius}
                  className="stroke-muted"
                  strokeWidth="4"
                  fill="none"
                />
                <circle
                  cx="34" cy="34" r={radius}
                  className={cn(
                    "transition-all duration-700",
                    ringPct >= 80 ? "stroke-energy" : "stroke-primary"
                  )}
                  strokeWidth="4"
                  fill="none"
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                  strokeLinecap="round"
                />
              </svg>
              <Avatar className="h-[68px] w-[68px] m-0 p-1.5">
                <AvatarImage src={profile?.avatar_url || ""} className="rounded-full" />
                <AvatarFallback className="bg-primary/10 text-primary text-base font-bold rounded-full">
                  {firstName[0]}
                </AvatarFallback>
              </Avatar>
              <span className="absolute -bottom-0.5 -right-0.5 px-1.5 py-0 rounded-full bg-foreground text-background text-[10px] font-black tabular-nums shadow">
                {ringPct}%
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="text-base font-bold text-foreground truncate">{profile?.full_name || firstName}</h2>
                {profile?.verification_status === "verified" && (
                  <ShieldCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">{profile?.role || "Creative Professional"}</p>

              <div className="mt-2 flex flex-wrap gap-1.5">
                <Link
                  to={`/profile/${userId}`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/60 hover:bg-muted text-[10px] font-semibold text-foreground transition-colors"
                >
                  <ExternalLink className="h-2.5 w-2.5" /> View public profile
                </Link>
                {nextItem && ringPct < 100 && (
                  <Link
                    to="/profile"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-energy/15 hover:bg-energy/25 text-[10px] font-semibold text-energy-foreground/90 dark:text-energy transition-colors"
                  >
                    <Sparkles className="h-2.5 w-2.5" /> Add {nextItem.label.toLowerCase()}
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Primary share CTA */}
          <Button
            variant="hero"
            className="w-full mt-4 h-11"
            onClick={() => setShareOpen(true)}
          >
            <Share2 className="h-4 w-4" />
            Share my profile
          </Button>

          {/* Creator Passport — unique verified identity */}
          {profile?.icdb_creator_id && (
            <div className="mt-3 rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-3">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[9px] uppercase tracking-wider font-bold text-primary flex items-center gap-1">
                  <ShieldCheck className="h-2.5 w-2.5" /> Creator Passport
                </p>
                <Link to="/credits" className="text-[9px] font-semibold text-primary/80 hover:text-primary flex items-center gap-0.5">
                  Manage <ArrowRight className="h-2 w-2" />
                </Link>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                  <Fingerprint className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-mono font-bold text-sm text-foreground tracking-wide truncate">
                    {profile.icdb_creator_id}
                  </p>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    Your verified ID — unique to you, embed anywhere.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 shrink-0"
                  onClick={() => {
                    navigator.clipboard.writeText(profile.icdb_creator_id);
                    toast.success("Creator Passport ID copied");
                  }}
                  aria-label="Copy Creator Passport"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Today / Reach panel */}
        <div className="border-t border-border bg-background/40 px-2 py-2">
          <div className="flex items-center justify-between px-2 pb-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> Your reach (7d)
            </p>
            <Link to="/profile" className="text-[10px] font-semibold text-primary hover:underline flex items-center gap-0.5">
              Details <ArrowRight className="h-2.5 w-2.5" />
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-1">
            <ReachStat
              icon={Eye}
              label="Profile views"
              value={viewsWeek}
              color="text-primary"
              to="/profile"
            />
            <ReachStat
              icon={Search}
              label="Search hits"
              value={searchAppearances}
              color="text-accent"
              to="/profile"
            />
            <ReachStat
              icon={ShieldCheck}
              label="Verified"
              value={creditsCount > 0 ? `${verificationRate}%` : "—"}
              color="text-success"
              to="/credits"
            />
          </div>
        </div>
      </motion.div>

      <ProfileShareModal
        open={shareOpen}
        onOpenChange={setShareOpen}
        userId={userId}
        fullName={profile?.full_name || firstName}
        role={profile?.role}
        avatarUrl={profile?.avatar_url}
        topCredit={topCredit}
        creditsCount={creditsCount}
      />
    </>
  );
};

interface ReachStatProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string | null;
  color: string;
  to: string;
}

const ReachStat = ({ icon: Icon, label, value, color, to }: ReachStatProps) => (
  <Link
    to={to}
    className="flex flex-col items-center justify-center gap-0.5 px-2 py-2 rounded-lg hover:bg-muted/40 transition-colors text-center"
  >
    <Icon className={cn("h-3.5 w-3.5 opacity-70", color)} />
    <span className="text-sm font-bold text-foreground tabular-nums leading-tight">
      {value === null ? "…" : value}
    </span>
    <span className="text-[9px] text-muted-foreground font-medium leading-tight">{label}</span>
  </Link>
);
