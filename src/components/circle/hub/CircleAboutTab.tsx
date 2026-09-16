import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Crown, ShieldCheck, Calendar, Lock, Globe } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface AboutProps {
  circle: any;
  leaderProfile?: { full_name?: string; avatar_url?: string; bio?: string } | null;
  memberCount: number;
}

export function CircleAboutTab({ circle, leaderProfile, memberCount }: AboutProps) {
  const navigate = useNavigate();
  const created = circle.created_at ? new Date(circle.created_at) : null;

  return (
    <div className="space-y-5 px-4 pb-8">
      {/* Description */}
      <section>
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">About</h2>
        <p className="text-sm leading-relaxed whitespace-pre-line">
          {circle.description || (
            <span className="text-muted-foreground italic">No description yet.</span>
          )}
        </p>
      </section>

      {/* Leader card */}
      {leaderProfile && (
        <section>
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Circle Leader</h2>
          <button
            onClick={() => circle.created_by && navigate(`/profile/${circle.created_by}`)}
            className="w-full flex items-start gap-3 p-3 rounded-xl border border-border/50 bg-card hover:border-primary/30 transition-all text-left"
          >
            <Avatar className="h-12 w-12 border-2 border-accent/30">
              <AvatarImage src={leaderProfile.avatar_url || ""} />
              <AvatarFallback className="bg-primary/10 text-primary font-bold">
                {(leaderProfile.full_name || "?")[0]}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="font-semibold text-sm truncate">{leaderProfile.full_name || "Unknown"}</p>
                <Crown className="h-3.5 w-3.5 text-accent shrink-0" />
              </div>
              {leaderProfile.bio && (
                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{leaderProfile.bio}</p>
              )}
            </div>
          </button>
        </section>
      )}

      {/* Rules */}
      {circle.rules && (
        <section>
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Community Guidelines</h2>
          <div className="p-4 rounded-xl border border-border/50 bg-card/50">
            <p className="text-sm whitespace-pre-line leading-relaxed">{circle.rules}</p>
          </div>
        </section>
      )}

      {/* Quick facts */}
      <section>
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Details</h2>
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 rounded-lg bg-card/50 border border-border/50 text-sm">
            <span className="text-muted-foreground flex items-center gap-2">
              {circle.is_private ? <Lock className="h-3.5 w-3.5" /> : <Globe className="h-3.5 w-3.5" />}
              Visibility
            </span>
            <span className="font-medium">{circle.is_private ? "Private" : "Public"}</span>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-card/50 border border-border/50 text-sm">
            <span className="text-muted-foreground">Members</span>
            <span className="font-medium">{memberCount.toLocaleString()}</span>
          </div>
          {circle.category && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-card/50 border border-border/50 text-sm">
              <span className="text-muted-foreground">Category</span>
              <Badge variant="secondary" className="capitalize">{circle.category}</Badge>
            </div>
          )}
          {circle.is_verified && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-accent/5 border border-accent/30 text-sm">
              <span className="text-muted-foreground flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 text-accent" />
                Status
              </span>
              <span className="font-semibold text-accent">Verified Circle</span>
            </div>
          )}
          {created && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-card/50 border border-border/50 text-sm">
              <span className="text-muted-foreground flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5" />
                Created
              </span>
              <span className="font-medium">
                {created.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
              </span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
