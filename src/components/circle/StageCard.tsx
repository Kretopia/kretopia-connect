import { Mic, Video, Search, Mic2 } from "lucide-react";
import { format, formatDistanceToNowStrict } from "date-fns";
import { EventCard } from "./EventCard";

/**
 * One card shape for every Stage type (live Sound Stage or scheduled/live Curated Stage) in a single balanced grid: the event card, with the
 * Stage's own words for what kind it is, when it happens and what the action is.
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
}

function formatWhen(iso: string, isLive: boolean) {
  if (isLive) return "Live now";
  const d = new Date(iso);
  const delta = d.getTime() - Date.now();
  if (delta < 0) return "Starting soon";
  if (delta < 24 * 60 * 60 * 1000) return `In ${formatDistanceToNowStrict(d)}`;
  return format(d, "EEE, MMM d · h:mma");
}

export function StageCard({ stage, onAction }: StageCardProps) {
  const isLive = stage.status === "live";
  const TypeIcon = stage.kind === "sound_stage" ? (stage.mode === "audio" ? Mic : Video) : stage.curatedType === "scout" ? Search : Mic2;
  const typeLabel = stage.kind === "sound_stage" ? "Sound Stage" : stage.curatedType === "scout" ? "Scout Stage" : "Showcase";
  const actionLabel = isLive ? "Join Stage" : "Save your place";
  const when = formatWhen(stage.when, isLive);
  return (
    <EventCard
      title={stage.title}
      coverUrl={stage.coverUrl}
      kindLabel={typeLabel}
      kindIcon={<TypeIcon className="h-3 w-3" aria-hidden />}
      live={isLive}
      host={stage.hostName || stage.hostAvatarUrl ? { name: stage.hostName, avatarUrl: stage.hostAvatarUrl } : null}
      when={when}
      attendance={stage.participantCount !== null ? (stage.capacity ? `${stage.participantCount}/${stage.capacity}` : String(stage.participantCount)) : null}
      open={{ onClick: () => onAction(stage), ariaLabel: `${actionLabel} — ${stage.title}, ${typeLabel}, ${when}` }}
      primary={{ label: actionLabel, onClick: () => onAction(stage) }}
    />
  );
}

export default StageCard;
