import { useEffect, useState } from "react";
import { Mic, Plus, Sparkles, Calendar, ChevronDown, ChevronUp, Loader2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { EpisodeDetailDialog } from "./EpisodeDetailDialog";

interface Episode {
  id: string;
  episode_number: number | null;
  title: string;
  guest_names: string[] | null;
  scheduled_at: string | null;
  status: string;
  ai_questions: { kind: string; text: string }[] | null;
  ai_summary: string | null;
}

interface Props {
  project: any;
  currentUserId: string;
}

const STATUS_TONE: Record<string, string> = {
  planned: "bg-muted text-muted-foreground",
  scheduled: "bg-primary/15 text-primary",
  recorded: "bg-energy/15 text-foreground",
  published: "bg-white/15 text-white font-semibold",
};

/**
 * Podcast Studio module — only renders when project.workspace_type === 'podcast'.
 * Provides episode planning, guest tracking, and AI-generated interview questions.
 */
export function PodcastStudioSection({ project, currentUserId }: Props) {
  const { toast } = useToast();
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCompose, setOpenCompose] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [genBusy, setGenBusy] = useState<string | null>(null);
  const [detailEp, setDetailEp] = useState<Episode | null>(null);

  // compose form
  const [title, setTitle] = useState("");
  const [guestNames, setGuestNames] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("podcast_episodes")
      .select("id, episode_number, title, guest_names, scheduled_at, status, ai_questions, ai_summary")
      .eq("project_id", project.id)
      .order("episode_number", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (error) console.warn("podcast_episodes load", error);
    setEpisodes((data || []) as Episode[]);
    setLoading(false);
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [project.id]);

  const create = async () => {
    if (!title.trim()) return;
    setCreating(true);
    try {
      const nextNum = (episodes[episodes.length - 1]?.episode_number || 0) + 1;
      const guests = guestNames.split(",").map((s) => s.trim()).filter(Boolean);
      const { error } = await (supabase as any).from("podcast_episodes").insert({
        project_id: project.id,
        created_by: currentUserId,
        episode_number: nextNum,
        title: title.trim(),
        guest_names: guests,
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        status: scheduledAt ? "scheduled" : "planned",
      });
      if (error) throw error;
      toast({ title: `Episode ${nextNum} added` });
      setTitle(""); setGuestNames(""); setScheduledAt("");
      setOpenCompose(false);
      await load();
    } catch (e: any) {
      toast({ title: "Could not add episode", description: e?.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const generateQuestions = async (ep: Episode) => {
    setGenBusy(ep.id);
    try {
      const { data, error } = await supabase.functions.invoke<{ questions: { kind: string; text: string }[] }>(
        "gen-podcast-questions",
        {
          body: {
            episode_title: ep.title,
            guest_names: ep.guest_names || [],
            show_concept: project.title + (project.description ? `. ${project.description}` : ""),
          },
        },
      );
      if (error) throw error;
      const qs = data?.questions || [];
      const { error: upErr } = await (supabase as any)
        .from("podcast_episodes")
        .update({ ai_questions: qs })
        .eq("id", ep.id);
      if (upErr) throw upErr;
      setEpisodes((prev) => prev.map((e) => e.id === ep.id ? { ...e, ai_questions: qs } : e));
      setExpandedId(ep.id);
      toast({ title: "Interview questions ready" });
    } catch (e: any) {
      toast({ title: "Couldn't generate questions", description: e?.message, variant: "destructive" });
    } finally {
      setGenBusy(null);
    }
  };

  const setStatus = async (ep: Episode, status: string) => {
    await (supabase as any).from("podcast_episodes").update({ status }).eq("id", ep.id);
    setEpisodes((prev) => prev.map((e) => e.id === ep.id ? { ...e, status } : e));
  };

  return (
    <section className="px-4 py-5 lg:px-0">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="h-8 w-8 rounded-xl bg-primary/12 text-primary flex items-center justify-center">
            <Mic className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold leading-tight">Podcast Studio</h3>
            <p className="text-[11px] text-muted-foreground leading-tight">
              Episodes, guests, questions — all in one place.
            </p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpenCompose(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Episode
        </Button>
      </div>

      {loading ? (
        <div className="text-xs text-muted-foreground py-6 text-center">Loading episodes…</div>
      ) : episodes.length === 0 ? (
        <button
          type="button"
          onClick={() => setOpenCompose(true)}
          className="w-full rounded-2xl border border-dashed border-border/80 p-5 text-left hover:border-primary/50 hover:bg-primary/5 transition-colors"
        >
          <p className="text-sm font-semibold">Add your first episode</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Plan a guest, schedule a recording, and let Thrive draft your interview questions.
          </p>
        </button>
      ) : (
        <ul className="space-y-2">
          {episodes.map((ep) => {
            const expanded = expandedId === ep.id;
            return (
              <li key={ep.id} className="rounded-2xl border border-border/60 bg-card/40 overflow-hidden">
                <div className="flex items-start gap-3 p-3 cursor-pointer hover:bg-accent/30" onClick={() => setDetailEp(ep)}>
                  <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary text-[11px] font-black flex items-center justify-center shrink-0">
                    EP{ep.episode_number ?? "—"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold leading-tight truncate">{ep.title}</p>
                      <Badge className={`text-[10px] uppercase tracking-wider ${STATUS_TONE[ep.status] || STATUS_TONE.planned}`}>{ep.status}</Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      {ep.guest_names && ep.guest_names.length > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3 w-3" /> {ep.guest_names.join(", ")}
                        </span>
                      )}
                      {ep.scheduled_at && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> {format(new Date(ep.scheduled_at), "MMM d, h:mm a")}
                        </span>
                      )}
                    </div>
                    <div className="mt-2.5 flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => generateQuestions(ep)}
                        disabled={genBusy === ep.id}
                        className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-primary hover:underline disabled:opacity-50"
                      >
                        {genBusy === ep.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                        {ep.ai_questions ? "Regenerate" : "Draft"} questions
                      </button>
                      {ep.ai_questions && ep.ai_questions.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setExpandedId(expanded ? null : ep.id)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                        >
                          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          {expanded ? "Hide" : "Show"} ({ep.ai_questions.length})
                        </button>
                      )}
                      <select
                        value={ep.status}
                        onChange={(e) => setStatus(ep, e.target.value)}
                        className="ml-auto text-[10px] uppercase tracking-wider bg-transparent border border-border/60 rounded px-1.5 py-0.5 text-muted-foreground"
                      >
                        <option value="planned">Planned</option>
                        <option value="scheduled">Scheduled</option>
                        <option value="recorded">Recorded</option>
                        <option value="published">Published</option>
                      </select>
                    </div>
                  </div>
                </div>
                {expanded && ep.ai_questions && (
                  <ol className="border-t border-border/60 bg-background/40 p-3 pl-6 space-y-1.5 text-sm list-decimal">
                    {ep.ai_questions.map((q, i) => (
                      <li key={i}>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mr-2">{q.kind}</span>
                        {q.text}
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={openCompose} onOpenChange={setOpenCompose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New episode</DialogTitle>
            <DialogDescription>Title it, list guests, schedule. Thrive will draft questions on tap.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Episode title</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Maya Singh on building a label from a bedroom" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Guests (comma separated)</label>
              <Input value={guestNames} onChange={(e) => setGuestNames(e.target.value)} placeholder="Maya Singh, Sam Lee" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Recording date (optional)</label>
              <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCompose(false)}>Cancel</Button>
            <Button onClick={create} disabled={!title.trim() || creating}>
              {creating && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />} Add episode
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EpisodeDetailDialog
        open={!!detailEp}
        onOpenChange={(v) => !v && setDetailEp(null)}
        episode={detailEp}
        projectId={project.id}
        currentUserId={currentUserId}
        onUpdated={load}
      />
    </section>
  );
}
