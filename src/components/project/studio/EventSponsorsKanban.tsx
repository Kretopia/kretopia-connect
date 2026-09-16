import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor,
  useSensor, useSensors, useDroppable, useDraggable,
} from "@dnd-kit/core";
import { Handshake, Plus, Loader2, Mail, Phone, DollarSign, Trash2, GripVertical } from "lucide-react";

interface Sponsor {
  id: string;
  name: string;
  tier: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  package_value: number | null;
  package_currency: string | null;
  deliverables: string | null;
  notes: string | null;
  status: string;
  position: number;
}

// A 5-stage pipeline, left to right: gray -> increasing pink intensity
// -> white (delivered). No per-stage hue switching.
const COLUMNS: { id: string; label: string; tone: string }[] = [
  { id: "lead",      label: "Lead",      tone: "bg-muted text-muted-foreground" },
  { id: "outreach",  label: "Outreach",  tone: "bg-[hsl(var(--energy)/0.12)] text-[hsl(var(--energy))]" },
  { id: "proposed",  label: "Proposed",  tone: "bg-[hsl(var(--energy)/0.2)] text-[hsl(var(--energy))]" },
  { id: "confirmed", label: "Confirmed", tone: "bg-[hsl(var(--energy)/0.3)] text-[hsl(var(--energy))] font-semibold" },
  { id: "delivered", label: "Delivered", tone: "bg-primary/15 text-primary" },
];

const TIERS = ["title", "platinum", "gold", "silver", "bronze", "standard", "in-kind"];

interface Props {
  project: any;
  currentUserId: string;
}

