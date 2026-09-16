import { useState } from "react";
import { Calendar, Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface AvailabilityIndicatorProps {
  status?: string;
  note?: string;
  availableFrom?: string | null;
  isOwnProfile: boolean;
  onRefresh?: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; dotColor: string }> = {
  available: { label: "Available for work", color: "text-green-600", dotColor: "bg-green-500" },
  busy: { label: "Currently busy", color: "text-amber-600", dotColor: "bg-amber-500" },
  unavailable: { label: "Not available", color: "text-red-500", dotColor: "bg-red-500" },
  selective: { label: "Selectively available", color: "text-primary", dotColor: "bg-primary" },
};

export const AvailabilityIndicator = ({
  status = "available",
  note,
  availableFrom,
  isOwnProfile,
  onRefresh,
}: AvailabilityIndicatorProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [editStatus, setEditStatus] = useState(status);
  const [editNote, setEditNote] = useState(note || "");

  const config = STATUS_CONFIG[status] || STATUS_CONFIG.available;

  const handleSave = async () => {
    if (!user) return;
    try {
      await supabase
        .from("profiles")
        .update({
          availability_status: editStatus,
          availability_note: editNote || null,
        })
        .eq("user_id", user.id);
      toast({ title: "Availability updated!" });
      onRefresh?.();
    } catch {
      toast({ title: "Failed to update", variant: "destructive" });
    }
  };

  if (isOwnProfile) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border hover:border-primary/50 transition-all text-sm">
            <span className={cn("h-2.5 w-2.5 rounded-full animate-pulse", config.dotColor)} />
            <span className={cn("font-medium text-xs", config.color)}>{config.label}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3 space-y-3">
          <p className="text-xs font-semibold">Set Availability</p>
          <Select value={editStatus} onValueChange={setEditStatus}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                <SelectItem key={key} value={key} className="text-xs">
                  <div className="flex items-center gap-2">
                    <span className={cn("h-2 w-2 rounded-full", cfg.dotColor)} />
                    {cfg.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={editNote}
            onChange={(e) => setEditNote(e.target.value)}
            placeholder="e.g. Booking for April"
            className="h-8 text-xs"
          />
          <Button size="sm" onClick={handleSave} className="w-full h-7 text-xs">
            Save
          </Button>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className={cn("h-2.5 w-2.5 rounded-full", config.dotColor)} />
      <span className={cn("text-xs font-medium", config.color)}>{config.label}</span>
      {note && <span className="text-xs text-muted-foreground">· {note}</span>}
    </div>
  );
};
