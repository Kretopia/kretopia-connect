import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Globe, Linkedin, Instagram, Sparkles, MapPin, ExternalLink,
  RefreshCw, Mail, Bookmark, X, Send, ShieldCheck, Briefcase, SlidersHorizontal,
  CheckCircle2, Trophy, Banknote,
} from "lucide-react";
import { ScoutPreferencesDialog } from "./ScoutPreferencesDialog";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext, type CarouselApi } from "@/components/ui/carousel";
import { CarouselPositionDots } from "@/components/ui/glass/CarouselPositionDots";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useNavigate } from "react-router-dom";
import { extractInvokeError } from "@/lib/extractInvokeError";
import { OPPORTUNITY_PUBLIC_COLUMNS } from "@/lib/opportunityColumns";
import { KretoMark } from "@/components/brand/KretoMark";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { cn } from "@/lib/utils";
import { applyPayFilter, countPaid, hasRealCompensation, type PayFilter } from "@/lib/scoutPay";
import {
  LIVE_INTERVAL_MS,
  degradedNote,
  describeScan,
  friendlyScanError,
  isScanStale,
  type ScanResult,
} from "@/lib/scoutScan";
import { SmartWidget } from "@/components/ui/smart-widget";
import { HoloCard } from "@/components/passport/HoloCard";
import kretoScout from "@/assets/brand/kreto/kreto-scout-cutout.png";

interface ScoutedGig {
  id: string;
  source: string;
  source_name: string | null;
  source_url: string;
  title: string;
  company: string | null;
  location: string | null;
  remote: boolean;
  description: string | null;
  full_description: string | null;
  image_url: string | null;
  compensation: string | null;
  contact_email: string | null;
  apply_url: string | null;
  fit_score: number;
  fit_reason: string | null;
  scouted_at: string;
  /** When the board says the job went up; null for pages that don't say. */
  posted_at?: string | null;
  details_fetched_at: string | null;
}

const SOURCE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  web: Globe, linkedin: Linkedin, instagram: Instagram, ats: Briefcase, gigboard: Briefcase,
};

