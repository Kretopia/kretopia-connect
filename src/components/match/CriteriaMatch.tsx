import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Eye, Search, UserPlus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KretopiaLoader, KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { loadCandidatePool, type PoolClient } from "@/lib/matching/candidates";
import { rankCandidates, type Evaluation } from "@/lib/matching/evaluate";
import { emptyForm, formToNeed, type CriteriaForm } from "@/lib/matching/form";
import { CRAFT_CATEGORIES, PLATFORM_IDS, PLATFORM_LABEL, type Importance, type MatchNeed } from "@/lib/matching/need";
import { ROLE_STAMP_LABEL } from "@/lib/passport/roleStamp";
import { cn } from "@/lib/utils";
import { FitBadge, MatchEvidence } from "./MatchEvidence";

const client = supabase as unknown as PoolClient;
const SHOWN = 20;

function ImportanceToggle({ value, onChange, label }: { value: Importance; onChange: (v: Importance) => void; label: string }) {
  return (
    <div role="group" aria-label={`${label}: how important`} className="inline-flex shrink-0 rounded-md border border-border p-0.5 text-[11px] font-semibold">
      {(["required", "preferred"] as const).map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={cn("rounded px-2 py-1 transition-colors", value === v ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
        >
          {v === "required" ? "Required" : "Preferred"}
        </button>
      ))}
    </div>
  );
}

function Field({ label, htmlFor, importance, onImportance, children }: { label: string; htmlFor?: string; importance: Importance; onImportance: (v: Importance) => void; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={htmlFor} className="text-sm font-medium">{label}</Label>
        <ImportanceToggle value={importance} onChange={onImportance} label={label} />
      </div>
      {children}
    </div>
  );
}

interface Props {
  /** Shortlists a result with the facts it was found on, through the page's existing shortlist. */
  onShortlist: (userId: string, name: string, reasons: string[]) => void;
  shortlisted: Record<string, boolean>;
  savingId: string | null;
}

/**
 * Search by criteria: the company lists what it needs and which of it is required, and every profile with a completed
 * Passport is checked against it. Nothing is scored or given a percentage: each profile shows a fit level in words,
 * how much of the list could be checked, and, criterion by criterion, what was found and where it came from.
 */
