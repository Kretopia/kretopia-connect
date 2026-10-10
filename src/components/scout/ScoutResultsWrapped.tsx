import type { ReactNode } from "react";

import { KretoScene } from "@/components/brand/KretoScene";
import { WrappedShell } from "@/components/wrapped/WrappedShell";
import { WrappedStatus } from "@/components/wrapped/WrappedStatus";
import { useScoutScan } from "./scoutScanContext";

interface ScoutResultsWrappedProps {
  /** The section switcher, the results and Kreto's panel: everything under the top section. */
  children: ReactNode;
}

/**
 * The bottom of Scout on one Wrapped surface, the same frame as the top
 * section above it and as Today's Radar and Studio: the section switcher,
 * the list and Kreto's panel live inside it instead of loose on the page.
 * It states two numbers it can count (gigs on the list, gigs saved) and
 * carries the Kretopia lockup at its foot.
 */
export function ScoutResultsWrapped({ children }: ScoutResultsWrappedProps) {
  const { gigs, progress, loading, listError } = useScoutScan();
  const saved = progress.saved;

  const label = listError
    ? "Couldn't load your list"
    : loading
      ? "Loading your list…"
      : gigs.length === 0
        ? "Nothing on your list yet"
        : `${gigs.length} gig${gigs.length === 1 ? "" : "s"} on your list`;

  return (
    <WrappedShell
      titleId="scout-results-title"
      eyebrow="Kretopia · Scout"
      title={
        <>
          Your <span className="k-gradient-text">opportunities</span>
        </>
      }
      status={
        <WrappedStatus
          active={!listError && gigs.length > 0}
          label={label}
          detail={saved > 0 ? <>· {saved} saved</> : null}
        />
      }
      aside={<KretoScene scene="talent-search" size="thumb" className="hidden h-16 w-32 shrink-0 rounded-xl border border-border sm:block" />}
    >
      {children}
    </WrappedShell>
  );
}

export default ScoutResultsWrapped;
