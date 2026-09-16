import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ClipboardList, Plus, Trash2, Loader2, Eye } from "lucide-react";

interface Question {
  id: string;
  question: string;
  question_type: string;
  required: boolean;
  options: string[];
  position: number;
}

interface Props {
  project: any;
  currentUserId: string;
}

const QUESTION_TYPES: { value: string; label: string; hasOptions?: boolean }[] = [
  { value: "short_text", label: "Short text" },
  { value: "long_text", label: "Long text" },
  { value: "single_select", label: "Single choice", hasOptions: true },
  { value: "multi_select", label: "Multi-select", hasOptions: true },
  { value: "dietary", label: "Dietary requirements" },
  { value: "allergies", label: "Allergies" },
  { value: "social_link", label: "Social link" },
  { value: "meet_intent", label: "Who do you want to meet?" },
];

/**
 * Host-only Studio module for managing custom RSVP questions on an event.
 * Renders only when the project is linked to a creative_jam (event_id).
 */
export function EventRsvpQuestionsBuilder({ project, currentUserId }: Props) {
  const { toast } = useToast();
  const [items, setItems] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [openAdd, setOpenAdd] = useState(false);
  const [creating, setCreating] = useState(false);

  // form
  const [q, setQ] = useState("");
  const [qtype, setQtype] = useState("short_text");
  const [required, setRequired] = useState(false);
  const [optionsText, setOptionsText] = useState("");

  const eventId = project?.event_id as string | undefined;

  const load = async () => {
    if (!eventId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await (supabase as any)
      .from("event_rsvp_questions")
      .select("id, question, question_type, required, options, position")
      .eq("event_id", eventId)
      .order("position", { ascending: true });
    setItems((data || []).map((d: any) => ({ ...d, options: Array.isArray(d.options) ? d.options : [] })));
    setLoading(false);
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [eventId]);

  if (!eventId) return null;

  const reset = () => {
    setQ(""); setQtype("short_text"); setRequired(false); setOptionsText("");
  };

  const create = async () => {
    if (!q.trim()) return;
    setCreating(true);
    try {
      const pos = (items[items.length - 1]?.position || 0) + 1;
      const opts = QUESTION_TYPES.find(t => t.value === qtype)?.hasOptions
        ? optionsText.split("\n").map(s => s.trim()).filter(Boolean)
        : [];
      const { error } = await (supabase as any).from("event_rsvp_questions").insert({
        event_id: eventId,
        question: q.trim(),
        question_type: qtype,
        required,
        options: opts,
        position: pos,
        created_by: currentUserId,
      });
      if (error) throw error;
      reset();
      setOpenAdd(false);
      await load();
      toast({ title: "Question added" });
    } catch (err: any) {
      toast({ title: "Couldn't save", description: err?.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const remove = async (id: string) => {
    const prev = items;
    setItems(items.filter(i => i.id !== id));
    const { error } = await (supabase as any).from("event_rsvp_questions").delete().eq("id", id);
    if (error) {
      setItems(prev);
      toast({ title: "Couldn't delete", description: error.message, variant: "destructive" });
    }
  };

  const typeNeedsOptions = QUESTION_TYPES.find(t => t.value === qtype)?.hasOptions;

  return (
    <section className="rounded-2xl border border-border/60 bg-card/40 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="h-8 w-8 rounded-lg bg-[hsl(var(--energy)/0.15)] text-[hsl(var(--energy))] flex items-center justify-center">
            <ClipboardList className="h-4 w-4" />
          </span>
          <div>
            <h3 className="font-bold text-sm">RSVP Questions</h3>
            <p className="text-[11px] text-muted-foreground">What you ask guests when they sign up</p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpenAdd(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add
        </Button>
      </div>

      {loading ? (
        <div className="text-xs text-muted-foreground py-2">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-xs text-muted-foreground py-2 italic">
          No custom questions yet. Defaults (name + email) are always asked.
        </div>
      ) : (
        <ul className="space-y-1.5">
          {items.map((it) => (
            <li key={it.id} className="flex items-start gap-2 rounded-lg border border-border/40 bg-background/40 p-2.5">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-sm font-medium truncate">{it.question}</p>
                  {it.required && <Badge variant="secondary" className="text-[10px] h-4">Required</Badge>}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {QUESTION_TYPES.find(t => t.value === it.question_type)?.label || it.question_type}
                  {it.options.length > 0 && ` • ${it.options.length} options`}
                </p>
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => remove(it.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={openAdd} onOpenChange={(v) => { setOpenAdd(v); if (!v) reset(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New RSVP question</DialogTitle>
            <DialogDescription>Asked when guests reserve a spot.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Question</Label>
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. What's your dietary preference?" />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={qtype} onValueChange={setQtype}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {QUESTION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {typeNeedsOptions && (
              <div className="space-y-1.5">
                <Label>Options (one per line)</Label>
                <textarea
                  className="w-full min-h-[88px] rounded-md border bg-background p-2 text-sm"
                  value={optionsText}
                  onChange={(e) => setOptionsText(e.target.value)}
                  placeholder={"VIP\nGeneral\nPress"}
                />
              </div>
            )}
            <div className="flex items-center justify-between rounded-lg border border-border/60 p-2.5">
              <Label className="text-sm font-medium cursor-pointer">Required</Label>
              <Switch checked={required} onCheckedChange={setRequired} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenAdd(false)}>Cancel</Button>
            <Button onClick={create} disabled={creating || !q.trim()}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add question"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
