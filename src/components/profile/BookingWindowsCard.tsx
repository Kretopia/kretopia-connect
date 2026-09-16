// Owner-facing editor for weekly booking windows + master toggle.
// Mount on the profile editor surface.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CalendarDays, Plus, Trash2, Loader2, Copy } from "lucide-react";
import { toast } from "sonner";
import { APP_URL } from "@/lib/constants";

interface Window {
  id: string;
  weekday: number;
  start_minute: number;
  end_minute: number;
  slot_minutes: number;
  is_active: boolean;
  timezone: string;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const toHHMM = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const fromHHMM = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

interface Props { userId: string; username: string | null; bookingsEnabled: boolean; }

export const BookingWindowsCard = ({ userId, username, bookingsEnabled }: Props) => {
  const [enabled, setEnabled] = useState(bookingsEnabled);
  const [windows, setWindows] = useState<Window[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingToggle, setSavingToggle] = useState(false);
  const [adding, setAdding] = useState(false);

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const bookingUrl = username ? `${APP_URL}/@${username}/book` : null;

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("creator_booking_windows")
      .select("*")
      .eq("user_id", userId)
      .order("weekday", { ascending: true })
      .order("start_minute", { ascending: true });
    setWindows((data || []) as Window[]);
    setLoading(false);
  };

  useEffect(() => { load().catch(() => {}); }, [userId]);

  const toggleEnabled = async (next: boolean) => {
    setSavingToggle(true);
    setEnabled(next);
    const { error } = await supabase
      .from("profiles")
      .update({ bookings_enabled: next })
      .eq("user_id", userId);
    setSavingToggle(false);
    if (error) { toast.error("Couldn't save"); setEnabled(!next); return; }
    toast.success(next ? "Booking page is live" : "Booking page is off");
  };

  const addWindow = async (weekday: number) => {
    setAdding(true);
    const { error } = await supabase.from("creator_booking_windows").insert({
      user_id: userId,
      weekday,
      start_minute: 9 * 60,
      end_minute: 17 * 60,
      slot_minutes: 30,
      timezone: tz,
      is_active: true,
    });
    setAdding(false);
    if (error) { toast.error("Couldn't add window", { description: error.message }); return; }
    load();
  };

  const updateWindow = async (id: string, patch: Partial<Window>) => {
    const prev = windows;
    setWindows((ws) => ws.map((w) => (w.id === id ? { ...w, ...patch } : w)));
    const { error } = await supabase
      .from("creator_booking_windows")
      .update(patch)
      .eq("id", id);
    if (error) { setWindows(prev); toast.error("Couldn't save"); }
  };

  const removeWindow = async (id: string) => {
    const { error } = await supabase.from("creator_booking_windows").delete().eq("id", id);
    if (error) { toast.error("Couldn't remove"); return; }
    load();
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-[hsl(var(--signal-teal))]/15 flex items-center justify-center">
            <CalendarDays className="h-4 w-4 text-[hsl(var(--signal-teal))]" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-tight">Booking page</h3>
            <p className="text-[11px] text-muted-foreground">
              Share one link. People pick a slot. Done.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {savingToggle && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          <Switch checked={enabled} onCheckedChange={toggleEnabled} />
        </div>
      </div>

      {enabled && bookingUrl && (
        <button
          onClick={() => { navigator.clipboard.writeText(bookingUrl); toast.success("Booking link copied"); }}
          className="btn-glass btn-glass-outline w-full text-left text-[11px] font-mono px-3 py-2 mb-3 rounded-lg flex items-center justify-between gap-2"
        >
          <span className="truncate">{bookingUrl.replace(/^https?:\/\//, "")}</span>
          <Copy className="h-3 w-3 shrink-0 text-muted-foreground" />
        </button>
      )}

      {loading ? (
        <p className="text-xs text-muted-foreground text-center py-3">Loading…</p>
      ) : (
        <div className="space-y-2">
          {WEEKDAYS.map((label, weekday) => {
            const dayWindows = windows.filter((w) => w.weekday === weekday);
            return (
              <div key={weekday} className="rounded-lg border border-border/60 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground">{label}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-[11px]"
                    disabled={adding}
                    onClick={() => addWindow(weekday)}
                  >
                    <Plus className="h-3 w-3" /> Add
                  </Button>
                </div>
                {dayWindows.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">No hours set.</p>
                ) : (
                  <div className="space-y-1.5">
                    {dayWindows.map((w) => (
                      <div key={w.id} className="flex items-center gap-2">
                        <Input
                          type="time"
                          value={toHHMM(w.start_minute)}
                          onChange={(e) => updateWindow(w.id, { start_minute: fromHHMM(e.target.value) })}
                          className="h-9 flex-1"
                        />
                        <span className="text-xs text-muted-foreground">to</span>
                        <Input
                          type="time"
                          value={toHHMM(w.end_minute)}
                          onChange={(e) => updateWindow(w.id, { end_minute: fromHHMM(e.target.value) })}
                          className="h-9 flex-1"
                        />
                        <select
                          value={w.slot_minutes}
                          onChange={(e) => updateWindow(w.id, { slot_minutes: Number(e.target.value) })}
                          className="h-9 px-2 rounded-md border border-border bg-background text-xs"
                        >
                          {[15, 30, 45, 60, 90].map((n) => <option key={n} value={n}>{n}m</option>)}
                        </select>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-rose-400"
                          onClick={() => removeWindow(w.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-3 text-[10px] text-muted-foreground">
        Timezone: {tz}. Bookings won't clash with anything already on your meetings calendar.
      </p>
    </div>
  );
};

export default BookingWindowsCard;
