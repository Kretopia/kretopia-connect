import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, Plus, Trash2, Calendar, MapPin, Shield, Loader2, GripVertical } from "lucide-react";

interface Props { project: any; currentUserId: string; }

interface Look { id: string; project_id: string; name: string; order_idx: number; wardrobe: any; reference_urls: string[] | null; notes: string | null; }
interface CallSheet { id: string; project_id: string; shoot_date: string | null; call_time: string | null; wrap_time: string | null; location: any; contacts: any; notes: string | null; }
interface UsageRight { id: string; project_id: string; scope: string; territory: string | null; duration_months: number | null; exclusivity: boolean; rate_usd: number | null; notes: string | null; }

const SCOPES = ["editorial", "commercial", "social", "ooh", "broadcast", "web"];

export function ModelingStudioSection({ project, currentUserId }: Props) {
  const { toast } = useToast();
  const [tab, setTab] = useState("call_sheet");

  // CALL SHEET
  const [callSheet, setCallSheet] = useState<CallSheet | null>(null);
  const [csDraft, setCsDraft] = useState({ shoot_date: "", call_time: "", wrap_time: "", location_name: "", location_address: "", notes: "" });
  const [savingCs, setSavingCs] = useState(false);

  // LOOKS
  const [looks, setLooks] = useState<Look[]>([]);
  const [openLook, setOpenLook] = useState(false);
  const [lookDraft, setLookDraft] = useState({ name: "", notes: "", reference_urls: "" });

  // USAGE
  const [usage, setUsage] = useState<UsageRight[]>([]);
  const [openUsage, setOpenUsage] = useState(false);
  const [usageDraft, setUsageDraft] = useState({ scope: "editorial", territory: "worldwide", duration_months: "12", exclusivity: false, rate_usd: "", notes: "" });

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [project?.id]);

  async function loadAll() {
    if (!project?.id) return;
    const [{ data: cs }, { data: lk }, { data: ur }] = await Promise.all([
      supabase.from("modeling_call_sheets" as any).select("*").eq("project_id", project.id).maybeSingle(),
      supabase.from("modeling_looks" as any).select("*").eq("project_id", project.id).order("order_idx", { ascending: true }),
      supabase.from("modeling_usage_rights" as any).select("*").eq("project_id", project.id).order("created_at", { ascending: false }),
    ]);
    if (cs) {
      setCallSheet(cs as any);
      setCsDraft({
        shoot_date: (cs as any).shoot_date || "",
        call_time: (cs as any).call_time || "",
        wrap_time: (cs as any).wrap_time || "",
        location_name: (cs as any).location?.name || "",
        location_address: (cs as any).location?.address || "",
        notes: (cs as any).notes || "",
      });
    }
    setLooks((lk as any) || []);
    setUsage((ur as any) || []);
  }

  async function saveCallSheet() {
    setSavingCs(true);
    const payload = {
      project_id: project.id,
      shoot_date: csDraft.shoot_date || null,
      call_time: csDraft.call_time || null,
      wrap_time: csDraft.wrap_time || null,
      location: { name: csDraft.location_name, address: csDraft.location_address },
      notes: csDraft.notes || null,
      created_by: currentUserId,
    };
    const { error } = callSheet
      ? await supabase.from("modeling_call_sheets" as any).update(payload).eq("id", callSheet.id)
      : await supabase.from("modeling_call_sheets" as any).insert(payload);
    setSavingCs(false);
    if (error) { toast({ title: "Couldn't save", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Call sheet saved" });
    loadAll();
  }

  async function addLook() {
    if (!lookDraft.name.trim()) return;
    const refs = lookDraft.reference_urls.split(/[\s,]+/).filter(Boolean);
    const { error } = await supabase.from("modeling_looks" as any).insert({
      project_id: project.id,
      name: lookDraft.name.trim(),
      notes: lookDraft.notes || null,
      reference_urls: refs,
      order_idx: looks.length,
      created_by: currentUserId,
    });
    if (error) { toast({ title: "Couldn't add", description: error.message, variant: "destructive" }); return; }
    setOpenLook(false);
    setLookDraft({ name: "", notes: "", reference_urls: "" });
    loadAll();
  }

  async function deleteLook(id: string) {
    await supabase.from("modeling_looks" as any).delete().eq("id", id);
    loadAll();
  }

  async function addUsage() {
    const { error } = await supabase.from("modeling_usage_rights" as any).insert({
      project_id: project.id,
      scope: usageDraft.scope,
      territory: usageDraft.territory || null,
      duration_months: usageDraft.duration_months ? Number(usageDraft.duration_months) : null,
      exclusivity: usageDraft.exclusivity,
      rate_usd: usageDraft.rate_usd ? Number(usageDraft.rate_usd) : null,
      notes: usageDraft.notes || null,
      created_by: currentUserId,
    });
    if (error) { toast({ title: "Couldn't add", description: error.message, variant: "destructive" }); return; }
    setOpenUsage(false);
    setUsageDraft({ scope: "editorial", territory: "worldwide", duration_months: "12", exclusivity: false, rate_usd: "", notes: "" });
    loadAll();
  }

  async function deleteUsage(id: string) {
    await supabase.from("modeling_usage_rights" as any).delete().eq("id", id);
    loadAll();
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Camera className="h-4 w-4 text-primary" />
        <h2 className="font-serif text-lg">Modeling Shoot</h2>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="call_sheet"><Calendar className="h-3.5 w-3.5 mr-1.5" />Call Sheet</TabsTrigger>
          <TabsTrigger value="looks"><GripVertical className="h-3.5 w-3.5 mr-1.5" />Looks</TabsTrigger>
          <TabsTrigger value="usage"><Shield className="h-3.5 w-3.5 mr-1.5" />Usage</TabsTrigger>
        </TabsList>

        {/* CALL SHEET */}
        <TabsContent value="call_sheet" className="space-y-3 pt-3">
          <div className="grid grid-cols-3 gap-2">
            <div><Label className="text-xs">Date</Label><Input type="date" value={csDraft.shoot_date} onChange={(e) => setCsDraft((d) => ({ ...d, shoot_date: e.target.value }))} /></div>
            <div><Label className="text-xs">Call</Label><Input type="time" value={csDraft.call_time} onChange={(e) => setCsDraft((d) => ({ ...d, call_time: e.target.value }))} /></div>
            <div><Label className="text-xs">Wrap</Label><Input type="time" value={csDraft.wrap_time} onChange={(e) => setCsDraft((d) => ({ ...d, wrap_time: e.target.value }))} /></div>
          </div>
          <div><Label className="text-xs">Location name</Label><Input value={csDraft.location_name} onChange={(e) => setCsDraft((d) => ({ ...d, location_name: e.target.value }))} placeholder="Studio 5, Brooklyn" /></div>
          <div><Label className="text-xs">Address</Label><Input value={csDraft.location_address} onChange={(e) => setCsDraft((d) => ({ ...d, location_address: e.target.value }))} placeholder="123 Wythe Ave, Brooklyn, NY" /></div>
          <div><Label className="text-xs">Notes (parking, lunch, contacts…)</Label><Textarea rows={3} value={csDraft.notes} onChange={(e) => setCsDraft((d) => ({ ...d, notes: e.target.value }))} /></div>
          {csDraft.location_address && (
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(csDraft.location_address)}`}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
            ><MapPin className="h-3 w-3" />Get directions</a>
          )}
          <Button onClick={saveCallSheet} disabled={savingCs} className="w-full">
            {savingCs ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            {callSheet ? "Update call sheet" : "Save call sheet"}
          </Button>
        </TabsContent>

        {/* LOOKS */}
        <TabsContent value="looks" className="space-y-2 pt-3">
          <Button size="sm" variant="outline" className="w-full" onClick={() => setOpenLook(true)}>
            <Plus className="h-4 w-4 mr-1.5" />Add look
          </Button>
          {looks.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">No looks yet. Add one to start your shooting order.</p>
          ) : looks.map((l, i) => (
            <div key={l.id} className="flex items-center gap-2 rounded-lg border border-border bg-background p-2.5">
              <Badge variant="outline" className="shrink-0">{i + 1}</Badge>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{l.name}</div>
                {l.notes && <div className="text-xs text-muted-foreground truncate">{l.notes}</div>}
                {l.reference_urls?.length ? <div className="text-[10px] text-muted-foreground">{l.reference_urls.length} ref{l.reference_urls.length > 1 ? "s" : ""}</div> : null}
              </div>
              <button onClick={() => deleteLook(l.id)} className="text-muted-foreground hover:text-destructive p-1">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </TabsContent>

        {/* USAGE */}
        <TabsContent value="usage" className="space-y-2 pt-3">
          <Button size="sm" variant="outline" className="w-full" onClick={() => setOpenUsage(true)}>
            <Plus className="h-4 w-4 mr-1.5" />Add usage right
          </Button>
          {usage.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">No usage rights logged. Lock these in before the shoot.</p>
          ) : usage.map((u) => (
            <div key={u.id} className="flex items-center gap-2 rounded-lg border border-border bg-background p-2.5">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium capitalize">{u.scope}{u.exclusivity ? " · Exclusive" : ""}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {[u.territory, u.duration_months ? `${u.duration_months}mo` : null, u.rate_usd ? `$${u.rate_usd}` : null].filter(Boolean).join(" · ")}
                </div>
              </div>
              <button onClick={() => deleteUsage(u.id)} className="text-muted-foreground hover:text-destructive p-1">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </TabsContent>
      </Tabs>

      {/* LOOK DIALOG */}
      <Dialog open={openLook} onOpenChange={setOpenLook}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add look</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Name</Label><Input value={lookDraft.name} onChange={(e) => setLookDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Look 1 — denim editorial" /></div>
            <div><Label className="text-xs">Notes (wardrobe, accessories)</Label><Textarea rows={2} value={lookDraft.notes} onChange={(e) => setLookDraft((d) => ({ ...d, notes: e.target.value }))} /></div>
            <div><Label className="text-xs">Reference URLs (comma or space separated)</Label><Textarea rows={2} value={lookDraft.reference_urls} onChange={(e) => setLookDraft((d) => ({ ...d, reference_urls: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button onClick={addLook}>Add look</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* USAGE DIALOG */}
      <Dialog open={openUsage} onOpenChange={setOpenUsage}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add usage right</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Scope</Label>
              <Select value={usageDraft.scope} onValueChange={(v) => setUsageDraft((d) => ({ ...d, scope: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SCOPES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Territory</Label><Input value={usageDraft.territory} onChange={(e) => setUsageDraft((d) => ({ ...d, territory: e.target.value }))} /></div>
              <div><Label className="text-xs">Duration (months)</Label><Input value={usageDraft.duration_months} onChange={(e) => setUsageDraft((d) => ({ ...d, duration_months: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Rate (USD)</Label><Input value={usageDraft.rate_usd} onChange={(e) => setUsageDraft((d) => ({ ...d, rate_usd: e.target.value }))} /></div>
              <label className="flex items-center gap-2 mt-5 text-sm">
                <input type="checkbox" checked={usageDraft.exclusivity} onChange={(e) => setUsageDraft((d) => ({ ...d, exclusivity: e.target.checked }))} />
                Exclusive
              </label>
            </div>
            <div><Label className="text-xs">Notes</Label><Textarea rows={2} value={usageDraft.notes} onChange={(e) => setUsageDraft((d) => ({ ...d, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button onClick={addUsage}>Add</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
