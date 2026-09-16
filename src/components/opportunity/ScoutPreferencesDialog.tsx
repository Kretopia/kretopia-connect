import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Loader2, X, Sparkles, Plus } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

interface Prefs {
  enabled: boolean;
  sources: string[];
  job_types: string[];
  employment_types: string[];
  locations: string[];
  exclude_keywords: string[];
  extra_keywords: string[];
  remote_only: boolean;
  travel_ok: boolean;
  min_fit_score: number;
  instructions: string;
}

const SOURCES = [
  { id: "web", label: "Gig boards & web" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "instagram", label: "Instagram open calls" },
  { id: "ats", label: "Company career pages (ATS)" },
  { id: "facebook", label: "Facebook groups" },
];

const EMPLOYMENT_OPTIONS = [
  "Full-time", "Part-time", "Contract", "Freelance", "Gig / one-off", "Paid internship", "Volunteer / unpaid",
];

const DEFAULT_PREFS: Prefs = {
  enabled: true,
  sources: ["web", "linkedin", "instagram", "ats"],
  job_types: [],
  employment_types: [],
  locations: [],
  exclude_keywords: [],
  extra_keywords: [],
  remote_only: false,
  travel_ok: false,
  min_fit_score: 60,
  instructions: "",
};

function ChipList({
  values,
  placeholder,
  onChange,
}: {
  values: string[];
  placeholder: string;
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (values.includes(v)) { setDraft(""); return; }
    onChange([...values, v]);
    setDraft("");
  };
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); }
          }}
        />
        <Button type="button" size="sm" variant="outline" onClick={add}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v) => (
            <Badge key={v} variant="secondary" className="gap-1 pr-1">
              {v}
              <button
                type="button"
                onClick={() => onChange(values.filter((x) => x !== v))}
                className="ml-0.5 rounded hover:bg-foreground/10 p-0.5"
                aria-label={`Remove ${v}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export function ScoutPreferencesDialog({ open, onOpenChange, onSaved }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from("scout_preferences")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();
        if (cancelled) return;
        if (data) {
          setPrefs({
            enabled: data.enabled ?? true,
            sources: data.sources ?? DEFAULT_PREFS.sources,
            job_types: data.job_types ?? [],
            employment_types: data.employment_types ?? [],
            locations: data.locations ?? [],
            exclude_keywords: data.exclude_keywords ?? [],
            extra_keywords: data.extra_keywords ?? [],
            remote_only: data.remote_only ?? false,
            travel_ok: data.travel_ok ?? false,
            min_fit_score: data.min_fit_score ?? 60,
            instructions: data.instructions ?? "",
          });
        }
      } catch {
        // ignore — keep defaults
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, user]);

  const toggleSource = (id: string) => {
    setPrefs((p) => ({
      ...p,
      sources: p.sources.includes(id) ? p.sources.filter((s) => s !== id) : [...p.sources, id],
    }));
  };

  const toggleEmployment = (id: string) => {
    setPrefs((p) => ({
      ...p,
      employment_types: p.employment_types.includes(id)
        ? p.employment_types.filter((s) => s !== id)
        : [...p.employment_types, id],
    }));
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("scout_preferences")
      .upsert({ user_id: user.id, ...prefs, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Scout tuned", description: "Your next scan will use these preferences." });
    onSaved?.();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-energy" />
            Tune your scout
          </SheetTitle>
          <SheetDescription>
            Tell the scout exactly what you want. Updates apply on your next scan.
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="mt-4 space-y-6">
            {/* How scanning works */}
            <div className="rounded-lg border border-border p-3">
              <Label className="text-sm font-semibold">How this works</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Scanning is manual — tap "Scan now" on the Scout page to search using the preferences below. There's no automatic background scan yet.
              </p>
            </div>

            {/* Job types */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Roles you want</Label>
              <p className="text-xs text-muted-foreground">e.g. Director of Photography, Editor, Sound Designer</p>
              <ChipList
                values={prefs.job_types}
                placeholder="Add a role and press Enter"
                onChange={(next) => setPrefs((p) => ({ ...p, job_types: next }))}
              />
            </div>

            {/* Employment type */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Employment type</Label>
              <div className="flex flex-wrap gap-1.5">
                {EMPLOYMENT_OPTIONS.map((opt) => {
                  const active = prefs.employment_types.includes(opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => toggleEmployment(opt)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card text-foreground border-border hover:bg-accent"
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Locations */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Where you want to work</Label>
              <p className="text-xs text-muted-foreground">Add cities, regions or countries. Leave empty to use your profile location.</p>
              <ChipList
                values={prefs.locations}
                placeholder="e.g. Berlin, Lisbon, NYC"
                onChange={(next) => setPrefs((p) => ({ ...p, locations: next }))}
              />
              <div className="flex items-center justify-between pt-1">
                <Label htmlFor="remote-only" className="text-xs">Remote only</Label>
                <Switch
                  id="remote-only"
                  checked={prefs.remote_only}
                  onCheckedChange={(v) => setPrefs((p) => ({ ...p, remote_only: v }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="travel-ok" className="text-xs">Open to travel</Label>
                <Switch
                  id="travel-ok"
                  checked={prefs.travel_ok}
                  onCheckedChange={(v) => setPrefs((p) => ({ ...p, travel_ok: v }))}
                />
              </div>
            </div>

            {/* Sources */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Where to scout</Label>
              <div className="space-y-2">
                {SOURCES.map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                    <span className="text-sm">{s.label}</span>
                    <Switch
                      checked={prefs.sources.includes(s.id)}
                      onCheckedChange={() => toggleSource(s.id)}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Keywords */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Boost keywords</Label>
              <p className="text-xs text-muted-foreground">Words to prioritize (e.g. "music video", "documentary")</p>
              <ChipList
                values={prefs.extra_keywords}
                placeholder="Add a keyword"
                onChange={(next) => setPrefs((p) => ({ ...p, extra_keywords: next }))}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Exclude keywords</Label>
              <p className="text-xs text-muted-foreground">Hide gigs that mention these words (e.g. "unpaid", "crypto")</p>
              <ChipList
                values={prefs.exclude_keywords}
                placeholder="Add a word to exclude"
                onChange={(next) => setPrefs((p) => ({ ...p, exclude_keywords: next }))}
              />
            </div>

            {/* Min fit */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Minimum fit score</Label>
                <Badge variant="secondary">{prefs.min_fit_score}</Badge>
              </div>
              <Slider
                value={[prefs.min_fit_score]}
                min={30}
                max={95}
                step={5}
                onValueChange={(v) => setPrefs((p) => ({ ...p, min_fit_score: v[0] }))}
              />
              <p className="text-xs text-muted-foreground">Higher = fewer, more relevant gigs.</p>
            </div>

            {/* Free-form instructions */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Notes for the scout</Label>
              <p className="text-xs text-muted-foreground">
                Anything else the scout should know. Updates anytime your situation changes.
              </p>
              <Textarea
                value={prefs.instructions}
                onChange={(e) => setPrefs((p) => ({ ...p, instructions: e.target.value }))}
                placeholder={`e.g. "I'm in Berlin until June, then Lisbon. Skip unpaid. Prefer indie film & music video work. Open to 2-week travel gigs."`}
                rows={5}
                maxLength={1000}
              />
              <p className="text-[10px] text-muted-foreground text-right">{prefs.instructions.length}/1000</p>
            </div>
          </div>
        )}

        <SheetFooter className="mt-6 gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || loading}>
            {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Save preferences
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
