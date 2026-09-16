import { useEffect, useRef, useState } from "react";
import { Loader2, Upload, Plus, X, Check, Save, Trash2, Palette as PaletteIcon, Type, Megaphone, Link as LinkIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

interface Props {
  /** Optional — when set the vault is pinned to a project. */
  projectId?: string | null;
  /** Optional — load a specific vault id (e.g. when editing project vault). */
  vaultId?: string | null;
  onSaved?: (vault: any) => void;
}

interface Vault {
  id?: string;
  user_id?: string;
  project_id?: string | null;
  name: string;
  is_default: boolean;
  logo_url: string | null;
  logo_dark_url: string | null;
  palette: string[];
  fonts: { heading?: string; body?: string };
  voice_tone: string | null;
  tagline: string | null;
  do_dont: { do: string[]; dont: string[] };
  links: { website?: string; instagram?: string; youtube?: string };
}

const EMPTY_VAULT: Vault = {
  name: "My Brand",
  is_default: true,
  logo_url: null,
  logo_dark_url: null,
  palette: ["#0F172A", "#FF0A78", "#9413D2"],
  fonts: { heading: "", body: "" },
  voice_tone: "",
  tagline: "",
  do_dont: { do: [], dont: [] },
  links: {},
};

export function BrandVaultEditor({ projectId = null, vaultId = null, onSaved }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [vault, setVault] = useState<Vault>({ ...EMPTY_VAULT, project_id: projectId, is_default: !projectId });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [doInput, setDoInput] = useState("");
  const [dontInput, setDontInput] = useState("");
  const [paletteInput, setPaletteInput] = useState("");
  const logoRef = useRef<HTMLInputElement>(null);

  // Load
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        let query = supabase.from("brand_vaults").select("*").eq("user_id", user.id);
        if (vaultId) {
          query = query.eq("id", vaultId);
        } else if (projectId) {
          query = query.eq("project_id", projectId);
        } else {
          query = query.is("project_id", null).eq("is_default", true);
        }
        const { data } = await query.maybeSingle();
        if (cancelled) return;
        if (data) {
          setVault({
            id: data.id,
            user_id: data.user_id,
            project_id: data.project_id,
            name: data.name,
            is_default: data.is_default,
            logo_url: data.logo_url,
            logo_dark_url: data.logo_dark_url,
            palette: Array.isArray(data.palette) ? (data.palette as string[]) : [],
            fonts: (data.fonts as any) || {},
            voice_tone: data.voice_tone,
            tagline: data.tagline,
            do_dont: (data.do_dont as any) || { do: [], dont: [] },
            links: (data.links as any) || {},
          });
        } else {
          setVault({
            ...EMPTY_VAULT,
            project_id: projectId,
            is_default: !projectId,
            name: projectId ? "Project brand" : "My Brand",
          });
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, projectId, vaultId]);

  const uploadLogo = async (file: File, field: "logo_url" | "logo_dark_url") => {
    if (!user) return;
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${user.id}/brand-vault/${vault.id || "default"}-${field}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("portfolio").upload(path, file, {
        upsert: true, contentType: file.type,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("portfolio").getPublicUrl(path);
      setVault((v) => ({ ...v, [field]: data.publicUrl }));
      toast({ title: "Logo uploaded" });
    } catch (e: any) {
      toast({ title: "Couldn't upload logo", description: e?.message, variant: "destructive" });
    }
  };

  const addColor = () => {
    const c = paletteInput.trim();
    if (!c) return;
    const isHex = /^#?[0-9a-fA-F]{3,8}$/.test(c);
    if (!isHex) {
      toast({ title: "Use a hex color", description: "e.g. #FF0A78", variant: "destructive" });
      return;
    }
    const normalized = c.startsWith("#") ? c : `#${c}`;
    setVault((v) => ({ ...v, palette: [...v.palette, normalized] }));
    setPaletteInput("");
  };

  const removeColor = (i: number) =>
    setVault((v) => ({ ...v, palette: v.palette.filter((_, idx) => idx !== i) }));

  const addDo = () => {
    if (!doInput.trim()) return;
    setVault((v) => ({ ...v, do_dont: { ...v.do_dont, do: [...v.do_dont.do, doInput.trim()] } }));
    setDoInput("");
  };
  const addDont = () => {
    if (!dontInput.trim()) return;
    setVault((v) => ({ ...v, do_dont: { ...v.do_dont, dont: [...v.do_dont.dont, dontInput.trim()] } }));
    setDontInput("");
  };
  const removeDo = (i: number) =>
    setVault((v) => ({ ...v, do_dont: { ...v.do_dont, do: v.do_dont.do.filter((_, idx) => idx !== i) } }));
  const removeDont = (i: number) =>
    setVault((v) => ({ ...v, do_dont: { ...v.do_dont, dont: v.do_dont.dont.filter((_, idx) => idx !== i) } }));

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const payload = {
        user_id: user.id,
        project_id: vault.project_id ?? null,
        name: vault.name || (vault.project_id ? "Project brand" : "My Brand"),
        is_default: !!vault.is_default && !vault.project_id,
        logo_url: vault.logo_url,
        logo_dark_url: vault.logo_dark_url,
        palette: vault.palette,
        fonts: vault.fonts,
        voice_tone: vault.voice_tone || null,
        tagline: vault.tagline || null,
        do_dont: vault.do_dont,
        links: vault.links,
      };

      let saved;
      if (vault.id) {
        const { data, error } = await supabase
          .from("brand_vaults").update(payload).eq("id", vault.id).select().single();
        if (error) throw error;
        saved = data;
      } else {
        const { data, error } = await supabase
          .from("brand_vaults").insert(payload).select().single();
        if (error) throw error;
        saved = data;
        setVault((v) => ({ ...v, id: saved.id }));
      }
      toast({ title: "Brand Vault saved", description: "Thrive will use this for every doc it generates." });
      window.dispatchEvent(new CustomEvent("brand-vault:updated"));
      onSaved?.(saved);
    } catch (e: any) {
      toast({ title: "Couldn't save", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!vault.id) return;
    if (!confirm("Delete this brand vault?")) return;
    const { error } = await supabase.from("brand_vaults").delete().eq("id", vault.id);
    if (error) {
      toast({ title: "Couldn't delete", description: error.message, variant: "destructive" });
      return;
    }
    setVault({ ...EMPTY_VAULT, project_id: projectId, is_default: !projectId });
    toast({ title: "Brand Vault deleted" });
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Name + scope */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <Label className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              {vault.project_id ? "Project brand" : "Personal default brand"}
            </Label>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {vault.project_id
                ? "Used by every doc generated inside this Studio."
                : "Used by Thrive everywhere unless a Studio has its own brand."}
            </p>
          </div>
          {vault.id && (
            <Button size="sm" variant="ghost" onClick={remove} className="text-destructive h-8 px-2">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        <div>
          <Label className="text-xs">Brand name</Label>
          <Input
            value={vault.name}
            onChange={(e) => setVault((v) => ({ ...v, name: e.target.value }))}
            placeholder="e.g. Studio Atlas"
            className="mt-1"
          />
        </div>
        <div>
          <Label className="text-xs">Tagline (one line)</Label>
          <Input
            value={vault.tagline || ""}
            onChange={(e) => setVault((v) => ({ ...v, tagline: e.target.value }))}
            placeholder="The line that goes under your logo"
            className="mt-1"
          />
        </div>
      </Card>

      {/* Logo */}
      <Card className="p-4 space-y-3">
        <Label className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-1.5">
          <Upload className="h-3 w-3" /> Logo
        </Label>
        <div className="flex items-center gap-3">
          <div className="h-20 w-20 rounded-xl border border-border bg-muted/40 flex items-center justify-center overflow-hidden">
            {vault.logo_url ? (
              <img src={vault.logo_url} alt="logo" className="max-h-full max-w-full object-contain" />
            ) : (
              <span className="text-[10px] text-muted-foreground">No logo</span>
            )}
          </div>
          <div className="flex-1">
            <input
              ref={logoRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadLogo(f, "logo_url");
                e.target.value = "";
              }}
            />
            <Button size="sm" variant="outline" onClick={() => logoRef.current?.click()}>
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              {vault.logo_url ? "Replace logo" : "Upload logo"}
            </Button>
            {vault.logo_url && (
              <Button size="sm" variant="ghost" className="text-destructive h-8 px-2 ml-1"
                onClick={() => setVault((v) => ({ ...v, logo_url: null }))}>
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
            <p className="text-[10px] text-muted-foreground mt-1.5">PNG or SVG with transparent bg works best.</p>
          </div>
        </div>
      </Card>

      {/* Palette */}
      <Card className="p-4 space-y-3">
        <Label className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-1.5">
          <PaletteIcon className="h-3 w-3" /> Palette
        </Label>
        <div className="flex flex-wrap gap-2">
          {vault.palette.map((c, i) => (
            <div key={`${c}-${i}`} className="group relative">
              <div
                className="h-12 w-12 rounded-lg border border-border shadow-sm"
                style={{ backgroundColor: c }}
                title={c}
              />
              <button
                onClick={() => removeColor(i)}
                className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
              >
                <X className="h-2.5 w-2.5" />
              </button>
              <p className="text-[9px] text-center mt-0.5 text-muted-foreground font-mono">{c}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={paletteInput}
            onChange={(e) => setPaletteInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addColor())}
            placeholder="#FF0A78"
            className="flex-1 font-mono text-sm"
          />
          <Button size="sm" variant="outline" onClick={addColor}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </Card>

      {/* Fonts */}
      <Card className="p-4 space-y-3">
        <Label className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-1.5">
          <Type className="h-3 w-3" /> Type
        </Label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Heading font</Label>
            <Input
              value={vault.fonts.heading || ""}
              onChange={(e) => setVault((v) => ({ ...v, fonts: { ...v.fonts, heading: e.target.value } }))}
              placeholder="e.g. Instrument Serif"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Body font</Label>
            <Input
              value={vault.fonts.body || ""}
              onChange={(e) => setVault((v) => ({ ...v, fonts: { ...v.fonts, body: e.target.value } }))}
              placeholder="e.g. Inter"
              className="mt-1"
            />
          </div>
        </div>
      </Card>

      {/* Voice */}
      <Card className="p-4 space-y-3">
        <Label className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-1.5">
          <Megaphone className="h-3 w-3" /> Voice & tone
        </Label>
        <Textarea
          value={vault.voice_tone || ""}
          onChange={(e) => setVault((v) => ({ ...v, voice_tone: e.target.value }))}
          placeholder='e.g. "Confident, sensory, no fluff. Speaks like a director, not a marketer."'
          className="min-h-[80px] text-sm"
        />

        {/* Do */}
        <div>
          <Label className="text-xs flex items-center gap-1.5 text-[hsl(var(--energy))]">
            <Check className="h-3 w-3" /> Do
          </Label>
          <div className="flex gap-2 mt-1">
            <Input
              value={doInput}
              onChange={(e) => setDoInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addDo())}
              placeholder="e.g. lead with audience numbers"
              className="flex-1"
            />
            <Button size="sm" variant="outline" onClick={addDo}><Plus className="h-3.5 w-3.5" /></Button>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {vault.do_dont.do.map((d, i) => (
              <Badge key={i} variant="secondary" className="gap-1">
                {d}
                <button onClick={() => removeDo(i)}><X className="h-3 w-3" /></button>
              </Badge>
            ))}
          </div>
        </div>

        {/* Don't */}
        <div>
          <Label className="text-xs flex items-center gap-1.5 text-destructive">
            <X className="h-3 w-3" /> Don't
          </Label>
          <div className="flex gap-2 mt-1">
            <Input
              value={dontInput}
              onChange={(e) => setDontInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addDont())}
              placeholder="e.g. avoid corporate jargon"
              className="flex-1"
            />
            <Button size="sm" variant="outline" onClick={addDont}><Plus className="h-3.5 w-3.5" /></Button>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {vault.do_dont.dont.map((d, i) => (
              <Badge key={i} variant="outline" className="gap-1 border-destructive/40 text-destructive">
                {d}
                <button onClick={() => removeDont(i)}><X className="h-3 w-3" /></button>
              </Badge>
            ))}
          </div>
        </div>
      </Card>

      {/* Links */}
      <Card className="p-4 space-y-3">
        <Label className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-1.5">
          <LinkIcon className="h-3 w-3" /> Links
        </Label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {(["website", "instagram", "youtube"] as const).map((k) => (
            <div key={k}>
              <Label className="text-xs capitalize">{k}</Label>
              <Input
                value={vault.links[k] || ""}
                onChange={(e) => setVault((v) => ({ ...v, links: { ...v.links, [k]: e.target.value } }))}
                placeholder={k === "website" ? "https://…" : "@handle"}
                className="mt-1"
              />
            </div>
          ))}
        </div>
      </Card>

      <div className="sticky bottom-0 bg-background/95 backdrop-blur-none border-t border-border -mx-4 px-4 py-3 flex gap-2 z-10">
        <Button onClick={save} disabled={saving} className="flex-1">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save brand
        </Button>
      </div>
    </div>
  );
}
