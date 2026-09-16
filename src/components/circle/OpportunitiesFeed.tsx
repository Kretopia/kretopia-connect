import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { OPPORTUNITY_PUBLIC_COLUMNS } from "@/lib/opportunityColumns";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PostOpportunityDialog } from "@/components/PostOpportunityDialog";
import { SavedOpportunitiesDialog } from "@/components/opportunity/SavedOpportunitiesDialog";
import { ScoutGigDialog } from "@/components/opportunity/ScoutGigDialog";
import GigCard, { type GigCreatorProfile } from "@/components/opportunity/GigCard";
import { computeOpportunityMatch, type ViewerProfileForMatch } from "@/lib/opportunityMatch";
import { 
  Briefcase, Handshake, ArrowRightLeft,
  Plus, Sparkles, Zap, Target, GraduationCap, X,
  Search, MapPin, SlidersHorizontal, DollarSign,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useNavigate } from "react-router-dom";
import { DiscoveryGate, DiscoveryUpsell } from "@/components/DiscoveryGate";
import { EmptyState } from "@/components/ui/empty-state";
import { useAccountTone } from "@/hooks/useAccountTone";
import { useTrinidadVoice } from "@/hooks/useTrinidadVoice";

interface Opportunity {
  id: string;
  title: string;
  description: string;
  type: string;
  compensation: string | null;
  location: string | null;
  skills: string[] | null;
  tags: string[] | null;
  created_at: string | null;
  created_by: string | null;
  duration: string | null;
  image_url: string | null;
  status: string | null;
  barter_offering: string | null;
  barter_requesting: string | null;
  platform_requirements: string[] | null;
  min_followers: number | null;
  scouted_by: string | null;
}

// Use shared GigCreatorProfile from GigCard

const TYPE_FILTERS = [
  { value: "all", label: "All", icon: Sparkles },
  { value: "barter", label: "Barter", icon: ArrowRightLeft },
  { value: "job", label: "Paid", icon: Briefcase },
  { value: "collab", label: "Collabs", icon: Handshake },
  { value: "gig", label: "Gigs", icon: Zap },
  { value: "project", label: "Projects", icon: Target },
  { value: "internship", label: "Learn", icon: GraduationCap },
] as const;

const SKILLS_OPTIONS = [
  'Photography', 'Videography', 'Music Production', 'Writing',
  'Design', 'Animation', 'Social Media', 'Marketing',
  'Content Creation', 'DJing', 'Singing', 'Acting',
  'Dance', 'Makeup Artistry', 'Styling', 'Video Editing',
  'Motion Graphics', 'Graphic Design', 'Podcast Production', 'Live Streaming',
];

// TYPE_CONFIG moved to shared GigCard component

