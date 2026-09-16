import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DollarSign, Plus, Pencil, Trash2, MoreVertical, Lock, Globe, Users, Eye, EyeOff,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { SUPPORTED_CURRENCIES } from "@/hooks/useCurrencyConversion";
import { cn } from "@/lib/utils";

type Visibility = "public" | "connections" | "on_request";
type RateType =
  | "day_rate"
  | "half_day"
  | "hourly"
  | "per_deliverable"
  | "package"
  | "usage_buyout"
  | "custom";

interface CreatorRate {
  id: string;
  user_id: string;
  rate_type: RateType;
  label: string;
  amount: number;
  amount_max: number | null;
  currency: string;
  unit: string | null;
  visibility: Visibility;
  notes: string | null;
  sort_order: number;
  is_active: boolean;
}

const RATE_TYPE_OPTIONS: { value: RateType; label: string; defaultUnit: string }[] = [
  { value: "day_rate", label: "Day rate", defaultUnit: "day" },
  { value: "half_day", label: "Half day", defaultUnit: "half-day" },
  { value: "hourly", label: "Hourly", defaultUnit: "hour" },
  { value: "per_deliverable", label: "Per deliverable", defaultUnit: "deliverable" },
  { value: "package", label: "Package", defaultUnit: "project" },
  { value: "usage_buyout", label: "Usage / Buyout", defaultUnit: "usage" },
  { value: "custom", label: "Custom", defaultUnit: "" },
];

const VISIBILITY_META: Record<Visibility, { label: string; icon: typeof Globe; hint: string }> = {
  public: { label: "Public", icon: Globe, hint: "Visible to everyone" },
  connections: { label: "Connections", icon: Users, hint: "Visible to your accepted connections" },
  on_request: { label: "On request", icon: Lock, hint: "Price hidden — buyers must ask" },
};

interface Props {
  userId: string;
  isOwner: boolean;
}

const emptyForm = (): Partial<CreatorRate> => ({
  rate_type: "day_rate",
  label: "Day rate",
  amount: 0,
  amount_max: null,
  currency: "USD",
  unit: "day",
  visibility: "public",
  notes: "",
  is_active: true,
});

const formatMoney = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
};

