import { useState } from "react";
import { Loader2, Sparkles, Plus, Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { extractInvokeError } from "@/lib/extractInvokeError";
import type { ScannedEventDetails } from "./ScanFlyerDialog";

interface Props {
  onPrefilled: (details: ScannedEventDetails | null) => void;
  onManage?: () => void;
  hostingCount?: number;
}

/** Convert the ISO shape the extractor returns into the dialog's date + time fields. */
function toScanned(extracted: any): ScannedEventDetails {
  const out: ScannedEventDetails = {
    title: extracted?.title || undefined,
    description: extracted?.description || undefined,
    category: extracted?.category || undefined,
    venue_name: extracted?.venue_name ?? null,
    venue_address: extracted?.venue_address ?? null,
    max_participants: extracted?.max_participants ?? null,
    is_ticketed: !!extracted?.is_ticketed,
    ticket_price: extracted?.ticket_price ?? null,
    ticket_currency: extracted?.ticket_currency ?? null,
    external_ticket_url: extracted?.external_ticket_url ?? null,
  };
  const start = extracted?.start_time ? new Date(extracted.start_time) : null;
  if (start && !isNaN(start.getTime())) {
    const pad = (n: number) => String(n).padStart(2, "0");
    out.start_date = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
    out.start_time = `${pad(start.getHours())}:${pad(start.getMinutes())}`;
  }
  return out;
}

/**
 * Kreto-powered event composer. The primary "Host an event" action on the Events page:
 * describe the event in plain language and Kreto fills the whole form.
 */
export function AIHostEventCard({ onPrefilled, onManage, hostingCount = 0 }: Props) {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!text.trim()) {
      onPrefilled(null);
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("extract-event-details", {
        body: { text: text.trim(), extract_only: true },
      });
      if (error) throw new Error((await extractInvokeError(error)) || "Kreto couldn't read that. Try again.");
      if (data?.error) throw new Error(String(data.error));
      if (!data?.extracted) throw new Error("Not enough detail — add a date, a venue and what it is.");
      onPrefilled(toScanned(data.extracted));
      toast({ title: "Kreto drafted your event", description: "Review the details and publish." });
      setText("");
    } catch (e: any) {
      toast({ title: "Couldn't draft that", description: e?.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-transparent p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" /> Kreto-powered
          </p>
          <h2 className="text-lg font-bold leading-tight">Host an event</h2>
          <p className="text-xs text-muted-foreground">
            Describe it in a sentence — Kreto fills in the date, venue, tickets and the listing copy.
          </p>
        </div>
        {hostingCount > 0 && onManage && (
          <Button size="sm" variant="outline" className="shrink-0" onClick={onManage}>
            <SettingsIcon className="h-4 w-4 mr-1.5" /> Manage ({hostingCount})
          </Button>
        )}
      </div>

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        placeholder="Beat-making workshop at Studio 7, Port of Spain, Friday 7pm, $50 entry, 20 spots…"
        className="bg-background/60 resize-none"
      />

      <div className="flex flex-wrap items-center gap-2 mt-3">
        <Button onClick={run} disabled={busy} variant="gradient" className="gap-1.5 rounded-full">
          {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Drafting…</> : <><Sparkles className="h-4 w-4" /> Draft with Kreto</>}
        </Button>
        <Button onClick={() => onPrefilled(null)} variant="ghost" size="sm" className="gap-1.5 rounded-full">
          <Plus className="h-4 w-4" /> Start from blank
        </Button>
      </div>
    </div>
  );
}

export default AIHostEventCard;
