import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck, Lock } from "lucide-react";
import { SurfaceProactiveCards } from "@/components/agent/SurfaceProactiveCards";
import { analytics } from "@/lib/analytics";
import { SectionCard } from "@/components/ui/section-card";
import type { Standing } from "@/lib/passport/standing";

interface Credit {
  verification_status?: string | null;
  endorsement_count?: number | null;
}

interface KretoActionCenterProps {
  credits: Credit[];
  standing: Standing;
  onReviewCredits: () => void;
  className?: string;
}

/**
 * Kreto Action Center — the ONE post-Passport block for "what should I do
 * next." Merges what used to be three separate mounts (PassportCommandCenter,
 * LevelUpCard's action list, LevelUpCard's decay/gate banners) into one
 * surface. Passport Strength itself now lives only on PassportHero — not
 * repeated here.
 */
export function KretoActionCenter({ credits, standing, onReviewCredits, className }: KretoActionCenterProps) {
  const unconfirmedCount = credits.filter(
    (c) => (c.endorsement_count || 0) === 0 && c.verification_status !== "verified",
  ).length;
  const nextUnlock = standing.unlocks[0];
  const hasAnything =
    unconfirmedCount > 0 || standing.decaying || !!standing.gatedAt || standing.nextActions.length > 0;

  return (
    <SectionCard title="Kreto Action Center" gap="2.5" className={className}>
      <SurfaceProactiveCards surface="passport" limit={2} className="px-0" />

      {unconfirmedCount > 0 && (
        <button
          type="button"
          onClick={() => { analytics.trustActionStarted('cosign'); onReviewCredits(); }}
          className="w-full flex items-start gap-3 rounded-xl border border-border/60 bg-background p-3.5 text-left hover:border-[hsl(var(--signal-teal))]/40 transition-colors"
        >
          <ShieldCheck className="h-4 w-4 text-[hsl(var(--signal-teal))] shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Turn claimed experience into trusted experience</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {unconfirmedCount} credit{unconfirmedCount === 1 ? "" : "s"} could use a Co-Sign from a collaborator.
            </p>
          </div>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
        </button>
      )}

      {nextUnlock && (
        <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs">
          <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">
            Unlocks at <span className="text-foreground font-medium">{standing.nextLevelTitle}</span>: {nextUnlock.label}
          </span>
        </div>
      )}

      {standing.nextActions.length > 0 && (
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
      )}

      {!hasAnything && (
        <p className="text-xs text-muted-foreground">You're all caught up — nothing needs attention right now.</p>
      )}
    </SectionCard>
  );
}

export default KretoActionCenter;