export const RateCardSection = ({ userId, isOwner }: Props) => {
  const { toast } = useToast();
  const [rates, setRates] = useState<CreatorRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<CreatorRate> | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("creator_rates")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (!error && data) setRates(data as CreatorRate[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [userId]);

  const openCreate = () => {
    setEditing(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (rate: CreatorRate) => {
    setEditing(rate);
    setDialogOpen(true);
  };

  const handleTypeChange = (value: RateType) => {
    const opt = RATE_TYPE_OPTIONS.find((o) => o.value === value);
    setEditing((prev) => ({
      ...prev,
      rate_type: value,
      unit: prev?.unit && prev.unit.length > 0 ? prev.unit : opt?.defaultUnit ?? "",
      label:
        !prev?.label || RATE_TYPE_OPTIONS.some((o) => o.label === prev?.label)
          ? opt?.label ?? ""
          : prev.label,
    }));
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.label || editing.amount === undefined || editing.amount === null) {
      toast({ title: "Add a label and amount", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      user_id: userId,
      rate_type: editing.rate_type ?? "custom",
      label: editing.label,
      amount: Number(editing.amount) || 0,
      amount_max: editing.amount_max ? Number(editing.amount_max) : null,
      currency: editing.currency ?? "USD",
      unit: editing.unit ?? null,
      visibility: (editing.visibility as Visibility) ?? "public",
      notes: editing.notes ?? null,
      is_active: editing.is_active ?? true,
      sort_order: editing.sort_order ?? rates.length,
    };
    const { error } = editing.id
      ? await supabase.from("creator_rates").update(payload).eq("id", editing.id)
      : await supabase.from("creator_rates").insert(payload);

    setSaving(false);
    if (error) {
      toast({ title: "Could not save rate", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: editing.id ? "Rate updated" : "Rate added" });
    setDialogOpen(false);
    setEditing(null);
    load();
  };

  const remove = async () => {
    if (!deletingId) return;
    const { error } = await supabase.from("creator_rates").delete().eq("id", deletingId);
    if (error) {
      toast({ title: "Could not delete", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Rate removed" });
      load();
    }
    setDeletingId(null);
  };

  // Hide block entirely for non-owners with no rates
  if (!isOwner && !loading && rates.length === 0) return null;

  return (
    <Card className="p-5 mb-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold leading-tight">Rate Card</h2>
            <p className="text-xs text-muted-foreground">
              Day rates, per-deliverable pricing & packages
            </p>
          </div>
        </div>
        {isOwner && (
          <Button size="sm" onClick={openCreate} className="shrink-0">
            <Plus className="h-4 w-4 mr-1" /> Add rate
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-14 rounded-md bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : rates.length === 0 ? (
        <div className="text-center py-8 border border-dashed rounded-lg">
          <p className="text-sm text-muted-foreground mb-3">
            No rates published yet. Add your day rate or per-deliverable pricing so clients
            know what to expect.
          </p>
          {isOwner && (
            <Button variant="outline" size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" /> Add your first rate
            </Button>
          )}
        </div>
      ) : (
        <div className="divide-y border rounded-lg">
          {rates.map((rate) => {
            const Vis = VISIBILITY_META[rate.visibility].icon;
            const hidePrice = rate.visibility === "on_request" && !isOwner;
            return (
              <div
                key={rate.id}
                className="flex items-center gap-3 px-4 py-3 first:rounded-t-lg last:rounded-b-lg"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{rate.label}</span>
                    {isOwner && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] gap-1 px-1.5 py-0",
                          rate.visibility === "public" && "border-emerald-500/40 text-emerald-600",
                          rate.visibility === "connections" && "border-primary/40 text-primary",
                          rate.visibility === "on_request" && "border-amber-500/40 text-amber-600"
                        )}
                      >
                        <Vis className="h-3 w-3" />
                        {VISIBILITY_META[rate.visibility].label}
                      </Badge>
                    )}
                  </div>
                  {rate.notes && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {rate.notes}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  {hidePrice ? (
                    <span className="text-sm font-semibold text-muted-foreground inline-flex items-center gap-1">
                      <EyeOff className="h-3.5 w-3.5" /> On request
                    </span>
                  ) : (
                    <div className="font-semibold text-sm">
                      {formatMoney(rate.amount, rate.currency)}
                      {rate.amount_max && rate.amount_max > rate.amount && (
                        <> – {formatMoney(rate.amount_max, rate.currency)}</>
                      )}
                      {rate.unit && (
                        <span className="text-muted-foreground font-normal"> /{rate.unit}</span>
                      )}
                    </div>
                  )}
                </div>
                {isOwner && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(rate)}>
                        <Pencil className="h-4 w-4 mr-2" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setDeletingId(rate.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Editor dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit rate" : "Add a rate"}</DialogTitle>
            <DialogDescription>
              Set what you charge — keep it public, share only with connections, or hide the price.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select
                    value={editing.rate_type}
                    onValueChange={(v) => handleTypeChange(v as RateType)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {RATE_TYPE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Visibility</Label>
                  <Select
                    value={editing.visibility}
                    onValueChange={(v) =>
                      setEditing({ ...editing, visibility: v as Visibility })
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(VISIBILITY_META) as Visibility[]).map((v) => (
                        <SelectItem key={v} value={v}>{VISIBILITY_META[v].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Label</Label>
                <Input
                  placeholder="e.g. Day rate, Per Reel, Tour Package"
                  value={editing.label ?? ""}
                  onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Currency</Label>
                  <Select
                    value={editing.currency}
                    onValueChange={(v) => setEditing({ ...editing, currency: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-60">
                      {SUPPORTED_CURRENCIES.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    min={0}
                    value={editing.amount ?? ""}
                    onChange={(e) =>
                      setEditing({ ...editing, amount: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Max (opt.)</Label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="Range"
                    value={editing.amount_max ?? ""}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        amount_max: e.target.value ? parseFloat(e.target.value) : null,
                      })
                    }
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Unit</Label>
                <Input
                  placeholder="day, hour, reel, song, post…"
                  value={editing.unit ?? ""}
                  onChange={(e) => setEditing({ ...editing, unit: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Notes (usage rights, scope, terms…)</Label>
                <Textarea
                  rows={3}
                  placeholder="e.g. Includes 6mo organic social usage. Excludes paid media."
                  value={editing.notes ?? ""}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : editing?.id ? "Save changes" : "Add rate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this rate?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes it from your rate card. You can always add it back later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
