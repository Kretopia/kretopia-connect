import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Truck, Mic2, Plus, Loader2, Mail, Phone, DollarSign, Trash2 } from "lucide-react";

type Kind = "supplier" | "talent";

interface Row {
  id: string;
  name: string;
  category?: string | null;
  role?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  fee_amount?: number | null;
  fee_currency?: string | null;
  call_time?: string | null;
  status: string;
  notes?: string | null;
}

const SUPPLIER_CATS = ["venue", "catering", "av", "decor", "security", "transport", "photo/video", "other"];
const TALENT_ROLES = ["performer", "speaker", "host", "DJ", "crew", "other"];

const SUPPLIER_STATUSES = ["lead", "quoted", "booked", "paid", "cancelled"];
const TALENT_STATUSES = ["invited", "confirmed", "declined", "cancelled"];

const STATUS_TONE: Record<string, string> = {
  lead: "bg-muted text-muted-foreground",
  quoted: "bg-[hsl(var(--energy)/0.15)] text-[hsl(var(--energy))]",
  booked: "bg-white/15 text-white font-semibold",
  paid: "bg-primary/15 text-primary",
  invited: "bg-muted text-muted-foreground",
  confirmed: "bg-white/15 text-white font-semibold",
  declined: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
};

interface Props {
  project: any;
  currentUserId: string;
  kind: Kind;
}

export function EventCrmSection({ project, currentUserId, kind }: Props) {
  const { toast } = useToast();
  const table = kind === "supplier" ? "event_suppliers" : "event_talent";
  const labelPlural = kind === "supplier" ? "Suppliers" : "Talent & Crew";
  const labelSingular = kind === "supplier" ? "Supplier" : "Talent";
  const Icon = kind === "supplier" ? Truck : Mic2;
  const cats = kind === "supplier" ? SUPPLIER_CATS : TALENT_ROLES;
  const statuses = kind === "supplier" ? SUPPLIER_STATUSES : TALENT_STATUSES;

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // form
  const [name, setName] = useState("");
  const [category, setCategory] = useState(cats[0]);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [fee, setFee] = useState("");
  const [notes, setNotes] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from(table)
      .select("*")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false });
    setRows((data || []) as Row[]);
    setLoading(false);
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [project.id, kind]);

  const reset = () => {
    setName(""); setCategory(cats[0]); setContactName(""); setContactEmail("");
    setContactPhone(""); setFee(""); setNotes("");
  };

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const payload: any = {
        project_id: project.id,
        created_by: currentUserId,
        name: name.trim(),
        contact_email: contactEmail.trim() || null,
        contact_phone: contactPhone.trim() || null,
        fee_amount: fee ? Number(fee) : null,
        notes: notes.trim() || null,
      };
      if (kind === "supplier") {
        payload.category = category;
        payload.contact_name = contactName.trim() || null;
      } else {
        payload.role = category;
      }
      const { error } = await (supabase as any).from(table).insert(payload);
      if (error) throw error;
      toast({ title: `${labelSingular} added` });
      reset();
      setOpen(false);
      await load();
    } catch (e: any) {
      toast({ title: "Couldn't add", description: e?.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  const setStatus = async (row: Row, status: string) => {
    await (supabase as any).from(table).update({ status }).eq("id", row.id);
    setRows((prev) => prev.map((x) => x.id === row.id ? { ...x, status } : x));
  };

  const remove = async (row: Row) => {
    if (!confirm(`Remove ${row.name}?`)) return;
    await (supabase as any).from(table).delete().eq("id", row.id);
    setRows((prev) => prev.filter((x) => x.id !== row.id));
  };

  const totalFee = useMemo(
    () => rows.reduce((s, r) => s + (Number(r.fee_amount) || 0), 0),
    [rows]
  );

  return (
    <section className="px-4 py-5 lg:px-0">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="h-8 w-8 rounded-xl bg-primary/12 text-primary flex items-center justify-center">
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold leading-tight">{labelPlural}</h3>
            <p className="text-[11px] text-muted-foreground leading-tight">
              {rows.length} on the roster · ${totalFee.toLocaleString()} committed
            </p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add
        </Button>
      </div>

      {loading ? (
        <div className="text-xs text-muted-foreground py-6 text-center">Loading…</div>
      ) : rows.length === 0 ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full rounded-2xl border border-dashed border-border/80 p-5 text-left hover:border-primary/50 hover:bg-primary/5 transition-colors"
        >
          <p className="text-sm font-semibold">Add your first {labelSingular.toLowerCase()}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Track who's on board, fees, and confirmation status in one place.
          </p>
        </button>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li key={r.id} className="rounded-xl border border-border/60 bg-card/40 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold leading-tight truncate">{r.name}</p>
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                      {r.category || r.role}
                    </Badge>
                    <Badge className={`text-[10px] uppercase tracking-wider ${STATUS_TONE[r.status] || ""}`}>
                      {r.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground flex-wrap">
                    {r.contact_email && (
                      <a href={`mailto:${r.contact_email}`} className="inline-flex items-center gap-1 hover:text-primary">
                        <Mail className="h-3 w-3" /> {r.contact_email}
                      </a>
                    )}
                    {r.contact_phone && (
                      <a href={`tel:${r.contact_phone}`} className="inline-flex items-center gap-1 hover:text-primary">
                        <Phone className="h-3 w-3" /> {r.contact_phone}
                      </a>
                    )}
                    {r.fee_amount != null && (
                      <span className="inline-flex items-center gap-0.5">
                        <DollarSign className="h-3 w-3" />{Number(r.fee_amount).toLocaleString()}
                      </span>
                    )}
                  </div>
                  {r.notes && <p className="text-[11px] text-foreground/70 mt-1 line-clamp-2">{r.notes}</p>}
                </div>
                <button
                  onClick={() => remove(r)}
                  className="text-muted-foreground/60 hover:text-destructive p-1"
                  aria-label="Remove"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-2">
                <select
                  value={r.status}
                  onChange={(e) => setStatus(r, e.target.value)}
                  className="text-[10px] uppercase tracking-wider bg-transparent border border-border/60 rounded px-1.5 py-0.5 text-muted-foreground"
                >
                  {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add {labelSingular.toLowerCase()}</DialogTitle>
            <DialogDescription>Track contact, fee and status for this event.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === "supplier" ? "Acme Catering" : "Jamie Doe"} />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">
                {kind === "supplier" ? "Category" : "Role"}
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                {cats.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {kind === "supplier" && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Contact name</label>
                <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
              </div>
            )}
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
              <label className="text-xs font-semibold text-muted-foreground">Fee (USD)</label>
              <Input type="number" inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} />
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
