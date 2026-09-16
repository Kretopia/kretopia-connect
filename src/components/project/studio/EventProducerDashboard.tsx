import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Radio, Users, AlertTriangle, CheckCircle2, ArrowRight, Clock } from "lucide-react";

interface Props {
  project: any;
  currentUserId: string | null;
}

interface RunsheetItem {
  id: string;
  start_time: string | null;
  end_time: string | null;
  title: string;
  owner_name: string | null;
  status: "planned" | "done" | "at_risk";
  position: number;
}

const toMin = (t: string | null): number | null => {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
};

const fmtCountdown = (target: Date | null, now: Date) => {
  if (!target) return null;
  const diff = target.getTime() - now.getTime();
  if (diff <= 0) return { label: "Live now", live: true };
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return { label: `${mins}m to go`, live: false };
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h < 24) return { label: `${h}h ${m}m to go`, live: false };
  return { label: `${Math.floor(h / 24)}d ${h % 24}h to go`, live: false };
};

export const EventProducerDashboard = ({ project, currentUserId }: Props) => {
  const eventId = project?.event_id;
  const projectId = project?.id;
  const isHost = project?.created_by === currentUserId;

  const [event, setEvent] = useState<any>(null);
  const [items, setItems] = useState<RunsheetItem[]>([]);
  const [rsvpCount, setRsvpCount] = useState(0);
  const [checkedInCount, setCheckedInCount] = useState(0);
  const [now, setNow] = useState(new Date());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const load = async () => {
    if (!eventId || !projectId) {
      setLoading(false);
      return;
    }
    const [{ data: ev }, { count: rsvp }, { count: ci }, { data: runs }] = await Promise.all([
      supabase.from("creative_jams").select("id, title, start_time").eq("id", eventId).maybeSingle(),
      supabase
        .from("jam_participants" as any)
        .select("id", { count: "exact", head: true })
        .eq("jam_id", eventId)
        .in("status", ["confirmed", "going", "attending"] as any),
      supabase
        .from("jam_participants" as any)
        .select("id", { count: "exact", head: true })
        .eq("jam_id", eventId)
        .not("checked_in_at", "is", null),
      (supabase as any)
        .from("event_runsheet_items")
        .select("id, start_time, end_time, title, owner_name, status, position")
        .eq("project_id", projectId)
        .order("position", { ascending: true }),
    ]).catch(() => [{ data: null }, { count: 0 }, { count: 0 }, { data: [] }] as any);

    setEvent(ev);
    setRsvpCount(rsvp ?? 0);
    setCheckedInCount(ci ?? 0);
    setItems((runs || []) as RunsheetItem[]);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [eventId, projectId]);

  // Realtime updates
  useEffect(() => {
    if (!projectId) return;
    const ch = supabase
      .channel(`producer-dash:${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_runsheet_items", filter: `project_id=eq.${projectId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [projectId]);

  const startsAt = event?.start_time ? new Date(event.start_time) : null;
  const cd = fmtCountdown(startsAt, now);

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const { current, next, atRisk, doneCount } = useMemo(() => {
    let curIdx = -1;
    items.forEach((it, i) => {
      const s = toMin(it.start_time);
      const e = toMin(it.end_time) ?? (s != null ? s + 30 : null);
      if (s != null && e != null && nowMin >= s && nowMin < e) curIdx = i;
    });
    const upcoming = items.findIndex((it) => {
      const s = toMin(it.start_time);
      return s != null && s > nowMin;
    });
    return {
      current: curIdx >= 0 ? items[curIdx] : null,
      next: upcoming >= 0 ? items[upcoming] : null,
      atRisk: items.filter((i) => i.status === "at_risk").length,
      doneCount: items.filter((i) => i.status === "done").length,
    };
  }, [items, nowMin]);

  if (!isHost || !eventId) return null;
  if (loading) return null;
  if (!event) return null;

  const checkInRate = rsvpCount > 0 ? Math.round((checkedInCount / rsvpCount) * 100) : 0;
  const isLiveWindow = cd?.live || (startsAt && now.getTime() - startsAt.getTime() < 6 * 3600 * 1000 && now.getTime() > startsAt.getTime());

  return (
    <section className="px-4 lg:px-0">
      <div className="rounded-2xl border border-[hsl(var(--energy)/0.4)] bg-gradient-to-br from-[hsl(var(--energy)/0.1)] via-card/60 to-transparent p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.22em] ${isLiveWindow ? "text-[hsl(var(--energy))]" : "text-muted-foreground"}`}>
              <Radio className={`h-3 w-3 ${isLiveWindow ? "animate-pulse" : ""}`} />
              {isLiveWindow ? "Live ops" : "Producer dashboard"}
            </span>
          </div>
          {projectId && (
            <Link to={`/desk/${projectId}/crew`}>
              <Button size="sm" variant="outline" className="h-7 text-[11px]">
                Open crew mode <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          )}
        </div>

        {cd && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Countdown</p>
            <p className={`text-2xl font-black ${cd.live ? "text-[hsl(var(--energy))]" : ""}`}>{cd.label}</p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-card/60 border border-border/50 p-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">RSVPs</p>
            <p className="text-lg font-black flex items-center gap-1">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              {rsvpCount}
            </p>
          </div>
          <div className="rounded-xl bg-card/60 border border-border/50 p-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Checked in</p>
            <p className="text-lg font-black">
              {checkedInCount}
              <span className="text-[10px] font-medium text-muted-foreground ml-1">/{rsvpCount}</span>
            </p>
            {rsvpCount > 0 && (
              <p className="text-[10px] text-muted-foreground">{checkInRate}%</p>
            )}
          </div>
          <div className="rounded-xl bg-card/60 border border-border/50 p-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Run sheet</p>
            <p className="text-lg font-black flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-white" />
              {doneCount}
              <span className="text-[10px] font-medium text-muted-foreground">/{items.length}</span>
            </p>
          </div>
        </div>

        {(current || next) && (
          <div className="rounded-xl bg-card/80 border border-border/60 p-3 space-y-2">
            {current ? (
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[hsl(var(--energy))] mb-0.5">Now</p>
                <p className="text-sm font-bold leading-snug">{current.title}</p>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Clock className="h-3 w-3" />
                  {current.start_time}{current.end_time ? `–${current.end_time}` : ""}
                  {current.owner_name ? ` · ${current.owner_name}` : ""}
                </p>
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground">No cue running.</p>
            )}
            {next && (
              <div className="pt-2 border-t border-border/40">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Up next</p>
                <p className="text-xs font-semibold leading-snug">{next.title}</p>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {next.start_time}{next.owner_name ? ` · ${next.owner_name}` : ""}
                </p>
              </div>
            )}
          </div>
        )}

        {atRisk > 0 && (
          <Badge className="text-[10px] bg-[hsl(var(--energy)/0.15)] text-[hsl(var(--energy))] border border-[hsl(var(--energy)/0.3)]">
            <AlertTriangle className="h-3 w-3 mr-1" />
            {atRisk} cue{atRisk === 1 ? "" : "s"} flagged at risk
          </Badge>
        )}

        {isLiveWindow && rsvpCount > 0 && checkInRate < 60 && (now.getTime() - (startsAt?.getTime() ?? 0)) > 30 * 60 * 1000 && (
          <div className="rounded-xl bg-[hsl(var(--energy)/0.1)] border border-[hsl(var(--energy)/0.3)] p-2 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "hsl(var(--energy))" }} />
            <p className="text-[11px] text-foreground/80 leading-snug">
              Only {checkInRate}% of RSVPs checked in. Consider sending a reminder to no-shows.
            </p>
          </div>
        )}
      </div>
    </section>
  );
};
