import { useState, useEffect } from "react";
import { Package, Clock, RefreshCw, Check, Plus, Trash2, Loader2, ShoppingCart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ServicePackage {
  id: string;
  tier: string;
  title: string;
  description: string | null;
  price: number;
  currency: string;
  delivery_days: number | null;
  revisions: number | null;
  features: string[];
  is_active: boolean;
}

interface ServicePackagesSectionProps {
  userId: string;
  isOwnProfile: boolean;
}

const TIER_CONFIG: Record<string, { label: string; accent: string }> = {
  basic: { label: "Basic", accent: "border-muted-foreground/20" },
  standard: { label: "Standard", accent: "border-primary/40 ring-1 ring-primary/20" },
  premium: { label: "Premium", accent: "border-amber-500/40 ring-1 ring-amber-500/20" },
};

export const ServicePackagesSection = ({ userId, isOwnProfile }: ServicePackagesSectionProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    tier: "basic",
    title: "",
    description: "",
    price: "",
    currency: "USD",
    delivery_days: "",
    revisions: "1",
    features: "",
  });

  const fetchPackages = async () => {
    const { data } = await supabase
      .from("service_packages")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("display_order");
    setPackages((data as ServicePackage[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchPackages(); }, [userId]);

  const handleSave = async () => {
    if (!user || !form.title || !form.price) return;
    setSaving(true);
    try {
      const payload = {
        user_id: user.id,
        tier: form.tier,
        title: form.title,
        description: form.description || null,
        price: parseFloat(form.price),
        currency: form.currency,
        delivery_days: form.delivery_days ? parseInt(form.delivery_days) : null,
        revisions: form.revisions ? parseInt(form.revisions) : 1,
        features: form.features.split("\n").filter(Boolean),
        display_order: form.tier === "basic" ? 0 : form.tier === "standard" ? 1 : 2,
      };

      if (editingId) {
        await supabase.from("service_packages").update(payload).eq("id", editingId);
      } else {
        await supabase.from("service_packages").insert(payload);
      }

      toast({ title: editingId ? "Package updated!" : "Package created!" });
      setDialogOpen(false);
      resetForm();
      fetchPackages();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("service_packages").update({ is_active: false }).eq("id", id);
    toast({ title: "Package removed" });
    fetchPackages();
  };

  const resetForm = () => {
    setEditingId(null);
    setForm({ tier: "basic", title: "", description: "", price: "", currency: "USD", delivery_days: "", revisions: "1", features: "" });
  };

  const openEdit = (pkg: ServicePackage) => {
    setEditingId(pkg.id);
    setForm({
      tier: pkg.tier,
      title: pkg.title,
      description: pkg.description || "",
      price: pkg.price.toString(),
      currency: pkg.currency,
      delivery_days: pkg.delivery_days?.toString() || "",
      revisions: pkg.revisions?.toString() || "1",
      features: pkg.features.join("\n"),
    });
    setDialogOpen(true);
  };

  if (loading) return null;
  if (packages.length === 0 && !isOwnProfile) return null;

  return (
    <div className="rounded-xl border bg-card p-4 sm:p-6 shadow-sm mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          Service Packages
        </h3>
        {isOwnProfile && packages.length < 3 && (
          <Button size="sm" variant="outline" onClick={() => { resetForm(); setDialogOpen(true); }} className="gap-1">
            <Plus className="h-3 w-3" /> Add
          </Button>
        )}
      </div>

      {packages.length === 0 && isOwnProfile ? (
        <button
          onClick={() => { resetForm(); setDialogOpen(true); }}
          className="w-full p-6 rounded-xl border-2 border-dashed border-border hover:border-primary/50 transition-colors text-center"
        >
          <Package className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium">Create Service Packages</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Offer tiered pricing like Basic, Standard & Premium
          </p>
        </button>
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          {packages.map((pkg) => {
            const config = TIER_CONFIG[pkg.tier] || TIER_CONFIG.basic;
            return (
              <Card
                key={pkg.id}
                className={cn(
                  "p-4 relative transition-shadow hover:shadow-md",
                  config.accent,
                  pkg.tier === "standard" && "md:scale-[1.02]"
                )}
              >
                {pkg.tier === "standard" && (
                  <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 text-[10px]">
                    Popular
                  </Badge>
                )}
                <div className="text-center mb-3">
                  <Badge variant="outline" className="text-[10px] mb-2">{config.label}</Badge>
                  <h4 className="font-semibold text-sm">{pkg.title}</h4>
                  <p className="text-2xl font-bold mt-1">
                    ${pkg.price}
                    <span className="text-xs text-muted-foreground font-normal"> {pkg.currency}</span>
                  </p>
                </div>

                {pkg.description && (
                  <p className="text-xs text-muted-foreground text-center mb-3">{pkg.description}</p>
                )}

                <div className="space-y-1.5 text-xs">
                  {pkg.delivery_days && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {pkg.delivery_days} day delivery
                    </div>
                  )}
                  {pkg.revisions && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <RefreshCw className="h-3 w-3" />
                      {pkg.revisions} revision{pkg.revisions > 1 ? "s" : ""}
                    </div>
                  )}
                  {pkg.features.map((f, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <Check className="h-3 w-3 text-green-500 mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>

                {isOwnProfile ? (
                  <div className="flex gap-1 mt-3">
                    <Button size="sm" variant="ghost" className="flex-1 text-xs h-7" onClick={() => openEdit(pkg)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" className="text-xs h-7 text-destructive" onClick={() => handleDelete(pkg.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    className="w-full mt-3 gap-1.5"
                    variant={pkg.tier === "standard" ? "default" : "outline"}
                  >
                    <ShoppingCart className="h-3.5 w-3.5" />
                    Book Now · ${pkg.price}
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit" : "Create"} Service Package</DialogTitle>
            <DialogDescription>Define what you offer at each pricing tier.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {(["basic", "standard", "premium"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setForm({ ...form, tier: t })}
                  className={cn(
                    "p-2 rounded-lg border text-xs font-medium capitalize transition-all",
                    form.tier === t ? "border-primary bg-primary/10 text-primary" : "border-border"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
            <div>
              <Label className="text-xs">Package Name</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Social Media Kit" />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What's included" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Price</Label>
                <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="100" />
              </div>
              <div>
                <Label className="text-xs">Delivery (days)</Label>
                <Input type="number" value={form.delivery_days} onChange={(e) => setForm({ ...form, delivery_days: e.target.value })} placeholder="7" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Features (one per line)</Label>
              <Textarea value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} placeholder="3 social posts&#10;1 reel&#10;Caption writing" rows={3} />
            </div>
            <Button onClick={handleSave} disabled={saving || !form.title || !form.price} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {editingId ? "Update" : "Create"} Package
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
