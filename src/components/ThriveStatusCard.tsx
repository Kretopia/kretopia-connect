import { type StatusResult, getAllTiers, getTierIndex } from "@/lib/statusEngine";
import { Shield, Zap, Award, Star, Crown, Sparkles, Lock, ChevronRight, Users, Briefcase, MessageCircle, TrendingUp, Trophy, Newspaper } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

const TIER_ICONS = {
  hobbyist: Shield,
  freelancer: Zap,
  thriver: Award,
  professional: Star,
  celebrity: Crown,
  icon: Sparkles,
};

const CATEGORY_ICONS = {
  credits: Award,
  network: Users,
  accelerators: Trophy,
};

interface ThriveStatusCardProps {
  status: StatusResult;
  className?: string;
}

export function ThriveStatusCard({ status, className }: ThriveStatusCardProps) {
  const allTiers = getAllTiers();
  const currentIdx = status.tierIndex;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Current Status Header */}
      <Card className={cn(
        "relative overflow-hidden border p-5",
        "bg-gradient-to-br",
        status.gradient,
      )}>
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: `repeating-linear-gradient(45deg, currentColor 0px, currentColor 1px, transparent 1px, transparent 10px)`,
        }} />

        <div className="relative flex items-center gap-4">
          {/* Status Ring */}
          <div className={cn(
            "relative h-16 w-16 rounded-full flex items-center justify-center shrink-0",
            status.ringClass,
            status.tier === "icon" && "animate-pulse",
          )}>
            <div className={cn(
              "h-12 w-12 rounded-full flex items-center justify-center",
              "bg-gradient-to-br",
              status.gradient,
            )}>
              {(() => {
                const Icon = TIER_ICONS[status.tier];
                return <Icon className={cn("h-6 w-6", status.color)} />;
              })()}
            </div>
            {status.tier === "icon" && (
              <div className="absolute -inset-1 rounded-full bg-primary/20 blur-md -z-10" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-medium">
              ThriveStatus
            </p>
            <h3 className={cn("text-xl font-bold", status.color)}>
              {status.combinedLabel}
            </h3>
            {status.socialProofLabel && (
              <span className={cn(
                "inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1",
                "bg-gradient-to-r",
                status.gradient,
                status.color,
              )}>
                {status.socialProofLabel}
              </span>
            )}
          </div>
        </div>

        {/* Powered By */}
        <div className="relative mt-4 pt-3 border-t border-border/30">
          <p className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground font-semibold mb-2">
            Powered by
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {status.metrics.verifiedCredits > 0 && (
              <MetricChip icon={Award} label={`${status.metrics.verifiedCredits} Verified Credits`} />
            )}
            {status.metrics.endorsementCount > 0 && (
              <MetricChip icon={Shield} label={`${status.metrics.endorsementCount} Endorsements`} />
            )}
            {status.metrics.awardCount > 0 && (
              <MetricChip icon={Trophy} label={`${status.metrics.awardCount} Awards`} />
            )}
            {status.metrics.pressCount > 0 && (
              <MetricChip icon={Newspaper} label={`${status.metrics.pressCount} Press`} />
            )}
            {status.metrics.connections > 0 && (
              <MetricChip icon={Users} label={`${status.metrics.connections} Connections`} />
            )}
            {status.metrics.reviewCount > 0 && (
              <MetricChip icon={MessageCircle} label={`${status.metrics.reviewCount} Reviews`} />
            )}
            {status.metrics.verifiedCredits === 0 && status.metrics.totalCredits === 0 && (
              <span className="text-[10px] text-muted-foreground italic">
                Add verified work to build your reputation
              </span>
            )}
          </div>
        </div>

        {/* Network Role Badge */}
        {status.networkRole !== "spark" && (
          <div className="relative mt-3 flex items-center gap-1.5">
            <Users className="h-3 w-3 text-accent" />
            <span className="text-[10px] font-semibold text-accent">
              {status.networkRoleLabel}
            </span>
          </div>
        )}
      </Card>

      {/* Actionable Progress */}
      {status.progress.length > 0 && status.nextTier && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-3.5 w-3.5 text-accent" />
            <p className="text-xs font-semibold">
              Progress to {status.nextTier.charAt(0).toUpperCase() + status.nextTier.slice(1)}
            </p>
          </div>
          <div className="space-y-2">
            {status.progress.map((item) => {
              const Icon = CATEGORY_ICONS[item.category];
              const remaining = item.needed - item.current;
              return (
                <div key={item.label} className="flex items-center gap-2.5">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-foreground">{item.label}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {item.current}/{item.needed}
                      </span>
                    </div>
                    <div className="h-1 bg-muted rounded-full mt-1 overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full transition-all"
                        style={{ width: `${Math.min(100, (item.current / item.needed) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-[10px] font-medium text-accent shrink-0">
                    +{remaining}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Tier Ladder */}
      <Card className="p-4 space-y-2">
        <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">
          Career Ladder
        </p>
        <div className="space-y-0.5">
          {allTiers.map((tierData, idx) => {
            const Icon = TIER_ICONS[tierData.tier];
            const isCurrentOrBelow = idx <= currentIdx;
            const isCurrent = idx === currentIdx;
            const isLocked = idx > currentIdx;

            return (
              <div
                key={tierData.tier}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                  isCurrent && "bg-gradient-to-r border",
                  isCurrent && tierData.gradient,
                  !isCurrent && isCurrentOrBelow && "opacity-60",
                  isLocked && "opacity-40",
                )}
              >
                <div className={cn(
                  "h-7 w-7 rounded-full flex items-center justify-center shrink-0",
                  isCurrent ? tierData.ringClass : "ring-1 ring-border",
                )}>
                  {isLocked ? (
                    <Lock className="h-3 w-3 text-muted-foreground" />
                  ) : (
                    <Icon className={cn("h-3.5 w-3.5", isCurrent ? tierData.color : "text-muted-foreground")} />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-xs font-semibold",
                    isCurrent ? tierData.color : "text-muted-foreground",
                  )}>
                    {tierData.label}
                  </p>
                  {tierData.socialProofLabel && (
                    <p className="text-[9px] text-muted-foreground truncate">
                      {tierData.socialProofLabel}
                    </p>
                  )}
                </div>

                {isCurrent && (
                  <ChevronRight className={cn("h-3 w-3 shrink-0", tierData.color)} />
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Current Perks */}
      <Card className="p-4 space-y-2">
        <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">
          Your Perks
        </p>
        <div className="flex flex-wrap gap-1.5">
          {status.perks.map(perk => (
            <span
              key={perk}
              className="text-[10px] px-2 py-0.5 rounded-full border bg-card text-muted-foreground"
            >
              {perk}
            </span>
          ))}
        </div>
      </Card>
    </div>
  );
}

function MetricChip({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <Icon className="h-3 w-3 text-muted-foreground" />
      <span className="text-[10px] text-foreground font-medium">{label}</span>
    </div>
  );
}
