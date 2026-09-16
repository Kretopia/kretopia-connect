import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, RefreshCw, Radio } from "lucide-react";
import { StageCard, type StageCardData } from "./StageCard";
import type { SoundStage } from "./SoundStagesRail";
import { StudioSectionTabs } from "@/components/studio-reference/StudioSectionTabs";

interface StageGridProps {
  onJoinSoundStage: (stage: SoundStage) => void;
}

/**
 * The balanced grid of every joinable/upcoming Stage -- live Sound Stages and
 * scheduled/live Curated Stages together, one card shape, one responsive
 * grid. Replaces the previous two separately-styled horizontal rails.
 */
export function StageGrid({ onJoinSoundStage }: StageGridProps) {
  const navigate = useNavigate();
  const [cards, setCards] = useState<StageCardData[] | null>(null);
  const [error, setError] = useState(false);
  const soundStagesRef = useRef<Record<string, SoundStage>>({});

  const load = useCallback(async () => {
    setError(false);
    try {
      const [soundRes, curatedRes] = await Promise.all([
        supabase
          .from("sound_stages")
          .select("id, host_user_id, title, vibe_tag, mode, format, participant_count, started_at")
          .eq("is_live", true)
          .order("started_at", { ascending: false })
          .limit(20),
        supabase
          .from("curated_stages")
          .select("id,type,title,cover_url,starts_at,capacity,rsvp_count,status,host_user_id")
          .in("status", ["scheduled", "live"])
          .lte("starts_at", new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString())
          .gte("starts_at", new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString())
          .order("starts_at", { ascending: true })
          .limit(20),
      ]);
      if (soundRes.error) throw soundRes.error;
      if (curatedRes.error) throw curatedRes.error;

      const soundStages = (soundRes.data ?? []) as SoundStage[];
      const hostIds = Array.from(new Set(soundStages.map((s) => s.host_user_id))).filter(Boolean);
      const hostMap: Record<string, { full_name: string | null; avatar_url: string | null; username: string | null }> = {};
      if (hostIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, full_name, avatar_url, username")
          .in("user_id", hostIds);
        (profs ?? []).forEach((p: any) => {
          hostMap[p.user_id] = { full_name: p.full_name, avatar_url: p.avatar_url, username: p.username };
        });
      }

      soundStagesRef.current = {};
      const soundCards: StageCardData[] = soundStages.map((s) => {
        soundStagesRef.current[s.id] = s;
        const host = hostMap[s.host_user_id];
        return {
          id: s.id,
          title: s.title,
          coverUrl: null,
          hostName: host?.username ? `@${host.username}` : host?.full_name ?? null,
          hostAvatarUrl: host?.avatar_url ?? null,
          status: "live",
          when: s.started_at,
          participantCount: s.participant_count,
          capacity: null,
          kind: "sound_stage",
          mode: s.mode,
        };
      });

      const curatedCards: StageCardData[] = (curatedRes.data ?? []).map((c: any) => ({
        id: c.id,
        title: c.title,
        coverUrl: c.cover_url,
        hostName: null,
        hostAvatarUrl: null,
        status: c.status === "live" ? "live" : "upcoming",
        when: c.starts_at,
        participantCount: c.rsvp_count,
        capacity: c.capacity,
        kind: "curated_stage",
        curatedType: c.type,
      }));

      setCards([...soundCards, ...curatedCards]);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("stage-grid")
      .on("postgres_changes", { event: "*", schema: "public", table: "sound_stages" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "curated_stages" }, () => load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load]);

  const handleAction = (stage: StageCardData) => {
    if (stage.kind === "sound_stage") {
      const original = soundStagesRef.current[stage.id];
      if (original) onJoinSoundStage(original);
      return;
    }
    navigate(`/circle/stage/${stage.id}`);
  };

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center space-y-3">
        <AlertCircle className="h-6 w-6 text-destructive mx-auto" aria-hidden />
        <p className="text-sm font-semibold">Couldn't load stages</p>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[hsl(var(--energy))] hover:underline"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Retry
        </button>
      </div>
    );
  }

  if (cards === null) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-busy="true" aria-label="Loading stages">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card overflow-hidden animate-pulse">
            <div className="aspect-video bg-muted" />
            <div className="p-3.5 space-y-2">
              <div className="h-4 w-3/4 bg-muted rounded" />
              <div className="h-3 w-1/2 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-muted/30 p-6 text-center space-y-1">
        <Radio className="h-5 w-5 text-muted-foreground mx-auto mb-1" aria-hidden />
        <p className="text-sm font-semibold">No stages live or scheduled</p>
        <p className="text-xs text-muted-foreground">Be first up — pop open a stage and let people walk on.</p>
      </div>
    );
  }

  const liveCards = cards.filter((c) => c.status === "live");
  const upcomingCards = cards.filter((c) => c.status !== "live");

  // Only offer the Live/Upcoming split once there's actually something on
  // both sides of it — otherwise it'd be a filter with a dead second tab.
  if (liveCards.length === 0 || upcomingCards.length === 0) {
    return <StageCardGrid cards={cards} onAction={handleAction} />;
  }

  return (
    <StudioSectionTabs
      tabs={[
        { id: "all", label: `All (${cards.length})`, content: <StageCardGrid cards={cards} onAction={handleAction} /> },
        { id: "live", label: `Live (${liveCards.length})`, content: <StageCardGrid cards={liveCards} onAction={handleAction} /> },
        { id: "upcoming", label: `Upcoming (${upcomingCards.length})`, content: <StageCardGrid cards={upcomingCards} onAction={handleAction} /> },
      ]}
    />
  );
}

function StageCardGrid({ cards, onAction }: { cards: StageCardData[]; onAction: (stage: StageCardData) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" role="list" aria-label="Live and upcoming stages">
      {cards.map((c) => (
        <div key={`${c.kind}-${c.id}`} role="listitem">
          <StageCard stage={c} onAction={onAction} />
        </div>
      ))}
    </div>
  );
}

export default StageGrid;
