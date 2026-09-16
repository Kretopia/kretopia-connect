import { Mic, Video, Search, Mic2, Users, Calendar } from "lucide-react";
import { format, formatDistanceToNowStrict } from "date-fns";
import { cn } from "@/lib/utils";

/**
 * One card shape for every Stage type (live Sound Stage or scheduled/live
 * Curated Stage) in a single balanced grid -- replacing the three divergent
 * card sizes (w-[280px] carousel, w-64 rail, ad-hoc grid tiles) found across
 * SoundStagesRail/CuratedStagesRail. Fixed 16:9 cover so every card in the
 * grid reads at the same visual weight regardless of type.
 */
export interface StageCardData {
  id: string;
  title: string;
  coverUrl: string | null;
  hostName: string | null;
  hostAvatarUrl: string | null;
  /** "live" always renders the text badge, never color alone. */
  status: "live" | "upcoming";
  /** ISO timestamp -- start time for upcoming, join time for live. */
  when: string;
  participantCount: number | null;
  capacity: number | null;
  kind: "sound_stage" | "curated_stage";
  mode?: "audio" | "video";
  curatedType?: "showcase" | "scout";
}

interface StageCardProps {
  stage: StageCardData;
  onAction: (stage: StageCardData) => void;
  className?: string;
}

function formatWhen(iso: string, isLive: boolean) {
  if (isLive) return "Live now";
  const d = new Date(iso);
  const delta = d.getTime() - Date.now();
  if (delta < 0) return "Starting soon";
  if (delta < 24 * 60 * 60 * 1000) return `In ${formatDistanceToNowStrict(d)}`;
  return format(d, "EEE, MMM d · h:mma");
}

export function StageCard({ stage, onAction, className }: StageCardProps) {
  const isLive = stage.status === "live";
  const TypeIcon =
    stage.kind === "sound_stage" ? (stage.mode === "audio" ? Mic : Video) : stage.curatedType === "scout" ? Search : Mic2;
  const typeLabel =
    stage.kind === "sound_stage" ? "Sound Stage" : stage.curatedType === "scout" ? "Scout Stage" : "Showcase";
  const actionLabel = isLive ? "Join Stage" : "Save your place";

  return (
    <button
      type="button"
      onClick={() => onAction(stage)}
      aria-label={`${actionLabel} — ${stage.title}, ${typeLabel}, ${isLive ? "live now" : formatWhen(stage.when, false)}`}
      className={cn(
        "group flex flex-col text-left rounded-2xl border bg-card overflow-hidden transition-colors",
        "hover:border-[hsl(var(--energy))]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--energy))] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        isLive ? "border-[hsl(var(--energy))]/40" : "border-border",
        className,
      )}
    >
      <div
        className="relative aspect-video w-full bg-gradient-to-br from-primary/20 via-accent/10 to-background bg-cover bg-center"
        style={stage.coverUrl ? { backgroundImage: `url(${stage.coverUrl})` } : undefined}
      >
        <div className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-background/90 text-[10px] font-bold uppercase tracking-wider">
          <TypeIcon className="h-3 w-3" aria-hidden />
          {typeLabel}
        </div>
        {isLive && (
          <div className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold uppercase tracking-wider motion-safe:animate-pulse">
            <span aria-hidden>●</span> Live
          </div>
        )}
        {stage.hostAvatarUrl && (
          <div className="absolute bottom-2 left-2 h-8 w-8 rounded-full ring-2 ring-background overflow-hidden bg-muted">
            <img src={stage.hostAvatarUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
          </div>
        )}
      </div>

      <div className="flex-1 p-3.5 space-y-1.5">
        <p className="font-bold text-sm leading-tight line-clamp-2 group-hover:text-[hsl(var(--energy))] transition-colors">
          {stage.title}
        </p>
        {stage.hostName && <p className="text-xs text-muted-foreground truncate">Host: {stage.hostName}</p>}
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-0.5">
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" aria-hidden />
            {formatWhen(stage.when, isLive)}
          </span>
          {stage.participantCount !== null && (
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" aria-hidden />
              {stage.capacity ? `${stage.participantCount}/${stage.capacity}` : stage.participantCount}
            </span>
          )}
        </div>
      </div>

      <div
        className={cn(
          "px-3.5 py-2.5 text-center text-xs font-black uppercase tracking-[0.15em] transition-colors",
          isLive ? "bg-[hsl(var(--energy))] text-white" : "bg-muted text-foreground group-hover:bg-[hsl(var(--energy))]/15",
        )}
      >
        {actionLabel}
      </div>
    </button>
  );
}

export default StageCard;