export function EventSponsorsKanban({ project, currentUserId }: Props) {
  const { toast } = useToast();
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  // form
  const [name, setName] = useState("");
  const [tier, setTier] = useState(TIERS[5]);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [packageValue, setPackageValue] = useState("");
  const [deliverables, setDeliverables] = useState("");
  const [notes, setNotes] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("event_sponsors")
      .select("*")
      .eq("project_id", project.id)
      .order("position", { ascending: true })
      .order("created_at", { ascending: false });
    setSponsors((data || []) as Sponsor[]);
    setLoading(false);
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [project.id]);

  const reset = () => {
    setName(""); setTier(TIERS[5]); setContactName(""); setContactEmail("");
    setContactPhone(""); setPackageValue(""); setDeliverables(""); setNotes("");
  };

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const { error } = await (supabase as any).from("event_sponsors").insert({
        project_id: project.id,
        created_by: currentUserId,
        name: name.trim(),
        tier,
        contact_name: contactName.trim() || null,
        contact_email: contactEmail.trim() || null,
        contact_phone: contactPhone.trim() || null,
        package_value: packageValue ? Number(packageValue) : null,
        deliverables: deliverables.trim() || null,
        notes: notes.trim() || null,
        status: "lead",
      });
      if (error) throw error;
      toast({ title: "Sponsor added" });
      reset();
      setOpen(false);
      await load();
    } catch (e: any) {
      toast({ title: "Couldn't add", description: e?.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  const moveTo = async (sponsorId: string, status: string) => {
    const prev = sponsors;
    setSponsors((s) => s.map((x) => x.id === sponsorId ? { ...x, status } : x));
    const { error } = await (supabase as any)
      .from("event_sponsors")
      .update({ status })
      .eq("id", sponsorId);
    if (error) {
      setSponsors(prev);
      toast({ title: "Couldn't move", description: error.message, variant: "destructive" });
    }
  };

  const remove = async (s: Sponsor) => {
    if (!confirm(`Remove ${s.name}?`)) return;
    await (supabase as any).from("event_sponsors").delete().eq("id", s.id);
    setSponsors((prev) => prev.filter((x) => x.id !== s.id));
  };

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const id = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;
    const sponsor = sponsors.find((s) => s.id === id);
    if (!sponsor || sponsor.status === overId) return;
    void moveTo(id, overId);
  };

  const grouped = useMemo(() => {
    const map: Record<string, Sponsor[]> = {};
    for (const c of COLUMNS) map[c.id] = [];
    for (const s of sponsors) (map[s.status] ||= []).push(s);
    return map;
  }, [sponsors]);

  const totals = useMemo(() => {
    const t: Record<string, number> = {};
    for (const c of COLUMNS) {
      t[c.id] = (grouped[c.id] || []).reduce((sum, s) => sum + (Number(s.package_value) || 0), 0);
    }
    t.confirmedPlus = (grouped.confirmed || []).concat(grouped.delivered || [])
      .reduce((sum, s) => sum + (Number(s.package_value) || 0), 0);
    return t;
  }, [grouped]);

  const active = sponsors.find((s) => s.id === activeId) || null;

  return (
    <section className="px-4 py-5 lg:px-0">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="h-8 w-8 rounded-xl bg-primary/12 text-primary flex items-center justify-center">
            <Handshake className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold leading-tight">Sponsors</h3>
            <p className="text-[11px] text-muted-foreground leading-tight">
              {sponsors.length} in pipeline · ${totals.confirmedPlus.toLocaleString()} secured
            </p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add
        </Button>
      </div>

      {loading ? (
        <div className="text-xs text-muted-foreground py-6 text-center">Loading…</div>
      ) : sponsors.length === 0 ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full rounded-2xl border border-dashed border-border/80 p-5 text-left hover:border-primary/50 hover:bg-primary/5 transition-colors"
        >
          <p className="text-sm font-semibold">Build your sponsor pipeline</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Track every brand from first lead through delivered activation. Drag cards across columns.
          </p>
        </button>
      ) : (
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
            {COLUMNS.map((col) => (
              <SponsorColumn
                key={col.id}
                col={col}
                sponsors={grouped[col.id] || []}
                total={totals[col.id] || 0}
                onRemove={remove}
              />
            ))}
          </div>
          <DragOverlay>
            {active ? <SponsorCardView sponsor={active} dragging /> : null}
          </DragOverlay>
        </DndContext>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add sponsor</DialogTitle>
            <DialogDescription>Track the deal from first contact to delivery.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Brand / Sponsor</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Co." />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Tier</label>
                <select
                  value={tier}
                  onChange={(e) => setTier(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                >
                  {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Package value (USD)</label>
                <Input type="number" inputMode="decimal" value={packageValue} onChange={(e) => setPackageValue(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Contact name</label>
              <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Email</label>
                <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Phone</label>
                <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Deliverables</label>
              <Input value={deliverables} onChange={(e) => setDeliverables(e.target.value)} placeholder="Logo on stage, social posts, booth…" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Notes</label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={create} disabled={!name.trim() || busy}>
              {busy && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />} Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function SponsorColumn({
  col, sponsors, total, onRemove,
}: {
  col: { id: string; label: string; tone: string };
  sponsors: Sponsor[];
  total: number;
  onRemove: (s: Sponsor) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });
  return (
    <div
      ref={setNodeRef}
      className={`shrink-0 w-64 snap-start rounded-2xl border bg-card/40 p-2 transition-colors ${
        isOver ? "border-primary/60 bg-primary/5" : "border-border/60"
      }`}
    >
      <div className="flex items-center justify-between px-1.5 py-1">
        <div className="flex items-center gap-1.5">
          <Badge className={`text-[10px] uppercase tracking-wider ${col.tone}`}>{col.label}</Badge>
          <span className="text-[11px] text-muted-foreground">{sponsors.length}</span>
        </div>
        {total > 0 && (
          <span className="text-[10px] font-mono text-muted-foreground">${total.toLocaleString()}</span>
        )}
      </div>
      <div className="space-y-1.5 mt-1 min-h-[60px]">
        {sponsors.map((s) => (
          <DraggableSponsor key={s.id} sponsor={s} onRemove={onRemove} />
        ))}
      </div>
    </div>
  );
}

function DraggableSponsor({ sponsor, onRemove }: { sponsor: Sponsor; onRemove: (s: Sponsor) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: sponsor.id });
  return (
    <div
      ref={setNodeRef}
      style={{ opacity: isDragging ? 0.4 : 1 }}
      className="rounded-xl border border-border/60 bg-background p-2.5 group"
    >
      <div className="flex items-start gap-1.5">
        <button
          {...attributes}
          {...listeners}
          className="touch-none text-muted-foreground/50 hover:text-muted-foreground mt-0.5"
          aria-label="Drag"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <p className="text-sm font-semibold leading-tight truncate">{sponsor.name}</p>
            <button
              onClick={() => onRemove(sponsor)}
              className="text-muted-foreground/50 hover:text-destructive opacity-0 group-hover:opacity-100"
              aria-label="Remove"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {sponsor.tier && (
              <Badge variant="outline" className="text-[9px] uppercase tracking-wider">{sponsor.tier}</Badge>
            )}
            {sponsor.package_value != null && (
              <span className="inline-flex items-center text-[10px] text-muted-foreground">
                <DollarSign className="h-2.5 w-2.5" />{Number(sponsor.package_value).toLocaleString()}
              </span>
            )}
          </div>
          {sponsor.deliverables && (
            <p className="text-[10px] text-foreground/70 mt-1 line-clamp-2">{sponsor.deliverables}</p>
          )}
          {sponsor.contact_name && (
            <p className="text-[10px] text-muted-foreground mt-1 truncate">Contact: {sponsor.contact_name}</p>
          )}
          {sponsor.notes && (
            <p className="text-[10px] text-muted-foreground mt-1 line-clamp-3 whitespace-pre-line">{sponsor.notes}</p>
          )}
          <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
            {sponsor.contact_email && (
              <a href={`mailto:${sponsor.contact_email}`} className="inline-flex items-center gap-0.5 hover:text-primary">
                <Mail className="h-2.5 w-2.5" /> Email
              </a>
            )}
            {sponsor.contact_phone && (
              <a href={`tel:${sponsor.contact_phone}`} className="inline-flex items-center gap-0.5 hover:text-primary">
                <Phone className="h-2.5 w-2.5" /> Call
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SponsorCardView({ sponsor, dragging }: { sponsor: Sponsor; dragging?: boolean }) {
  return (
    <div className={`rounded-xl border border-primary/60 bg-background p-2.5 shadow-lg ${dragging ? "rotate-2" : ""}`}>
      <p className="text-sm font-semibold">{sponsor.name}</p>
      {sponsor.tier && <Badge variant="outline" className="text-[9px] uppercase mt-1">{sponsor.tier}</Badge>}
    </div>
  );
}
