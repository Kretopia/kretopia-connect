import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Mic2, Search, Calendar, Users } from "lucide-react";
import { format, formatDistanceToNowStrict } from "date-fns";

export interface CuratedStage {
  id: string;
  type: "showcase" | "scout";
  title: string;
  blurb: string | null;
  cover_url: string | null;
  starts_at: string;
  capacity: number;
  is_paid: boolean;
  price_cents: number | null;
  currency: string | null;
  rsvp_count: number;
  status: string;
  host_user_id: string;
  vibe_tags: string[] | null;
}

interface CuratedStagesRailProps {
  limit?: number;
  hideWhenEmpty?: boolean;
  onLoad?: (count: number) => void;
}

/**
 * Horizontal rail of upcoming Scout & Showcase Stages.
 * Pulls scheduled or live stages starting within the next 14 days.
 */
export function CuratedStagesRail({ limit = 8, hideWhenEmpty = false, onLoad }: CuratedStagesRailProps) {
  const [stages, setStages] = useState<CuratedStage[] | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const horizon = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("curated_stages")
        .select("id,type,title,blurb,cover_url,starts_at,capacity,is_paid,price_cents,currency,rsvp_count,status,host_user_id,vibe_tags")
        .in("status", ["scheduled", "live"])
        .lte("starts_at", horizon)
        .gte("starts_at", new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString())
        .order("starts_at", { ascending: true })
        .limit(limit);
      if (mounted) {
        const rows = (data as any) ?? [];
        setStages(rows);
        onLoad?.(rows.length);
      }
    };

    load();

    const channel = supabase
      .channel("curated_stages_rail")
      .on("postgres_changes", { event: "*", schema: "public", table: "curated_stages" }, () => load().catch(() => {}))
      .subscribe();

    return () => { mounted = false; supabase.removeChannel(channel); };
  }, [limit]);

  if (stages === null) {
    return (
      <div className="flex gap-3 overflow-x-auto -mx-4 px-4 pb-1">
        {[0, 1].map((i) => <Skeleton key={i} className="h-44 w-64 shrink-0 rounded-2xl" />)}
      </div>
    );
  }

  if (stages.length === 0) {
    if (hideWhenEmpty) return null;
    return (
      <Card className="p-5 border-dashed bg-card">
        <p className="text-sm font-semibold">No curated stages this week.</p>
        <p className="text-xs text-muted-foreground mt-1">
          Producers, scouts and industry leaders schedule these drops. You'll see them here first.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto -mx-4 px-4 pb-1 scrollbar-thin">
      {stages.map((s) => <StageCard key={s.id} stage={s} />)}
    </div>
  );
}

function StageCard({ stage }: { stage: CuratedStage }) {
  const isLive = stage.status === "live";
  const Icon = stage.type === "scout" ? Search : Mic2;
  const typeLabel = stage.type === "scout" ? "Scout Stage" : "Showcase";
  const remaining = Math.max(0, stage.capacity - stage.rsvp_count);
  const scarcity = remaining > 0 && remaining <= 5;

  return (
    <Link
      to={`/circle/stage/${stage.id}`}
      className="block shrink-0 w-64 rounded-2xl border border-border bg-card overflow-hidden hover:border-primary/40 transition-colors"
    >
      <div
        className="h-24 bg-gradient-to-br from-primary/20 via-accent/10 to-background relative"
        style={stage.cover_url ? { backgroundImage: `url(${stage.cover_url})`, backgroundSize: "cover", backgroundPosition: "center" } : {}}
      >
        <div className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-background/95 text-[10px] font-bold uppercase tracking-wider">
          <Icon className="h-3 w-3" /> {typeLabel}
        </div>
        {isLive && (
          <div className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold uppercase tracking-wider animate-pulse">
            ● Live
          </div>
        )}
        {stage.is_paid && !isLive && (
          <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full bg-foreground text-background text-[10px] font-bold">
            ${((stage.price_cents ?? 0) / 100).toFixed(0)}
          </div>
        )}
      </div>
      <div className="p-3 space-y-1.5">
        <p className="font-bold text-sm leading-tight line-clamp-2">{stage.title}</p>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {isLive ? "Now" : formatStart(stage.starts_at)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="h-3 w-3" />
            {stage.rsvp_count}/{stage.capacity}
          </span>
        </div>
        {scarcity && (
          <p className="text-[10px] font-bold text-energy uppercase">Only {remaining} spots left</p>
        )}
      </div>
    </Link>
  );
}

function formatStart(iso: string) {
  const d = new Date(iso);
  const delta = d.getTime() - Date.now();
  if (delta < 0) return "Live";
  if (delta < 24 * 60 * 60 * 1000) return `in ${formatDistanceToNowStrict(d)}`;
  return format(d, "EEE, MMM d · h:mma");
}
