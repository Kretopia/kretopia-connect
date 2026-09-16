import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle2, AlertTriangle, Clock, Radio, Loader2, Maximize2, Minimize2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { SEO } from "@/components/SEO";

interface RunsheetItem {
  id: string;
  start_time: string | null;
  end_time: string | null;
  title: string;
  owner_name: string | null;
  notes: string | null;
  position: number;
  status: "planned" | "done" | "at_risk";
}

const STATUS_TONE: Record<string, string> = {
  planned: "bg-muted text-muted-foreground",
  done: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  at_risk: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
};

const toMinutes = (t: string | null): number | null => {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
};

const EventCrewMode = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const [items, setItems] = useState<RunsheetItem[]>([]);
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  const [presenter, setPresenter] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const load = async () => {
    if (!projectId) return;
    const [{ data: itemsData }, { data: projectData }] = await Promise.all([
      (supabase as any)
        .from("event_runsheet_items")
        .select("id, start_time, end_time, title, owner_name, notes, position, status")
        .eq("project_id", projectId)
        .order("position", { ascending: true }),
      (supabase as any)
        .from("projects")
        .select("id, title, workspace_type, event_id, created_by")
        .eq("id", projectId)
        .maybeSingle(),
    ]);
    setItems((itemsData || []) as RunsheetItem[]);
    setProject(projectData);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [projectId]);

  // Realtime — anyone in the project sees live status updates
  useEffect(() => {
    if (!projectId) return;
    const ch = supabase
      .channel(`crew:${projectId}`)
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

  const nowMin = now.getHours() * 60 + now.getMinutes();

  const currentIdx = useMemo(() => {
    let idx = -1;
    items.forEach((it, i) => {
      const s = toMinutes(it.start_time);
      const e = toMinutes(it.end_time) ?? (s != null ? s + 30 : null);
      if (s != null && e != null && nowMin >= s && nowMin < e) idx = i;
    });
    if (idx === -1) {
      // next upcoming
      idx = items.findIndex((it) => {
        const s = toMinutes(it.start_time);
        return s != null && s > nowMin;
      });
    }
    return idx;
  }, [items, nowMin]);

  const cycleStatus = async (it: RunsheetItem) => {
    const next: RunsheetItem["status"] =
      it.status === "planned" ? "done" : it.status === "done" ? "at_risk" : "planned";
    setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, status: next } : x)));
    await (supabase as any).from("event_runsheet_items").update({ status: next }).eq("id", it.id);
  };

  const stats = useMemo(() => {
    const done = items.filter((i) => i.status === "done").length;
    const risk = items.filter((i) => i.status === "at_risk").length;
    return { done, risk, total: items.length };
  }, [items]);

  if (!user) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        Sign in to view crew mode.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <SEO title="Crew Mode · Run of Show" description="Live event run-of-show for crew" />

      <header className="sticky top-0 z-40 bg-background border-b border-border/60">
        <div className="px-4 py-3 flex items-center gap-3">
          <Link to={projectId ? `/desk/${projectId}` : "/"} className="text-muted-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[hsl(var(--energy))] flex items-center gap-1">
              <Radio className="h-3 w-3 animate-pulse" /> Crew mode · live
            </p>
            <h1 className="text-base font-black truncate">{project?.title ?? "Run of Show"}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setPresenter((p) => !p)}
              title={presenter ? "Exit presenter view" : "Presenter view"}
            >
              {presenter ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
            <p className="text-xs font-mono text-muted-foreground">
              {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </div>
        <div className="px-4 pb-2 flex gap-2">
          <Badge variant="outline" className="text-[10px]">
            <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-500" />
            {stats.done}/{stats.total} done
          </Badge>
          {stats.risk > 0 && (
            <Badge className="text-[10px] bg-amber-500/15 text-amber-600 border border-amber-500/30">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {stats.risk} at risk
            </Badge>
          )}
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="px-6 py-16 text-center space-y-2">
          <p className="text-sm font-semibold">No run sheet yet.</p>
          <p className="text-xs text-muted-foreground">
            Ask the producer to draft a run sheet from the event Studio.
          </p>
          {projectId && (
            <Link to={`/desk/${projectId}`}>
              <Button size="sm" variant="outline" className="mt-2">
                Open Studio
              </Button>
            </Link>
          )}
        </div>
      ) : presenter ? (
        (() => {
          const cur = currentIdx >= 0 ? items[currentIdx] : null;
          const nxt = items[currentIdx + 1] ?? items.find((it) => {
            const s = toMinutes(it.start_time);
            return s != null && s > nowMin;
          });
          return (
            <div className="px-6 py-10 space-y-8 text-center">
              {cur ? (
                <div className="space-y-3">
                  <p className="text-xs font-black uppercase tracking-[0.3em] text-[hsl(var(--energy))]">Now</p>
                  <p className="text-4xl font-black leading-tight">{cur.title}</p>
                  <p className="text-base font-mono text-muted-foreground">
                    {cur.start_time}{cur.end_time ? `–${cur.end_time}` : ""}
                  </p>
                  {cur.owner_name && (
                    <p className="text-sm text-muted-foreground">{cur.owner_name}</p>
                  )}
                  <Button
                    size="lg"
                    className="mt-4"
                    onClick={() => cycleStatus(cur)}
                  >
                    {cur.status === "planned" ? "Mark done" : cur.status === "done" ? "Flag risk" : "Reset"}
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No cue running right now.</p>
              )}
              {nxt && (
                <div className="pt-6 border-t border-border/40 space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Up next</p>
                  <p className="text-xl font-bold">{nxt.title}</p>
                  <p className="text-sm font-mono text-muted-foreground">{nxt.start_time}</p>
                </div>
              )}
            </div>
          );
        })()
      ) : (
        <ol className="px-3 py-3 space-y-2">
          {items.map((it, i) => {
            const isCurrent = i === currentIdx;
            const isPast = currentIdx > -1 && i < currentIdx && it.status !== "at_risk";
            return (
              <li
                key={it.id}
                className={[
                  "rounded-2xl border p-3 transition-all",
                  isCurrent
                    ? "border-[hsl(var(--energy))] bg-[hsl(var(--energy)/0.08)] shadow-[0_0_0_2px_hsl(var(--energy)/0.25)]"
                    : "border-border/60 bg-card/40",
                  isPast && it.status === "done" ? "opacity-60" : "",
                ].join(" ")}
              >
                {isCurrent && (
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[hsl(var(--energy))] mb-1.5">
                    Now
                  </p>
                )}
                <div className="flex items-start gap-3">
                  <div className="w-16 shrink-0">
                    <p className="text-sm font-mono font-bold leading-tight">
                      {it.start_time ?? "—"}
                    </p>
                    {it.end_time && (
                      <p className="text-[10px] font-mono text-muted-foreground">
                        –{it.end_time}
                      </p>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold leading-snug">{it.title}</p>
                    {it.owner_name && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {it.owner_name}
                      </p>
                    )}
                    {it.notes && (
                      <p className="text-[11px] text-foreground/80 mt-1 leading-snug">
                        {it.notes}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <Badge className={`text-[10px] uppercase tracking-wider ${STATUS_TONE[it.status]}`}>
                    {it.status.replace("_", " ")}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px]"
                    onClick={() => cycleStatus(it)}
                  >
                    {it.status === "planned"
                      ? "Mark done"
                      : it.status === "done"
                      ? "Flag risk"
                      : "Reset"}
                  </Button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
};

export default EventCrewMode;
