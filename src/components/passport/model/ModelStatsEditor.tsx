import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Save, Ruler, IdCard } from "lucide-react";
import { Link } from "react-router-dom";
import {
  type ModelStats, type UnitSystem,
  cmToFeetInches, feetInchesToCm, inchesToCm,
  MODEL_CATEGORIES, MODEL_UNIONS,
} from "@/lib/modelUnits";
import { SocialFeedIngest } from "./SocialFeedIngest";

interface Props {
  userId: string;
  initialStats?: ModelStats | null;
  initialCategories?: string[] | null;
  initialUnions?: string[] | null;
  initialMotherAgency?: string | null;
  onSaved?: () => void;
}

export function ModelStatsEditor({
  userId, initialStats, initialCategories, initialUnions, initialMotherAgency, onSaved,
}: Props) {
  const { toast } = useToast();
  const [units, setUnits] = useState<UnitSystem>("metric");
  const [stats, setStats] = useState<ModelStats>(initialStats || {});
  const [categories, setCategories] = useState<string[]>(initialCategories || []);
  const [unions, setUnions] = useState<string[]>(initialUnions || []);
  const [motherAgency, setMotherAgency] = useState<string>(initialMotherAgency || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setStats(initialStats || {}); }, [initialStats]);

  const setNum = (k: keyof ModelStats, v: string) => {
    const n = v.trim() === "" ? null : Number(v);
    setStats((s) => ({ ...s, [k]: Number.isFinite(n as number) ? n : null }));
  };

  const heightDisplay = () =>
    units === "metric"
      ? stats.height_cm ?? ""
      : stats.height_cm ? cmToFeetInches(stats.height_cm) : "";

  const setHeight = (v: string) => {
    if (units === "metric") return setNum("height_cm", v);
    // imperial: accept "5'10" or "5 10" or just inches
    const m = v.match(/^(\d+)'\s*(\d+)/);
    if (m) return setStats((s) => ({ ...s, height_cm: feetInchesToCm(Number(m[1]), Number(m[2])) }));
    const n = Number(v);
    if (Number.isFinite(n)) setStats((s) => ({ ...s, height_cm: inchesToCm(n) }));
  };

  const setMeas = (k: "bust_cm" | "waist_cm" | "hips_cm" | "inseam_cm", v: string) => {
    if (units === "metric") return setNum(k, v);
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return setStats((s) => ({ ...s, [k]: null }));
    setStats((s) => ({ ...s, [k]: inchesToCm(n) }));
  };

  const measVal = (cm?: number | null) =>
    cm == null ? "" : units === "metric" ? cm : Math.round(cm / 2.54);

  const toggle = (list: string[], setList: (l: string[]) => void, v: string) =>
    setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        model_stats: stats as any,
        model_categories: categories,
        model_unions: unions,
        mother_agency: motherAgency || null,
      } as any)
      .eq("user_id", userId);
    setSaving(false);
    if (error) { toast({ title: "Couldn't save", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Saved" });
    onSaved?.();
  };

  return (
    <div className="space-y-5 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Ruler className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-serif text-lg">Model stats</h3>
        </div>
        <div className="flex items-center gap-1 text-xs">
          <button
            onClick={() => setUnits("metric")}
            className={`px-2 py-1 rounded ${units === "metric" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >cm</button>
          <button
            onClick={() => setUnits("imperial")}
            className={`px-2 py-1 rounded ${units === "imperial" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >in</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Height</Label>
          <Input
            value={heightDisplay() as any}
            onChange={(e) => setHeight(e.target.value)}
            placeholder={units === "metric" ? "178" : `5'10`}
          />
        </div>
        <div>
          <Label className="text-xs">Shoe (EU)</Label>
          <Input value={stats.shoe_eu ?? ""} onChange={(e) => setNum("shoe_eu", e.target.value)} placeholder="39" />
        </div>
        <div>
          <Label className="text-xs">Bust</Label>
          <Input value={measVal(stats.bust_cm)} onChange={(e) => setMeas("bust_cm", e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Waist</Label>
          <Input value={measVal(stats.waist_cm)} onChange={(e) => setMeas("waist_cm", e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Hips</Label>
          <Input value={measVal(stats.hips_cm)} onChange={(e) => setMeas("hips_cm", e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Inseam</Label>
          <Input value={measVal(stats.inseam_cm)} onChange={(e) => setMeas("inseam_cm", e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Dress (EU)</Label>
          <Input value={stats.dress_eu ?? ""} onChange={(e) => setNum("dress_eu", e.target.value)} placeholder="36" />
        </div>
        <div>
          <Label className="text-xs">Hair</Label>
          <Input value={stats.hair ?? ""} onChange={(e) => setStats((s) => ({ ...s, hair: e.target.value }))} placeholder="Brown" />
        </div>
        <div>
          <Label className="text-xs">Eyes</Label>
          <Input value={stats.eyes ?? ""} onChange={(e) => setStats((s) => ({ ...s, eyes: e.target.value }))} placeholder="Hazel" />
        </div>
        <div>
          <Label className="text-xs">Skin tone</Label>
          <Input value={stats.skin_tone ?? ""} onChange={(e) => setStats((s) => ({ ...s, skin_tone: e.target.value }))} placeholder="Medium" />
        </div>
      </div>

      <div>
        <Label className="text-xs">Categories</Label>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {MODEL_CATEGORIES.map((c) => (
            <button key={c} onClick={() => toggle(categories, setCategories, c)}>
              <Badge variant={categories.includes(c) ? "default" : "outline"} className="cursor-pointer">{c}</Badge>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Mother agency</Label>
          <Input value={motherAgency} onChange={(e) => setMotherAgency(e.target.value)} placeholder="e.g. IMG Models" />
        </div>
        <div>
          <Label className="text-xs">Union</Label>
          <Select value={unions[0] || ""} onValueChange={(v) => setUnions(v ? [v] : [])}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              {MODEL_UNIONS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button onClick={save} disabled={saving} className="w-full">
        <Save className="h-4 w-4 mr-2" />{saving ? "Saving…" : "Save model details"}
      </Button>

      <Button asChild variant="outline" className="w-full">
        <Link to="/passport/comp-card">
          <IdCard className="h-4 w-4 mr-2" />Build comp card
        </Link>
      </Button>

      <SocialFeedIngest userId={userId} />

    </div>
  );
}
