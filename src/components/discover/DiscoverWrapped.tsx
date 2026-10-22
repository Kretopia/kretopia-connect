import { WrappedShell } from "@/components/wrapped/WrappedShell";
import { WrappedSignals, type WrappedSignal } from "@/components/wrapped/WrappedSignals";
import { WrappedStatus } from "@/components/wrapped/WrappedStatus";

interface DiscoverWrappedProps {
  signals: WrappedSignal[];
}

/**
 * The top of Discover on the same Wrapped frame as Today's Radar and Scout's top section: what is on right now
 * across the four lanes, each number a way into its lane. It states only counts of rows that exist.
 */
export function DiscoverWrapped({ signals }: DiscoverWrappedProps) {
  const stages = signals.find((s) => s.id === "stages");
  const onAir = stages?.state === "ready" && stages.value > 0;
  const label =
    stages?.state === "error"
      ? "Couldn't check what's on"
      : stages?.state === "loading"
        ? "Checking what's on"
        : onAir
          ? `${stages.value} Stage${stages.value === 1 ? "" : "s"} on air`
          : "Nothing on air right now";

  return (
    <WrappedShell
      titleId="discover-wrapped-title"
      eyebrow="Kretopia · Discover"
      title={
        <>
          What's on <span className="k-gradient-text">right now</span>
        </>
      }
      status={<WrappedStatus active={onAir} label={label} />}
      brandFooter={false}
    >
      <WrappedSignals
        signals={signals}
        label="Discover signals"
        columnsClassName={signals.length === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"}
        compactOnMobile
      />
    </WrappedShell>
  );
}

export default DiscoverWrapped;
