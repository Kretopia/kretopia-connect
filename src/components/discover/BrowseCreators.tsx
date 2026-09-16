import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { escapePostgrestValue } from "@/lib/postgrestFilter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Search, SlidersHorizontal, Sparkles, Loader2, Star, Verified, MapPin,
  Bell, BellOff, Bookmark, X, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ProfileActivationGate } from "@/components/ProfileActivationGate";
import { getDiscoveryMissingFields } from "@/lib/profileCompletion";
import { buildMyMatchContext, computeMatchScore, extractCity, extractSkillsArray, fetchPastCollaboratorIds } from "@/lib/matchScoring";

interface CreatorRow {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  cover_image_url: string | null;
  role: string | null;
  sub_roles?: string[] | null;
  location: string | null;
  verification_tier: string | null;
  average_rating: number | null;
  professional_skills: any;
  last_active_date?: string | null;
  match_score?: number;
  match_reason?: string;
}

interface SavedSearch {
  id: string;
  name: string;
  query: string | null;
  filters: any;
  alerts_enabled: boolean;
}

interface Filters {
  role: string;
  location: string;
  skill: string;
  verifiedOnly: boolean;
  minRating: number;
}

type SortKey = "recommended" | "nearest" | "most_active";

const EMPTY_FILTERS: Filters = { role: "", location: "", skill: "", verifiedOnly: false, minRating: 0 };