export const OpportunitiesFeed = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pick: pickTone } = useAccountTone();
  const { pick: pickVoice } = useTrinidadVoice();
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSkill, setSelectedSkill] = useState("all");
  const [postDialogOpen, setPostDialogOpen] = useState(false);
  const [locationFilter, setLocationFilter] = useState("all");
  const [compensationFilter, setCompensationFilter] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [viewerProfile, setViewerProfile] = useState<ViewerProfileForMatch | null>(null);

  useEffect(() => {
    if (!user) { setViewerProfile(null); return; }
    let cancelled = false;
    supabase
      .from("profiles")
      .select("professional_skills, role, location")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        const raw = data.professional_skills;
        const skills = Array.isArray(raw)
          ? raw.map((s) => (typeof s === "string" ? s : (s as { skill?: string } | null)?.skill || "")).filter(Boolean)
          : [];
        setViewerProfile({ skills, role: data.role || "", location: data.location || "" });
      });
    return () => { cancelled = true; };
  }, [user]);

  const activeFilterCount = [activeFilter !== "all", selectedSkill !== "all", locationFilter !== "all", compensationFilter !== "all"].filter(Boolean).length;

  const { data, isLoading: loading, refetch: fetchOpportunities } = useQuery({
    queryKey: ["opportunities-feed", activeFilter, searchQuery, selectedSkill, locationFilter],
    queryFn: async () => {
      let query = supabase
        .from("opportunities")
        .select(OPPORTUNITY_PUBLIC_COLUMNS)
        .in("status", ["active", "open"])
        .order("created_at", { ascending: false })
        .limit(30);

      if (activeFilter !== "all") {
        if (activeFilter === "collab") {
          query = query.in("type", ["collab", "collaboration"]);
        } else {
          query = query.eq("type", activeFilter);
        }
      }

      if (searchQuery.trim()) {
        query = query.ilike("title", `%${searchQuery.trim()}%`);
      }

      if (selectedSkill !== "all") {
        query = query.contains("skills", [selectedSkill]);
      }

      if (locationFilter !== "all") {
        query = query.ilike("location", `%${locationFilter}%`);
      }

      const { data: rows, error } = await query;
      if (error) throw error;

      // Stale-gig filter: hide if deadline passed, OR (no deadline AND created >30d ago with no recent priority)
      const now = Date.now();
      const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
      const fresh = ((rows as any[]) || []).filter((o) => {
        if (o.application_deadline && new Date(o.application_deadline).getTime() < now) return false;
        if (!o.application_deadline && o.created_at && now - new Date(o.created_at).getTime() > THIRTY_DAYS) return false;
        return true;
      });

      // Sort priority gigs to the top
      const sorted: Opportunity[] = fresh.sort((a, b) => {
        const aPriority = a.is_priority && a.priority_expires_at && new Date(a.priority_expires_at) > new Date() ? 1 : 0;
        const bPriority = b.is_priority && b.priority_expires_at && new Date(b.priority_expires_at) > new Date() ? 1 : 0;
        return bPriority - aPriority;
      });

      let creators: Record<string, GigCreatorProfile> = {};
      if (rows && rows.length > 0) {
        const creatorIds = [...new Set(rows.map((o) => o.created_by).filter(Boolean))] as string[];
        if (creatorIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id, full_name, avatar_url, role")
            .in("user_id", creatorIds);
          if (profiles) {
            creators = Object.fromEntries(profiles.map((p) => [p.user_id, p]));
          }
        }
      }

      return { opportunities: sorted, creators };
    },
  });
  const opportunities = data?.opportunities ?? [];
  const creators = data?.creators ?? {};



  return (
    <div className="space-y-4">
      {/* Header — actions on a single row */}
      <div className="flex items-center gap-2 flex-wrap">
        <SavedOpportunitiesDialog />
        <ScoutGigDialog />
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate('/manage-opportunities')}>
          <Briefcase className="h-4 w-4" />
          <span className="hidden sm:inline">My Listings</span>
        </Button>
        <PostOpportunityDialog
          open={postDialogOpen}
          onOpenChange={setPostDialogOpen}
          onSuccess={() => { setPostDialogOpen(false); fetchOpportunities(); }}
          trigger={
            <Button size="sm" className="gap-1.5 shrink-0 ml-auto">
              <Plus className="h-4 w-4" />
              Post
            </Button>
          }
        />
      </div>

      {/* Search & Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search gigs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-8"
          />
          {searchQuery && (
            <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6" onClick={() => setSearchQuery("")} aria-label="Clear search query">
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="relative shrink-0" aria-label="Open gig filters">
              <SlidersHorizontal className="h-4 w-4" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] text-primary-foreground flex items-center justify-center font-bold">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] flex flex-col pb-[calc(env(safe-area-inset-bottom)+9rem)]">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4" />
                Filter Gigs
              </SheetTitle>
            </SheetHeader>
            <div className="space-y-5 py-4 overflow-y-auto flex-1 min-h-0">
              {/* Type Filter */}
              <div>
                <label className="text-sm font-medium flex items-center gap-1.5 mb-2">
                  <Briefcase className="h-3.5 w-3.5 text-primary" />
                  Type
                </label>
                <Select value={activeFilter} onValueChange={setActiveFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPE_FILTERS.map(filter => (
                      <SelectItem key={filter.value} value={filter.value}>{filter.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Skill Filter */}
              <div>
                <label className="text-sm font-medium flex items-center gap-1.5 mb-2">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Skill
                </label>
                <Select value={selectedSkill} onValueChange={setSelectedSkill}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Skills" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Skills</SelectItem>
                    {SKILLS_OPTIONS.map(skill => (
                      <SelectItem key={skill} value={skill}>{skill}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Location Filter */}
              <div>
                <label className="text-sm font-medium flex items-center gap-1.5 mb-2">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  Location
                </label>
                <Select value={locationFilter} onValueChange={setLocationFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any Location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any Location</SelectItem>
                    <SelectItem value="Remote">Remote</SelectItem>
                    <SelectItem value="Bali">Bali</SelectItem>
                    <SelectItem value="Trinidad">Trinidad</SelectItem>
                    <SelectItem value="New York">New York</SelectItem>
                    <SelectItem value="Los Angeles">Los Angeles</SelectItem>
                    <SelectItem value="London">London</SelectItem>
                    <SelectItem value="Lagos">Lagos</SelectItem>
                    <SelectItem value="Toronto">Toronto</SelectItem>
                    <SelectItem value="Kingston">Kingston</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Compensation Filter */}
              <div>
                <label className="text-sm font-medium flex items-center gap-1.5 mb-2">
                  <DollarSign className="h-3.5 w-3.5 text-primary" />
                  Compensation
                </label>
                <Select value={compensationFilter} onValueChange={setCompensationFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any</SelectItem>
                    <SelectItem value="paid">Paid Only</SelectItem>
                    <SelectItem value="barter">Barter/Trade</SelectItem>
                    <SelectItem value="volunteer">Volunteer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setActiveFilter("all");
                    setSelectedSkill("all");
                    setLocationFilter("all");
                    setCompensationFilter("all");
                  }}
                >
                  Clear All
                </Button>
                <Button className="flex-1" onClick={() => setFiltersOpen(false)}>
                  Show Results
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Active filter badges */}
      {(searchQuery || activeFilter !== "all" || selectedSkill !== "all" || locationFilter !== "all" || compensationFilter !== "all") && (
        <div className="flex gap-2 flex-wrap">
          {activeFilter !== "all" && (
            <Badge variant="secondary" className="gap-1">
              {TYPE_FILTERS.find(f => f.value === activeFilter)?.label || activeFilter}
              <X className="h-3 w-3 cursor-pointer" onClick={() => setActiveFilter("all")} />
            </Badge>
          )}
          {searchQuery && (
            <Badge variant="secondary" className="gap-1">
              Search: {searchQuery}
              <X className="h-3 w-3 cursor-pointer" onClick={() => setSearchQuery("")} />
            </Badge>
          )}
          {selectedSkill !== "all" && (
            <Badge variant="secondary" className="gap-1">
              {selectedSkill}
              <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedSkill("all")} />
            </Badge>
          )}
          {locationFilter !== "all" && (
            <Badge variant="secondary" className="gap-1">
              {locationFilter}
              <X className="h-3 w-3 cursor-pointer" onClick={() => setLocationFilter("all")} />
            </Badge>
          )}
          {compensationFilter !== "all" && (
            <Badge variant="secondary" className="gap-1">
              {compensationFilter}
              <X className="h-3 w-3 cursor-pointer" onClick={() => setCompensationFilter("all")} />
            </Badge>
          )}
        </div>
      )}


      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Card key={i}><CardContent className="p-4 space-y-3">
              <Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-1/2" />
            </CardContent></Card>
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && opportunities.length === 0 && (() => {
        const hasFilters = activeFilter !== "all" || !!searchQuery || selectedSkill !== "all" || locationFilter !== "all" || compensationFilter !== "all";
        const clearAll = () => { setActiveFilter("all"); setSearchQuery(""); setSelectedSkill("all"); setLocationFilter("all"); setCompensationFilter("all"); };
        return (
          <EmptyState
            icon={hasFilters ? Search : Briefcase}
            eyebrow={hasFilters
              ? pickTone(pickVoice("No matches", "Nuttin' matchin'"), "No matches")
              : pickTone(pickVoice("Quiet feed", "Ting quiet"), "Empty marketplace")}
            title={hasFilters
              ? pickTone(pickVoice("Nothing here yet", "Nuttin' here yet"), "No gigs match these filters")
              : pickTone(pickVoice("No gigs here yet", "No gigs droppin' yet"), "No active briefs yet")}
            description={hasFilters
              ? pickTone(
                  pickVoice(
                    "New gigs are posted daily — try widening your filters or check back tomorrow.",
                    "Fresh gigs droppin' daily — loosen the filters or check back tomorrow.",
                  ),
                  "Try a wider radius or clear filters to see all open briefs.",
                )
              : pickTone(
                  pickVoice(
                    "Be the first to post — paid gig, barter, or collab.",
                    "Be the first to post — paid wuk, barter, or collab.",
                  ),
                  "Post your first brief to start receiving applications.",
                )}
            accent="lime"
            action={hasFilters
              ? { label: pickVoice("Clear filters", "Clear de filters"), icon: X, onClick: clearAll }
              : { label: pickTone(pickVoice("Post a Gig", "Post a wuk"), "Post a brief"), icon: Plus, onClick: () => setPostDialogOpen(true) }}
          />
        );
      })()}

      {/* Cards — responsive grid: 1 col mobile, 2 cols tablet, 3 cols desktop */}
      {!loading && opportunities.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {opportunities.map((opp, index) => {
            // Don't show scout's profile as the poster — show "Scouted for" label instead
            const creator = opp.scouted_by ? null : (opp.created_by ? creators[opp.created_by] : null);

            return (
              <DiscoveryGate key={opp.id} totalItems={opportunities.length} freePreviewCount={4} index={index} itemLabel="gigs">
                <GigCard opportunity={opp} creator={creator} matchScore={computeOpportunityMatch(opp, viewerProfile)} />
              </DiscoveryGate>
            );
          })}
        </div>
      )}
      {!loading && <DiscoveryUpsell totalItems={opportunities.length} freePreviewCount={4} itemLabel="gigs" />}
    </div>
  );
};
