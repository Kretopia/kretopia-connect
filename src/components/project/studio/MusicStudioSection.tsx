import { useEffect, useMemo, useState } from "react";
import { Music2, Disc3, Users, ListChecks, Plus, Sparkles, Loader2, Trash2, Save, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface Props { project: any; currentUserId: string; }

interface Release {
  id: string; title: string; artist: string | null; release_type: string;
  release_date: string | null; distributor: string | null; isrc: string | null;
  upc: string | null; cover_url: string | null; status: string; notes: string | null;
}
interface Track {
  id: string; release_id: string | null; track_no: number | null; title: string;
  duration_seconds: number | null; isrc: string | null; status: string; master_url: string | null;
}
interface Split {
  id: string; track_id: string | null; release_id: string | null;
  name: string; role: string | null; percentage: number; payout_email: string | null; status: string;
}
interface ChecklistItem {
  id: string; title: string; due_date: string | null; done: boolean; order_index: number;
}

// A 5-stage pipeline, not a traffic light: gray (not started) -> white
// (in motion) -> increasing pink intensity -> solid white (final/done).
const TRACK_STATUS_TONE: Record<string, string> = {
  idea: "bg-muted text-muted-foreground",
  recorded: "bg-primary/15 text-primary",
  mixed: "bg-[hsl(var(--energy)/0.15)] text-[hsl(var(--energy))]",
  mastered: "bg-[hsl(var(--energy)/0.25)] text-[hsl(var(--energy))] font-semibold",
  final: "bg-white/15 text-white font-semibold",
};

const SPLIT_TONE: Record<string, string> = {
  pending: "bg-[hsl(var(--energy)/0.15)] text-[hsl(var(--energy))]",
  agreed: "bg-white/10 text-white",
  declined: "bg-muted text-muted-foreground",
};

export function MusicStudioSection({ project, currentUserId }: Props) {
  const { toast } = useToast();
  const [tab, setTab] = useState("release");

  const [release, setRelease] = useState<Release | null>(null);
  const [relDraft, setRelDraft] = useState({
    title: project?.title || "", artist: "", release_type: "single",
    release_date: "", distributor: "", isrc: "", upc: "", notes: "",
  });
  const [savingRel, setSavingRel] = useState(false);

  const [tracks, setTracks] = useState<Track[]>([]);
  const [openTrack, setOpenTrack] = useState(false);
  const [trackDraft, setTrackDraft] = useState({ title: "", duration_seconds: "", isrc: "", master_url: "" });

  const [splits, setSplits] = useState<Split[]>([]);
  const [openSplit, setOpenSplit] = useState(false);
  const [splitDraft, setSplitDraft] = useState({ name: "", role: "songwriter", percentage: "", payout_email: "", track_id: "" });

  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [openCheck, setOpenCheck] = useState(false);
  const [checkDraft, setCheckDraft] = useState({ title: "", due_date: "" });
  const [genCheck, setGenCheck] = useState(false);

  const loadAll = async () => {
    const { data: rel } = await (supabase as any).from("music_releases").select("*").eq("project_id", project.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (rel) {
      setRelease(rel);
      setRelDraft({
        title: rel.title, artist: rel.artist || "", release_type: rel.release_type,
        release_date: rel.release_date || "", distributor: rel.distributor || "",
        isrc: rel.isrc || "", upc: rel.upc || "", notes: rel.notes || "",
      });
    }
    const [t, s, c] = await Promise.all([
      (supabase as any).from("music_tracks").select("*").eq("project_id", project.id).order("order_index"),
      (supabase as any).from("music_splits").select("*").eq("project_id", project.id).order("created_at"),
      (supabase as any).from("music_release_checklist").select("*").eq("project_id", project.id).order("order_index"),
    ]);
    setTracks((t.data || []) as Track[]);
    setSplits((s.data || []) as Split[]);
    setChecklist((c.data || []) as ChecklistItem[]);
  };

  useEffect(() => { void loadAll(); /* eslint-disable-next-line */ }, [project.id]);

  // ---- RELEASE ----
  const saveRelease = async () => {
    if (!relDraft.title.trim()) return;
    setSavingRel(true);
    try {
      const payload = {
        title: relDraft.title.trim(),
        artist: relDraft.artist || null,
        release_type: relDraft.release_type,
        release_date: relDraft.release_date || null,
        distributor: relDraft.distributor || null,
        isrc: relDraft.isrc || null,
        upc: relDraft.upc || null,
        notes: relDraft.notes || null,
      };
      if (!release) {
        const { data, error } = await (supabase as any).from("music_releases")
          .insert({ project_id: project.id, created_by: currentUserId, ...payload }).select().single();
        if (error) throw error;
        setRelease(data as Release);
      } else {
        const { error } = await (supabase as any).from("music_releases").update(payload).eq("id", release.id);
        if (error) throw error;
      }
      toast({ title: "Release saved" });
      await loadAll();
    } catch (e: any) {
      toast({ title: "Couldn't save", description: e?.message, variant: "destructive" });
    } finally {
      setSavingRel(false);
    }
  };

  // ---- TRACKS ----
  const addTrack = async () => {
    if (!trackDraft.title.trim()) return;
    const { error } = await (supabase as any).from("music_tracks").insert({
      project_id: project.id, created_by: currentUserId,
      release_id: release?.id || null,
      title: trackDraft.title.trim(),
      duration_seconds: trackDraft.duration_seconds ? parseInt(trackDraft.duration_seconds) : null,
      isrc: trackDraft.isrc || null,
      master_url: trackDraft.master_url || null,
      track_no: tracks.length + 1,
      order_index: tracks.length,
    });
    if (error) return toast({ title: "Couldn't add", description: error.message, variant: "destructive" });
    setTrackDraft({ title: "", duration_seconds: "", isrc: "", master_url: "" });
    setOpenTrack(false);
    await loadAll();
  };
  const setTrackStatus = async (id: string, status: string) => {
    await (supabase as any).from("music_tracks").update({ status }).eq("id", id);
    setTracks((p) => p.map((t) => t.id === id ? { ...t, status } : t));
  };
  const delTrack = async (id: string) => {
    await (supabase as any).from("music_tracks").delete().eq("id", id);
    setTracks((p) => p.filter((t) => t.id !== id));
  };

  // ---- SPLITS ----
  const splitTotalsByTarget = useMemo(() => {
    const map: Record<string, number> = { release: 0 };
    splits.forEach((s) => {
      const key = s.track_id || "release";
      map[key] = (map[key] || 0) + Number(s.percentage || 0);
    });
    return map;
  }, [splits]);

  const addSplit = async () => {
    if (!splitDraft.name.trim() || !splitDraft.percentage) return;
    const { error } = await (supabase as any).from("music_splits").insert({
      project_id: project.id, created_by: currentUserId,
      release_id: release?.id || null,
      track_id: splitDraft.track_id || null,
      name: splitDraft.name.trim(),
      role: splitDraft.role,
      percentage: parseFloat(splitDraft.percentage),
      payout_email: splitDraft.payout_email || null,
    });
    if (error) return toast({ title: "Couldn't add", description: error.message, variant: "destructive" });
    setSplitDraft({ name: "", role: "songwriter", percentage: "", payout_email: "", track_id: "" });
    setOpenSplit(false);
    await loadAll();
  };
  const setSplitStatus = async (id: string, status: string) => {
    await (supabase as any).from("music_splits").update({ status }).eq("id", id);
    setSplits((p) => p.map((s) => s.id === id ? { ...s, status } : s));
  };
  const delSplit = async (id: string) => {
    await (supabase as any).from("music_splits").delete().eq("id", id);
    setSplits((p) => p.filter((s) => s.id !== id));
  };

  // ---- CHECKLIST ----
  const addCheck = async () => {
    if (!checkDraft.title.trim()) return;
    const { error } = await (supabase as any).from("music_release_checklist").insert({
      project_id: project.id, created_by: currentUserId,
      release_id: release?.id || null,
      title: checkDraft.title.trim(),
      due_date: checkDraft.due_date || null,
      order_index: checklist.length,
    });
    if (error) return toast({ title: "Couldn't add", description: error.message, variant: "destructive" });
    setCheckDraft({ title: "", due_date: "" });
    setOpenCheck(false);
    await loadAll();
  };
  const toggleCheck = async (item: ChecklistItem) => {
    await (supabase as any).from("music_release_checklist").update({ done: !item.done }).eq("id", item.id);
    setChecklist((p) => p.map((c) => c.id === item.id ? { ...c, done: !c.done } : c));
  };
  const delCheck = async (id: string) => {
    await (supabase as any).from("music_release_checklist").delete().eq("id", id);
    setChecklist((p) => p.filter((c) => c.id !== id));
  };
  const generateChecklist = async () => {
    setGenCheck(true);
    try {
      const { data, error } = await supabase.functions.invoke<{ items: any[] }>("gen-release-checklist", {
        body: {
          release_type: release?.release_type || relDraft.release_type,
          release_date: release?.release_date || relDraft.release_date,
          distributor: release?.distributor || relDraft.distributor,
          project_title: release?.title || relDraft.title || project.title,
          artist: release?.artist || relDraft.artist,
        },
      });
      if (error) throw error;
      const items = data?.items || [];
      if (items.length === 0) return toast({ title: "No items returned", variant: "destructive" });
      const releaseDate = release?.release_date || relDraft.release_date || null;
      const rows = items.map((it, i) => {
        let due: string | null = null;
        if (releaseDate && typeof it.days_before_release === "number") {
          const d = new Date(releaseDate);
          d.setDate(d.getDate() - it.days_before_release);
          due = d.toISOString().slice(0, 10);
        }
        return {
          project_id: project.id, created_by: currentUserId,
          release_id: release?.id || null,
          title: it.title || "Task",
          due_date: due,
          order_index: checklist.length + i,
        };
      });
      const { error: insErr } = await (supabase as any).from("music_release_checklist").insert(rows);
      if (insErr) throw insErr;
      toast({ title: `Added ${rows.length} tasks` });
      setTab("checklist");
      await loadAll();
    } catch (e: any) {
      toast({ title: "Couldn't draft checklist", description: e?.message, variant: "destructive" });
    } finally {
      setGenCheck(false);
    }
  };

  const totalReleaseSplit = splitTotalsByTarget["release"] || 0;

  return (
    <section className="px-4 py-5 lg:px-0">
      <div className="flex items-center gap-2 mb-3">
        <span className="h-8 w-8 rounded-xl bg-primary/12 text-primary flex items-center justify-center">
          <Music2 className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-sm font-bold leading-tight">Music Studio</h3>
          <p className="text-[11px] text-muted-foreground leading-tight">Release, tracklist, splits, checklist — one room.</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="release" className="text-[11px]"><Disc3 className="h-3 w-3 mr-1" />Release</TabsTrigger>
          <TabsTrigger value="tracks" className="text-[11px]"><Music2 className="h-3 w-3 mr-1" />Tracks</TabsTrigger>
          <TabsTrigger value="splits" className="text-[11px]"><Users className="h-3 w-3 mr-1" />Splits</TabsTrigger>
          <TabsTrigger value="checklist" className="text-[11px]"><ListChecks className="h-3 w-3 mr-1" />Checklist</TabsTrigger>
        </TabsList>

        {/* RELEASE */}
        <TabsContent value="release" className="mt-3 space-y-2">
          <Input placeholder="Release title" value={relDraft.title} onChange={(e) => setRelDraft({ ...relDraft, title: e.target.value })} className="text-sm" />
          <Input placeholder="Artist" value={relDraft.artist} onChange={(e) => setRelDraft({ ...relDraft, artist: e.target.value })} className="text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <select value={relDraft.release_type} onChange={(e) => setRelDraft({ ...relDraft, release_type: e.target.value })}
              className="text-sm bg-transparent border border-border rounded-md px-3 py-2">
              <option value="single">Single</option>
              <option value="ep">EP</option>
              <option value="album">Album</option>
            </select>
            <Input type="date" value={relDraft.release_date} onChange={(e) => setRelDraft({ ...relDraft, release_date: e.target.value })} className="text-sm" />
          </div>
          <Input placeholder="Distributor (DistroKid, TuneCore, etc.)" value={relDraft.distributor} onChange={(e) => setRelDraft({ ...relDraft, distributor: e.target.value })} className="text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="ISRC" value={relDraft.isrc} onChange={(e) => setRelDraft({ ...relDraft, isrc: e.target.value })} className="text-sm" />
            <Input placeholder="UPC" value={relDraft.upc} onChange={(e) => setRelDraft({ ...relDraft, upc: e.target.value })} className="text-sm" />
          </div>
          <Textarea placeholder="Notes (concept, references, marketing angle)" rows={3} value={relDraft.notes} onChange={(e) => setRelDraft({ ...relDraft, notes: e.target.value })} className="text-sm" />
          <Button size="sm" onClick={saveRelease} disabled={savingRel} className="w-full">
            {savingRel ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
            {release ? "Update release" : "Save release"}
          </Button>
        </TabsContent>

        {/* TRACKS */}
        <TabsContent value="tracks" className="mt-3 space-y-2">
          <Button size="sm" variant="outline" onClick={() => setOpenTrack(true)} className="w-full">
            <Plus className="h-3.5 w-3.5 mr-1" /> Add track
          </Button>
          {tracks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/80 p-5 text-center">
              <p className="text-sm font-semibold">No tracks yet</p>
              <p className="text-xs text-muted-foreground mt-0.5">Add your first track to start building the release.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {tracks.map((t) => (
                <li key={t.id} className="rounded-xl border border-border/60 bg-card/40 p-3">
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary text-xs font-black flex items-center justify-center shrink-0">
                      {String(t.track_no || "—").padStart(2, "0")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold leading-tight">{t.title}</p>
                        <Badge className={`text-[10px] uppercase ${TRACK_STATUS_TONE[t.status] || ""}`}>{t.status}</Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 text-[11px] text-muted-foreground">
                        {t.duration_seconds && <span>{Math.floor(t.duration_seconds / 60)}:{String(t.duration_seconds % 60).padStart(2, "0")}</span>}
                        {t.isrc && <span>· ISRC {t.isrc}</span>}
                        {t.master_url && <a href={t.master_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">· master</a>}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <select value={t.status} onChange={(e) => setTrackStatus(t.id, e.target.value)}
                          className="text-[10px] uppercase bg-transparent border border-border/60 rounded px-1.5 py-0.5 text-muted-foreground">
                          <option value="idea">Idea</option>
                          <option value="recorded">Recorded</option>
                          <option value="mixed">Mixed</option>
                          <option value="mastered">Mastered</option>
                          <option value="final">Final</option>
                        </select>
                        <button onClick={() => delTrack(t.id)} className="ml-auto text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        {/* SPLITS */}
        <TabsContent value="splits" className="mt-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Button size="sm" variant="outline" onClick={() => setOpenSplit(true)} className="flex-1">
              <Plus className="h-3.5 w-3.5 mr-1" /> Add split
            </Button>
            <Badge
              variant="outline"
              className={`text-[10px] shrink-0 ${totalReleaseSplit === 100 ? "text-white border-white/30" : totalReleaseSplit > 100 ? "text-destructive border-destructive/40" : ""}`}
            >
              Release: {totalReleaseSplit.toFixed(1)}%
            </Badge>
          </div>
          {splits.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/80 p-5 text-center">
              <p className="text-sm font-semibold">No splits set</p>
              <p className="text-xs text-muted-foreground mt-0.5">Document who gets paid before you release.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {splits.map((s) => {
                const track = tracks.find((t) => t.id === s.track_id);
                return (
                  <li key={s.id} className="rounded-xl border border-border/60 bg-card/40 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-tight">{s.name}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                          {s.role && <span className="capitalize">{s.role}</span>}
                          {track ? <span>· track {track.track_no}: {track.title}</span> : <span>· whole release</span>}
                          {s.payout_email && <span>· {s.payout_email}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-bold">{Number(s.percentage).toFixed(1)}%</span>
                        <Badge className={`text-[10px] uppercase ${SPLIT_TONE[s.status] || ""}`}>{s.status}</Badge>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <select value={s.status} onChange={(e) => setSplitStatus(s.id, e.target.value)}
                        className="text-[10px] uppercase bg-transparent border border-border/60 rounded px-1.5 py-0.5 text-muted-foreground">
                        <option value="pending">Pending</option>
                        <option value="agreed">Agreed</option>
                        <option value="declined">Declined</option>
                      </select>
                      <button onClick={() => delSplit(s.id)} className="ml-auto text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>

        {/* CHECKLIST */}
        <TabsContent value="checklist" className="mt-3 space-y-2">
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setOpenCheck(true)} className="flex-1">
              <Plus className="h-3.5 w-3.5 mr-1" /> Task
            </Button>
            <Button size="sm" onClick={generateChecklist} disabled={genCheck} className="flex-1">
              {genCheck ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
              Draft full plan
            </Button>
          </div>
          {checklist.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/80 p-5 text-center">
              <p className="text-sm font-semibold">No checklist yet</p>
              <p className="text-xs text-muted-foreground mt-0.5">Generate a full release plan with one tap.</p>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {checklist.map((c) => (
                <li key={c.id} className={`rounded-xl border border-border/60 p-2.5 flex items-center gap-2 ${c.done ? "opacity-60 bg-muted/40" : "bg-card/40"}`}>
                  <button onClick={() => toggleCheck(c)}
                    className={`h-5 w-5 rounded-md border flex items-center justify-center shrink-0 ${c.done ? "bg-primary border-primary text-primary-foreground" : "border-border"}`}>
                    {c.done && <Check className="h-3 w-3" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-tight ${c.done ? "line-through" : "font-medium"}`}>{c.title}</p>
                    {c.due_date && <p className="text-[10px] text-muted-foreground mt-0.5">Due {c.due_date}</p>}
                  </div>
                  <button onClick={() => delCheck(c.id)} className="text-muted-foreground hover:text-destructive shrink-0">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      {/* Add Track Dialog */}
      <Dialog open={openTrack} onOpenChange={setOpenTrack}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New track</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Input placeholder="Track title" value={trackDraft.title} onChange={(e) => setTrackDraft({ ...trackDraft, title: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" placeholder="Duration (sec)" value={trackDraft.duration_seconds} onChange={(e) => setTrackDraft({ ...trackDraft, duration_seconds: e.target.value })} />
              <Input placeholder="ISRC" value={trackDraft.isrc} onChange={(e) => setTrackDraft({ ...trackDraft, isrc: e.target.value })} />
            </div>
            <Input placeholder="Master URL (optional)" value={trackDraft.master_url} onChange={(e) => setTrackDraft({ ...trackDraft, master_url: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenTrack(false)}>Cancel</Button>
            <Button onClick={addTrack}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Split Dialog */}
      <Dialog open={openSplit} onOpenChange={setOpenSplit}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add split</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Input placeholder="Collaborator name" value={splitDraft.name} onChange={(e) => setSplitDraft({ ...splitDraft, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <select value={splitDraft.role} onChange={(e) => setSplitDraft({ ...splitDraft, role: e.target.value })}
                className="text-sm bg-transparent border border-border rounded-md px-3 py-2">
                <option value="songwriter">Songwriter</option>
                <option value="producer">Producer</option>
                <option value="performer">Performer</option>
                <option value="featured">Featured</option>
                <option value="engineer">Engineer</option>
              </select>
              <Input type="number" step="0.1" placeholder="Percentage" value={splitDraft.percentage} onChange={(e) => setSplitDraft({ ...splitDraft, percentage: e.target.value })} />
            </div>
            <select value={splitDraft.track_id} onChange={(e) => setSplitDraft({ ...splitDraft, track_id: e.target.value })}
              className="w-full text-sm bg-transparent border border-border rounded-md px-3 py-2">
              <option value="">Whole release</option>
              {tracks.map((t) => <option key={t.id} value={t.id}>Track {t.track_no}: {t.title}</option>)}
            </select>
            <Input type="email" placeholder="Payout email (optional)" value={splitDraft.payout_email} onChange={(e) => setSplitDraft({ ...splitDraft, payout_email: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenSplit(false)}>Cancel</Button>
            <Button onClick={addSplit}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Checklist Item */}
      <Dialog open={openCheck} onOpenChange={setOpenCheck}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New task</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Input placeholder="Task title" value={checkDraft.title} onChange={(e) => setCheckDraft({ ...checkDraft, title: e.target.value })} />
            <Input type="date" value={checkDraft.due_date} onChange={(e) => setCheckDraft({ ...checkDraft, due_date: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCheck(false)}>Cancel</Button>
            <Button onClick={addCheck}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
