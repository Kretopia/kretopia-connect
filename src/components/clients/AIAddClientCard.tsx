import { useState } from "react";
import { Loader2, Sparkles, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { extractInvokeError } from "@/lib/extractInvokeError";
import type { Client } from "@/hooks/useClients";

interface Props {
  /** null = start from a blank form. */
  onDraft: (draft: Partial<Client> | null) => void;
}

/**
 * Kreto-powered client capture — the primary "New client" action on the Clients page.
 * Paste an email signature or a brief and Kreto fills the form.
 */
export function AIAddClientCard({ onDraft }: Props) {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!text.trim()) {
      onDraft(null);
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("extract-client-details", {
        body: { text: text.trim() },
      });
      if (error) throw new Error((await extractInvokeError(error)) || "Kreto couldn't read that. Try again.");
      if (data?.error) throw new Error(String(data.error));
      if (!data?.extracted) throw new Error("Not enough detail — paste a signature or a few lines about them.");
      onDraft(data.extracted as Partial<Client>);
      toast({ title: "Kreto filled the form", description: "Check the details and save." });
      setText("");
    } catch (e: any) {
      toast({ title: "Couldn't read that", description: e?.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="rounded-2xl border bg-card/80 backdrop-blur-sm p-4 sm:p-5 mb-5"
      style={{ borderColor: "hsl(var(--energy) / 0.25)" }}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[hsl(var(--energy))] flex items-center gap-1.5">
        <Sparkles className="h-3 w-3" /> Kreto-powered
      </p>
      <h2 className="text-lg font-bold tracking-tight leading-tight mt-1">Add a client</h2>
      <p className="text-xs text-muted-foreground mb-3">
        Paste an email signature, a brief or a DM — Kreto pulls out the name, company, contact and terms.
      </p>

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        placeholder="Elisa Leclercq — Head of Brand, Maison Nine · elisa@maisonnine.com · +33 6 12 34 56 78 · Net 30"
        className="bg-background/60 resize-none rounded-xl"
      />

      <div className="flex flex-wrap items-center justify-end gap-2 mt-3">
        <Button onClick={() => onDraft(null)} variant="ghost" size="sm" className="gap-1.5 rounded-full">
          <Plus className="h-4 w-4" /> Add manually
        </Button>
        <Button
          onClick={run}
          disabled={busy}
          size="sm"
          className="gap-1.5 rounded-full text-white"
          style={{ backgroundColor: "hsl(var(--energy))" }}
        >
          {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Reading…</> : <><Sparkles className="h-4 w-4" /> Add with Kreto</>}
        </Button>
      </div>
    </div>
  );
}

export default AIAddClientCard;
