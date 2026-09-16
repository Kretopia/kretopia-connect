import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CalendarIcon, Clock, DollarSign } from "lucide-react";
import type { CreativeLocation } from "./LocationListItem";

interface LocationBookingDialogProps {
  location: CreativeLocation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LocationBookingDialog({ location, open, onOpenChange }: LocationBookingDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [date, setDate] = useState<Date | undefined>();
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("12:00");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const calculateTotal = () => {
    if (!location.price_per_hour || !startTime || !endTime) return 0;
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    const hours = (eh + em / 60) - (sh + sm / 60);
    return Math.max(0, hours * Number(location.price_per_hour));
  };

  const handleSubmit = async () => {
    if (!user || !date) return;
    setSubmitting(true);
    try {
      const total = calculateTotal();
      const { error } = await supabase.from('location_bookings').insert({
        location_id: location.id,
        user_id: user.id,
        booking_date: date.toISOString().split('T')[0],
        start_time: startTime,
        end_time: endTime,
        message: message.trim() || null,
        total_price: total,
        currency: location.price_currency || 'USD',
      });
      if (error) throw error;
      toast({ title: "Booking request sent! 📅", description: "The spot owner will review your request." });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const total = calculateTotal();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary" />
            Book {location.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Date picker */}
          <div>
            <Label className="text-sm mb-1 block">Select Date</Label>
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              disabled={(d) => d < new Date()}
              className="rounded-md border mx-auto"
            />
          </div>

          {/* Time slots */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm mb-1 flex items-center gap-1">
                <Clock className="h-3 w-3" /> Start Time
              </Label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-sm mb-1 flex items-center gap-1">
                <Clock className="h-3 w-3" /> End Time
              </Label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          {/* Message */}
          <div>
            <Label className="text-sm mb-1 block">Message (optional)</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell the owner what you'll be using the space for..."
              rows={2}
              className="text-sm"
            />
          </div>

          {/* Price summary */}
          {total > 0 && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-medium">Estimated Total</span>
              </div>
              <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                ${total.toFixed(2)} {location.price_currency || 'USD'}
              </span>
            </div>
          )}

          <Button
            onClick={handleSubmit}
            disabled={!date || submitting}
            className="w-full"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Send Booking Request
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