export function BrowseCreators() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [aiMode, setAiMode] = useState(false);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortKey>("recommended");
  const [prioritizeSector, setPrioritizeSector] = useState(true);
  // Bumped by the empty-state "Clear filters" action so the effect below
  // re-runs with the just-cleared filters/query -- setTimeout(runFilterSearch)
  // (the pattern applySaved uses elsewhere in this file) would instead
  // call the stale pre-clear closure, since the callback reference is
  // captured before the state update is applied.
  const [refreshToken, setRefreshToken] = useState(0);
  const [results, setResults] = useState<CreatorRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveAlerts, setSaveAlerts] = useState(false);
  const [visibility, setVisibility] = useState<{ isVisible: boolean; missingFields: string[] }>({ isVisible: true, missingFields: [] });
  const [visibilityChecked, setVisibilityChecked] = useState(false);

  // Gate: enforce same discovery requirements as Circle/Nearby
  useEffect(() => {
    const check = async () => {
      if (!user?.id) { setVisibilityChecked(true); return; }
      try {
        const { data: profile } = await supabase
          .from("profiles").select("avatar_url, bio").eq("user_id", user.id).single();
        const { count } = await supabase
          .from("credits").select("id", { count: "exact", head: true }).eq("user_id", user.id);
        if (profile) {
          const missing = getDiscoveryMissingFields(profile as any, count || 0);
          setVisibility({ isVisible: missing.length === 0, missingFields: missing });
        }
      } finally { setVisibilityChecked(true); }
    };
    check();
  }, [user?.id]);
  const loadSaved = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("saved_creator_searches")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setSavedSearches((data || []) as SavedSearch[]);
  }, [user]);

  useEffect(() => { loadSaved(); }, [loadSaved]);

  const runFilterSearch = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url, cover_image_url, role, sub_roles, location, verification_tier, average_rating, professional_skills, bio, is_claimed, badge, last_active_date")
        .eq("onboarding_completed", true)
        .not("full_name", "is", null)
        .not("avatar_url", "is", null)
        .neq("avatar_url", "")
        .limit(120);
      // Pre-existing gap: this query never excluded the signed-in user's
      // own profile, so the grid could show you as a match for yourself
      // (found live while testing the new scoring — a real account showed
      // up in its own "Recommended" results at a high score).
      if (user?.id) q = q.neq("user_id", user.id);

      if (filters.role) q = q.ilike("role", `%${filters.role}%`);
      if (filters.location) q = q.ilike("location", `%${filters.location}%`);
      if (filters.verifiedOnly) q = q.neq("verification_tier", "none").not("verification_tier", "is", null);
      if (filters.minRating > 0) q = q.gte("average_rating", filters.minRating);
      if (query.trim()) {
        const likeQ = escapePostgrestValue(`%${query}%`);
        q = q.or(`full_name.ilike.${likeQ},role.ilike.${likeQ},bio.ilike.${likeQ}`);
      }

      const { data, error } = await q;
      if (error) throw error;
      let rows = (data || []) as (CreatorRow & { bio?: string | null; is_claimed?: boolean; badge?: string | null })[];

      // "Is there anything real to show" gate -- NOT an experience/activity
      // gate. A brand new user with zero credits must still be
      // discoverable (no artificial gating), so bio length and work-item
      // count are gone from here; they used to hard-exclude any thin
      // profile from the grid entirely.
      rows = rows.filter(r => {
        if (!r.full_name || r.full_name === "New User" || r.full_name.trim() === "") return false;
        // role === "Creator" removed from this exclusion -- it's the exact
        // default Onboarding.tsx assigns when role is left blank, not a
        // "never set up" placeholder. Excluding it directly contradicted
        // this filter's own "no artificial gating" stance (see
        // src/hooks/useSwipeProfiles.ts's matching fix for the full story).
        if (!r.role || r.role.trim() === "") return false;
        if (!r.avatar_url) return false;
        if (r.is_claimed === false && r.badge !== "odos") return false;
        return true;
      });

      if (filters.skill) {
        const s = filters.skill.toLowerCase();
        rows = rows.filter(r => {
          const skills = Array.isArray(r.professional_skills) ? r.professional_skills : [];
          return skills.some((sk: any) => String(sk).toLowerCase().includes(s));
        });
      }

      // Same scoring algorithm the deck uses (src/lib/matchScoring.ts) --
      // "Recommended" here means the same thing "top of the deck" does.
      if (user?.id && rows.length > 0) {
        const [{ data: meProfile }, pastCollabIds] = await Promise.all([
          supabase.from("profiles").select("role, sub_roles, location, professional_skills, passion_skills").eq("user_id", user.id).maybeSingle(),
          fetchPastCollaboratorIds(user.id),
        ]);
        const myContext = buildMyMatchContext(meProfile || {}, pastCollabIds);

        rows = rows.map(r => {
          const { score, ...signals } = computeMatchScore(myContext, {
            userId: r.user_id,
            role: r.role,
            subRoles: r.sub_roles,
            location: r.location,
            skills: extractSkillsArray(r.professional_skills),
          });
          const sectorBoost = prioritizeSector && signals.sameSector ? 0 : (signals.sameSector ? -40 : 0);
          const reason = signals.pastCollab
            ? "You've worked together before"
            : signals.sameSector
            ? "Same sector as you"
            : signals.sameCity
            ? "Same city as you"
            : signals.skillOverlapRatio > 0.2
            ? "Shares your skills"
            : undefined;
          return { ...r, match_score: Math.round(score + sectorBoost), match_reason: reason };
        });

        if (sort === "recommended") {
          rows = rows.sort((a, b) => (b.match_score || 0) - (a.match_score || 0));
        } else if (sort === "nearest") {
          const myCity = extractCity(meProfile?.location);
          rows = rows.sort((a, b) => {
            const aNear = myCity && extractCity(a.location) === myCity ? 1 : 0;
            const bNear = myCity && extractCity(b.location) === myCity ? 1 : 0;
            return bNear - aNear || (b.match_score || 0) - (a.match_score || 0);
          });
        } else {
          rows = rows.sort((a, b) => {
            const aTime = a.last_active_date ? new Date(a.last_active_date).getTime() : 0;
            const bTime = b.last_active_date ? new Date(b.last_active_date).getTime() : 0;
            return bTime - aTime;
          });
        }
      }

      setResults(rows.slice(0, 60));
    } catch (e: any) {
      toast({ title: "Search failed", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  }, [filters, query, toast, user?.id, sort, prioritizeSector]);

  const runAiSearch = useCallback(async () => {
    if (!query.trim() || query.trim().length < 3) {
      toast({ title: "Type a longer query", description: "Describe who you're looking for in 3+ characters" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("discover-creators", {
        body: { query: query.trim() },
      });
      if (error) throw error;
      setResults((data?.results || []) as CreatorRow[]);
    } catch (e: any) {
      toast({ title: "Smart search failed", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  }, [query, toast]);

  const handleSearch = () => { aiMode ? runAiSearch() : runFilterSearch(); };

  // Initial load, and re-run whenever sort/prioritize change so those
  // controls feel immediate (unlike the advanced filter popover, which
  // still requires an explicit "Apply"). user?.id is included so the
  // self-exclusion filter actually re-applies once auth resolves --
  // without it, a search fired before `user` loads would run once with
  // no self-exclusion and never automatically retry.
  useEffect(() => {
    if (aiMode) return;
    runFilterSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, prioritizeSector, refreshToken, user?.id]);

  const saveCurrentSearch = async () => {
    if (!user || !saveName.trim()) return;
    const { error } = await supabase.from("saved_creator_searches").insert({
      user_id: user.id,
      name: saveName.trim(),
      query: query || null,
      filters: filters as any,
      alerts_enabled: saveAlerts,
    });
    if (error) { toast({ title: "Couldn't save", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Search saved", description: saveAlerts ? "We'll notify you of new matches" : undefined });
    setShowSaveDialog(false); setSaveName(""); setSaveAlerts(false);
    loadSaved();
  };

  const applySaved = (s: SavedSearch) => {
    setQuery(s.query || "");
    setFilters({ ...EMPTY_FILTERS, ...(s.filters || {}) });
    setAiMode(false);
    setTimeout(runFilterSearch, 0);
  };

  const deleteSaved = async (id: string) => {
    await supabase.from("saved_creator_searches").delete().eq("id", id);
    loadSaved();
  };

  const toggleAlerts = async (s: SavedSearch) => {
    await supabase.from("saved_creator_searches").update({ alerts_enabled: !s.alerts_enabled }).eq("id", s.id);
    loadSaved();
  };

  const activeFilterCount =
    (filters.role ? 1 : 0) + (filters.location ? 1 : 0) + (filters.skill ? 1 : 0) +
    (filters.verifiedOnly ? 1 : 0) + (filters.minRating > 0 ? 1 : 0);

  return (
    <div className="space-y-3">
      <ProfileActivationGate
        isVisible={!visibilityChecked || visibility.isVisible}
        missingFields={visibility.missingFields}
        surfaceLabel="Browse"
      >
      <>
      {/* Search bar */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            {aiMode ? (
              <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
            ) : (
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            )}
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder={aiMode ? "e.g. cinematographer in Lagos who's done music videos" : "Search by name, role, bio…"}
              className="pl-9 h-9"
            />
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 relative" aria-label="Open creator filters">
                <SlidersHorizontal className="h-4 w-4" />
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 space-y-3" align="end">
              <div>
                <Label className="text-xs">Role</Label>
                <Input value={filters.role} onChange={(e) => setFilters(f => ({ ...f, role: e.target.value }))} placeholder="e.g. Photographer" className="h-8 text-sm mt-1" />
              </div>
              <div>
                <Label className="text-xs">Location</Label>
                <Input value={filters.location} onChange={(e) => setFilters(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Trinidad" className="h-8 text-sm mt-1" />
              </div>
              <div>
                <Label className="text-xs">Skill</Label>
                <Input value={filters.skill} onChange={(e) => setFilters(f => ({ ...f, skill: e.target.value }))} placeholder="e.g. color grading" className="h-8 text-sm mt-1" />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Verified only</Label>
                <Switch checked={filters.verifiedOnly} onCheckedChange={(v) => setFilters(f => ({ ...f, verifiedOnly: v }))} />
              </div>
              <div>
                <Label className="text-xs">Min rating: {filters.minRating || "Any"}</Label>
                <div className="flex gap-1 mt-1">
                  {[0, 3, 4, 4.5].map(r => (
                    <Button key={r} size="sm" variant={filters.minRating === r ? "default" : "outline"} className="h-7 text-xs flex-1"
                      onClick={() => setFilters(f => ({ ...f, minRating: r }))}>
                      {r === 0 ? "Any" : `${r}+`}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-2 border-t">
                <Button size="sm" variant="ghost" className="flex-1 text-xs" onClick={() => { setFilters(EMPTY_FILTERS); }}>
                  Clear
                </Button>
                <Button size="sm" className="flex-1 text-xs" onClick={runFilterSearch}>Apply</Button>
              </div>
            </PopoverContent>
          </Popover>
          <Button onClick={handleSearch} disabled={loading} size="sm" variant="gradient" className="h-9 px-3">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Go"}
          </Button>
        </div>

        {/* Mode toggle + save */}
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => setAiMode(v => !v)}
            className={cn(
              "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors",
              aiMode ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            <Sparkles className="h-3 w-3" />
            {aiMode ? "Smart search on" : "Try Smart search"}
          </button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowSaveDialog(true)}>
            <Bookmark className="h-3 w-3 mr-1" /> Save search
          </Button>
        </div>

        {/* Sort + sector priority — apply immediately, unlike the advanced
            filter popover above which still needs an explicit "Apply". */}
        {!aiMode && (
          <div className="flex items-center justify-between gap-2">
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger className="h-8 w-[150px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recommended" className="text-xs">Recommended</SelectItem>
                <SelectItem value="nearest" className="text-xs">Nearest</SelectItem>
                <SelectItem value="most_active" className="text-xs">Most active</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1.5">
              <Label htmlFor="prioritize-sector" className="text-xs text-muted-foreground">Prioritize my sector</Label>
              <Switch id="prioritize-sector" checked={prioritizeSector} onCheckedChange={setPrioritizeSector} />
            </div>
          </div>
        )}
      </div>

      {/* Saved searches chips */}
      {savedSearches.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {savedSearches.map(s => (
            <div key={s.id} className="shrink-0 flex items-center gap-1 bg-muted/60 rounded-full pl-2.5 pr-1 py-0.5">
              <button onClick={() => applySaved(s)} className="text-xs font-medium">{s.name}</button>
              <button onClick={() => toggleAlerts(s)} className="p-1 hover:bg-background rounded-full" title={s.alerts_enabled ? "Alerts on" : "Alerts off"} aria-label={s.alerts_enabled ? `Turn off alerts for "${s.name}"` : `Turn on alerts for "${s.name}"`}>
                {s.alerts_enabled ? <Bell className="h-3 w-3 text-primary" /> : <BellOff className="h-3 w-3 text-muted-foreground" />}
              </button>
              <button onClick={() => deleteSaved(s.id)} className="p-1 hover:bg-background rounded-full" aria-label={`Delete saved search "${s.name}"`}>
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Results grid */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : results.length === 0 ? (
        <Card className="py-12 px-6 text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            {query || filters.role || filters.location || filters.skill
              ? "No creators match those filters. Try widening your search."
              : "New here? Discover creators from your sector and city — clear any filters to see the full Kretopia network."}
          </p>
          {(query || filters.role || filters.location || filters.skill) && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setQuery(""); setFilters(EMPTY_FILTERS); setRefreshToken(t => t + 1); }}
            >
              Clear filters
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {results.map(c => (
            <button
              key={c.user_id}
              onClick={() => navigate(`/profile/${c.user_id}`)}
              className="text-left rounded-xl border bg-card overflow-hidden hover:shadow-md hover:border-primary/30 transition-all group"
            >
              {/* Cover artwork leads the card; avatar is a small identity badge,
                  same treatment as the swipe deck -- a real photo of the work
                  reads far better in a grid than a row of small round avatars. */}
              <div className="relative aspect-[4/3] w-full overflow-hidden">
                {c.cover_image_url || c.avatar_url ? (
                  <img
                    src={c.cover_image_url || c.avatar_url || ""}
                    alt={c.full_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className="w-full h-full"
                    style={{ background: "linear-gradient(150deg, hsl(var(--energy)/0.45), hsl(var(--primary)/0.35))" }}
                  />
                )}
                {c.cover_image_url && c.avatar_url && (
                  <Avatar className="absolute bottom-1.5 left-1.5 h-7 w-7 border-2 border-background">
                    <AvatarImage src={c.avatar_url} alt="" />
                    <AvatarFallback className="text-[10px]">{c.full_name?.[0] || "?"}</AvatarFallback>
                  </Avatar>
                )}
                {c.verification_tier && c.verification_tier !== "none" && (
                  <div className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-primary flex items-center justify-center border-2 border-background">
                    <Verified className="h-2.5 w-2.5 text-primary-foreground" />
                  </div>
                )}
              </div>
              <div className="p-2.5">
                <p className="text-xs font-semibold truncate">{c.full_name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{c.role || "Creator"}</p>
                {c.location && (
                  <p className="text-[10px] text-muted-foreground truncate flex items-center gap-0.5 mt-0.5">
                    <MapPin className="h-2.5 w-2.5 shrink-0" />{c.location}
                  </p>
                )}
                <div className="flex items-center gap-1 mt-1.5">
                  {c.average_rating ? (
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0 gap-0.5">
                      <Star className="h-2.5 w-2.5 fill-current" />{Number(c.average_rating).toFixed(1)}
                    </Badge>
                  ) : null}
                  {typeof c.match_score === "number" && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-primary/30 text-primary">
                      {c.match_score}% match
                    </Badge>
                  )}
                </div>
                {c.match_reason && (
                  <p className="text-[9px] text-muted-foreground line-clamp-2 mt-1 italic">{c.match_reason}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Save dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Save this search</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Name</Label>
              <Input value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="e.g. Cinematographers Lagos" className="mt-1" />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Notify me of new matches</Label>
              <Switch checked={saveAlerts} onCheckedChange={setSaveAlerts} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowSaveDialog(false)}>Cancel</Button>
            <Button onClick={saveCurrentSearch} disabled={!saveName.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </>
      </ProfileActivationGate>
    </div>
  );
}
