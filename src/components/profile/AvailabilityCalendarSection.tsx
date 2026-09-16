import { useEffect, useMemo, useState } from "react";
import { format, parseISO, isWithinInterval, startOfDay } from "date-fns";
import { CalendarDays, Plus, Trash2, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type BlockType = "booked" | "hold" | "unavailable";

interface AvailabilityBlock {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  block_type: BlockType;
  label: string | null;
  is_public: boolean;
}

const TYPE_META: Record<BlockType, { label: string; dot: string; chip: string }> = {
  booked:      { label: "Booked",      dot: "bg-rose-500",   chip: "bg-rose-500/15 text-rose-300 border-rose-500/30" },
  hold:        { label: "On Hold",     dot: "bg-amber-500",  chip: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  unavailable: { label: "Unavailable", dot: "bg-zinc-500",   chip: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30" },
};

interface Props {
  userId: string;
  isOwner: boolean;
}

export const AvailabilityCalendarSection = ({ userId, isOwner }: Props) => {
  const { toast } = useToast();
  const [blocks, setBlocks] = useState<AvailabilityBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Editor state
  const [range, setRange] = useState<DateRange | undefined>();
  const [blockType, setBlockType] = useState<BlockType>("booked");
  const [label, setLabel] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadBlocks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("creator_availability_blocks")
      .select("*")
      .eq("user_id", userId)
      .gte("end_date", new Date().toISOString().split("T")[0])
      .order("start_date", { ascending: true });

    if (!error && data) setBlocks(data as AvailabilityBlock[]);
    setLoading(false);
  };

  useEffect(() => {
    loadBlocks();
  }, [userId]);

  const blockedDateMatchers = useMemo(() => {
    return blocks.map((b) => ({
      from: parseISO(b.start_date),
      to: parseISO(b.end_date),
    }));
  }, [blocks]);

  const getBlockForDate = (d: Date): AvailabilityBlock | undefined => {
    const day = startOfDay(d);
    return blocks.find((b) =>
      isWithinInterval(day, { start: parseISO(b.start_date), end: parseISO(b.end_date) })
    );
  };

  const handleSave = async () => {
    if (!range?.from || !range?.to) {
      toast({ title: "Pick a date range", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("creator_availability_blocks").insert({
      user_id: userId,
      start_date: format(range.from, "yyyy-MM-dd"),
      end_date: format(range.to, "yyyy-MM-dd"),
      block_type: blockType,
      label: label.trim() || null,
      is_public: isPublic,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Failed to save", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Availability updated" });
    setRange(undefined);
    setLabel("");
    setBlockType("booked");
    setIsPublic(true);
    setDialogOpen(false);
    loadBlocks();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("creator_availability_blocks").delete().eq("id", id);
    if (error) {
      toast({ title: "Failed to remove", variant: "destructive" });
      return;
    }
    toast({ title: "Block removed" });
    loadBlocks();
  };

  // Public visitors: hide section if no public blocks AND not owner
  const visibleBlocks = isOwner ? blocks : blocks.filter((b) => b.is_public);
  if (!isOwner && !loading && visibleBlocks.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center">
            <CalendarDays className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-tight">Availability</h3>
            <p className="text-[11px] text-muted-foreground">
              {isOwner ? "Mark booked or unavailable windows" : "Booked & unavailable dates"}
            </p>
          </div>
        </div>

        {isOwner && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-8">
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Block availability</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="rounded-xl border border-border p-2">
                  <Calendar
                    mode="range"
                    selected={range}
                    onSelect={setRange}
                    numberOfMonths={1}
                    disabled={{ before: new Date() }}
                    className={cn("p-2 pointer-events-auto")}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Type</Label>
                    <Select value={blockType} onValueChange={(v) => setBlockType(v as BlockType)}>
                      <SelectTrigger className="h-9 mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(TYPE_META) as BlockType[]).map((k) => (
                          <SelectItem key={k} value={k}>
                            <div className="flex items-center gap-2">
                              <span className={cn("h-2 w-2 rounded-full", TYPE_META[k].dot)} />
                              {TYPE_META[k].label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Visibility</Label>
                    <div className="flex items-center justify-between h-9 mt-1 px-3 rounded-md border border-border">
                      <span className="text-xs flex items-center gap-1.5">
                        {isPublic ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                        {isPublic ? "Public" : "Private"}
                      </span>
                      <Switch checked={isPublic} onCheckedChange={setIsPublic} />
                    </div>
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Label (optional)</Label>
                  <Input
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="e.g. On set in Lagos"
                    className="h-9 mt-1"
                    maxLength={60}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSave} disabled={saving || !range?.from || !range?.to}>
                  {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                  Save block
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Calendar preview */}
      <div className="rounded-xl border border-border bg-background/40 p-1 overflow-hidden">
        <Calendar
          mode="multiple"
          selected={[]}
          numberOfMonths={1}
          disabled={blockedDateMatchers}
          modifiers={{ blocked: blockedDateMatchers }}
          modifiersClassNames={{
            blocked: "bg-rose-500/15 text-rose-300 line-through",
          }}
          className={cn("p-2 pointer-events-auto mx-auto")}
        />
      </div>

      {/* Blocks list */}
      {loading ? (
        <div className="text-center text-xs text-muted-foreground py-3">Loading…</div>
      ) : visibleBlocks.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3">
          {isOwner ? "No blocked dates — you're showing as fully open." : "Open for bookings."}
        </p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {visibleBlocks.slice(0, 6).map((b) => {
            const meta = TYPE_META[b.block_type];
            const sameDay = b.start_date === b.end_date;
            return (
              <li
                key={b.id}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-border/60 bg-background/40"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant="outline" className={cn("text-[10px] font-bold uppercase tracking-wider", meta.chip)}>
                    <span className={cn("h-1.5 w-1.5 rounded-full mr-1", meta.dot)} />
                    {meta.label}
                  </Badge>
                  <span className="text-xs text-foreground truncate">
                    {sameDay
                      ? format(parseISO(b.start_date), "MMM d")
                      : `${format(parseISO(b.start_date), "MMM d")} – ${format(parseISO(b.end_date), "MMM d")}`}
                  </span>
                  {b.label && (
                    <span className="text-[11px] text-muted-foreground truncate">· {b.label}</span>
                  )}
                  {!b.is_public && isOwner && (
                    <Lock className="h-3 w-3 text-muted-foreground shrink-0" aria-label="Private" />
                  )}
                </div>
                {isOwner && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-rose-400"
                    onClick={() => handleDelete(b.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default AvailabilityCalendarSection;
