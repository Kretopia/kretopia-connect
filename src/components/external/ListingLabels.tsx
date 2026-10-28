import { listingLabels } from "../../../supabase/functions/_shared/discovery/labels";

/**
 * The honest labels of a discovered listing, the same words everywhere it shows: External or Kretopia, Unclaimed or
 * Claimed, when the source was last checked, and which source it came from. External is not registered, partnered,
 * verified or available.
 */
export function ListingLabels({ claimed, lastCheckedAt, sourceName, className = "" }: { claimed: boolean; lastCheckedAt: string | null; sourceName: string | null; className?: string }) {
  const l = listingLabels({ origin: "external", claimed, last_checked_at: lastCheckedAt, source_name: sourceName }, new Date());
  const pill = "rounded border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground";
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`} data-testid="listing-labels">
      <span className={pill}>{l.origin}</span>
      {l.ownership && <span className={pill}>{l.ownership}</span>}
      {l.lastChecked && <span className="text-[11px] text-muted-foreground">{l.lastChecked}</span>}
      {l.source && <span className="text-[11px] text-muted-foreground">{l.source}</span>}
    </div>
  );
}
