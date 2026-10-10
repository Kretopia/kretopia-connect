import { ListChecks } from "lucide-react";

import { cn } from "@/lib/utils";
import { scoutEvidence, scoutUnknowns, type ScoutEvidenceInput } from "@/lib/scoutEvidence";

interface ScoutEvidenceProps {
  gig: ScoutEvidenceInput;
  /** Card use: at most three lines of text, the dialog shows it whole. */
  compact?: boolean;
  className?: string;
}

/**
 * The reason a gig is on the list, as evidence rather than a verdict: what
 * Scout matched, in the words the scan stored, without the date that went stale
 * and without a score. Under it, in plain words, what the listing did not say.
 * Renders nothing when there is neither.
 */
export function ScoutEvidence({ gig, compact = false, className }: ScoutEvidenceProps) {
  const evidence = scoutEvidence(gig);
  const unknowns = scoutUnknowns(gig);
  if (!evidence && unknowns.length === 0) return null;

  return (
    <div className={cn("rounded-lg border border-border bg-muted/30 px-2.5 py-2", className)}>
      {evidence && (
        <>
          <p className="mb-0.5 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
            <ListChecks className="h-2.5 w-2.5" aria-hidden />
            Relevant evidence
          </p>
          <p className={cn("text-[11px] leading-snug text-foreground/80", compact && "line-clamp-3")}>
            {evidence.lines.join(" · ")}
          </p>
          {evidence.summarised && (
            <p className="mt-1 text-[10px] leading-snug text-muted-foreground">Summarised from the listing. Check the source before you pitch.</p>
          )}
        </>
      )}
      {unknowns.length > 0 && (
        <p className={cn("text-[10px] leading-snug text-muted-foreground", evidence && "mt-1.5")}>
          <span className="font-semibold text-foreground/70">Not stated:</span> {unknowns.join(", ")}
        </p>
      )}
    </div>
  );
}

export default ScoutEvidence;
