import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CompCardPreview } from "@/components/passport/model/CompCardPreview";
import { SocialFeedIngest } from "@/components/passport/model/SocialFeedIngest";
import { BrandLoader } from "@/components/brand/BrandDots";
import { ArrowLeft, Upload, Download, Share2, Save, Link2, Trash2 } from "lucide-react";
import { Helmet } from "react-helmet-async";

const SLOT_LABELS = ["Headshot", "Profile", "Full Body", "Editorial", "Swim / Fit"];

export default function CompCardBuilder() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const cardRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [slots, setSlots] = useState<(string | null)[]>([null, null, null, null, null]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url, portfolio_links, mother_agency, model_unions, model_categories, model_stats, comp_card_layout")
        .eq("user_id", user.id)
        .maybeSingle();
      setProfile(data);
      const layout: any = (data as any)?.comp_card_layout;
      if (layout?.slots && Array.isArray(layout.slots)) {
        const next = [...slots];
        layout.slots.forEach((s: any) => {
          if (typeof s?.slot_index === "number" && s.image_url) next[s.slot_index] = s.image_url;
        });
        setSlots(next);
      } else if ((data as any)?.avatar_url) {
        setSlots((s) => { const c = [...s]; if (!c[0]) c[0] = (data as any).avatar_url; return c; });
      }
      setLoading(false);
    })();
  }, [user?.id]);

  const setSlot = (i: number, url: string | null) =>
    setSlots((s) => { const c = [...s]; c[i] = url; return c; });

  const uploadToSlot = async (i: number, file: File) => {
    if (!user) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Pick an image file", variant: "destructive" });
      return;
    }
    const path = `${user.id}/comp-${Date.now()}-${i}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await supabase.storage.from("portfolio").upload(path, file, { upsert: true });
    if (error) { toast({ title: "Upload failed", description: error.message, variant: "destructive" }); return; }
    const { data } = supabase.storage.from("portfolio").getPublicUrl(path);
    setSlot(i, data.publicUrl);
  };

  const importFromPortfolio = (i: number) => {
    const links: string[] = profile?.portfolio_links || [];
    if (!links.length) { toast({ title: "No portfolio links yet", description: "Pull some from Instagram / TikTok below." }); return; }
    // pick first link not already used in another slot
    const used = new Set(slots.filter(Boolean) as string[]);
    const next = links.find((u) => !used.has(u)) || links[0];
    setSlot(i, next);
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const layout = {
      slots: slots.map((image_url, slot_index) => ({ slot_index, image_url })).filter((s) => s.image_url),
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("profiles")
      .update({ comp_card_layout: layout as any } as any)
      .eq("user_id", user.id);
    setSaving(false);
    if (error) { toast({ title: "Couldn't save", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Comp card saved" });
  };

  const exportPdf = async () => {
    if (!cardRef.current || !user) return;
    setExporting(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const canvas = await html2canvas(cardRef.current, { backgroundColor: "#ffffff", scale: 2, useCORS: true });
      const img = canvas.toDataURL("image/jpeg", 0.92);
      // 5.5 x 8.5 in @ 72dpi
      const pdf = new jsPDF({ unit: "in", format: [5.5, 8.5], orientation: "portrait" });
      pdf.addImage(img, "JPEG", 0, 0, 5.5, 8.5);
      const name = (profile?.full_name || "comp-card").toString().toLowerCase().replace(/\s+/g, "-");
      pdf.save(`${name}-comp-card.pdf`);
    } catch (e: any) {
      toast({ title: "Export failed", description: e?.message || "", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const copyShareLink = async () => {
    if (!user) return;
    const url = `${window.location.origin}/comp/${user.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied", description: url });
    } catch {
      toast({ title: url });
    }
  };

  if (loading) return <div className="min-h-screen grid place-items-center"><BrandLoader /></div>;

  return (
    <div className="min-h-screen bg-background pb-32">
      <Helmet><title>Comp Card Builder — Kretopia</title></Helmet>

      <header className="sticky top-0 z-10 bg-background border-b border-border px-3 py-3 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <h1 className="font-serif text-lg leading-tight">Comp Card</h1>
          <p className="text-xs text-muted-foreground">Industry-standard 5.5 × 8.5</p>
        </div>
        <Button variant="outline" size="sm" onClick={save} disabled={saving}>
          <Save className="h-3.5 w-3.5 mr-1" />{saving ? "Saving" : "Save"}
        </Button>
      </header>

      <div className="max-w-md mx-auto px-4 py-5 space-y-5">
        <div ref={cardRef} className="bg-white">
          <CompCardPreview
            name={profile?.full_name || "Model"}
            agency={profile?.mother_agency}
            unions={profile?.model_unions}
            categories={profile?.model_categories}
            stats={profile?.model_stats}
            images={slots.filter(Boolean) as string[]}
            contact={null}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={copyShareLink}>
            <Share2 className="h-4 w-4 mr-2" />Share link
          </Button>
          <Button onClick={exportPdf} disabled={exporting}>
            <Download className="h-4 w-4 mr-2" />{exporting ? "Exporting" : "Export PDF"}
          </Button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Slots</h2>
            <span className="text-[10px] text-muted-foreground">{(profile?.portfolio_links || []).length} portfolio link{(profile?.portfolio_links || []).length === 1 ? "" : "s"}</span>
          </div>
          {user && (
            <SocialFeedIngest
              userId={user.id}
              existingLinks={profile?.portfolio_links || []}
              onIngested={(added) => setProfile((p: any) => ({ ...p, portfolio_links: [...(p?.portfolio_links || []), ...added] }))}
            />
          )}
          {SLOT_LABELS.map((label, i) => (
            <SlotRow
              key={i}
              label={label}
              value={slots[i]}
              onUpload={(f) => uploadToSlot(i, f)}
              onPaste={(v) => setSlot(i, v || null)}
              onClear={() => setSlot(i, null)}
              onPortfolio={() => importFromPortfolio(i)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function SlotRow({
  label, value, onUpload, onPaste, onClear, onPortfolio,
}: {
  label: string;
  value: string | null;
  onUpload: (f: File) => void;
  onPaste: (v: string) => void;
  onClear: () => void;
  onPortfolio: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="rounded-xl border border-border p-3 space-y-2">
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-md bg-muted overflow-hidden grid place-items-center text-[10px] text-muted-foreground shrink-0">
          {value ? <img src={value} alt={label} className="w-full h-full object-cover" /> : label}
        </div>
        <div className="flex-1 min-w-0">
          <Label className="text-xs">{label}</Label>
          <Input
            placeholder="Paste image URL"
            value={value || ""}
            onChange={(e) => onPaste(e.target.value)}
            className="h-8 mt-1 text-xs"
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.currentTarget.value = ""; }} />
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
          <Upload className="h-3 w-3 mr-1" />Upload
        </Button>
        <Button size="sm" variant="ghost" onClick={onPortfolio}>
          <Link2 className="h-3 w-3 mr-1" />From portfolio
        </Button>
        {value && (
          <Button size="sm" variant="ghost" onClick={onClear} className="text-destructive">
            <Trash2 className="h-3 w-3 mr-1" />Clear
          </Button>
        )}
      </div>
    </div>
  );
}
