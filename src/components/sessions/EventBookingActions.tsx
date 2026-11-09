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
}: EventBookingActionsProps) {
  const reasonId = useId();

  return (
    <div className={compact ? "flex flex-wrap items-center gap-3" : "space-y-4"}>
      {!compact && (
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Admission</p>
            <p className="mt-1 text-xl font-semibold">{priceLabel || "Free"}</p>
          </div>
          <p className="pt-1 text-sm text-muted-foreground">{goingLabel}</p>
        </div>
      )}
      {compact && <div className="min-w-0 flex-1"><p className="font-semibold">{priceLabel || "Free"}</p><p className="text-xs text-muted-foreground">{goingLabel}</p></div>}
      <div className={compact ? "shrink-0" : undefined}>
        <Button
          type="button"
          className={compact ? "min-w-24" : "w-full"}
          disabled={disabled || joining}
          onClick={onBook}
          aria-describedby={reason ? reasonId : undefined}
        >
          {joining ? <KretopiaSpinner className="h-4 w-4" /> : label}
        </Button>
      </div>
      {reason && (
        <p id={reasonId} className={compact ? "w-full basis-full text-xs text-muted-foreground" : "text-sm text-muted-foreground"} role="status">{reason}</p>
      )}
    </div>
  );
}
