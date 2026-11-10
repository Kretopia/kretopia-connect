import { Check } from "lucide-react";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EventBookingControl } from "@/lib/eventBookingState";

interface EventBookingCtaProps {
  control: EventBookingControl;
  joining: boolean;
  onBook: () => void;
  onCancel: () => void;
  /** The id of the line that says why the control cannot be used. */
  describedBy?: string;
  className?: string;
}

/**
 * The one booking control of the Event page, in every state. Where the viewer can act it is the page's single primary button
 * (data-booking-cta); everywhere else it is a status ("Going", "Sold out", "Ended"), never a second button of the same shape. Leaving an RSVP
 * is a quiet text action beside the "Going" status.
 */
export function EventBookingCta({ control, joining, onBook, onCancel, describedBy, className }: EventBookingCtaProps) {
  if (control.kind === "primary") {
    return (
      <Button
        type="button"
        size="lg"
        data-booking-cta="primary"
        className={cn("w-full", className)}
        disabled={!control.enabled || joining}
        onClick={onBook}
        aria-describedby={describedBy}
      >
        {joining ? <KretopiaSpinner className="h-4 w-4" /> : control.label}
      </Button>
    );
  }
  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <p
        data-booking-state={control.label}
        aria-describedby={describedBy}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-md border border-border bg-muted/40 px-4 text-sm font-semibold"
      >
        {control.cancellable && <Check className="h-4 w-4 text-primary" aria-hidden />}
        {control.label}
      </p>
      {control.cancellable && control.cancelLabel && (
        <Button type="button" variant="link" size="sm" className="h-8 text-destructive" disabled={joining} onClick={onCancel}>
          {joining ? <KretopiaSpinner className="h-3.5 w-3.5" /> : control.cancelLabel}
        </Button>
      )}
    </div>
  );
}

export default EventBookingCta;
