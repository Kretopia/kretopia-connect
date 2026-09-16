import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { WatchReplayButton } from "@/components/calls/WatchReplayButton";
import { CallRecapSheet } from "@/components/calls/CallRecapSheet";
import { formatDistanceToNow } from "date-fns";
import { FileVideo, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext, type CarouselApi } from "@/components/ui/carousel";
import { CarouselPositionDots } from "@/components/ui/glass/CarouselPositionDots";
import { useReducedMotion } from "@/hooks/useReducedMotion";

type Row = {
  id: string;
  call_kind: string;
  status: "pending" | "transcribing" | "ready" | "failed";
  duration_seconds: number | null;
  created_at: string;
  recording_id: string | null;
  summary: string | null;
};

const KIND_LABEL: Record<string, string> = {
  project: "Studio call",
  direct: "1:1 call",
  circle: "Circle call",
  meeting: "Meeting",
  event: "Event",
  sound_stage: "Sound Stage",
  speed_session: "Speed session",
  curated_stage: "Showcase",
};

const fmtDur = (s: number | null) => {
  if (!s) return null;
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m` : `${s}s`;
};

/**
 * "Recording; Meeting notes" surface for Studio home — a real gap: the
 * transcription/brief pipeline (call_transcripts, CallRecapSheet,
 * WatchReplayButton, the full /recordings page) already exists and is
 * production-complete, but nothing on Studio home pointed to it. Reuses
 * that pipeline's query shape and components as-is rather than a new
 * recap UI. Self-hides entirely when there's nothing yet.
 */
export const RecentRecordingsRail = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [recapId, setRecapId] = useState<string | null>(null);
  const [api, setApi] = useState<CarouselApi>();
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("call_transcripts")
        .select("id, call_kind, status, duration_seconds, created_at, recording_id, summary")
        .order("created_at", { ascending: false })
        .limit(8);
      if (!cancelled) {
        setRows((data as Row[]) ?? []);
        setLoading(false);
      }
    })().catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [user?.id]);

  if (loading || rows.length === 0) return null;

  return (
    <div className="space-y-2">
      <h2 className="text-base font-bold">Recent recordings &amp; notes</h2>
      <div className="relative">
      <Carousel setApi={setApi} opts={{ align: "start", dragFree: true, duration: reducedMotion ? 0 : 20 }} className="w-full" aria-label="Recent recordings and notes">
      <CarouselContent className="-ml-3">
        {rows.map((r) => (
          <CarouselItem key={r.id} className="pl-3 basis-auto">
          <div className="w-64 rounded-2xl glass-surface p-3.5 flex flex-col">
            <div className="flex items-center gap-2">
              <span className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                <FileVideo className="h-4 w-4 text-muted-foreground" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold truncate">{KIND_LABEL[r.call_kind] || "Call"}</p>
                <p className="text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                  {fmtDur(r.duration_seconds) && ` · ${fmtDur(r.duration_seconds)}`}
                </p>
              </div>
            </div>

            <div className="mt-2.5 flex-1 min-h-[2.5rem]">
              {r.status === "ready" && r.summary ? (
                <p className="text-xs text-muted-foreground line-clamp-2">{r.summary}</p>
              ) : r.status === "failed" ? (
                <p className="text-xs text-destructive/80">Transcription failed</p>
              ) : (
                <p className="text-xs text-muted-foreground/60 flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" /> Transcribing…
                </p>
              )}
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRecapId(r.id)}
                disabled={r.status !== "ready"}
                className={cn(
                  "flex-1 inline-flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
                  "bg-white/5 hover:bg-white/10 text-foreground",
                )}
              >
                <Sparkles className="h-3 w-3 text-[hsl(var(--color-accent))]" />
                Notes
              </button>
              {r.recording_id && (
                <WatchReplayButton
                  transcriptId={r.id}
                  variant="ghost"
                  size="sm"
                  label="Watch"
                  title={KIND_LABEL[r.call_kind] || "Call"}
                  subtitle={`${formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}${fmtDur(r.duration_seconds) ? ` · ${fmtDur(r.duration_seconds)}` : ""}`}
                />
              )}
            </div>
          </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious variant="glass" className="hidden sm:flex -left-3" aria-label="Previous — recent recordings and notes" />
      <CarouselNext variant="glass" className="hidden sm:flex -right-3" aria-label="Next — recent recordings and notes" />
      </Carousel>
      <CarouselPositionDots api={api} label="Recent recordings and notes" className="mt-2" />
      </div>

      {recapId && (
        <CallRecapSheet open={!!recapId} onOpenChange={(o) => !o && setRecapId(null)} transcriptId={recapId} />
      )}
    </div>
  );
};

export default RecentRecordingsRail;
