import { useEffect, useMemo, useState } from "react";
import { CreativeLoader } from "@/components/ui/creative-loader";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { OPPORTUNITY_PUBLIC_COLUMNS } from "@/lib/opportunityColumns";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Briefcase, Clock, MapPin, DollarSign, Eye, Plus,
  Users, ArrowRight, Pause, CheckCircle2, XCircle,
  Send, MoreHorizontal, Sparkles, Search, Pencil, Copy as CopyIcon,
  Share2, Filter, ChevronDown,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { PageTransition } from "@/components/PageTransition";
import { toast } from "@/hooks/use-toast";
import { FeaturePageHeader } from "@/components/features/FeaturePageHeader";
import { StudioFeatureShell } from "@/components/studio-reference/StudioFeatureShell";
import type { TutorialStep } from "@/components/landing/kretopia/FeatureTutorial";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface PostedGig {
  id: string;
  title: string;
  status: string;
  created_at: string;
  compensation: string | null;
  location: string | null;
  type: string | null;
  image_url: string | null;
  view_count: number | null;
  applicant_count?: number;
  pending_count?: number;
}

interface Application {
  id: string;
  opportunity_title: string;
  opportunity_type: string;
  compensation: string;
  location: string;
  status: string;
  created_at: string;
  cover_letter: string;
  opportunity_id: string;
  poster_name?: string | null;
  poster_avatar?: string | null;
}

