import { useCallback, useState, type ComponentType, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Radio, UsersRound, Camera, FileVideo, ChevronRight, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import { SoundStagesRail, type SoundStage } from "@/components/circle/SoundStagesRail";
import { CastingCallsRail } from "@/components/opportunity/CastingCallsRail";
import { RecentRecordingsRail } from "@/components/calls/RecentRecordingsRail";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface Collaborator {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: string | null;
}

interface StudioActivitySummaryProps {
  recentCollaborators: Collaborator[];
}

interface RowProps {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  status: string;
  action?: string;
  onAction?: () => void;
  children: ReactNode;
}

/** Defined at module scope, not inside StudioActivitySummary -- an inline
 *  component defined in a parent's render body is a fresh type every
 *  render, so React would fully unmount/remount every row (and everything
 *  it contains, including the Sound Stage rail's realtime subscription and
 *  the crew Carousel's embla instance) on every single re-render; that
 *  remount storm, not the widgets themselves, was a real hang reproduced
 *  while building this. children stays mounted regardless of open/closed
 *  (each widget still fetches its own count for the summary line above),
 *  <details> only controls whether it's visually revealed. */
function Row({ icon: Icon, label, status, action, onAction, children }: RowProps) {
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center gap-2.5 py-2">
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1 text-sm">
          <span className="font-semibold">{label}</span>
          <span className="text-muted-foreground"> — {status}</span>
        </span>
        {action && onAction && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 shrink-0 gap-1 text-xs"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onAction();
            }}
          >
            {action} <ArrowRight className="h-3 w-3" aria-hidden />
          </Button>
        )}
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60 transition-transform group-open:rotate-90" aria-hidden />
      </summary>
      <div className="pt-2">{children}</div>
    </details>
  );
}

/**
 * CEO brief: "Right now" (Sound Stage, Crew, Casting, Recordings) was four
 * always-expanded rails/carousels stacked one after another -- verbose even
 * when most of them were empty ("No stages on air yet...", "No open
 * casting calls right now..."). This condenses them to one status line each
 * (icon, short text, a quick action) with the actual rail collapsed behind
 * it via native <details> -- same collapsed-by-default pattern StudioRoom's
 * own `collapsedWidget()` already uses for its end-of-project widgets.
 * Every rail's own data-fetching, self-hiding-when-empty and interactions
 * are unchanged; only whether they show by default did.
 */
export function StudioActivitySummary({ recentCollaborators }: StudioActivitySummaryProps) {
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const [collabApi, setCollabApi] = useState<CarouselApi>();
  const [liveSessionCount, setLiveSessionCount] = useState<number | null>(null);
  const [castingCount, setCastingCount] = useState<number | null>(null);
  const [recordingsCount, setRecordingsCount] = useState<number | null>(null);

  // Stable setters -- passed as onLoad to rails whose own effect re-runs
  // (including, for CastingCallsRail, a realtime resubscribe) whenever this
  // callback identity changes. useState's setter is referentially stable
  // across renders, so wrapping it doesn't reintroduce that risk.
  const onCastingLoad = useCallback((n: number) => setCastingCount(n), []);
  const onRecordingsLoad = useCallback((n: number) => setRecordingsCount(n), []);

  const hasCrew = recentCollaborators.length > 0;
  const allCounted = liveSessionCount !== null && castingCount !== null && recordingsCount !== null;
  const allEmpty = allCounted && (liveSessionCount ?? 0) === 0 && !hasCrew && (castingCount ?? 0) === 0 && (recordingsCount ?? 0) === 0;

  if (allEmpty) {
    return (
      <div className="flex items-center gap-2">
        <Radio className="h-4 w-4 text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">Nothing happening right now.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/60">
      <Row
        icon={Radio}
        label="Sound Stage"
        status={
          liveSessionCount === null
            ? "checking…"
            : liveSessionCount > 0
            ? `${liveSessionCount} live now`
            : "nothing on air"
        }
        action="Open Stage"
        onAction={() => navigate("/soundstages")}
      >
        <SoundStagesRail onJoin={(_stage: SoundStage) => navigate("/soundstages")} onLoad={setLiveSessionCount} />
      </Row>

      <Row
        icon={UsersRound}
        label="Crew"
        status={hasCrew ? `${recentCollaborators.length} recent` : "build your crew"}
        action={hasCrew ? undefined : "Invite"}
        onAction={() => navigate("/post-opportunity")}
      >
        {hasCrew ? (
          <Carousel setApi={setCollabApi} opts={{ align: "start", dragFree: true, duration: reducedMotion ? 0 : 20 }} className="w-full" aria-label="Recent collaborators">
            <CarouselContent className="-ml-3">
              {recentCollaborators.map((c) => (
                <CarouselItem key={c.id} className="pl-3 basis-auto">
                  <button
                    type="button"
                    onClick={() => navigate(`/profile/${c.id}`)}
                    className="w-28 rounded-2xl border border-border bg-card p-3 text-center transition-all hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <div className="h-14 w-14 mx-auto rounded-full overflow-hidden bg-muted mb-2">
                      {c.avatar_url ? (
                        <img src={c.avatar_url} alt={c.full_name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-sm font-bold text-muted-foreground">
                          {c.full_name?.[0]?.toUpperCase() ?? "?"}
                        </div>
                      )}
                    </div>
                    <p className="text-xs font-semibold truncate">{c.full_name}</p>
                    {c.role && <p className="text-[10px] text-muted-foreground truncate">{c.role}</p>}
                  </button>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        ) : (
          <p className="text-xs text-muted-foreground">No recent collaborators yet.</p>
        )}
      </Row>

      <Row
        icon={Camera}
        label="Casting"
        status={
          castingCount === null ? "checking…" : castingCount > 0 ? `${castingCount} open call${castingCount === 1 ? "" : "s"}` : "nothing open"
        }
        action="Post a call"
        onAction={() => navigate("/post-opportunity")}
      >
        <CastingCallsRail onLoad={onCastingLoad} />
      </Row>

      <Row
        icon={FileVideo}
        label="Recordings"
        status={recordingsCount === null ? "checking…" : recordingsCount > 0 ? `${recordingsCount} recent` : "none yet"}
      >
        <RecentRecordingsRail onLoad={onRecordingsLoad} />
      </Row>
    </div>
  );
}

export default StudioActivitySummary;
