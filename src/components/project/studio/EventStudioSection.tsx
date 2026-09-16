import { useEffect, useState } from "react";
import { Calendar, Plus, Sparkles, Loader2, GripVertical, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";

interface RunsheetItem {
  id: string;
  start_time: string | null;
  end_time: string | null;
  title: string;
  owner_name: string | null;
  notes: string | null;
  position: number;
  status: "planned" | "done" | "at_risk";
}

interface Props {
  project: any;
  currentUserId: string;
}

// White = done/resolved, pink = at risk (needs a look), gray = plain
// planned — no red/amber/green traffic light, per the app's palette.
const STATUS_TONE: Record<string, string> = {
  planned: "bg-muted text-muted-foreground",
  done: "bg-white/10 text-white",
  at_risk: "bg-[hsl(var(--energy)/0.15)] text-[hsl(var(--energy))]",
};

/**
 * Event Studio module — only renders when project.workspace_type === 'event'.
 * Provides a run sheet timeline with AI generation + manual editing.
 */
export function EventStudioSection({ project, currentUserId }: Props) {
  const { toast } = useToast();
  const [items, setItems] = useState<RunsheetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openAdd, setOpenAdd] = useState(false);
  const [genBusy, setGenBusy] = useState(false);
  const [creating, setCreating] = useState(false);

  // form
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [owner, setOwner] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("event_runsheet_items")
      .select("id, start_time, end_time, title, owner_name, notes, position, status")
      .eq("project_id", project.id)
      .order("position", { ascending: true });
    setItems((data || []) as RunsheetItem[]);
    setLoading(false);
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [project.id]);

  const create = async () => {
    if (!title.trim()) return;
    setCreating(true);
    try {
      const pos = (items[items.length - 1]?.position || 0) + 1;
      const { error } = await (supabase as any).from("event_runsheet_items").insert({
        project_id: project.id,
        created_by: currentUserId,
        title: title.trim(),
        start_time: start || null,
        end_time: end || null,
        owner_name: owner.trim() || null,
        position: pos,
      });
      if (error) throw error;
      setTitle(""); setStart(""); setEnd(""); setOwner("");
      setOpenAdd(false);
      await load();
    } catch (e: any) {
      toast({ title: "Couldn't add", description: e?.message, variant: "destructive" });
    } finally { setCreating(false); }
  };

  const generate = async () => {
    setGenBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke<{ items: Array<{
        start_time: string; end_time: string; title: string; owner_name: string; notes: string;
      }>}>("gen-event-runsheet", {
        body: {
          event_title: project.title,
          event_description: project.description,
          event_date: project.due_date || null,
        },
      });
      if (error) throw error;
      const generated = data?.items || [];
      if (!generated.length) throw new Error("No items generated");
      // Replace existing planned items
      const startPos = (items[items.length - 1]?.position || 0) + 1;
      const rows = generated.map((it, i) => ({
        project_id: project.id,
        created_by: currentUserId,
        title: it.title,
        start_time: it.start_time,
        end_time: it.end_time,
        owner_name: it.owner_name,
        notes: it.notes,
        position: startPos + i,
        status: "planned" as const,
      }));
      const { error: insErr } = await (supabase as any).from("event_runsheet_items").insert(rows);
      if (insErr) throw insErr;
      toast({ title: `Run sheet drafted — ${rows.length} items` });
      await load();
    } catch (e: any) {
      toast({ title: "Couldn't generate run sheet", description: e?.message, variant: "destructive" });
    } finally { setGenBusy(false); }
  };

  const setStatus = async (it: RunsheetItem, status: RunsheetItem["status"]) => {
    await (supabase as any).from("event_runsheet_items").update({ status }).eq("id", it.id);
    setItems((prev) => prev.map((x) => x.id === it.id ? { ...x, status } : x));
  };

  return (
    <section className="px-4 py-5 lg:px-0">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="h-8 w-8 rounded-xl bg-primary/12 text-primary flex items-center justify-center">
            <Calendar className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold leading-tight">Event Run Sheet</h3>
            <p className="text-[11px] text-muted-foreground leading-tight">
              Minute-by-minute timeline. Drafted by Thrive, edited by you.
            </p>
          </div>
        </div>
        <div className="flex gap-1.5">
          <a
            href={`/desk/${project.id}/crew`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-[hsl(var(--energy)/0.4)] bg-[hsl(var(--energy)/0.1)] px-2 py-1 text-[11px] font-bold text-[hsl(var(--energy))] hover:bg-[hsl(var(--energy)/0.18)]"
            title="Open live crew view"
          >
            <Clock className="h-3 w-3" /> Crew
          </a>
          <Button size="sm" variant="outline" onClick={generate} disabled={genBusy}>
            {genBusy ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
            Draft
          </Button>
          <Button size="sm" variant="outline" onClick={() => setOpenAdd(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Item
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-xs text-muted-foreground py-6 text-center">Loading run sheet…</div>
      ) : items.length === 0 ? (
        <button
          type="button"
          onClick={generate}
          disabled={genBusy}
          className="w-full rounded-2xl border border-dashed border-border/80 p-5 text-left hover:border-primary/50 hover:bg-primary/5 transition-colors"
        >
          <p className="text-sm font-semibold inline-flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" /> Draft my run sheet
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Thrive will sketch a realistic timeline from your brief. You edit from there.
          </p>
        </button>
      ) : (
        <ol className="space-y-1.5">
          {items.map((it) => (
            <li key={it.id} className="flex items-start gap-2 rounded-xl border border-border/60 bg-card/40 p-2.5">
              <GripVertical className="h-4 w-4 text-muted-foreground/50 mt-0.5 shrink-0" />
              <div className="w-20 shrink-0 text-[11px] font-mono text-muted-foreground">
                {it.start_time || "—"}
                {it.end_time && <div className="text-[10px]">–{it.end_time}</div>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold leading-tight">{it.title}</p>
                  <Badge className={`text-[10px] uppercase tracking-wider ${STATUS_TONE[it.status]}`}>{it.status.replace("_", " ")}</Badge>
                </div>
                {it.owner_name && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">{it.owner_name}</p>
                )}
                {it.notes && <p className="text-[11px] text-foreground/70 mt-1">{it.notes}</p>}
                <div className="mt-1.5">
                  <select
                    value={it.status}
                    onChange={(e) => setStatus(it, e.target.value as RunsheetItem["status"])}
                    className="text-[10px] uppercase tracking-wider bg-transparent border border-border/60 rounded px-1.5 py-0.5 text-muted-foreground"
                  >
                    <option value="planned">Planned</option>
                    <option value="done">Done</option>
                    <option value="at_risk">At risk</option>
                  </select>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      <Dialog open={openAdd} onOpenChange={setOpenAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Run sheet item</DialogTitle>
            <DialogDescription>Add a moment to the timeline.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Title</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Doors open" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Start</label>
                <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">End</label>
                <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Owner</label>
              <Input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Stage Manager" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenAdd(false)}>Cancel</Button>
            <Button onClick={create} disabled={!title.trim() || creating}>
              {creating && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />} Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
