import { Link } from "react-router-dom";
import { ArrowRight, Sparkles, ShieldAlert, TrendingDown, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Standing } from "@/lib/passport/standing";

interface Props {
  standing: Standing;
  className?: string;
}

/**
 * Home + Profile surface. Shows the user's current standing, the next
 * level, what unlocks there, and three highest-leverage next actions.
 * Hidden once the user is at the top level with no actions left.
 */
export const LevelUpCard = ({ standing, className }: Props) => {
  if (!standing.nextLevelTitle && standing.nextActions.length === 0 && !standing.gatedAt && !standing.decaying) {
    return null;
  }

  const nextUnlock = standing.unlocks[0];

  return (
    <Card className={`p-4 space-y-3 ${className ?? ""}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[hsl(var(--signal-amber))]" />
            <h3 className="text-sm font-semibold">Level up your Passport</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            You're a <span className="font-medium text-foreground">{standing.title}</span>
            {standing.nextLevelTitle && (
              <> — {100 - standing.progressPct}% to <span className="font-medium text-foreground">{standing.nextLevelTitle}</span></>
            )}.
          </p>
        </div>
      </div>

      {standing.nextLevelTitle && <Progress value={standing.progressPct} className="h-1.5" />}

      {/* Status banners — decay + verification gate */}
      {standing.decaying && (
        <div className="flex items-start gap-2 rounded-lg border border-[hsl(var(--signal-amber))]/30 bg-[hsl(var(--signal-amber))]/5 px-3 py-2 text-xs">
          <TrendingDown className="h-3.5 w-3.5 text-[hsl(var(--signal-amber))] shrink-0 mt-0.5" />
          <span className="text-muted-foreground">
            <span className="text-foreground font-medium">Slipping.</span>{" "}
            Add a recent credit or start a Studio to hold your standing.
          </span>
        </div>
      )}

      {standing.gatedAt && (
        <div className="flex items-start gap-2 rounded-lg border border-[hsl(var(--signal-teal))]/30 bg-[hsl(var(--signal-teal))]/5 px-3 py-2 text-xs">
          <ShieldAlert className="h-3.5 w-3.5 text-[hsl(var(--signal-teal))] shrink-0 mt-0.5" />
          <span className="text-muted-foreground">
            <span className="text-foreground font-medium">You qualify on score.</span>{" "}
            {standing.gateReason ?? "Finish verification to claim the badge"}.
          </span>
        </div>
      )}

      {/* Next-level unlock teaser */}
      {nextUnlock && (
        <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs">
          <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">
            Unlocks at <span className="text-foreground font-medium">{standing.nextLevelTitle}</span>: {nextUnlock.label}
          </span>
        </div>
      )}

      <ul className="space-y-1.5">
        {standing.nextActions.map((a) => (
          <li key={a.id}>
            <Link
              to={a.deeplink}
              className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
            >
              <span className="truncate">{a.label}</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
};
