import { useState } from "react";
import { Timer, Play, Square, Receipt, History, Pencil, Trash2, Plus, Check, X } from "lucide-react";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useProjectTimer, formatHMS } from "@/hooks/useProjectTimer";
import { format } from "date-fns";

interface TimeEntryRow {
  id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  note: string | null;
  billed_invoice_id: string | null;
}

interface StudioTimerProps {
  projectId: string;
  userId?: string | null;
  /** Owner can also "Bill these hours" → draft invoice */
  isOwner?: boolean;
  onInvoiceDrafted?: () => void;
}

interface UnbilledTotals {
  hours: number;
  amount: number;
  count: number;
  currency: string;
}

export const StudioTimer = ({
  projectId,
  userId,
  isOwner,
  onInvoiceDrafted,
}: StudioTimerProps) => {
  const { running, elapsedSec, hourlyRate, currency, isRunning, start, stop } =
    useProjectTimer({ projectId, userId });

  const [billOpen, setBillOpen] = useState(false);
  const [totals, setTotals] = useState<UnbilledTotals | null>(null);
  const [loadingTotals, setLoadingTotals] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [rateOverride, setRateOverride] = useState("");
  const [note, setNote] = useState("Hours worked");

  // History + manual edit/add -- CDO audit: "no clear history of previous
  // sessions" / "users cannot clearly correct or add time manually".
  const [historyOpen, setHistoryOpen] = useState(false);
  const [entries, setEntries] = useState<TimeEntryRow[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMinutes, setEditMinutes] = useState("");
  const [adding, setAdding] = useState(false);
  const [addMinutes, setAddMinutes] = useState("");
  const [addNote, setAddNote] = useState("");
  const [savingEntry, setSavingEntry] = useState(false);

  const fmtMoney = (n: number, c: string) => {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: (c || "USD").toUpperCase(),
        maximumFractionDigits: 2,
      }).format(n);
    } catch {
      return `${c || "$"} ${n.toFixed(2)}`;
    }
  };

  const openBill = async () => {
    if (!userId) return;
    setLoadingTotals(true);
    setBillOpen(true);
    setRateOverride(hourlyRate ? String(hourlyRate) : "");
    try {
      const { data, error } = await supabase
        .from("project_time_entries")
        .select("duration_seconds, hourly_rate, currency")
        .eq("project_id", projectId)
        .eq("user_id", userId)
        .is("billed_invoice_id", null)
        .not("ended_at", "is", null);
      if (error) throw error;
      let totalSec = 0;
      let amount = 0;
      let ccy = currency || "USD";
      (data || []).forEach((row: any) => {
        const sec = row.duration_seconds || 0;
        totalSec += sec;
        const rate = row.hourly_rate || hourlyRate || 0;
        amount += (sec / 3600) * rate;
        if (row.currency) ccy = row.currency;
      });
      setTotals({
        hours: totalSec / 3600,
        amount,
        count: data?.length || 0,
        currency: ccy,
      });
    } catch (e: any) {
      toast.error("Couldn't load hours", { description: e.message });
      setBillOpen(false);
    } finally {
      setLoadingTotals(false);
    }
  };

  const draftInvoice = async () => {
    if (!totals || !userId || totals.hours <= 0) return;
    setDrafting(true);
    try {
      const rate = parseFloat(rateOverride) || hourlyRate || 0;
      const amount = +(totals.hours * rate).toFixed(2);
      const invoiceNumber = `TIME-${Date.now().toString().slice(-8)}`;
      const lineItems = [
        {
          description: `${note} · ${totals.hours.toFixed(2)} hrs @ ${fmtMoney(rate, totals.currency)}/hr`,
          quantity: +totals.hours.toFixed(2),
          rate,
          amount,
        },
      ];
      const { data: invoice, error } = await supabase
        .from("invoices")
        .insert({
          invoice_number: invoiceNumber,
          project_id: projectId,
          issued_by: userId,
          status: "draft",
          amount,
          currency: totals.currency,
          line_items: lineItems,
          notes: `${note} · auto-generated from tracked time on ${format(new Date(), "MMM d, yyyy")}`,
        } as any)
        .select("id")
        .single();
      if (error) throw error;
      // Mark entries as billed
      await supabase
        .from("project_time_entries")
        .update({ billed_invoice_id: (invoice as any).id })
        .eq("project_id", projectId)
        .eq("user_id", userId)
        .is("billed_invoice_id", null)
        .not("ended_at", "is", null);
      toast.success("Draft invoice created", {
        description: `${fmtMoney(amount, totals.currency)} from ${totals.hours.toFixed(2)} hrs`,
      });
      setBillOpen(false);
      onInvoiceDrafted?.();
    } catch (e: any) {
      toast.error("Couldn't draft invoice", { description: e.message });
    } finally {
      setDrafting(false);
    }
  };

  const loadEntries = async () => {
    if (!userId) return;
    setLoadingEntries(true);
    try {
      const { data, error } = await supabase
        .from("project_time_entries")
        .select("id, started_at, ended_at, duration_seconds, note, billed_invoice_id")
        .eq("project_id", projectId)
        .eq("user_id", userId)
        .not("ended_at", "is", null)
        .order("started_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      setEntries((data || []) as TimeEntryRow[]);
    } catch (e: any) {
      toast.error("Couldn't load time history", { description: e.message });
    } finally {
      setLoadingEntries(false);
    }
  };

  const openHistory = () => {
    setHistoryOpen(true);
    void loadEntries();
  };

  const startEdit = (entry: TimeEntryRow) => {
    setEditingId(entry.id);
    setEditMinutes(String(Math.round((entry.duration_seconds || 0) / 60)));
  };

  const saveEdit = async (entry: TimeEntryRow) => {
    const minutes = parseFloat(editMinutes);
    if (!minutes || minutes <= 0) return;
    setSavingEntry(true);
    try {
      // duration_seconds is a generated column on most schemas for this
      // table (derived from started_at/ended_at) -- edit by moving
      // started_at instead of writing duration_seconds directly, so the
      // edit survives however that column is actually computed.
      const endedAt = entry.ended_at ? new Date(entry.ended_at) : new Date();
      const startedAt = new Date(endedAt.getTime() - minutes * 60_000);
      const { error } = await supabase
        .from("project_time_entries")
        .update({ started_at: startedAt.toISOString() })
        .eq("id", entry.id);
      if (error) throw error;
      setEditingId(null);
      await loadEntries();
    } catch (e: any) {
      toast.error("Couldn't update entry", { description: e.message });
    } finally {
      setSavingEntry(false);
    }
  };

  const deleteEntry = async (entry: TimeEntryRow) => {
    try {
      const { error } = await supabase.from("project_time_entries").delete().eq("id", entry.id);
      if (error) throw error;
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
    } catch (e: any) {
      toast.error("Couldn't delete entry", { description: e.message });
    }
  };

  const addManualEntry = async () => {
    if (!userId) return;
    const minutes = parseFloat(addMinutes);
    if (!minutes || minutes <= 0) return;
    setSavingEntry(true);
    try {
      const endedAt = new Date();
      const startedAt = new Date(endedAt.getTime() - minutes * 60_000);
      const { error } = await supabase.from("project_time_entries").insert({
        project_id: projectId,
        user_id: userId,
        started_at: startedAt.toISOString(),
        ended_at: endedAt.toISOString(),
        hourly_rate: hourlyRate,
        currency,
        note: addNote.trim() || null,
      });
      if (error) throw error;
      setAdding(false);
      setAddMinutes("");
      setAddNote("");
      await loadEntries();
    } catch (e: any) {
      toast.error("Couldn't add entry", { description: e.message });
    } finally {
      setSavingEntry(false);
    }
  };

  return (
    <>
      <div className="inline-flex items-center gap-1 rounded-full border border-border bg-card/80 backdrop-blur-sm p-0.5">
        <Button
          type="button"
          size="sm"
          variant={isRunning ? "default" : "ghost"}
          onClick={() => (isRunning ? stop() : start())}
          className={cn(
            "h-7 gap-1.5 rounded-full px-2.5 text-xs font-bold",
            isRunning &&
              "bg-[hsl(var(--energy))] text-[hsl(var(--background))] hover:bg-[hsl(var(--energy)/0.9)] shadow-[0_0_10px_hsl(var(--energy)/0.5)]",
          )}
          aria-label={isRunning ? "Stop timer" : "Start timer"}
        >
          {isRunning ? (
            <>
              <Square className="h-3 w-3 fill-current" />
              <span className="tabular-nums">{formatHMS(elapsedSec)}</span>
            </>
          ) : (
            <>
              <Timer className="h-3.5 w-3.5" />
              <span>Track time</span>
            </>
          )}
        </Button>
        {isOwner && !isRunning && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 rounded-full"
            onClick={openBill}
            aria-label="Bill tracked hours"
            title="Bill tracked hours"
          >
            <Receipt className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7 rounded-full"
          onClick={openHistory}
          aria-label="Time history"
          title="Time history"
        >
          <History className="h-3.5 w-3.5" />
        </Button>
      </div>

      <Sheet open={billOpen} onOpenChange={setBillOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader className="text-left">
            <SheetTitle className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-[hsl(var(--energy))]" />
              Bill tracked hours
            </SheetTitle>
          </SheetHeader>

          {loadingTotals ? (
            <div className="py-10 flex items-center justify-center">
              <KretopiaSpinner className="h-5 w-5 text-muted-foreground" />
            </div>
          ) : !totals || totals.count === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No unbilled hours on this project yet. Hit{" "}
              <Play className="h-3 w-3 inline -mt-0.5" /> Track time to start.
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="rounded-xl bg-muted/40 p-4 ring-1 ring-border">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Unbilled hours
                </p>
                <p className="text-3xl font-black tracking-tight">
                  {totals.hours.toFixed(2)}
                  <span className="text-sm text-muted-foreground font-bold ml-1">hrs</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Across {totals.count} session{totals.count === 1 ? "" : "s"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Hourly rate</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={rateOverride}
                    onChange={(e) => setRateOverride(e.target.value)}
                    placeholder="0"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Currency</Label>
                  <Input value={totals.currency} disabled className="mt-1" />
                </div>
              </div>

              <div>
                <Label className="text-xs">Note for invoice</Label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  className="mt-1"
                />
              </div>

              <div className="rounded-xl bg-[hsl(var(--energy)/0.08)] ring-1 ring-[hsl(var(--energy)/0.3)] p-3 flex items-center justify-between">
                <span className="text-sm font-semibold">Invoice total</span>
                <span className="text-lg font-black text-[hsl(var(--energy))]">
                  {fmtMoney(
                    totals.hours * (parseFloat(rateOverride) || 0),
                    totals.currency,
                  )}
                </span>
              </div>

              <Button
                onClick={draftInvoice}
                disabled={drafting || totals.hours <= 0 || !parseFloat(rateOverride)}
                className="w-full gap-2"
              >
                {drafting ? (
                  <KretopiaSpinner className="h-4 w-4" />
                ) : (
                  <Receipt className="h-4 w-4" />
                )}
                Create draft invoice
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
          <SheetHeader className="text-left">
            <SheetTitle className="flex items-center gap-2">
              <History className="h-4 w-4 text-[hsl(var(--energy))]" />
              Time history
            </SheetTitle>
          </SheetHeader>

          <div className="py-3">
            {!adding ? (
              <Button variant="outline" size="sm" className="gap-1.5 mb-3" onClick={() => setAdding(true)}>
                <Plus className="h-3.5 w-3.5" /> Add manually
              </Button>
            ) : (
              <div className="rounded-xl border border-border p-3 mb-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Minutes</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={addMinutes}
                      onChange={(e) => setAddMinutes(e.target.value)}
                      placeholder="60"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Note (optional)</Label>
                    <Input
                      value={addNote}
                      onChange={(e) => setAddNote(e.target.value)}
                      placeholder="What did you work on?"
                      className="mt-1"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={addManualEntry}
                    disabled={savingEntry || !parseFloat(addMinutes)}
                  >
                    {savingEntry ? <KretopiaSpinner className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {loadingEntries ? (
              <div className="py-10 flex items-center justify-center">
                <KretopiaSpinner className="h-5 w-5 text-muted-foreground" />
              </div>
            ) : entries.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No logged sessions yet on this project.
              </p>
            ) : (
              <div className="space-y-1.5">
                {entries.map((entry) => {
                  const minutes = Math.round((entry.duration_seconds || 0) / 60);
                  const billed = !!entry.billed_invoice_id;
                  const isEditing = editingId === entry.id;
                  return (
                    <div
                      key={entry.id}
                      className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium">
                          {format(new Date(entry.started_at), "MMM d, yyyy")}
                          {entry.note ? ` · ${entry.note}` : ""}
                        </p>
                        {billed && (
                          <p className="text-[10px] text-muted-foreground">Billed — locked</p>
                        )}
                      </div>
                      {isEditing ? (
                        <>
                          <Input
                            type="number"
                            inputMode="decimal"
                            value={editMinutes}
                            onChange={(e) => setEditMinutes(e.target.value)}
                            className="h-7 w-20 text-xs"
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 shrink-0"
                            onClick={() => saveEdit(entry)}
                            disabled={savingEntry}
                            aria-label="Save"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 shrink-0"
                            onClick={() => setEditingId(null)}
                            aria-label="Cancel edit"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <span className="text-xs font-bold tabular-nums shrink-0">
                            {(minutes / 60).toFixed(2)}h
                          </span>
                          {!billed && (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 shrink-0"
                                onClick={() => startEdit(entry)}
                                aria-label="Edit entry"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                                onClick={() => deleteEntry(entry)}
                                aria-label="Delete entry"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};
