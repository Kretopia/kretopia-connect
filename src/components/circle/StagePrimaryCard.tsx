import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Radio, Users, Calendar, AlertCircle, RefreshCw } from "lucide-react";
import { format, formatDistanceToNowStrict } from "date-fns";
import { HoloCard } from "@/components/passport/HoloCard";
import type { SoundStage } from "./SoundStagesRail";

type Primary =
  | { kind: "sound_stage"; stage: SoundStage; hostName: string | null; hostAvatarUrl: string | null }
  | {
      kind: "curated_stage";
      id: string;
      title: string;
      status: "live" | "scheduled";
      startsAt: string;
      rsvpCount: number;
      capacity: number;
      coverUrl: string | null;
    }
  | null;

interface StagePrimaryCardProps {
  onJoinSoundStage: (stage: SoundStage) => void;
  onStartStage: () => void;
}

/**
 * The one primary Stage card, answering: what's happening now, where do I
 * join, what's the next best session, and what can I do if nothing is live.
 * Only ever renders a state its own query actually found -- never invents
 * "live" or "replay" data that doesn't exist.
 */
export function StagePrimaryCard({ onJoinSoundStage, onStartStage }: StagePrimaryCardProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [primary, setPrimary] = useState<Primary>(null);

  const load = useCallback(async () => {
    setError(false);
    try {
      const { data: liveSound, error: e1 } = await supabase
        .from("sound_stages")
        .select("id, host_user_id, title, vibe_tag, mode, format, participant_count, started_at")
        .eq("is_live", true)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (e1) throw e1;

      if (liveSound) {
        const { data: host } = await supabase
          .from("profiles")
          .select("full_name, avatar_url, username")
          .eq("user_id", liveSound.host_user_id)
          .maybeSingle();
        setPrimary({
          kind: "sound_stage",
          stage: liveSound as SoundStage,
          hostName: host?.username ? `@${host.username}` : host?.full_name ?? null,
          hostAvatarUrl: host?.avatar_url ?? null,
        });
        setLoading(false);
        return;
      }

      const { data: curated, error: e2 } = await supabase
        .from("curated_stages")
        .select("id, title, status, starts_at, rsvp_count, capacity, cover_url")
        .in("status", ["live", "scheduled"])
        .gte("starts_at", new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString())
        .order("status", { ascending: true }) // "live" sorts before "scheduled"
        .order("starts_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (e2) throw e2;

      if (curated) {
        setPrimary({
          kind: "curated_stage",
          id: curated.id,
          title: curated.title,
          status: curated.status as "live" | "scheduled",
          startsAt: curated.starts_at,
          rsvpCount: curated.rsvp_count,
          capacity: curated.capacity,
          coverUrl: curated.cover_url,
        });
      } else {
        setPrimary(null);
      }
      setLoading(false);
    } catch {
      setError(true);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("stage-primary-card")
      .on("postgres_changes", { event: "*", schema: "public", table: "sound_stages" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "curated_stages" }, () => load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 space-y-3 animate-pulse" aria-busy="true" aria-label="Loading Stage">
        <div className="h-4 w-24 bg-muted rounded" />
        <div className="h-6 w-2/3 bg-muted rounded" />
        <div className="h-10 w-40 bg-muted rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center space-y-3">
        <AlertCircle className="h-6 w-6 text-destructive mx-auto" aria-hidden />
        <p className="text-sm font-semibold">Couldn't load Stage</p>
        <button
          type="button"
          onClick={() => { setLoading(true); load(); }}
          className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[hsl(var(--energy))] hover:underline"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Retry
        </button>
      </div>
    );
  }

  // NO LIVE SESSION
  if (!primary) {
    return (
      <HoloCard maxTilt={4}>
        <div className="rounded-2xl border border-border bg-card p-6 flex flex-col sm:flex-row sm:items-center gap-5 text-center sm:text-left">
          <div className="h-12 w-12 rounded-full bg-[hsl(var(--energy))]/15 text-[hsl(var(--energy))] flex items-center justify-center mx-auto sm:mx-0 shrink-0">
            <Radio className="h-6 w-6" aria-hidden />
          </div>
          <div className="sm:flex-1 min-w-0">
            <p className="font-bold text-base">Nothing live right now</p>
            <p className="text-sm text-muted-foreground mt-1">Check what's scheduled, or open your own stage.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 justify-center sm:justify-end shrink-0">
            <a
              href="#stage-grid"
              className="inline-flex items-center justify-center rounded-xl border border-border px-4 py-2 text-xs font-bold uppercase tracking-wider hover:border-[hsl(var(--energy))]/50 transition-colors whitespace-nowrap"
            >
              Browse upcoming sessions
            </a>
            <button
              type="button"
              onClick={onStartStage}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition-transform hover:scale-[1.02] whitespace-nowrap"
              style={{ background: "hsl(var(--energy))" }}
            >
              <Radio className="h-3.5 w-3.5" aria-hidden /> Start a Stage
            </button>
          </div>
        </div>
      </HoloCard>
    );
  }

  // LIVE NOW (sound stage)
  if (primary.kind === "sound_stage") {
    const s = primary.stage;
    return (
      <HoloCard maxTilt={4}>
        <div className="rounded-2xl border-2 border-[hsl(var(--energy))] bg-card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: "hsl(var(--energy))" }} />
              <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "hsl(var(--energy))" }} />
            </span>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[hsl(var(--energy))]">Live now</p>
          </div>
          <div className="flex items-center gap-3">
            {primary.hostAvatarUrl && (
              <img src={primary.hostAvatarUrl} alt="" className="h-12 w-12 rounded-2xl object-cover shrink-0" />
            )}
            <div className="min-w-0">
              <p className="font-extrabold text-lg leading-tight truncate">{s.title}</p>
              {primary.hostName && <p className="text-sm text-muted-foreground truncate">Host: {primary.hostName}</p>}
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" aria-hidden /> {s.participant_count} here now
            </span>
            <button
              type="button"
              onClick={() => onJoinSoundStage(s)}
              className="inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-[0.15em] text-white transition-transform hover:scale-[1.02]"
              style={{ background: "hsl(var(--energy))", boxShadow: "0 10px 30px hsl(var(--energy) / 0.4)" }}
            >
              Join Stage
            </button>
          </div>
        </div>
      </HoloCard>
    );
  }

  // LIVE NOW or UPCOMING (curated stage)
  const isLive = primary.status === "live";
  const startDate = new Date(primary.startsAt);
  const startsSoon = startDate.getTime() - Date.now() < 24 * 60 * 60 * 1000;
  const whenLabel = isLive
    ? "Live now"
    : startsSoon
      ? `In ${formatDistanceToNowStrict(startDate)}`
      : format(startDate, "EEE, MMM d · h:mma");

  return (
    <HoloCard maxTilt={4}>
      <div className={`rounded-2xl border bg-card p-6 space-y-4 ${isLive ? "border-2 border-[hsl(var(--energy))]" : "border-border"}`}>
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[hsl(var(--energy))]">
          {isLive ? "Live now" : "Coming up"}
        </p>
        <p className="font-extrabold text-lg leading-tight">{primary.title}</p>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" aria-hidden /> {whenLabel}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" aria-hidden /> {primary.rsvpCount}/{primary.capacity}
            </span>
          </div>
          <Link
            to={`/circle/stage/${primary.id}`}
            className="inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-[0.15em] text-white transition-transform hover:scale-[1.02]"
            style={{ background: "hsl(var(--energy))", boxShadow: "0 10px 30px hsl(var(--energy) / 0.4)" }}
          >
            {isLive ? "Join Stage" : "Save your place"}
          </Link>
        </div>
      </div>
    </HoloCard>
  );
}

export default StagePrimaryCard;
