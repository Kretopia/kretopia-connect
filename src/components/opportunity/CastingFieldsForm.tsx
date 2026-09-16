import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MODEL_CATEGORIES } from "@/lib/modelUnits";
import { Camera } from "lucide-react";

export interface CastingFields {
  casting_gender?: string;
  casting_min_height_cm?: number | null;
  casting_max_height_cm?: number | null;
  casting_age_min?: number | null;
  casting_age_max?: number | null;
  casting_categories?: string[];
  casting_fitting_date?: string | null;
  casting_shoot_date?: string | null;
  casting_usage_summary?: string;
}

interface Props {
  value: CastingFields;
  onChange: (next: CastingFields) => void;
}

const num = (v: string): number | null => {
  const n = v.trim() === "" ? null : Number(v);
  return Number.isFinite(n as number) ? (n as number) : null;
};

/**
 * Casting-specific opportunity fields. Renders only when opportunity type='casting'.
 * Captures the basics every casting director asks for.
 */
export function CastingFieldsForm({ value, onChange }: Props) {
  const update = (patch: Partial<CastingFields>) => onChange({ ...value, ...patch });
  const toggleCategory = (c: string) => {
    const set = new Set(value.casting_categories || []);
    set.has(c) ? set.delete(c) : set.add(c);
    update({ casting_categories: Array.from(set) });
  };

  return (
    <div className="space-y-4 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Camera className="h-4 w-4 text-primary" />
        Casting details
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Looking for</Label>
          <Select
            value={value.casting_gender || ""}
            onValueChange={(v) => update({ casting_gender: v || undefined })}
          >
            <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="non-binary">Non-binary</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Height range (cm)</Label>
          <div className="flex gap-2 items-center">
            <Input
              type="number" placeholder="min" value={value.casting_min_height_cm ?? ""}
              onChange={(e) => update({ casting_min_height_cm: num(e.target.value) })}
            />
            <span className="text-muted-foreground">–</span>
            <Input
              type="number" placeholder="max" value={value.casting_max_height_cm ?? ""}
              onChange={(e) => update({ casting_max_height_cm: num(e.target.value) })}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Age range</Label>
          <div className="flex gap-2 items-center">
            <Input
              type="number" placeholder="min" value={value.casting_age_min ?? ""}
              onChange={(e) => update({ casting_age_min: num(e.target.value) })}
            />
            <span className="text-muted-foreground">–</span>
            <Input
              type="number" placeholder="max" value={value.casting_age_max ?? ""}
              onChange={(e) => update({ casting_age_max: num(e.target.value) })}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Fitting date</Label>
          <Input
            type="date" value={value.casting_fitting_date || ""}
            onChange={(e) => update({ casting_fitting_date: e.target.value || null })}
          />
        </div>
        <div className="space-y-1 col-span-2 sm:col-span-1">
          <Label className="text-xs">Shoot date</Label>
          <Input
            type="date" value={value.casting_shoot_date || ""}
            onChange={(e) => update({ casting_shoot_date: e.target.value || null })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Categories</Label>
        <div className="flex flex-wrap gap-1.5">
          {MODEL_CATEGORIES.map((c) => {
            const on = (value.casting_categories || []).includes(c);
            return (
              <button key={c} type="button" onClick={() => toggleCategory(c)}>
                <Badge variant={on ? "default" : "outline"} className="cursor-pointer">{c}</Badge>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Usage summary</Label>
        <Textarea
          value={value.casting_usage_summary || ""}
          onChange={(e) => update({ casting_usage_summary: e.target.value })}
          placeholder="e.g. 6 months digital + print, EMEA, exclusive in category"
          rows={2}
          maxLength={500}
        />
      </div>
    </div>
  );
}
