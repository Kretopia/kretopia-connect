import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { DialogBrandHeader } from "@/components/ui/dialogBrand";
import { DIALOG_BODY } from "@/components/ui/dialogBrand.tokens";
import { downloadIcs } from "@/lib/eventActions";
import { APP_URL } from "@/lib/constants";
import { formatEventTime } from "@/lib/eventTime";

interface EventRsvpSuccessDialogProps {
  successSequence: number;
  event: {
    id: string;
    title: string;
    description?: string | null;
    start_time: string;
    end_time?: string | null;
    venue_name?: string | null;
    venue_address?: string | null;
  };
}

export function EventRsvpSuccessDialog({ successSequence, event }: EventRsvpSuccessDialogProps) {
  const [open, setOpen] = useState(false);
  const lastShown = useRef(0);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (successSequence > lastShown.current) {
      lastShown.current = successSequence;
      const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      returnFocus.current = activeElement && activeElement !== document.body && !activeElement.closest('[role="dialog"]')
        ? activeElement
        : document.getElementById("event-title");
      setOpen(true);
    }
  }, [successSequence]);

  const addToCalendar = () => downloadIcs({
    id: event.id,
    title: event.title,
    description: event.description,
    startTime: event.start_time,
    endTime: event.end_time,
    venueName: event.venue_name,
    venueAddress: event.venue_address,
    url: `${APP_URL}/event/${event.id}`,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        brand
        className="max-w-md p-0"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocus.current?.focus();
        }}
      >
        <DialogBrandHeader title="You're in" description={`${event.title} · ${formatEventTime(event.start_time)} · local time`} />
        <div className={`space-y-4 ${DIALOG_BODY}`}>
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary" role="img" aria-label="Kreto mascot illustration placeholder">
            <Sparkles className="h-10 w-10" aria-hidden />
          </div>
          <p className="text-center text-sm text-muted-foreground">Your place is confirmed by the event service.</p>
          <p className="text-center font-semibold">{event.title}</p>
          <DialogFooter className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button type="button" variant="outline" onClick={addToCalendar}>Add to calendar</Button>
            <Button type="button" onClick={() => setOpen(false)}>Done</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
