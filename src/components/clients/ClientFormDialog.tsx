import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useUpsertClient, type Client } from "@/hooks/useClients";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  client?: Client | null;
  onSaved?: (c: Client) => void;
}

export const ClientFormDialog = ({ open, onOpenChange, client, onSaved }: Props) => {
  const upsert = useUpsertClient();
  const { toast } = useToast();
  const isEdit = !!client?.id;
  const [form, setForm] = useState(() => ({
    name: client?.name ?? "",
    company_name: client?.company_name ?? "",
    contact_email: client?.contact_email ?? "",
    contact_phone: client?.contact_phone ?? "",
    website: client?.website ?? "",
    default_markup_pct: client?.default_markup_pct ?? 0,
    payment_terms: client?.payment_terms ?? "",
    notes: client?.notes ?? "",
  }));

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name.trim()) {
      toast({ title: "Add a client name", variant: "destructive" });
      return;
    }
    try {
      const saved = await upsert.mutateAsync({ id: client?.id, ...form });
      toast({ title: isEdit ? "Client updated" : "Client added" });
      onSaved?.(saved);
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Couldn't save", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit client" : "New client"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Client / contact name *</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Elisa Leclercq" />
          </div>
          <div>
            <Label>Company / brand</Label>
            <Input value={form.company_name} onChange={(e) => set("company_name", e.target.value)} placeholder="Maison Leclercq" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.contact_email} onChange={(e) => set("contact_email", e.target.value)} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={form.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Website</Label>
            <Input value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Default markup %</Label>
              <Input
                type="number"
                value={form.default_markup_pct}
                onChange={(e) => set("default_markup_pct", parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label>Payment terms</Label>
              <Input value={form.payment_terms} onChange={(e) => set("payment_terms", e.target.value)} placeholder="Net 30" />
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Brand voice, preferences, who's who…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={upsert.isPending}>
            {upsert.isPending ? "Saving…" : client ? "Save" : "Add client"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
