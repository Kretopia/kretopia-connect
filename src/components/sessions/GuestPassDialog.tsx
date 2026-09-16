import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { EventPassCard } from "./EventPassCard";

interface GuestPassDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  eventTitle: string;
  startTime: string;
  venueName?: string | null;
  userId: string;
  guestName?: string | null;
}

/**
 * Boarding-pass style screen guests show at the door — full Kretopia
 * branding (see EventPassCard), the same card everywhere a pass appears.
 */
export const GuestPassDialog = ({
  open,
  onOpenChange,
  eventId,
  eventTitle,
  startTime,
  venueName,
  userId,
  guestName,
}: GuestPassDialogProps) => {
  const [token, setToken] = useState<string | null>(null);
  const [checkedIn, setCheckedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [{ data: tokenData }, { data: statusData }] = await Promise.all([
          supabase.rpc("get_my_check_in_token", { _jam_id: eventId }),
          supabase
            .from("jam_participants")
            .select("checked_in_at")
            .eq("jam_id", eventId)
            .eq("user_id", userId)
            .maybeSingle(),
        ]);
        if (cancelled) return;
        setToken((tokenData as string | null) || null);
        setCheckedIn(!!statusData?.checked_in_at);
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, eventId, userId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-0 overflow-hidden border-0 bg-transparent shadow-none">
        <DialogHeader className="sr-only">
          <DialogTitle>Your event pass</DialogTitle>
        </DialogHeader>

        <EventPassCard
          eventTitle={eventTitle}
          guestName={guestName}
          startTime={startTime}
          venueName={venueName}
          token={token}
          loading={loading}
          checkedIn={checkedIn}
        />

        <Button variant="outline" className="w-full mt-3" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      </DialogContent>
    </Dialog>
  );
};
