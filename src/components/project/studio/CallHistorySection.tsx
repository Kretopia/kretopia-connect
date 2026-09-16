import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { History, Phone } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface CallRow {
  id: string;
  started_by: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
}

interface Props {
  projectId: string;
}

const formatDuration = (sec: number | null) => {
  if (!sec || sec < 1) return null;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

export const CallHistorySection = ({ projectId }: Props) => {
  const [rows, setRows] = useState<CallRow[]>([]);
  const [loading, setLoading] = useState(true);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("project_video_calls")
        .select("id, started_by, started_at, ended_at, duration_seconds")
        .eq("project_id", projectId)
        // Only show calls that actually ended — incomplete rows look broken.
        .not("ended_at", "is", null)
        .order("started_at", { ascending: false })
        .limit(20);
      if (cancelled) return;
      setRows(data ?? []);
      setLoading(false);
    })().catch((e) => {
      console.error("[CallHistory]", e);
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (loading) return null;

  if (rows.length === 0) {
    return (
      <section className="px-4 py-5">
        <div className="rounded-2xl border border-dashed border-border/60 p-4 text-center space-y-1.5">
          <Phone className="h-5 w-5 mx-auto text-muted-foreground" aria-hidden />
          <p className="text-sm font-semibold">No calls yet</p>
          <p className="text-xs text-muted-foreground leading-snug">
            Video calls on this project — once one ends, it shows up here.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="px-4 py-5 space-y-3">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[hsl(var(--energy))]">
            Replay
          </p>
          <h2 className="text-lg font-black leading-none tracking-tight flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            Call history
          </h2>
        </div>
        <span className="text-[10px] font-semibold text-muted-foreground tabular-nums">
          {rows.length} total
        </span>
      </header>
      <Carousel opts={{ align: "start", dragFree: true, duration: reducedMotion ? 0 : 20 }} className="w-full" aria-label="Call history">
        <CarouselContent className="-ml-2">
          {rows.map((r) => {
            const dur = formatDuration(r.duration_seconds);
            return (
              <CarouselItem key={r.id} className="pl-2 basis-auto">
                <div className="flex items-center gap-2.5 rounded-lg border border-border/60 px-3 py-2 w-48">
                  <span className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Phone className="h-3.5 w-3.5 text-primary" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {formatDistanceToNow(new Date(r.started_at), { addSuffix: true })}
                    </p>
                    {dur && (
                      <p className="text-xs text-muted-foreground">{dur}</p>
                    )}
                  </div>
                </div>
              </CarouselItem>
            );
          })}
        </CarouselContent>
      </Carousel>
    </section>
  );
};
