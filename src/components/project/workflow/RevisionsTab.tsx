import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, RotateCcw, Check, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface Props { projectId: string; currentUserId: string; }
type Status = "open" | "in_progress" | "delivered" | "approved";
interface Revision {
  id: string; project_id: string; round_number: number; requested_by: string;
  notes: string | null; status: string; created_at: string;
}

const STATUS: Record<Status, { label: string; cls: string }> = {
  open:        { label: "Requested",   cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  in_progress: { label: "In progress", cls: "bg-primary/10 text-primary" },
  delivered:   { label: "Delivered",   cls: "bg-primary/15 text-primary dark:text-primary" },
  approved:    { label: "Approved",    cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
};

export function RevisionsTab({ projectId, currentUserId }: Props) {
  const { toast } = useToast();
  const [items, setItems] = useState<Revision[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");

  useEffect(() => { void load(); }, [projectId]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("project_revisions").select("*")
        .eq("project_id", projectId).order("round_number", { ascending: false });
      setItems((data as any[]) || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const add = async () => {
    if (!draft.trim()) return;
    const next = (items[0]?.round_number ?? 0) + 1;
    const { error } = await supabase.from("project_revisions").insert({
      project_id: projectId, requested_by: currentUserId,
      round_number: next, notes: draft.trim(), status: "open",
    });
    if (error) { toast({ title: "Add failed", description: error.message, variant: "destructive" }); return; }
    setDraft("");
    void load();
  };

  const setStatus = async (id: string, status: Status) => {
    await supabase.from("project_revisions").update({ status }).eq("id", id);
    void load();
  };

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2"><RotateCcw className="h-5 w-5" /> Revision Rounds</h2>
        <p className="text-sm text-muted-foreground">Track every round of changes — keeps scope creep visible.</p>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Request a new round</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Textarea placeholder="Describe what needs changing..." value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} />
          <Button onClick={add} disabled={!draft.trim()} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> Add round
          </Button>
        </CardContent>
      </Card>

      {items.length === 0 && (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No revision rounds yet.</CardContent></Card>
      )}

      {items.map((r) => {
        const status = (r.status as Status) ?? "open";
        return (
          <Card key={r.id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-muted">R{r.round_number}</span>
                  <Badge className={cn("border-0 text-[10px]", STATUS[status].cls)} variant="secondary">
                    {STATUS[status].label}
                  </Badge>
                </div>
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                </span>
              </div>
              {r.notes && <p className="text-sm whitespace-pre-wrap">{r.notes}</p>}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {(["open", "in_progress", "delivered", "approved"] as Status[]).map((s) => (
                  <Button key={s} size="sm" variant={status === s ? "default" : "outline"}
                    className="h-7 text-xs gap-1" onClick={() => setStatus(r.id, s)}>
                    {s === "approved" && <Check className="h-3 w-3" />}
                    {STATUS[s].label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
