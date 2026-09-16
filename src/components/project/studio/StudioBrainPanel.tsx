import { useEffect, useState } from "react";
import { Brain, Loader2, Trash2, Users, Calendar, DollarSign, MapPin, Quote } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Fact {
  id: string;
  kind: string;
  label: string | null;
  value: string;
  value_numeric: number | null;
  value_date: string | null;
  importance: number;
  source_kind: string | null;
  source_excerpt: string | null;
}

interface Entity {
  id: string;
  kind: string;
  name: string;
  aliases: string[] | null;
  importance: number;
}

const KIND_ICON: Record<string, any> = {
  budget_total: DollarSign, budget_line: DollarSign, rate: DollarSign,
  deposit: DollarSign, invoice_amount: DollarSign, payment_terms: DollarSign,
  event_date: Calendar, deadline: Calendar, load_in: Calendar,
  load_out: Calendar, doors: Calendar, show_start: Calendar,
  venue_name: MapPin, venue_address: MapPin, city: MapPin, country: MapPin,
  client: Users, contact_email: Users, contact_phone: Users,
};

interface Props {
  projectId: string;
  isOwner: boolean;
}

/**
 * Studio Brain visibility panel — shows the user every fact/entity Thrive
 * has extracted from drops. Without this, the "it already knows" promise is
 * invisible. With it, users can audit + prune what EP relies on.
 */
export function StudioBrainPanel({ projectId, isOwner }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [facts, setFacts] = useState<Fact[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [counts, setCounts] = useState<{ f: number; e: number }>({ f: 0, e: 0 });

  // Light count fetch so the chip can show a number. Refreshes on open AND
  // whenever a drop signals "studio-brain:updated".
  useEffect(() => {
    let cancelled = false;
    const fetchCounts = async () => {
      try {
        const [{ count: fc }, { count: ec }] = await Promise.all([
          supabase.from("studio_facts").select("id", { count: "exact", head: true }).eq("project_id", projectId),
          supabase.from("studio_entities").select("id", { count: "exact", head: true }).eq("project_id", projectId),
        ]);
        if (cancelled) return;
        setCounts({ f: fc ?? 0, e: ec ?? 0 });
      } catch { /* silent */ }
    };
    fetchCounts();
    const onUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || detail.projectId === projectId) {
        fetchCounts();
        if (open) loadAll();
      }
    };
    window.addEventListener("studio-brain:updated", onUpdate);
    return () => { cancelled = true; window.removeEventListener("studio-brain:updated", onUpdate); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, open]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [factsRes, entRes] = await Promise.all([
        supabase
          .from("studio_facts")
          .select("id, kind, label, value, value_numeric, value_date, importance, source_kind, source_excerpt")
          .eq("project_id", projectId)
          .order("importance", { ascending: false })
          .limit(80),
        supabase
          .from("studio_entities")
          .select("id, kind, name, aliases, importance")
          .eq("project_id", projectId)
          .order("importance", { ascending: false })
          .limit(80),
      ]);
      setFacts((factsRes.data as any) || []);
      setEntities((entRes.data as any) || []);
    } finally {
      setLoading(false);
    }
  };

  const forgetFact = async (id: string) => {
    const prev = facts;
    setFacts(facts.filter((f) => f.id !== id));
    const { error } = await supabase.from("studio_facts").delete().eq("id", id);
    if (error) {
      setFacts(prev);
      toast({ title: "Couldn't forget", description: error.message, variant: "destructive" });
    }
  };

  const forgetEntity = async (id: string) => {
    const prev = entities;
    setEntities(entities.filter((e) => e.id !== id));
    const { error } = await supabase.from("studio_entities").delete().eq("id", id);
    if (error) {
      setEntities(prev);
      toast({ title: "Couldn't forget", description: error.message, variant: "destructive" });
    }
  };

  const total = counts.f + counts.e;

  return (
    <Sheet open={open} onOpenChange={(o) => { setOpen(o); if (o) loadAll(); }}>
      <SheetTrigger asChild>
        <button
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-card hover:border-primary/50 transition text-[11px] group"
          title="What Kreto remembers about this Studio"
        >
          <Brain className="h-3 w-3 text-primary" />
          <span className="font-medium">Brain</span>
          {total > 0 && (
            <span className="text-[10px] font-bold tabular-nums text-primary">{total}</span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto pt-[max(env(safe-area-inset-top),0.5rem)]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" /> Studio Brain
          </SheetTitle>
          <p className="text-xs text-muted-foreground text-left">
            Everything Kreto remembers from what you've dropped here. Used automatically when you ask for decks, proposals, invoices.
          </p>
        </SheetHeader>

        {loading ? (
          <div className="py-12 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>
        ) : (
          <div className="mt-4 space-y-6">
            <section>
              <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground mb-2">
                Facts ({facts.length})
              </h3>
              {facts.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Nothing yet. Drop a brief, contract, budget or voice note to fill the Brain.</p>
              ) : (
                <ul className="space-y-1.5">
                  {facts.map((f) => {
                    const Icon = KIND_ICON[f.kind] || Quote;
                    return (
                      <li key={f.id} className="group flex items-start gap-2 p-2 rounded-lg border border-border bg-card hover:bg-muted/30 transition">
                        <Icon className="h-3.5 w-3.5 mt-0.5 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{f.kind.replace(/_/g, " ")}</span>
                            {f.importance >= 4 && <Badge variant="secondary" className="h-4 text-[9px] px-1.5">key</Badge>}
                          </div>
                          <p className="text-sm font-medium truncate">{f.label ? `${f.label}: ` : ""}{f.value}</p>
                          {f.source_excerpt && (
                            <p className="text-[10px] text-muted-foreground italic truncate mt-0.5">"{f.source_excerpt}"</p>
                          )}
                        </div>
                        {isOwner && (
                          <button onClick={() => forgetFact(f.id)} className="opacity-60 sm:opacity-0 sm:group-hover:opacity-100 transition text-muted-foreground hover:text-destructive p-1 -m-1" title="Forget this" aria-label="Forget fact">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section>
              <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground mb-2">
                People & places ({entities.length})
              </h3>
              {entities.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No people, sponsors or venues remembered yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {entities.map((e) => (
                    <li key={e.id} className="group flex items-center gap-2 p-2 rounded-lg border border-border bg-card hover:bg-muted/30 transition">
                      <Badge variant="outline" className="text-[9px] uppercase tracking-wider">{e.kind}</Badge>
                      <span className="text-sm font-medium flex-1 truncate">{e.name}</span>
                      {isOwner && (
                        <button onClick={() => forgetEntity(e.id)} className="opacity-60 sm:opacity-0 sm:group-hover:opacity-100 transition text-muted-foreground hover:text-destructive p-1 -m-1" title="Forget this" aria-label="Forget entity">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
