import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
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
      returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
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
        className="max-w-md rounded-2xl p-6"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocus.current?.focus();
        }}
      >
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary" role="img" aria-label="Kreto mascot illustration placeholder">
          <Sparkles className="h-10 w-10" aria-hidden />
        </div>
        <div className="space-y-2 text-center">
          <DialogTitle className="text-2xl font-bold">You're in</DialogTitle>
          <p className="font-semibold">{event.title}</p>
          <DialogDescription>{formatEventTime(event.start_time)} · local time</DialogDescription>
          <DialogDescription>Your place is confirmed by the event service.</DialogDescription>
        </div>
        <DialogFooter className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button type="button" variant="outline" onClick={addToCalendar}>Add to calendar</Button>
          <Button type="button" onClick={() => setOpen(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