const statusConfig: Record<string, { dot: string; pill: string; icon: React.ElementType; label: string }> = {
  active:  { dot: "bg-emerald-500", pill: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30", icon: CheckCircle2, label: "Live" },
  open:    { dot: "bg-emerald-500", pill: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30", icon: CheckCircle2, label: "Live" },
  paused:  { dot: "bg-amber-500",   pill: "bg-amber-500/15 text-amber-500 border-amber-500/30",       icon: Pause,        label: "Paused" },
  closed:  { dot: "bg-muted-foreground", pill: "bg-background/80 text-muted-foreground border-border", icon: XCircle,      label: "Closed" },
  filled:  { dot: "bg-primary",    pill: "bg-primary/15 text-primary border-primary/30",          icon: Users,        label: "Filled" },
};

const appStatusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
  pending: { variant: "secondary", label: "Pending" },
  reviewed: { variant: "outline", label: "Reviewed" },
  accepted: { variant: "default", label: "Accepted" },
  rejected: { variant: "destructive", label: "Not Selected" },
};

type SortKey = "newest" | "oldest" | "most_applicants" | "title";
type StatusFilter = "all" | "active" | "paused" | "closed" | "filled";

// How many cards show before "See more" reveals the next batch -- keeps the
// initial paint light (esp. with cover images) without ever hard-capping
// what a poster with a big roster of gigs can actually see.
const PAGE_SIZE = 6;

const MANAGE_TUTORIAL: TutorialStep[] = [
  { icon: Send, title: "Track every listing", body: "Status, applicants and views for each gig you've posted, at a glance — live, paused, filled or closed." },
  { icon: Users, title: "Review applicants fast", body: "New applicants are flagged right on the card. Tap Review to open the full applicant list for that gig." },
  { icon: Briefcase, title: "Track your own applications", body: "Switch to My Applications to follow every gig you've applied to and where it stands." },
];

const ManageOpportunities = () => {
  const [postedGigs, setPostedGigs] = useState<PostedGig[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortKey>("newest");
  const [liveVisible, setLiveVisible] = useState(PAGE_SIZE);
  const [pastVisible, setPastVisible] = useState(PAGE_SIZE);
  const [appsVisible, setAppsVisible] = useState(PAGE_SIZE);
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const openApplicants = (opportunityId: string) => {
    navigate(`/opportunity-dashboard?opportunity=${opportunityId}`);
  };

  useEffect(() => {
    if (authLoading || !user) return;
    loadData();
  }, [user, authLoading]);

  // A new search/filter/sort is a new list — start each back at one page
  // rather than carrying over however far someone had scrolled the last one.
  useEffect(() => {
    setLiveVisible(PAGE_SIZE);
    setPastVisible(PAGE_SIZE);
  }, [search, statusFilter, sortBy]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);

    const [gigsRes, appsRes] = await Promise.all([
      // @ts-ignore – deep type instantiation
      supabase
        .from("opportunities")
        .select("id, title, status, created_at, compensation, location, type, image_url, view_count")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("user_applications_view")
        .select("*")
        .eq("applicant_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    const gigs = gigsRes.data || [];

    if (gigs.length > 0) {
      const ids = gigs.map(g => g.id);
      const { data: apps } = await supabase
        .from("applications")
        .select("opportunity_id, status")
        .in("opportunity_id", ids);
      const counts: Record<string, number> = {};
      const pending: Record<string, number> = {};
      (apps || []).forEach(a => {
        counts[a.opportunity_id] = (counts[a.opportunity_id] || 0) + 1;
        if (a.status === "pending") pending[a.opportunity_id] = (pending[a.opportunity_id] || 0) + 1;
      });
      gigs.forEach(g => {
        (g as PostedGig).applicant_count = counts[g.id] || 0;
        (g as PostedGig).pending_count = pending[g.id] || 0;
      });
    }

    setPostedGigs(gigs as PostedGig[]);
    setApplications((appsRes.data || []) as unknown as Application[]);
    setLoading(false);
  };

  const updateGigStatus = async (gigId: string, newStatus: string) => {
    await supabase.from("opportunities").update({ status: newStatus }).eq("id", gigId);
    setPostedGigs(prev => prev.map(g => g.id === gigId ? { ...g, status: newStatus } : g));
    toast({ title: `Gig ${statusConfig[newStatus]?.label?.toLowerCase() || "updated"}` });
  };

  const duplicateGig = async (gigId: string) => {
    const { data: orig } = await supabase.from("opportunities").select(OPPORTUNITY_PUBLIC_COLUMNS).eq("id", gigId).maybeSingle();
    if (!orig || !user) return;
    const { id, created_at, updated_at, ...rest } = orig as any;
    const { data: created, error } = await supabase
      .from("opportunities")
      .insert({ ...rest, title: `${orig.title} (copy)`, status: "draft", created_by: user.id })
      .select("id")
      .single();
    if (error) {
      toast({ title: "Couldn't duplicate", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Duplicated as draft" });
    if (created?.id) navigate(`/post-opportunity?edit=${created.id}`);
  };

  const shareGig = async (gigId: string, title: string) => {
    const url = `${window.location.origin}/opportunity/${gigId}`;
    if (navigator.share) {
      try { await navigator.share({ title, url }); return; } catch {}
    }
    await navigator.clipboard.writeText(url);
    toast({ title: "Link copied" });
  };

  const filteredGigs = useMemo(() => {
    let list = [...postedGigs];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(g => g.title?.toLowerCase().includes(q));
    }
    if (statusFilter !== "all") {
      list = list.filter(g => {
        if (statusFilter === "active") return g.status === "active" || g.status === "open";
        return g.status === statusFilter;
      });
    }
    switch (sortBy) {
      case "oldest": list.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at)); break;
      case "most_applicants": list.sort((a, b) => (b.applicant_count || 0) - (a.applicant_count || 0)); break;
      case "title": list.sort((a, b) => a.title.localeCompare(b.title)); break;
      default: list.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    }
    return list;
  }, [postedGigs, search, statusFilter, sortBy]);

  const activeGigs = filteredGigs.filter(g => g.status === "active" || g.status === "open");
  const inactiveGigs = filteredGigs.filter(g => g.status !== "active" && g.status !== "open");

  // counts for status chips (unfiltered by status, respect search)
  const counts = useMemo(() => {
    const base = search.trim()
      ? postedGigs.filter(g => g.title?.toLowerCase().includes(search.toLowerCase()))
      : postedGigs;
    return {
      all: base.length,
      active: base.filter(g => g.status === "active" || g.status === "open").length,
      paused: base.filter(g => g.status === "paused").length,
      filled: base.filter(g => g.status === "filled").length,
      closed: base.filter(g => g.status === "closed").length,
    };
  }, [postedGigs, search]);

  const totalPending = postedGigs.reduce((s, g) => s + (g.pending_count || 0), 0);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6"><CreativeLoader size="page" /></div>
    );
  }

  const StatusChip = ({ value, label, count }: { value: StatusFilter; label: string; count: number }) => (
    <button
      onClick={() => setStatusFilter(value)}
      className={cn(
        "shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all whitespace-nowrap",
        statusFilter === value
          ? "bg-[hsl(var(--energy))] text-white border-transparent shadow-sm"
          : "bg-foreground/[0.03] text-muted-foreground border-border hover:border-[hsl(var(--energy)/0.4)] hover:text-foreground"
      )}
    >
      {label} <span className="opacity-70">·{count}</span>
    </button>
  );

  const headerSubtitle = postedGigs.length === 0
    ? "Post your first gig and start reviewing applicants in minutes."
    : totalPending > 0
      ? `${totalPending} new applicant${totalPending !== 1 ? "s" : ""} waiting on your review.`
      : `${postedGigs.length} listing${postedGigs.length !== 1 ? "s" : ""} — everything's reviewed.`;

  return (
    <PageTransition>
      <Tabs defaultValue="listings" className="w-full">
        <FeaturePageHeader
          eyebrow="Manage"
          title="Gig Manager."
          accentTitle="From post to hire."
          subtitle={headerSubtitle}
          tutorial={{ featureKey: "manage-opportunities", label: "How this works", steps: MANAGE_TUTORIAL }}
          tabs={
            <div className="flex flex-col items-center gap-4">
              <Button onClick={() => navigate("/post-opportunity")} className="gap-1.5 rounded-full px-5">
                <Plus className="h-3.5 w-3.5" /> Post a new gig
              </Button>
              <TabsList className="h-auto gap-1 rounded-full border border-foreground/[0.08] bg-foreground/[0.05] p-1 backdrop-blur-sm">
                <TabsTrigger
                  value="listings"
                  className="gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-foreground/60 data-[state=active]:bg-[hsl(var(--energy))] data-[state=active]:text-white data-[state=active]:shadow-none"
                >
                  <Send className="h-3.5 w-3.5" /> My Listings ({postedGigs.length})
                </TabsTrigger>
                <TabsTrigger
                  value="applications"
                  className="gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-foreground/60 data-[state=active]:bg-[hsl(var(--energy))] data-[state=active]:text-white data-[state=active]:shadow-none"
                >
                  <Briefcase className="h-3.5 w-3.5" /> My Applications ({applications.length})
                </TabsTrigger>
              </TabsList>
            </div>
          }
        />

        <StudioFeatureShell>
          {/* ── MY LISTINGS ── */}
          <TabsContent value="listings" className="mt-0 space-y-4">
            {postedGigs.length === 0 ? (
              <EmptyState
                icon={Briefcase}
                eyebrow="No listings yet"
                title="Post your first gig"
                description="Reach thousands of vetted creators in minutes. Paid, barter, or collab — your call."
                action={{ label: "Post a Gig", icon: Plus, onClick: () => navigate("/post-opportunity") }}
                secondaryAction={{ label: "Browse examples", onClick: () => navigate("/opportunities") }}
              />
            ) : (
              <>
                {/* Search + sort */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search your gigs…"
                      className="pl-9 h-10 text-sm rounded-full"
                    />
                  </div>
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
                    <SelectTrigger className="h-10 w-auto gap-1.5 text-xs px-3 rounded-full">
                      <Filter className="h-3.5 w-3.5" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent align="end">
                      <SelectItem value="newest">Newest</SelectItem>
                      <SelectItem value="oldest">Oldest</SelectItem>
                      <SelectItem value="most_applicants">Most applicants</SelectItem>
                      <SelectItem value="title">A → Z</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Status chips */}
                <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1 scrollbar-none">
                  <StatusChip value="all" label="All" count={counts.all} />
                  <StatusChip value="active" label="Live" count={counts.active} />
                  <StatusChip value="paused" label="Paused" count={counts.paused} />
                  <StatusChip value="filled" label="Filled" count={counts.filled} />
                  <StatusChip value="closed" label="Closed" count={counts.closed} />
                </div>

                {filteredGigs.length === 0 ? (
                  <div className="text-center py-10 text-sm text-muted-foreground">
                    No gigs match these filters.
                  </div>
                ) : (
                  <>
                    {activeGigs.length > 0 && (
                      <GigSection
                        label="Live"
                        gigs={activeGigs}
                        visible={liveVisible}
                        onSeeMore={() => setLiveVisible(v => v + PAGE_SIZE)}
                        onStatusChange={updateGigStatus}
                        navigate={navigate}
                        onOpenApplicants={openApplicants}
                        onDuplicate={duplicateGig}
                        onShare={shareGig}
                      />
                    )}

                    {inactiveGigs.length > 0 && (
                      <GigSection
                        label="Past"
                        gigs={inactiveGigs}
                        visible={pastVisible}
                        onSeeMore={() => setPastVisible(v => v + PAGE_SIZE)}
                        onStatusChange={updateGigStatus}
                        navigate={navigate}
                        onOpenApplicants={openApplicants}
                        onDuplicate={duplicateGig}
                        onShare={shareGig}
                      />
                    )}
                  </>
                )}
              </>
            )}
          </TabsContent>

          {/* ── MY APPLICATIONS ── */}
          <TabsContent value="applications" className="mt-0 space-y-4">
            {applications.length === 0 ? (
              <EmptyState
                icon={Sparkles}
                eyebrow="Nothing in flight"
                title="Apply to your first gig"
                description="The fastest way to land work is to send 3 strong applications today. We'll notify you the moment a poster responds."
                action={{ label: "Browse Gigs", icon: ArrowRight, onClick: () => navigate("/opportunities") }}
              />
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {applications.slice(0, appsVisible).map(app => (
                    <ApplicationCard key={app.id} app={app} navigate={navigate} />
                  ))}
                </div>
                {applications.length > appsVisible && (
                  <SeeMoreButton remaining={applications.length - appsVisible} onClick={() => setAppsVisible(v => v + PAGE_SIZE)} />
                )}
              </>
            )}
          </TabsContent>
        </StudioFeatureShell>
      </Tabs>
    </PageTransition>
  );
};

// ── Section: eyebrow + grid + "See more" ──
const GigSection = ({
  label,
  gigs,
  visible,
  onSeeMore,
  onStatusChange,
  navigate,
  onOpenApplicants,
  onDuplicate,
  onShare,
}: {
  label: string;
  gigs: PostedGig[];
  visible: number;
  onSeeMore: () => void;
  onStatusChange: (id: string, status: string) => void;
  navigate: (path: string) => void;
  onOpenApplicants: (opportunityId: string) => void;
  onDuplicate: (id: string) => void;
  onShare: (id: string, title: string) => void;
}) => (
  <div className="space-y-3">
    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] px-1">
      {label} · {gigs.length}
    </p>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {gigs.slice(0, visible).map(gig => (
        <GigCard key={gig.id} gig={gig} onStatusChange={onStatusChange} navigate={navigate} onOpenApplicants={onOpenApplicants} onDuplicate={onDuplicate} onShare={onShare} />
      ))}
    </div>
    {gigs.length > visible && (
      <SeeMoreButton remaining={gigs.length - visible} onClick={onSeeMore} />
    )}
  </div>
);

const SeeMoreButton = ({ remaining, onClick }: { remaining: number; onClick: () => void }) => (
  <div className="flex justify-center pt-1">
    <Button variant="outline" size="sm" onClick={onClick} className="gap-1.5 rounded-full">
      See more <span className="text-muted-foreground">({remaining})</span>
      <ChevronDown className="h-3.5 w-3.5" />
    </Button>
  </div>
);

// ── Gig Card ──
const GigCard = ({
  gig,
  onStatusChange,
  navigate,
  onOpenApplicants,
  onDuplicate,
  onShare,
}: {
  gig: PostedGig;
  onStatusChange: (id: string, status: string) => void;
  navigate: (path: string) => void;
  onOpenApplicants: (opportunityId: string) => void;
  onDuplicate: (id: string) => void;
  onShare: (id: string, title: string) => void;
}) => {
  const config = statusConfig[gig.status] || statusConfig.active;
  const StatusIcon = config.icon;
  const hasPending = (gig.pending_count || 0) > 0;

  return (
    <div
      className={cn(
        "group relative flex flex-col rounded-2xl overflow-hidden border bg-card transition-all hover:border-[hsl(var(--energy)/0.4)] hover:shadow-2xl hover:shadow-[hsl(var(--energy)/0.1)]",
        hasPending ? "border-amber-500/40 ring-1 ring-amber-500/20" : "border-border",
      )}
    >
      {/* Cover — the opportunity's own image, same editorial treatment as
          Scout's cards, so a posted gig and a scouted one read as the same
          visual family instead of two different products. */}
      <div
        className="relative aspect-[16/9] overflow-hidden shrink-0 cursor-pointer"
        onClick={() => navigate(`/opportunity/${gig.id}`)}
      >
        {gig.image_url ? (
          <img
            src={gig.image_url}
            alt={gig.title}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[hsl(var(--energy)/0.3)] via-primary/10 to-background flex items-center justify-center">
            <Briefcase className="h-12 w-12 text-foreground/15" strokeWidth={1.5} />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />

        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-start justify-between gap-2">
          <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border backdrop-blur-sm", config.pill)}>
            <StatusIcon className="h-2.5 w-2.5" />
            {config.label}
          </span>
          {hasPending && (
            <Badge className="h-5 text-[10px] font-bold bg-amber-500 text-white border-0 shrink-0 shadow-sm">
              {gig.pending_count} new
            </Badge>
          )}
        </div>

        <div className="absolute bottom-0 inset-x-0 p-3">
          <h3 className="font-bold text-base leading-tight line-clamp-2 text-foreground">{gig.title}</h3>
        </div>
      </div>

      <div className="p-3 flex flex-col gap-2 flex-1">
        {/* Meta row */}
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
          {gig.type && <span className="uppercase tracking-wide text-[10px] font-bold text-foreground/70">{gig.type}</span>}
          {gig.compensation && (
            <span className="flex items-center gap-0.5"><DollarSign className="h-3 w-3" /> {gig.compensation}</span>
          )}
          {gig.location && (
            <span className="flex items-center gap-0.5"><MapPin className="h-3 w-3" /> {gig.location}</span>
          )}
        </div>

        {/* Applicants + views + age */}
        <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-border/50">
          <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              <span className="font-semibold text-foreground">{gig.applicant_count || 0}</span>
            </span>
            {typeof gig.view_count === "number" && (
              <span className="flex items-center gap-1">
                <Eye className="h-3.5 w-3.5" />
                {gig.view_count}
              </span>
            )}
          </div>
          <span className="flex items-center gap-1 text-[10px] shrink-0">
            <Clock className="h-3 w-3" /> {formatDistanceToNow(new Date(gig.created_at), { addSuffix: true })}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 pt-1">
          <Button
            size="sm"
            variant={(gig.applicant_count || 0) > 0 ? "default" : "outline"}
            className="flex-1 h-8 text-xs gap-1 rounded-full"
            onClick={() => (gig.applicant_count || 0) > 0 ? onOpenApplicants(gig.id) : navigate(`/opportunity/${gig.id}`)}
            disabled={(gig.applicant_count || 0) === 0 && gig.status === "closed"}
          >
            {(gig.applicant_count || 0) > 0 ? "Review" : "View"}
            <ArrowRight className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0 rounded-full" onClick={() => onShare(gig.id, gig.title)} aria-label="Share">
            <Share2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0 rounded-full" onClick={() => navigate(`/post-opportunity?edit=${gig.id}`)} aria-label="Edit">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0 rounded-full" aria-label="More options">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => navigate(`/opportunity/${gig.id}`)}>
                <Eye className="h-3.5 w-3.5 mr-2" /> View public page
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDuplicate(gig.id)}>
                <CopyIcon className="h-3.5 w-3.5 mr-2" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {(gig.status === "active" || gig.status === "open") && (
                <DropdownMenuItem onClick={() => onStatusChange(gig.id, "paused")}>
                  <Pause className="h-3.5 w-3.5 mr-2" /> Pause
                </DropdownMenuItem>
              )}
              {gig.status === "paused" && (
                <DropdownMenuItem onClick={() => onStatusChange(gig.id, "active")}>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-2" /> Reactivate
                </DropdownMenuItem>
              )}
              {gig.status !== "filled" && (
                <DropdownMenuItem onClick={() => onStatusChange(gig.id, "filled")}>
                  <Users className="h-3.5 w-3.5 mr-2" /> Mark filled
                </DropdownMenuItem>
              )}
              {gig.status !== "closed" && (
                <DropdownMenuItem onClick={() => onStatusChange(gig.id, "closed")} className="text-destructive">
                  <XCircle className="h-3.5 w-3.5 mr-2" /> Close
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
};

// ── Application Card ──
const ApplicationCard = ({ app, navigate }: { app: Application; navigate: (path: string) => void }) => {
  const config = appStatusConfig[app.status] || appStatusConfig.pending;
  return (
    <div
      onClick={() => navigate(`/opportunity/${app.opportunity_id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") navigate(`/opportunity/${app.opportunity_id}`); }}
      className="group flex flex-col rounded-2xl border border-border bg-card p-4 gap-2.5 cursor-pointer transition-all hover:border-[hsl(var(--energy)/0.4)] hover:shadow-lg"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-bold leading-tight line-clamp-2 flex-1">{app.opportunity_title}</p>
        <Badge variant={config.variant} className="text-[10px] shrink-0">{config.label}</Badge>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
        {app.opportunity_type && (
          <span className="flex items-center gap-0.5"><Briefcase className="h-3 w-3" /> {app.opportunity_type}</span>
        )}
        {app.compensation && (
          <span className="flex items-center gap-0.5"><DollarSign className="h-3 w-3" /> {app.compensation}</span>
        )}
        {app.location && (
          <span className="flex items-center gap-0.5"><MapPin className="h-3 w-3" /> {app.location}</span>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 mt-auto pt-2 border-t border-border/50">
        {app.poster_name ? (
          <div className="flex items-center gap-1.5 min-w-0">
            <Avatar className="h-5 w-5 shrink-0">
              <AvatarImage src={app.poster_avatar || undefined} />
              <AvatarFallback className="text-[9px]">{app.poster_name[0]}</AvatarFallback>
            </Avatar>
            <span className="text-[11px] text-muted-foreground truncate">{app.poster_name}</span>
          </div>
        ) : <span />}
        <span className="text-[10px] text-muted-foreground flex items-center gap-1 shrink-0">
          <Clock className="h-3 w-3" /> {formatDistanceToNow(new Date(app.created_at), { addSuffix: true })}
        </span>
      </div>
    </div>
  );
};

export default ManageOpportunities;
