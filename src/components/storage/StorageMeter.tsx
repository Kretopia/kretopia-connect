import { Link } from "react-router-dom";
import { HardDrive, ArrowUpCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useStorageQuota } from "@/hooks/useStorageQuota";
import { formatBytes, TIER_LABELS } from "@/lib/fileSizeLimits";

type Variant = "card" | "compact" | "inline";

interface Props {
  variant?: Variant;
  className?: string;
  showUpgrade?: boolean;
}

const TIER_NEXT: Record<string, { label: string; total: string }> = {
  free: { label: "Creator", total: "25 GB" },
  pro: { label: "Creator+", total: "100 GB" },
  creator_pro: { label: "Founder Circle", total: "1 TB" },
};

/**
 * Unified storage indicator. Used in: hamburger menu, vault sidebar,
 * settings page, profile. Single source of truth via useStorageQuota.
 */
export function StorageMeter({ variant = "card", className, showUpgrade = true }: Props) {
  const { data: quota, isLoading } = useStorageQuota();
  if (isLoading || !quota) return null;

  const { used, limit, pct, tier, isNearLimit, isCritical, isFull } = quota;
  const next = TIER_NEXT[tier];
  const meterColor = isCritical
    ? "[&>div]:bg-destructive"
    : isNearLimit
    ? "[&>div]:bg-amber-500"
    : "";

  if (variant === "inline") {
    return (
      <div className={cn("flex items-center gap-2 text-xs", className)}>
        <HardDrive className="h-3.5 w-3.5 text-muted-foreground" />
        <span className={cn("tabular-nums", isCritical && "text-destructive font-medium")}>
          {formatBytes(used)} / {formatBytes(limit)}
        </span>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className={cn("space-y-1.5", className)}>
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <HardDrive className="h-3.5 w-3.5" />
            <span>Storage</span>
          </div>
          <span className={cn("tabular-nums", isCritical && "text-destructive font-medium")}>
            {formatBytes(used)} / {formatBytes(limit)}
          </span>
        </div>
        <Progress value={pct} className={cn("h-1.5", meterColor)} />
        {isFull && showUpgrade && next && (
          <Link to="/pricing" className="block text-[11px] text-primary hover:underline">
            Storage full → upgrade to {next.label}
          </Link>
        )}
      </div>
    );
  }

  // card variant (full)
  return (
    <div className={cn("rounded-xl border bg-card p-4 space-y-3", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HardDrive className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Storage</h3>
        </div>
        <span className="text-xs text-muted-foreground">{TIER_LABELS[tier] || tier}</span>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className={cn(isCritical && "text-destructive font-medium", isNearLimit && !isCritical && "text-amber-600 font-medium")}>
            {formatBytes(used)} used
          </span>
          <span className="text-muted-foreground">{formatBytes(limit)} total</span>
        </div>
        <Progress value={pct} className={meterColor} />
        <p className="text-[11px] text-muted-foreground">
          {pct.toFixed(0)}% of your storage in use. Includes project files, portfolio, EPK media, event photos and attachments.
        </p>
      </div>

      {(isNearLimit || isFull) && showUpgrade && next && (
        <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 space-y-2">
          <p className="text-xs font-medium">
            {isFull ? "You're out of storage" : "Running low on space"}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Upgrade to {next.label} for {next.total} of total storage.
          </p>
          <Button asChild size="sm" className="w-full h-8 text-xs">
            <Link to="/pricing">
              <ArrowUpCircle className="h-3.5 w-3.5 mr-1.5" />
              Upgrade plan
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
