import { useId } from "react";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { Button } from "@/components/ui/button";

interface EventBookingActionsProps {
  label: string;
  priceLabel: string | null;
  goingLabel: string;
  reason: string | null;
  disabled: boolean;
  joining: boolean;
  onBook: () => void;
  compact?: boolean;
  responsive?: boolean;
}

export function EventBookingActions({
  label,
  priceLabel,
  goingLabel,
  reason,
  disabled,
  joining,
  onBook,
  compact = false,
  responsive = false,
}: EventBookingActionsProps) {
  const reasonId = useId();
  const isCompact = compact || responsive;
  const containerClass = responsive
    ? "flex flex-wrap items-center gap-3 lg:block lg:space-y-4"
    : compact ? "flex flex-wrap items-center gap-3" : "space-y-4";

  return (
    <div className={containerClass}>
      {!isCompact && (
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Admission</p>
            <p className="mt-1 text-xl font-semibold">{priceLabel || "Free"}</p>
          </div>
          <p className="pt-1 text-sm text-muted-foreground">{goingLabel}</p>
        </div>
      )}
      {isCompact && (
        <div className={responsive ? "min-w-0 flex-1 lg:flex lg:items-start lg:justify-between lg:gap-4" : "min-w-0 flex-1"}>
          <div>
            <p className={responsive ? "text-sm font-semibold lg:text-xs lg:uppercase lg:tracking-wide lg:text-muted-foreground" : "font-semibold"}>
              {responsive ? <><span className="lg:hidden">{priceLabel || "Free"}</span><span className="hidden lg:inline">Admission</span></> : priceLabel || "Free"}
            </p>
            {responsive && <p className="hidden text-xl font-semibold lg:mt-1 lg:block">{priceLabel || "Free"}</p>}
            <p className={responsive ? "truncate text-xs text-muted-foreground" : "text-xs text-muted-foreground"}>{goingLabel}</p>
          </div>
        </div>
      )}
      <div className={responsive ? "shrink-0 lg:block" : compact ? "shrink-0" : undefined}>
        <Button
          type="button"
          className={responsive ? "min-w-24 lg:w-full" : compact ? "min-w-24" : "w-full"}
          disabled={disabled || joining}
          onClick={onBook}
          aria-describedby={reason ? reasonId : undefined}
        >
          {joining ? <KretopiaSpinner className="h-4 w-4" /> : label}
        </Button>
      </div>
      {reason && (
        <p id={reasonId} className={isCompact ? "w-full basis-full text-xs text-muted-foreground lg:text-sm" : "text-sm text-muted-foreground"} role="status">{reason}</p>
      )}
    </div>
  );
}
