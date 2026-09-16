import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { HardDrive, ArrowUpCircle, AlertTriangle, FileWarning } from "lucide-react";
import { useStorageQuota } from "@/hooks/useStorageQuota";
import { formatBytes, TIER_LABELS } from "@/lib/fileSizeLimits";
import { cn } from "@/lib/utils";

const TIER_NEXT: Record<string, { label: string; perFile: string; total: string; tier: string }> = {
  free:        { label: "Creator",        perFile: "2 GB",  total: "25 GB",  tier: "pro" },
  pro:         { label: "Creator+",       perFile: "10 GB", total: "100 GB", tier: "creator_pro" },
  creator_pro: { label: "Founder Circle", perFile: "25 GB", total: "1 TB",   tier: "founder" },
};

export type QuotaBlockReason =
  | { kind: "per_file"; fileName?: string; fileSize: number; perFileLimit: number }
  | { kind: "quota_full"; fileName?: string; fileSize: number; remaining: number };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason: QuotaBlockReason | null;
  onManageFiles?: () => void;
}

/**
 * User-friendly upload-blocked screen. Shows live quota meter, the reason
 * the upload was rejected, and a clear upgrade CTA based on the user's tier.
 */
export function QuotaExceededDialog({ open, onOpenChange, reason, onManageFiles }: Props) {
  const { data: quota } = useStorageQuota();
  const tier = quota?.tier ?? "free";
  const next = TIER_NEXT[tier];
  const isPerFile = reason?.kind === "per_file";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center">
            {isPerFile ? (
              <FileWarning className="h-6 w-6 text-amber-600" />
            ) : (
              <AlertTriangle className="h-6 w-6 text-amber-600" />
            )}
          </div>
          <DialogTitle className="text-center">
            {isPerFile ? "This file is too big" : "You're out of storage"}
          </DialogTitle>
          <DialogDescription className="text-center">
            {reason?.kind === "per_file" && (
              <>
                {reason.fileName ? <span className="font-medium text-foreground">{reason.fileName}</span> : "This file"}{" "}
                is <span className="font-medium text-foreground">{formatBytes(reason.fileSize)}</span>, but your{" "}
                <span className="font-medium text-foreground">{TIER_LABELS[tier] ?? tier}</span> plan allows up to{" "}
                <span className="font-medium text-foreground">{formatBytes(reason.perFileLimit)}</span> per file.
              </>
            )}
            {reason?.kind === "quota_full" && (
              <>
                {reason.fileName ? <span className="font-medium text-foreground">{reason.fileName}</span> : "This upload"}{" "}
                needs <span className="font-medium text-foreground">{formatBytes(reason.fileSize)}</span>, but only{" "}
                <span className="font-medium text-foreground">{formatBytes(reason.remaining)}</span> is left in your plan.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {quota && (
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <HardDrive className="h-3.5 w-3.5" />
                <span>Your storage</span>
              </div>
              <span className={cn("tabular-nums", quota.isCritical && "text-destructive font-medium")}>
                {formatBytes(quota.used)} / {formatBytes(quota.limit)}
              </span>
            </div>
            <Progress
              value={quota.pct}
              className={cn("h-1.5", quota.isCritical ? "[&>div]:bg-destructive" : quota.isNearLimit && "[&>div]:bg-amber-500")}
            />
            <p className="text-[11px] text-muted-foreground">
              {formatBytes(quota.remaining)} remaining · {TIER_LABELS[tier] ?? tier}
            </p>
          </div>
        )}

        {next && (
          <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 space-y-1">
            <p className="text-sm font-medium">Upgrade to {next.label}</p>
            <p className="text-xs text-muted-foreground">
              Get up to <span className="font-medium text-foreground">{next.perFile}</span> per file and{" "}
              <span className="font-medium text-foreground">{next.total}</span> of total storage.
            </p>
          </div>
        )}

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          {onManageFiles && (
            <Button variant="outline" onClick={() => { onManageFiles(); onOpenChange(false); }} className="sm:flex-1">
              Free up space
            </Button>
          )}
          {next ? (
            <Button asChild className="sm:flex-1">
              <Link to="/pricing" onClick={() => onOpenChange(false)}>
                <ArrowUpCircle className="h-4 w-4 mr-1.5" />
                Upgrade plan
              </Link>
            </Button>
          ) : (
            <Button onClick={() => onOpenChange(false)} className="sm:flex-1">
              Got it
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Helper: derives a QuotaBlockReason from a file + sizeLimit context.
 * Returns null if the file is allowed.
 */
export function deriveQuotaReason(
  file: { name?: string; size: number },
  perFileLimit: number,
  remaining: number | undefined,
): QuotaBlockReason | null {
  if (file.size > perFileLimit) {
    return { kind: "per_file", fileName: file.name, fileSize: file.size, perFileLimit };
  }
  if (remaining !== undefined && file.size > remaining) {
    return { kind: "quota_full", fileName: file.name, fileSize: file.size, remaining };
  }
  return null;
}