// Pay chip -- the survey's #1 ask is "find suitable paid work", so what a gig
// pays (or that it doesn't say) is the first thing on every card.
function PayChip({ compensation, className }: { compensation: string | null; className?: string }) {
  if (hasRealCompensation(compensation)) {
    return (
      <span
        className={cn(
          "inline-flex max-w-full items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400",
          className,
        )}
        title={compensation}
      >
        <Banknote className="h-3 w-3 shrink-0" />
        <span className="truncate">{compensation}</span>
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center rounded-full border border-dashed border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground", className)}>
      Pay not listed
    </span>
  );
}

// Lightweight markdown renderer for the brief (headings + paragraphs + lists)
function MiniMarkdown({ md }: { md: string }) {
  const blocks = md.split(/\n{2,}/);
  return (
    <div className="space-y-3 text-sm leading-relaxed text-foreground/90">
      {blocks.map((b, i) => {
        const trimmed = b.trim();
        if (/^#{1,6}\s/.test(trimmed)) {
          const text = trimmed.replace(/^#{1,6}\s/, "");
          return <h4 key={i} className="text-sm font-bold text-foreground mt-2">{text}</h4>;
        }
        if (/^[-*]\s/m.test(trimmed)) {
          const items = trimmed.split(/\n/).map((l) => l.replace(/^[-*]\s/, "").trim()).filter(Boolean);
          return (
            <ul key={i} className="list-disc pl-5 space-y-1">
              {items.map((it, j) => <li key={j}>{it.replace(/\*\*(.+?)\*\*/g, "$1")}</li>)}
            </ul>
          );
        }
        return (
          <p key={i} className="whitespace-pre-wrap">
            {trimmed.split(/(\*\*[^*]+\*\*)/).map((seg, k) =>
              seg.startsWith("**") ? <strong key={k}>{seg.slice(2, -2)}</strong> : <span key={k}>{seg}</span>
            )}
          </p>
        );
      })}
    </div>
  );
}

interface ScoutedGigsSectionProps {
  /** When set, only show this many gigs and append a "See all" link to /opportunities. */
  limit?: number;
}

const isThinListing = (g: ScoutedGig) => {
  const desc = (g.full_description || g.description || "").trim();
  if (desc.length < 40 && !g.compensation && !g.company) return true;
  const url = g.apply_url || g.source_url || "";
  try {
    const u = new URL(url);
    const segs = u.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
    const last = (segs[segs.length - 1] || "").toLowerCase();
    const generic = ["jobs","careers","search","browse","explore","listings","opportunities","gigs","tags","postings","apply","casting"];
    if (generic.includes(last)) return true;
    if (segs.length < 2 && last.length < 8) return true;
    if (/linkedin\.com$/.test(u.hostname.replace(/^www\./, "")) && !/\/jobs\/view\//.test(u.pathname)) return true;
  } catch { return true; }
  return false;
};

export function ScoutedGigsSection({ limit }: ScoutedGigsSectionProps = {}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  // Chasing down real 404s: image_url values can go stale (source page
  // took the image down, hotlink blocked, etc.) after a gig was already
  // scouted -- the old onError handler just hid the broken <img> outright,
  // leaving a blank gap and a console error with no visible fix. Every
  // scouted gig now gets a real picture: the source image if it loads, a
  // branded Kreto Scout illustration if it never had one or failed to load.
  const [brokenImageIds, setBrokenImageIds] = useState<Set<string>>(new Set());
  const markImageBroken = (id: string) =>
    setBrokenImageIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  const queryKey = ["scouted-gigs", user?.id];
  // Declared before the queries: while a scan runs the list is re-read every
  // few seconds, so gigs appear as the scan saves them instead of at the end.
  const [scanning, setScanning] = useState(false);
  const { data: gigs = [], isLoading: loading } = useQuery({
    queryKey,
    refetchInterval: scanning ? 3_000 : 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("scouted_gigs")
        .select("*")
        .eq("target_user_id", user!.id)
        .gt("expires_at", new Date().toISOString())
        .order("fit_score", { ascending: false })
        .order("scouted_at", { ascending: false })
        .limit(40);

      const { data: actions } = await supabase
        .from("scouted_gig_actions")
        .select("scouted_gig_id, action")
        .eq("user_id", user!.id)
        .eq("action", "dismissed");
      const dismissed = new Set((actions || []).map((a) => a.scouted_gig_id));
      return ((data || []) as ScoutedGig[]).filter((g) => !dismissed.has(g.id) && !isThinListing(g));
    },
    enabled: !!user,
  });
  const { data: progress = { saved: 0, applied: 0, won: 0 } } = useQuery({
    queryKey: ["scout-progress", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scouted_gig_actions")
        .select("action, outcome")
        .eq("user_id", user!.id);
      if (error) throw error;
      return {
        saved: data.filter((item) => item.action === "saved").length,
        applied: data.filter((item) => item.action === "applied").length,
        won: data.filter((item) => item.action === "applied" && item.outcome === "won").length,
      };
    },
    enabled: !!user,
  });
  // When Scout last checked the boards (any trigger), for the "Live" line and
  // to decide whether to refresh on arrival.
  const { data: lastRunAt = null, isFetched: lastRunKnown } = useQuery({
    queryKey: ["scout-last-run", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("scout_preferences")
        .select("last_run_at")
        .eq("user_id", user!.id)
        .maybeSingle();
      return (data?.last_run_at as string | null | undefined) ?? null;
    },
    enabled: !!user,
    refetchInterval: 60_000,
  });
  const [scanUnavailable, setScanUnavailable] = useState<string | null>(null);
  const [liveRefreshing, setLiveRefreshing] = useState(false);
  const [scanNote, setScanNote] = useState<string | null>(null);
  const [payFilter, setPayFilter] = useState<PayFilter>("all");
  const [scanElapsed, setScanElapsed] = useState(0);
  const scanTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [openGig, setOpenGig] = useState<ScoutedGig | null>(null);
  const paidCount = countPaid(gigs);
  const visibleGigs = applyPayFilter(gigs, payFilter);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [coverLetter, setCoverLetter] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const reducedMotion = useReducedMotion();

  // Guarantee the For You tab is never a dead end: when nothing has been
  // scouted yet (new account, first scan running, or scan failed), surface
  // real open gigs from the Kretopia marketplace instead of an empty card.
  const { data: fallbackOpps = [] } = useQuery({
    queryKey: ["scout-fallback-opps"],
    queryFn: async () => {
      const { data } = await supabase
        .from("opportunities")
        .select(OPPORTUNITY_PUBLIC_COLUMNS)
        .in("status", ["active", "open"])
        .order("created_at", { ascending: false })
        .limit(6);
      return (data || []) as {
        id: string; title: string; type: string | null;
        location: string | null; compensation: string | null;
      }[];
    },
    enabled: !limit && !loading && gigs.length === 0,
    staleTime: 5 * 60_000,
  });

  // `auto` = a scan we start ourselves. It must never greet someone with a red
  // failure toast for something they didn't ask for.
  // `mode`: "full" is Scan now / first arrival (job boards, plus web search and
  // AI when the workspace has them); "live" is the quiet background refresh of
  // the public job boards (free; the server throttles it).
  const busyRef = useRef(false);
  const scanNow = async ({ auto = false, mode = "full" }: { auto?: boolean; mode?: "full" | "live" } = {}) => {
    if (!user) return;
    if (auto && busyRef.current) return;
    busyRef.current = true;
    const live = mode === "live";
    if (live) {
      setLiveRefreshing(true);
    } else {
      setScanning(true);
      setScanElapsed(0);
      scanTimerRef.current = setInterval(() => setScanElapsed((s) => s + 1), 1000);
    }

    const { data, error } = await supabase.functions.invoke("scout-gigs", { body: { trigger: live ? "live" : "manual" } });

    busyRef.current = false;
    if (live) {
      setLiveRefreshing(false);
    } else {
      if (scanTimerRef.current) clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
      setScanning(false);
    }

    if (error) {
      // The SDK's own message is a generic "non-2xx status code" — the
      // function's real error (config, auth, rate limit) lives in the body.
      const detail = friendlyScanError(await extractInvokeError(error));
      if (auto) {
        if (!live) setScanUnavailable(detail);
        return;
      }
      toast({ title: "Scout failed", description: detail, variant: "destructive" });
      setScanUnavailable(detail);
      return;
    }

    const result = (data ?? {}) as ScanResult;
    setScanUnavailable(null);
    setScanNote(degradedNote(result.degraded));
    const message = describeScan(result, auto);
    if (message) toast(message);
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: ["scout-last-run", user.id] });
  };

  useEffect(() => () => { if (scanTimerRef.current) clearInterval(scanTimerRef.current); }, []);

  // On arrival, once per mount: nothing scouted yet -> a full scan (waiting for
  // a manual click was the whole complaint); otherwise, if the last check is
  // stale -> a quiet live refresh, so the list is current the moment it is
  // looked at. Marking the ref in both cases keeps it from looping or burning
  // through the server-side weekly limit (e.g. after dismissing everything).
  const hasAutoScannedRef = useRef(false);
  useEffect(() => {
    if (hasAutoScannedRef.current) return;
    if (loading || scanning || !user || !lastRunKnown) return;
    hasAutoScannedRef.current = true;
    if (gigs.length === 0) scanNow({ auto: true });
    else if (!limit && isScanStale(lastRunAt)) scanNow({ auto: true, mode: "live" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, gigs.length, lastRunKnown, lastRunAt]);

  // While Scout stays open and visible, look again every few minutes. The
  // boards update about hourly and the server skips a refresh that comes too
  // soon after the last one, so this costs nothing.
  useEffect(() => {
    if (!user || limit) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") scanNow({ auto: true, mode: "live" });
    }, LIVE_INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, limit]);

  const dismiss = async (gigId: string) => {
    if (!user) return;
    const { error } = await supabase.from("scouted_gig_actions").upsert({ user_id: user.id, scouted_gig_id: gigId, action: "dismissed" });
    if (error) {
      toast({ title: "Couldn't dismiss this gig", description: "Your preference was not saved. Try again.", variant: "destructive" });
      return;
    }
    queryClient.setQueryData<ScoutedGig[]>(queryKey, (prev) => (prev ?? []).filter((g) => g.id !== gigId));
    toast({ title: "Gig dismissed", description: "This choice helps refine what Scout shows you." });
  };

  const save = async (gigId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    const { error } = await supabase.from("scouted_gig_actions").upsert({ user_id: user.id, scouted_gig_id: gigId, action: "saved" });
    if (error) {
      toast({ title: "Couldn't save this gig", variant: "destructive" });
      return;
    }
    // Shortlist lives in a separate query cache (ShortlistedGigs.tsx) —
    // without this, saving here can leave that tab showing a stale list
    // for up to its 5min staleTime if it was already visited this session.
    queryClient.invalidateQueries({ queryKey: ["shortlisted-gigs", user.id] });
    queryClient.invalidateQueries({ queryKey: ["scout-progress", user.id] });
    toast({ title: "Saved to your shortlist", description: "Scout will use this signal to refine future matches." });
  };

  const openDetail = async (gig: ScoutedGig) => {
    if (!user) return;
    setOpenGig(gig);
    setCoverLetter("");
    await supabase.from("scouted_gig_actions").upsert({
      user_id: user.id, scouted_gig_id: gig.id, action: "opened",
    }).then(() => {}, () => {});

    // Enrich if we don't have full_description yet
    if (!gig.full_description) {
      setEnriching(true);
      const { data, error } = await supabase.functions.invoke("scout-gig-detail", {
        body: { scouted_gig_id: gig.id },
      });
      setEnriching(false);
      if (!error && data?.gig) {
        setOpenGig(data.gig as ScoutedGig);
        queryClient.setQueryData<ScoutedGig[]>(queryKey, (prev) =>
          (prev ?? []).map((g) => (g.id === gig.id ? (data.gig as ScoutedGig) : g)),
        );
      }
    }
  };

  const draftLetter = async () => {
    if (!openGig || !user) return;
    setDrafting(true);
    const { data, error } = await supabase.functions.invoke("draft-gig-application", {
      body: { scouted_gig_id: openGig.id },
    });
    queryClient.invalidateQueries({ queryKey: ["scout-progress", user.id] });
    setDrafting(false);
    if (error || !data?.cover_letter) {
      toast({ title: "Couldn't draft letter", variant: "destructive" });
      return;
    }
    setCoverLetter(data.cover_letter);
    supabase.from("scouted_gig_actions").upsert({
      user_id: user.id, scouted_gig_id: openGig.id, action: "drafted",
    }).then(() => {}, () => {});
  };

  const trackApplyClick = () => {
    if (!user || !openGig) return;
    supabase.from("scouted_gig_actions").upsert({
      user_id: user.id, scouted_gig_id: openGig.id, action: "apply_clicked",
    }).then(() => {}, () => {});
  };

  const markApplied = async () => {
    if (!user || !openGig) return;
    await supabase.from("scouted_gig_actions").upsert({
      user_id: user.id, scouted_gig_id: openGig.id, action: "applied",
      cover_letter: coverLetter, outcome: "pending",
    });
    toast({ title: "Marked as applied", description: "Tap Won / Lost / Ghosted later to track outcome." });
    setOpenGig(null);
  };

  const setOutcome = async (outcome: "won" | "lost" | "ghosted") => {
    if (!user || !openGig) return;
    await supabase.from("scouted_gig_actions").update({ outcome })
      .eq("user_id", user.id).eq("scouted_gig_id", openGig.id).eq("action", "applied");
    queryClient.invalidateQueries({ queryKey: ["scout-progress", user.id] });
    toast({ title: outcome === "won" ? "Congrats — booked!" : `Marked ${outcome}` });
    setOpenGig(null);
  };

  const renderGigCard = (g: ScoutedGig) => {
    const Icon = SOURCE_ICON[g.source] || Globe;
    // CEO overhaul: Holo Card treatment (same 3D tilt/sheen wrapper as
    // PassportHero/Passport Directory), around this card's existing
    // content/logic unchanged -- it already had a real HD image, fit
    // score and "why this fits you" reasoning, just no HoloCard wrapper.
    return (
      <HoloCard className="h-full">
      <div
        onClick={() => openDetail(g)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDetail(g); } }}
        aria-label={`View brief for ${g.title}`}
        className="group relative h-full flex flex-col rounded-2xl overflow-hidden bg-card cursor-pointer transition-all hover:shadow-2xl hover:shadow-energy/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-energy"
      >
        <div className="relative aspect-[16/9] overflow-hidden shrink-0">
          {g.image_url && !brokenImageIds.has(g.id) ? (
            <img
              src={g.image_url}
              alt={g.title}
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              onError={() => markImageBroken(g.id)}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-energy/30 via-primary/10 to-background flex items-center justify-center">
              <img src={kretoScout} alt="" className="h-20 w-20 object-contain opacity-90" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />

          <div className="absolute top-2.5 left-2.5 right-2.5 flex items-start justify-between gap-2">
            <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-background/80 backdrop-blur-sm border-border">
              <Sparkles className="h-2.5 w-2.5 mr-1 text-energy" />
              Scouted
            </Badge>
            <Badge className="h-5 text-[10px] bg-energy/15 text-energy border-energy/30 shrink-0">
              {g.fit_score}% fit
            </Badge>
          </div>

          <div className="absolute bottom-0 inset-x-0 p-3">
            <h3 className="font-bold text-base leading-tight line-clamp-2 text-foreground">{g.title}</h3>
          </div>
        </div>

        <div className="p-3 flex flex-col gap-2 flex-1">
          <PayChip compensation={g.compensation} className="self-start" />
          {(g.company || g.location) && (
            <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
              {g.company && <span className="font-medium text-foreground/90">{g.company}</span>}
              {g.location && <><span>·</span><MapPin className="h-3 w-3" />{g.location}</>}
              {g.remote && <Badge variant="outline" className="h-4 text-[9px] px-1">Remote</Badge>}
            </div>
          )}

          {g.fit_reason && (
            <div className="rounded-lg bg-energy/[0.06] border border-energy/20 px-2.5 py-2">
              <div className="text-[9px] uppercase tracking-wider font-bold text-energy mb-0.5 flex items-center gap-1">
                <Sparkles className="h-2.5 w-2.5" />
                Why this fits you
              </div>
              <p className="text-[11px] leading-snug text-foreground/80 line-clamp-3">{g.fit_reason}</p>
            </div>
          )}

          <div className="mt-auto flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground min-w-0">
              <Icon className="h-3 w-3 shrink-0" />
              <span className="truncate">via {g.source_name || g.source}</span>
              <span>·</span>
              <span className="shrink-0">
                {g.posted_at ? "posted" : "found"} {formatDistanceToNow(new Date(g.posted_at || g.scouted_at), { addSuffix: true }).replace("about ", "")}
              </span>
            </div>
            <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => save(g.id, e)} title="Save">
                <Bookmark className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={(e) => { e.stopPropagation(); dismiss(g.id); }} title="Dismiss">
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
      </HoloCard>
    );
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Skeleton className="h-72 w-full rounded-2xl" />
          <Skeleton className="h-72 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-energy" />
            Scouted for you
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">Real gigs from job boards across the web — matched to your profile</p>
          {(liveRefreshing || lastRunAt) && (
            <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground" aria-live="polite">
              {liveRefreshing ? (
                <>
                  <KretopiaSpinner className="h-3 w-3" />
                  Checking the job boards…
                </>
              ) : (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                  Live · checked {formatDistanceToNow(new Date(lastRunAt!), { addSuffix: true }).replace("about ", "")}
                </>
              )}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => setPrefsOpen(true)} title="Tune scout preferences">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="ml-1.5 text-xs hidden sm:inline">Tune</span>
          </Button>
          <Button size="sm" variant="outline" onClick={() => scanNow()} disabled={scanning}>
            {scanning ? <KretoMark size="xs" state="active" /> : <RefreshCw className="h-3.5 w-3.5" />}
            <span className="ml-1.5 text-xs">Scan now</span>
          </Button>
        </div>
      </div>

      <ScoutPreferencesDialog
        open={prefsOpen}
        onOpenChange={setPrefsOpen}
        onSaved={() => { /* user can hit Scan now to re-run */ }}
      />

      {(progress.saved > 0 || progress.applied > 0 || progress.won > 0) && (
        <div className="flex flex-wrap gap-x-5 gap-y-2 border-y border-border/60 py-3" aria-label="Scout progress">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Bookmark className="h-3.5 w-3.5 text-energy" /> <strong className="text-foreground">{progress.saved}</strong> shortlisted
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-energy" /> <strong className="text-foreground">{progress.applied}</strong> applied
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Trophy className="h-3.5 w-3.5 text-energy" /> <strong className="text-foreground">{progress.won}</strong> booked
          </span>
        </div>
      )}

      {gigs.length > 0 && (
        <div role="group" aria-label="Pay filter" className="flex flex-wrap items-center gap-2">
          {([
            { id: "all" as const, label: `All ${gigs.length}` },
            { id: "paid" as const, label: `Pay listed ${paidCount}` },
          ]).map((f) => (
            <Button
              key={f.id}
              type="button"
              size="sm"
              variant="ghost"
              aria-pressed={payFilter === f.id}
              onClick={() => setPayFilter(f.id)}
              className={cn(
                "h-7 rounded-full border px-3 text-xs font-semibold",
                payFilter === f.id
                  ? "border-energy/40 bg-energy/10 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {f.id === "paid" && <Banknote className="mr-1 h-3.5 w-3.5" />}
              {f.label}
            </Button>
          ))}
          {gigs.length - paidCount > 0 && payFilter === "all" && (
            <span className="text-[11px] text-muted-foreground">
              {gigs.length - paidCount} don't state their pay. Check before you spend time on a pitch.
            </span>
          )}
        </div>
      )}

      {scanUnavailable && !scanning && (
        <p className="rounded-xl border border-border bg-card px-3 py-2 text-[11px] text-muted-foreground" role="status">
          {scanUnavailable}
        </p>
      )}

      {!scanUnavailable && scanNote && !scanning && (
        <p className="rounded-xl border border-border bg-card px-3 py-2 text-[11px] text-muted-foreground" role="status">
          {scanNote}
        </p>
      )}

      {scanning && (
        <SmartWidget interactive={false} className="p-3">
          <div className="flex items-center gap-3">
            <KretoMark size="xs" state="active" className="shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground">Searching remote job boards first, then gig sites, LinkedIn, Instagram and ATS pages…</p>
              <p className="text-[11px] text-muted-foreground">{scanElapsed}s elapsed — new gigs appear below as they're found</p>
            </div>
          </div>
        </SmartWidget>
      )}

      {gigs.length === 0 && !scanning ? (
        fallbackOpps.length > 0 ? (
          <div className="space-y-3">
            <p className="text-[11px] text-muted-foreground">
              Your first personalized scan is warming up — meanwhile, these open gigs on Kretopia match your world:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {fallbackOpps.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => navigate("/scout?tab=marketplace")}
                  className="text-left rounded-2xl border border-border bg-card p-4 transition-all hover:border-energy/40 hover:shadow-lg hover:shadow-energy/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-energy"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-sm leading-tight line-clamp-2 text-foreground">{o.title}</h3>
                    {o.type && (
                      <Badge className="h-5 text-[10px] bg-energy/15 text-energy border-energy/30 shrink-0 capitalize">
                        {o.type}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                    {o.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />{o.location}
                      </span>
                    )}
                    {hasRealCompensation(o.compensation) && <span>· {o.compensation}</span>}
                  </div>
                  <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-energy">
                    View in Open Gigs <ExternalLink className="h-3 w-3" />
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <Card className="p-6 text-center text-sm text-muted-foreground border-dashed">
            No scouted gigs yet. Tap <span className="font-semibold text-foreground">Scan now</span> to find real jobs across the web matched to your skills.
          </Card>
        )
      ) : limit ? (
        <>
        {/* Compact embed (e.g. Today's "More from today") — carousel only, no hero. */}
        <Carousel opts={{ align: "start", dragFree: true, duration: reducedMotion ? 0 : 20 }} className="w-full" aria-label="Scouted gigs">
          <CarouselContent className="-ml-3">
            {gigs.slice(0, limit).map((g) => (
              <CarouselItem key={g.id} className="pl-3 basis-[85%] sm:basis-[60%]">
                {renderGigCard(g)}
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
        {gigs.length > limit && (
          <a
            href="/opportunities"
            className="mt-1 inline-flex items-center justify-center w-full rounded-xl border border-border bg-card hover:border-energy/40 hover:bg-energy/[0.04] transition-colors px-4 py-3 text-sm font-semibold text-foreground gap-2"
          >
            See all {gigs.length} scouted gigs
            <ExternalLink className="h-3.5 w-3.5 text-energy" />
          </a>
        )}
        </>
      ) : visibleGigs.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground border-dashed">
          None of your {gigs.length} scouted gigs state their pay.{" "}
          <button type="button" className="font-semibold text-foreground underline underline-offset-2" onClick={() => setPayFilter("all")}>
            Show all
          </button>
        </Card>
      ) : (
        <>
        {/* One strongest opportunity first — gigs are already ordered by fit_score desc. */}
        {visibleGigs[0] && (
          <HoloCard>
          <div
            onClick={() => openDetail(visibleGigs[0])}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDetail(visibleGigs[0]); } }}
            aria-label={`View brief for ${visibleGigs[0].title}, your strongest match`}
            className="group relative rounded-2xl overflow-hidden bg-card cursor-pointer transition-all hover:shadow-2xl hover:shadow-energy/10 sm:flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-energy"
          >
            <div className="relative aspect-[16/9] sm:aspect-auto sm:w-64 shrink-0 overflow-hidden">
              {visibleGigs[0].image_url && !brokenImageIds.has(visibleGigs[0].id) ? (
                <img
                  src={visibleGigs[0].image_url}
                  alt={visibleGigs[0].title}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  onError={() => markImageBroken(visibleGigs[0].id)}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-energy/30 via-primary/10 to-background flex items-center justify-center">
                  <img src={kretoScout} alt="" className="h-16 w-16 object-contain opacity-90" />
                </div>
              )}
              <div className="absolute top-2.5 left-2.5">
                <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-background/80 backdrop-blur-sm border-border">
                  Strongest match
                </Badge>
              </div>
            </div>
            <div className="p-4 flex flex-col gap-2.5 flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-bold text-lg leading-tight text-foreground">{visibleGigs[0].title}</h3>
                <Badge className="h-5 text-[10px] bg-energy/15 text-energy border-energy/30 shrink-0">
                  {visibleGigs[0].fit_score}% fit
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                <PayChip compensation={visibleGigs[0].compensation} />
                {visibleGigs[0].company && <span className="font-medium text-foreground/90">{visibleGigs[0].company}</span>}
                {visibleGigs[0].location && <><span>·</span><MapPin className="h-3 w-3" />{visibleGigs[0].location}</>}
                {visibleGigs[0].remote && <Badge variant="outline" className="h-4 text-[9px] px-1">Remote</Badge>}
              </div>
              {visibleGigs[0].fit_reason && (
                <div className="rounded-lg bg-energy/[0.06] border border-energy/20 px-3 py-2">
                  <div className="text-[9px] uppercase tracking-wider font-bold text-energy mb-0.5 flex items-center gap-1">
                    <Sparkles className="h-2.5 w-2.5" />
                    Why this fits you
                  </div>
                  <p className="text-xs leading-relaxed text-foreground/80">{visibleGigs[0].fit_reason}</p>
                </div>
              )}
              <div className="mt-auto flex items-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                <Button size="sm" onClick={() => openDetail(visibleGigs[0])} className="gap-1.5">
                  View full brief
                </Button>
                <Button size="sm" variant="outline" onClick={(e) => save(visibleGigs[0].id, e)} className="gap-1.5">
                  <Bookmark className="h-3.5 w-3.5" />
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); dismiss(visibleGigs[0].id); }} className="gap-1.5 text-muted-foreground">
                  <X className="h-3.5 w-3.5" />
                  Dismiss
                </Button>
              </div>
            </div>
          </div>
          </HoloCard>
        )}

        {/* Everything else — carousel, not a card wall. */}
        {visibleGigs.length > 1 && (
          <div className="relative">
            <Carousel setApi={setCarouselApi} opts={{ align: "start", dragFree: true, duration: reducedMotion ? 0 : 20 }} className="w-full" aria-label="More scouted gigs">
              <CarouselContent className="-ml-3">
                {visibleGigs.slice(1).map((g) => (
                  <CarouselItem key={g.id} className="pl-3 basis-[85%] sm:basis-[46%] lg:basis-[31%]">
                    {renderGigCard(g)}
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious variant="glass" className="hidden sm:flex -left-3" aria-label="Previous — scouted gigs" />
              <CarouselNext variant="glass" className="hidden sm:flex -right-3" aria-label="Next — scouted gigs" />
            </Carousel>
            <CarouselPositionDots api={carouselApi} label="Scouted gigs" className="mt-2" />
          </div>
        )}
        </>
      )}

      {/* In-app detail modal — compact, centered, no big hero/whitespace */}
      <Dialog open={!!openGig} onOpenChange={(o) => !o && setOpenGig(null)}>
        <DialogContent className="max-w-lg p-0">
          {openGig && (
            <>
              <DialogHeader className="p-4 pb-3 border-b border-border">
                <div className="flex items-start gap-3">
                  <div className="h-11 w-11 rounded-xl overflow-hidden shrink-0 bg-gradient-to-br from-energy/30 via-primary/10 to-background flex items-center justify-center">
                    {openGig.image_url && !brokenImageIds.has(openGig.id) ? (
                      <img
                        src={openGig.image_url}
                        alt={openGig.title}
                        className="h-full w-full object-cover"
                        onError={() => markImageBroken(openGig.id)}
                      />
                    ) : (
                      <img src={kretoScout} alt="" className="h-7 w-7 object-contain opacity-90" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <DialogTitle className="text-base font-black leading-tight text-foreground line-clamp-2 pr-6">
                      {openGig.title}
                    </DialogTitle>
                    <div className="flex items-center gap-1.5 flex-wrap mt-1 text-xs text-muted-foreground">
                      {openGig.company && <span className="font-medium text-foreground/80">{openGig.company}</span>}
                      {openGig.location && (
                        <span className="flex items-center gap-0.5">
                          <MapPin className="h-3 w-3" />{openGig.location}
                        </span>
                      )}
                      {openGig.remote && <Badge variant="outline" className="h-4 text-[9px] px-1">Remote</Badge>}
                      <Badge className="h-4 text-[9px] bg-energy/15 text-energy border-energy/30">{openGig.fit_score}% fit</Badge>
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <div className="p-4 space-y-3.5">
                {openGig.fit_reason && (
                  <div className="rounded-lg bg-energy/[0.06] border border-energy/20 px-3 py-2">
                    <div className="text-[9px] uppercase tracking-wider font-bold text-energy mb-0.5 flex items-center gap-1">
                      <Sparkles className="h-2.5 w-2.5" />
                      Why this fits you
                    </div>
                    <p className="text-xs leading-relaxed text-foreground/90">{openGig.fit_reason}</p>
                  </div>
                )}

                <div>
                  {enriching ? (
                    <div className="space-y-2">
                      <Skeleton className="h-3.5 w-full" />
                      <Skeleton className="h-3.5 w-full" />
                      <Skeleton className="h-3.5 w-3/4" />
                    </div>
                  ) : openGig.full_description ? (
                    <MiniMarkdown md={openGig.full_description} />
                  ) : openGig.description ? (
                    <p className="text-sm text-foreground/90 whitespace-pre-wrap">{openGig.description}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No additional details available.</p>
                  )}
                </div>

                {hasRealCompensation(openGig.compensation) && (
                  <div className="rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs">
                    <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider mr-2">Comp</span>
                    {openGig.compensation}
                  </div>
                )}

                {/* Cover letter — collapsed until drafted, keeps the modal short by default */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-bold">Cover letter</h3>
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs px-2"
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent("thrive-copilot:open", {
                            detail: {
                              prompt: `Help me think through this opportunity: "${openGig.title}"${openGig.company ? ` at ${openGig.company}` : ""}. What's the strongest angle for my pitch?`,
                              context: {
                                scouted_gig_id: openGig.id,
                                opportunity_title: openGig.title,
                                opportunity_source: openGig.source_name || openGig.source,
                                opportunity_source_url: openGig.source_url,
                              },
                            },
                          }));
                        }}
                      >
                        <Sparkles className="h-3 w-3 mr-1" />
                        Open in Kreto
                      </Button>
                      {!coverLetter && (
                        <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={draftLetter} disabled={drafting}>
                          {drafting ? <KretoMark size="xs" state="active" className="mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                          Draft
                        </Button>
                      )}
                    </div>
                  </div>
                  {drafting ? (
                    <div className="space-y-1.5"><Skeleton className="h-3.5 w-full" /><Skeleton className="h-3.5 w-3/4" /></div>
                  ) : coverLetter ? (
                    <Textarea value={coverLetter} onChange={(e) => setCoverLetter(e.target.value)} rows={5} className="text-sm" />
                  ) : null}
                </div>
              </div>

              {/* Footer actions */}
              <div className="p-4 pt-0 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  {openGig.contact_email ? (
                    <Button asChild size="sm" variant="default" onClick={trackApplyClick}>
                      <a href={`mailto:${openGig.contact_email}?subject=${encodeURIComponent(`RE: ${openGig.title}`)}&body=${encodeURIComponent(coverLetter)}`}>
                        <Mail className="h-3.5 w-3.5 mr-1.5" />Email apply
                      </a>
                    </Button>
                  ) : (
                    <Button asChild size="sm" variant="default" onClick={trackApplyClick}>
                      <a href={openGig.apply_url || openGig.source_url} target="_blank" rel="noopener noreferrer">
                        <Send className="h-3.5 w-3.5 mr-1.5" />Apply on site
                      </a>
                    </Button>
                  )}
                  <Button size="sm" onClick={markApplied} variant="outline">
                    <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />I applied
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setOutcome("won")}>🎉 Won</Button>
                  <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setOutcome("lost")}>Lost</Button>
                  <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setOutcome("ghosted")}>Ghosted</Button>
                </div>
                <a
                  href={openGig.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition pt-0.5"
                >
                  <ExternalLink className="h-3 w-3" />
                  Verify on {openGig.source_name || openGig.source}
                </a>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