export function CriteriaMatch({ onShortlist, shortlisted, savingId }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState<CriteriaForm>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [need, setNeed] = useState<MatchNeed | null>(null);
  const [showWeak, setShowWeak] = useState(false);

  const pool = useQuery({
    queryKey: ["criteria-match-pool", user?.id ?? null],
    queryFn: () => loadCandidatePool(client, { excludeUserId: user?.id }),
    enabled: need !== null,
    staleTime: 5 * 60_000,
  });

  const ranked = useMemo<Evaluation[]>(() => (need && pool.data ? rankCandidates(need, pool.data.pool) : []), [need, pool.data]);
  const strong = ranked.filter((e) => e.summary.fit !== "weak");
  const weak = ranked.filter((e) => e.summary.fit === "weak");

  const patch = <K extends keyof CriteriaForm>(key: K, value: Partial<CriteriaForm[K]>) => setForm((f) => ({ ...f, [key]: { ...f[key], ...value } }));
  const togglePlatform = (id: (typeof PLATFORM_IDS)[number]) =>
    patch("platforms", { selected: form.platforms.selected.includes(id) ? form.platforms.selected.filter((p) => p !== id) : [...form.platforms.selected, id] });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const result = formToNeed(form);
    // `in` narrows the union whatever the compiler's strictness; `!result.ok` does not here.
    if ("error" in result) { setError(result.error); return; }
    setError(null);
    setShowWeak(false);
    setNeed(result.need);
  };

  const card = (e: Evaluation) => {
    const f = e.facts;
    const found = e.results.filter((r) => r.status === "met").slice(0, 2);
    const reasons = e.results.filter((r) => r.status === "met").map((r) => `${r.criterion.label}: ${r.evidence}`);
    return (
      <Card key={f.userId} className="rounded-lg border-border/60 p-3 shadow-none">
        <div className="flex items-start gap-3">
          <Avatar className="h-11 w-11 shrink-0">
            <AvatarImage src={f.avatarUrl ?? undefined} />
            <AvatarFallback>{f.fullName[0] ?? "?"}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-semibold">{f.fullName}</span>
              <FitBadge fit={e.summary.fit} />
            </div>
            {f.role && <p className="truncate text-xs text-muted-foreground">{f.role}</p>}
            <p className="text-xs text-muted-foreground">Checked {e.summary.coverage.checked} of {e.summary.coverage.total} {e.summary.coverage.total === 1 ? "criterion" : "criteria"}</p>
            {found.length > 0 && (
              <ul className="space-y-0.5 text-xs text-foreground">
                {found.map((r) => <li key={r.criterion.id}>{r.criterion.label}: <span className="text-muted-foreground">{r.evidence}</span></li>)}
              </ul>
            )}

            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="group -ml-2 h-8 gap-1 px-2 text-xs">
                  How this was checked
                  <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none" aria-hidden />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-1"><MatchEvidence evaluation={e} /></CollapsibleContent>
            </Collapsible>

            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => navigate(`/profile/${f.userId}`)}>
                <Eye className="h-3.5 w-3.5" aria-hidden /> View Passport
              </Button>
              {shortlisted[f.userId] ? (
                <Button size="sm" className="h-8 text-xs" onClick={() => navigate(`/messages?to=${f.userId}`)}>Message</Button>
              ) : (
                <Button size="sm" variant="secondary" className="h-8 gap-1 text-xs" disabled={savingId === f.userId} onClick={() => onShortlist(f.userId, f.fullName, reasons)}>
                  {savingId === f.userId ? <KretopiaSpinner className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" aria-hidden />} Shortlist
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="space-y-4 rounded-lg border border-border/60 bg-card p-4" aria-label="Search by criteria">
        <p className="text-xs text-muted-foreground">List what you need and mark what is required. Each profile is checked against what is on Kretopia: nothing is scored, and what cannot be checked is shown as such.</p>

        <Field label="Craft" htmlFor="cm-craft" importance={form.craft.importance} onImportance={(importance) => patch("craft", { importance })}>
          <Select value={form.craft.category || "any"} onValueChange={(v) => patch("craft", { category: v === "any" ? "" : (v as CriteriaForm["craft"]["category"]) })}>
            <SelectTrigger id="cm-craft" className="h-10"><SelectValue placeholder="Any" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any</SelectItem>
              {CRAFT_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c === "creator" ? "Creator / influencer / UGC" : ROLE_STAMP_LABEL[c]}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Skills (comma separated)" htmlFor="cm-skills" importance={form.skills.importance} onImportance={(importance) => patch("skills", { importance })}>
          <Input id="cm-skills" className="h-10" value={form.skills.text} onChange={(e) => patch("skills", { text: e.target.value })} placeholder="video editing, hooks" maxLength={200} />
        </Field>

        <Field label="Has worked on (comma separated)" htmlFor="cm-themes" importance={form.themes.importance} onImportance={(importance) => patch("themes", { importance })}>
          <Input id="cm-themes" className="h-10" value={form.themes.text} onChange={(e) => patch("themes", { text: e.target.value })} placeholder="swimwear, beauty" maxLength={200} />
        </Field>

        <Field label="Location" htmlFor="cm-location" importance={form.location.importance} onImportance={(importance) => patch("location", { importance })}>
          <Input id="cm-location" className="h-10" value={form.location.text} onChange={(e) => patch("location", { text: e.target.value })} placeholder="Los Angeles" maxLength={80} />
          <div className="flex items-center gap-2">
            <Checkbox id="cm-remote" checked={form.location.remoteOk} onCheckedChange={(v) => patch("location", { remoteOk: v === true })} />
            <Label htmlFor="cm-remote" className="text-xs font-normal text-muted-foreground">Remote is fine</Label>
          </div>
        </Field>

        <Field label="Platforms" importance={form.platforms.importance} onImportance={(importance) => patch("platforms", { importance })}>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {PLATFORM_IDS.map((id) => (
              <div key={id} className="flex items-center gap-2">
                <Checkbox id={`cm-p-${id}`} checked={form.platforms.selected.includes(id)} onCheckedChange={() => togglePlatform(id)} />
                <Label htmlFor={`cm-p-${id}`} className="text-sm font-normal">{PLATFORM_LABEL[id]}</Label>
              </div>
            ))}
          </div>
          {form.platforms.selected.length > 0 && (
            <div className="space-y-1">
              <Label htmlFor="cm-min" className="text-xs font-normal text-muted-foreground">Minimum audience (followers), optional</Label>
              <Input id="cm-min" className="h-10" inputMode="numeric" value={form.platforms.minAudience} onChange={(e) => patch("platforms", { minAudience: e.target.value })} placeholder="50000" />
              <p className="text-[11px] text-muted-foreground">Kretopia only knows a follower count when the account is connected and the sync stored one.</p>
            </div>
          )}
        </Field>

        <Field label="Audience" htmlFor="cm-audience" importance={form.audience.importance} onImportance={(importance) => patch("audience", { importance })}>
          <Input id="cm-audience" className="h-10" value={form.audience.text} onChange={(e) => patch("audience", { text: e.target.value })} placeholder="women 18 to 24 in the US" maxLength={120} />
          <p className="text-[11px] text-muted-foreground">Kretopia holds no audience demographics, so this will show as not provided for every profile. A location, bio or tag does not prove who follows someone.</p>
        </Field>

        <Field label="Has a verified or co-signed credit" importance={form.backedWork.importance} onImportance={(importance) => patch("backedWork", { importance })}>
          <div className="flex items-center gap-2">
            <Checkbox id="cm-backed" checked={form.backedWork.on} onCheckedChange={(v) => patch("backedWork", { on: v === true })} />
            <Label htmlFor="cm-backed" className="text-sm font-normal">Include this criterion</Label>
          </div>
        </Field>

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" size="lg" className="w-full gap-2" disabled={pool.isFetching}>
          {pool.isFetching ? <KretopiaSpinner className="h-4 w-4" /> : <Search className="h-4 w-4" aria-hidden />} Find matches
        </Button>
      </form>

      {need && pool.isLoading && <div className="py-6"><KretopiaLoader label="Checking profiles against your criteria…" /></div>}

      {need && pool.isError && (
        <div role="alert" className="space-y-2 rounded-lg border border-border p-4 text-sm">
          <p>Couldn't load the profiles to check.</p>
          <Button size="sm" variant="outline" onClick={() => void pool.refetch()}>Try again</Button>
        </div>
      )}

      {need && pool.data && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground" role="status">
            {pool.data.pool.length} {pool.data.pool.length === 1 ? "profile" : "profiles"} with a completed Passport checked
            {pool.data.truncated ? ". The pool is very large, so some profiles may be missing" : ""}.
          </p>

          {strong.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-4 text-sm">
              <p className="font-medium">No profile meets or partly meets these criteria.</p>
              <p className="mt-1 text-muted-foreground">Make a requirement preferred, remove one, or post it as a gig so creators can come to you.</p>
            </div>
          )}

          {strong.slice(0, SHOWN).map(card)}
          {strong.length > SHOWN && <p className="text-xs text-muted-foreground">Showing the first {SHOWN} of {strong.length}. Narrow the criteria to see fewer.</p>}

          {weak.length > 0 && (
            <div className="space-y-3">
              <Button variant="ghost" size="sm" className="text-xs" aria-expanded={showWeak} onClick={() => setShowWeak((v) => !v)}>
                {showWeak ? "Hide" : "Show"} {weak.length} {weak.length === 1 ? "profile that doesn't" : "profiles that don't"} meet a requirement
              </Button>
              {showWeak && weak.slice(0, SHOWN).map(card)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CriteriaMatch;
