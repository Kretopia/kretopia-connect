import { useState } from "react";
import { Sparkles, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { supabase } from "@/integrations/supabase/client";
import { epkDraftPrompt } from "@/lib/epkDraft";
import type { EPKPdfInput } from "@/lib/epkPdfGenerator";

export function EPKDraftField({ label, value, onChange, data }: { label: string; value: string; onChange: (value: string) => void; data: EPKPdfInput }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const suggest = async () => {
    setBusy(true); setError("");
    try {
      const { data: result, error: failure } = await supabase.functions.invoke("generate-content", {
        body: { messages: [{ role: "user", content: epkDraftPrompt(data, label, value) }] },
      });
      if (failure) {
        let message = failure.message;
        if (failure.context instanceof Response) {
          const body = await failure.context.clone().json().catch(() => null);
          message = body?.error || body?.message || message;
        }
        throw new Error(message);
      }
      if (result?.error) throw new Error(result.error);
      const text = result?.content?.trim();
      if (!text) throw new Error("Kreto returned no draft. Your current content is unchanged.");
      setDraft(text);
    } catch (e) { setError(e instanceof Error ? e.message : "Draft unavailable. Your content is unchanged."); }
    finally { setBusy(false); }
  };
  return <div className="space-y-2">
    <div className="flex items-center justify-between gap-2">
      <label className="text-xs font-semibold" htmlFor={`epk-${label}`}>{label}</label>
      <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={suggest} disabled={busy} aria-label={`Draft ${label} with AI`}>
        {busy ? <KretopiaSpinner className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />} Draft
      </Button>
    </div>
    <Textarea id={`epk-${label}`} value={value} onChange={e => onChange(e.target.value)} rows={label === "Bio" ? 5 : 3} />
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    {draft !== null && <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
      <p className="text-xs font-semibold text-muted-foreground">Kreto · Draft for review</p>
      <Textarea aria-label={`${label} AI draft`} value={draft} onChange={e => setDraft(e.target.value)} rows={5} />
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => { onChange(draft); setDraft(null); }}><Check /> Use draft</Button>
        <Button variant="ghost" size="sm" onClick={() => setDraft(null)}><X /> Discard</Button>
      </div>
    </div>}
  </div>;
}