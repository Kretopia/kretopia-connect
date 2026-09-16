import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, GripVertical, Loader2, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props { projectId: string; currentUserId: string; }
interface Segment {
  id: string; project_id: string; time_slot: string | null;
  duration_min: number | null; segment_title: string; owner_id: string | null;
  notes: string | null; position: number;
}

export function RunOfShowTab({ projectId, currentUserId }: Props) {
  const { toast } = useToast();
  const [items, setItems] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { void load(); }, [projectId]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("project_run_of_show").select("*")
        .eq("project_id", projectId).order("position", { ascending: true });
      setItems((data as any[]) || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const add = async () => {
    const next = items.length;
    const { error } = await supabase.from("project_run_of_show").insert({
      project_id: projectId, created_by: currentUserId,
      segment_title: "New segment", position: next, duration_min: 15,
    });
    if (error) toast({ title: "Add failed", description: error.message, variant: "destructive" });
    else void load();
  };

  const update = async (id: string, patch: Partial<Segment>) => {
    const { error } = await supabase.from("project_run_of_show").update(patch).eq("id", id);
    if (!error) void load();
  };

  const remove = async (id: string) => {
    await supabase.from("project_run_of_show").delete().eq("id", id);
    void load();
  };

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-3 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Run of Show</h2>
          <p className="text-sm text-muted-foreground">Minute-by-minute timeline of segments, sets, or scenes.</p>
        </div>
        <Button onClick={add} size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> Segment</Button>
      </div>

      {items.length === 0 && (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No segments yet. Build out your timeline.</CardContent></Card>
      )}

      {items.map((s, idx) => (
        <Card key={s.id}>
          <CardContent className="p-3 flex items-start gap-2">
            <div className="flex flex-col items-center pt-2 text-muted-foreground">
              <GripVertical className="h-4 w-4" />
              <span className="text-[10px] mt-0.5 font-mono">{String(idx + 1).padStart(2, "0")}</span>
            </div>
            <div className="flex-1 grid grid-cols-12 gap-2">
              <div className="col-span-4 sm:col-span-3 space-y-1">
                <div className="text-[10px] uppercase text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />Time</div>
                <Input type="time" defaultValue={s.time_slot ?? ""} onBlur={(e) => update(s.id, { time_slot: e.target.value || null })} />
              </div>
              <div className="col-span-3 sm:col-span-2 space-y-1">
                <div className="text-[10px] uppercase text-muted-foreground">Min</div>
                <Input type="number" min={1} defaultValue={s.duration_min ?? 15} onBlur={(e) => update(s.id, { duration_min: parseInt(e.target.value) || 15 })} />
              </div>
              <div className="col-span-12 sm:col-span-7 space-y-1">
                <div className="text-[10px] uppercase text-muted-foreground">Segment</div>
                <Input defaultValue={s.segment_title} onBlur={(e) => update(s.id, { segment_title: e.target.value })} />
              </div>
              <div className="col-span-12 space-y-1">
                <div className="text-[10px] uppercase text-muted-foreground">Notes</div>
                <Input defaultValue={s.notes ?? ""} placeholder="Cue, owner, setup, backstage note…" onBlur={(e) => update(s.id, { notes: e.target.value || null })} />
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => remove(s.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
