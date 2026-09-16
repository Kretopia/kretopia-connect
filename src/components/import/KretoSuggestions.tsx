import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { generateSuggestions, resolveSuggestions } from "@/lib/studioImport";
import { useToast } from "@/hooks/use-toast";

interface Suggestion {
  id: string;
  kind: string;
  title: string;
  detail: string | null;
  confidence: number | null;
  source_url: string | null;
  status: string;
}

const KIND_LABEL: Record<string, string> = {
  task: "Open thread",
  decision: "Decision",
  risk: "Risk",
  milestone: "Milestone",
  deliverable: "Deliverable",
  collaborator: "Person",
  note: "Note",
};

export const KretoSuggestions = ({ jobId }: { jobId: string }) => {
  const { toast } = useToast();
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("import_suggestions")
      .select("id, kind, title, detail, confidence, source_url, status")
      .eq("import_job_id", jobId)
      .eq("status", "pending")
      .order("confidence", { ascending: false });
    setItems((data ?? []) as Suggestion[]);
    setLoading(false);
  }, [jobId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await generateSuggestions(jobId);
      } catch {
        /* suggestions are a bonus, never a blocker */
      }
      if (alive) await load();
    })().catch(() => setLoading(false));
    return () => { alive = false; };
  }, [jobId, load]);

  const act = async (id: string, action: "approve" | "ignore") => {
    setBusy(id);
    try {
      await resolveSuggestions(jobId, [id], action);
      setItems((prev) => prev.filter((s) => s.id !== id));
      if (action === "approve") toast({ title: "Added to your Studio" });
    } catch (e: any) {
      toast({ title: "Couldn't do that", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const acceptAll = async () => {
    setBusy("all");
    try {
      await resolveSuggestions(jobId, items.map((i) => i.id), "approve");
      setItems([]);
      toast({ title: "All caught up" });
    } catch (e: any) {
      toast({ title: "Couldn't do that", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Kreto is reading through what you brought in…
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-[hsl(var(--signal-amber))]" />
          I picked out {items.length} thing{items.length === 1 ? "" : "s"} worth keeping
        </p>
        <Button size="sm" variant="ghost" onClick={acceptAll} disabled={busy === "all"}>
          {busy === "all" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add all"}
        </Button>
      </div>

      <div className="space-y-2">
        {items.map((s) => (
          <div key={s.id} className="rounded-2xl border border-border bg-card p-3.5">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <Badge variant="secondary" className="rounded-full text-[10px]">{KIND_LABEL[s.kind] ?? s.kind}</Badge>
                <p className="mt-1.5 text-sm font-medium">{s.title}</p>
                {s.detail && <p className="mt-0.5 text-xs text-muted-foreground">{s.detail}</p>}
                {s.source_url && (
                  <a href={s.source_url} target="_blank" rel="noreferrer" className="mt-1 block truncate text-[11px] text-muted-foreground underline">
                    where this came from
                  </a>
                )}
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="icon" variant="ghost" className="h-8 w-8" disabled={!!busy} onClick={() => act(s.id, "ignore")} aria-label="Ignore">
                  <X className="h-4 w-4" />
                </Button>
                <Button size="icon" className="h-8 w-8" disabled={!!busy} onClick={() => act(s.id, "approve")} aria-label="Add">
                  {busy === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">Nothing here is added until you say so.</p>
    </div>
  );
};
