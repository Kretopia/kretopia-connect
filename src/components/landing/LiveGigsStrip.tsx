import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Flame, MapPin, ArrowRight, Briefcase, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

interface Gig {
  id: string;
  title: string;
  type: string | null;
  location: string | null;
  compensation: string | null;
  created_at: string;
}

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
};

const typeLabel = (t?: string | null) => {
  const v = (t || "").toLowerCase();
  if (v.includes("barter")) return "Barter";
  if (v.includes("collab")) return "Collab";
  return "Paid";
};

/**
 * Live Gigs swipe carousel — surfaces real opportunities on the landing page
 * Mobile: full-width snap-scroll cards (Tinder-style horizontal swipe).
 * Desktop: shows ~2.5 cards w/ arrow controls. Routes into /auth?intent=gigs.
 */
export const LiveGigsStrip = () => {
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("opportunities")
        .select("id, title, type, location, compensation, created_at")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(6);
      setGigs((data as Gig[]) || []);
      setLoading(false);
    })();
  }, []);

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-gig-card]");
    const w = card?.offsetWidth ?? el.clientWidth * 0.85;
    el.scrollBy({ left: dir * (w + 12), behavior: "smooth" });
  };

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-gig-card]");
    const w = card?.offsetWidth ?? el.clientWidth * 0.85;
    setActiveIdx(Math.round(el.scrollLeft / (w + 12)));
  };

  if (loading || gigs.length === 0) return null;

  return (
    <section className="border-y border-border/50 bg-cinematic">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-10">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-energy" />
            <h2 className="text-sm sm:text-base font-black uppercase tracking-[0.2em] text-foreground">
              Live Gigs
            </h2>
            <span className="hidden sm:inline-flex items-center gap-1.5 ml-2 text-[10px] font-bold uppercase tracking-wider text-energy">
              <span className="h-1.5 w-1.5 rounded-full bg-energy animate-pulse" />
              Hiring now
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => scrollBy(-1)}
              className="btn-glass btn-glass-outline hidden sm:inline-flex h-8 w-8 items-center justify-center rounded-full"
              aria-label="Previous gig"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollBy(1)}
              className="btn-glass btn-glass-outline hidden sm:inline-flex h-8 w-8 items-center justify-center rounded-full"
              aria-label="Next gig"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <Link
              to="/auth?tab=signup&intent=gigs&next=/opportunities"
              className="text-xs font-semibold text-primary hover:text-primary/80 inline-flex items-center gap-1 ml-1"
            >
              See all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        <div
          ref={scrollerRef}
          onScroll={onScroll}
          className="-mx-4 sm:mx-0 px-4 sm:px-0 flex gap-3 sm:gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {gigs.map((g) => (
            <Link
              key={g.id}
              data-gig-card
              to={`/auth?tab=signup&intent=gigs&next=${encodeURIComponent(`/opportunities/${g.id}`)}`}
              className="group relative shrink-0 snap-start w-[85%] sm:w-[340px] rounded-2xl border border-border/60 bg-card/60 p-4 hover:border-primary/40 hover:bg-card transition-all"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider border-primary/30 text-primary bg-primary/5">
                  {typeLabel(g.type)}
                </Badge>
                <span className="text-[10px] text-muted-foreground">{timeAgo(g.created_at)}</span>
              </div>
              <h3 className="text-base font-bold text-foreground line-clamp-2 mb-3 group-hover:text-primary transition-colors min-h-[2.75rem]">
                {g.title}
              </h3>
              <div className="space-y-1.5 mb-4">
                {g.location && (
                  <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" /> {g.location}
                  </p>
                )}
                {g.compensation && (
                  <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                    <Briefcase className="h-3.5 w-3.5" /> {g.compensation}
                  </p>
                )}
              </div>
              <div className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-energy group-hover:gap-2 transition-all">
                Apply <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </Link>
          ))}
        </div>

        {/* Dot indicators (mobile) */}
        <div className="sm:hidden flex justify-center gap-1.5 mt-2">
          {gigs.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === activeIdx ? "w-5 bg-primary" : "w-1.5 bg-border"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
};
