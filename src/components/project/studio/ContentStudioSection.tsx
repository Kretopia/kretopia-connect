import { useEffect, useState } from "react";
import { Camera, FileText, Calendar as CalIcon, CheckSquare, Plus, Sparkles, Loader2, Trash2, Save, ExternalLink, Check, X, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { format } from "date-fns";

interface Props {
  project: any;
  currentUserId: string;
}

interface Shot {
  id: string;
  scene_no: number | null;
  shot_no: number | null;
  description: string;
  shot_type: string | null;
  location: string | null;
  talent: string[] | null;
  props: string[] | null;
  duration_seconds: number | null;
  status: string;
  order_index: number;
}

interface Script {
  id: string;
  title: string;
  body: string;
  version: number;
  is_current: boolean;
  updated_at: string;
}

interface CalItem {
  id: string;
  title: string;
  platform: string | null;
  scheduled_at: string | null;
  caption: string | null;
  asset_url: string | null;
  status: string;
}

interface Approval {
  id: string;
  title: string;
  item_type: string;
  asset_url: string | null;
  status: string;
  feedback: string | null;
  decided_at: string | null;
  reviewer_id: string | null;
}

const SHOT_STATUS_TONE: Record<string, string> = {
  planned: "bg-muted text-muted-foreground",
  shot: "bg-white/15 text-white font-semibold",
  skipped: "bg-muted text-muted-foreground",
};

const POST_STATUS_TONE: Record<string, string> = {
  idea: "bg-muted text-muted-foreground",
  drafted: "bg-primary/15 text-primary",
  scheduled: "bg-energy/15 text-foreground",
  published: "bg-white/15 text-white font-semibold",
};

const APPROVAL_TONE: Record<string, string> = {
  pending: "bg-[hsl(var(--energy)/0.15)] text-[hsl(var(--energy))]",
  approved: "bg-white/15 text-white font-semibold",
  changes_requested: "bg-primary/15 text-primary",
  rejected: "bg-muted text-muted-foreground",
};

export function ContentStudioSection({ project, currentUserId }: Props) {
  const { toast } = useToast();
  const [tab, setTab] = useState("shots");

  // SHOTS
  const [shots, setShots] = useState<Shot[]>([]);
  const [shotLoading, setShotLoading] = useState(true);
  const [openShot, setOpenShot] = useState(false);
  const [shotDraft, setShotDraft] = useState({ description: "", shot_type: "", location: "", duration_seconds: "" });
  const [genShots, setGenShots] = useState(false);

  // SCRIPT
  const [script, setScript] = useState<Script | null>(null);
  const [scriptBody, setScriptBody] = useState("");
  const [scriptTitle, setScriptTitle] = useState("Script");
  const [savingScript, setSavingScript] = useState(false);

  // CALENDAR
  const [posts, setPosts] = useState<CalItem[]>([]);
  const [openPost, setOpenPost] = useState(false);
  const [postDraft, setPostDraft] = useState({ title: "", platform: "instagram", scheduled_at: "", caption: "", asset_url: "" });

  // APPROVALS
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [openAppr, setOpenAppr] = useState(false);
  const [apprDraft, setApprDraft] = useState({ title: "", item_type: "post", asset_url: "" });
  const [feedbackFor, setFeedbackFor] = useState<Approval | null>(null);
  const [feedbackText, setFeedbackText] = useState("");

  const loadAll = async () => {
    const [s, sc, p, a] = await Promise.all([
      (supabase as any).from("content_shots").select("*").eq("project_id", project.id).order("order_index"),
      (supabase as any).from("content_scripts").select("*").eq("project_id", project.id).eq("is_current", true).order("version", { ascending: false }).limit(1).maybeSingle(),
      (supabase as any).from("content_calendar_items").select("*").eq("project_id", project.id).order("scheduled_at", { ascending: true, nullsFirst: false }),
      (supabase as any).from("content_approvals").select("*").eq("project_id", project.id).order("created_at", { ascending: false }),
    ]);
    setShots((s.data || []) as Shot[]);
    setShotLoading(false);
    if (sc.data) {
      setScript(sc.data as Script);
      setScriptBody(sc.data.body || "");
      setScriptTitle(sc.data.title || "Script");
    }
    setPosts((p.data || []) as CalItem[]);
    setApprovals((a.data || []) as Approval[]);
  };

  useEffect(() => { void loadAll(); /* eslint-disable-next-line */ }, [project.id]);

  // ----- SHOTS -----
  const addShot = async () => {
    if (!shotDraft.description.trim()) return;
    const nextScene = shots.length === 0 ? 1 : Math.max(...shots.map((s) => s.scene_no || 1));
    const inScene = shots.filter((s) => s.scene_no === nextScene);
    const { error } = await (supabase as any).from("content_shots").insert({
      project_id: project.id, created_by: currentUserId,
      scene_no: nextScene, shot_no: inScene.length + 1,
      description: shotDraft.description.trim(),
      shot_type: shotDraft.shot_type || null,
      location: shotDraft.location || null,
      duration_seconds: shotDraft.duration_seconds ? parseInt(shotDraft.duration_seconds) : null,
      order_index: shots.length,
    });
    if (error) return toast({ title: "Couldn't add shot", description: error.message, variant: "destructive" });
    setShotDraft({ description: "", shot_type: "", location: "", duration_seconds: "" });
    setOpenShot(false);
    await loadAll();
  };

  const generateShotList = async () => {
    setGenShots(true);
    try {
      const { data, error } = await supabase.functions.invoke<{ shots: any[] }>("gen-content-shotlist", {
        body: {
          brief: project.brief || project.description || project.title,
          project_title: project.title,
          format: project.workspace_type === "content" ? "short-form video" : "video",
        },
      });
      if (error) throw error;
      const generated = data?.shots || [];
      if (generated.length === 0) {
        toast({ title: "No shots returned", variant: "destructive" });
        return;
      }
      const rows = generated.map((s, i) => ({
        project_id: project.id, created_by: currentUserId,
        scene_no: s.scene_no || 1, shot_no: s.shot_no || i + 1,
        description: s.description || "Untitled shot",
        shot_type: s.shot_type || null,
        location: s.location || null,
        talent: Array.isArray(s.talent) ? s.talent : [],
        props: Array.isArray(s.props) ? s.props : [],
        duration_seconds: s.duration_seconds || null,
        order_index: shots.length + i,
      }));
      const { error: insErr } = await (supabase as any).from("content_shots").insert(rows);
      if (insErr) throw insErr;
      toast({ title: `Added ${generated.length} shots` });
      await loadAll();
    } catch (e: any) {
      toast({ title: "Couldn't generate shots", description: e?.message, variant: "destructive" });
    } finally {
      setGenShots(false);
    }
  };

  const setShotStatus = async (id: string, status: string) => {
    await (supabase as any).from("content_shots").update({ status }).eq("id", id);
    setShots((p) => p.map((s) => (s.id === id ? { ...s, status } : s)));
  };

  const delShot = async (id: string) => {
    await (supabase as any).from("content_shots").delete().eq("id", id);
    setShots((p) => p.filter((s) => s.id !== id));
  };

  // ----- SCRIPT -----
  const saveScript = async () => {
    setSavingScript(true);
    try {
      if (!script) {
        const { data, error } = await (supabase as any).from("content_scripts").insert({
          project_id: project.id, created_by: currentUserId, updated_by: currentUserId,
          title: scriptTitle || "Script", body: scriptBody, version: 1, is_current: true,
        }).select().single();
        if (error) throw error;
        setScript(data as Script);
      } else {
        const { error } = await (supabase as any).from("content_scripts")
          .update({ body: scriptBody, title: scriptTitle, updated_by: currentUserId })
          .eq("id", script.id);
        if (error) throw error;
      }
      toast({ title: "Script saved" });
    } catch (e: any) {
      toast({ title: "Couldn't save", description: e?.message, variant: "destructive" });
    } finally {
      setSavingScript(false);
    }
  };

  const newVersion = async () => {
    if (!script) return saveScript();
    await (supabase as any).from("content_scripts").update({ is_current: false }).eq("id", script.id);
    const { data, error } = await (supabase as any).from("content_scripts").insert({
      project_id: project.id, created_by: currentUserId, updated_by: currentUserId,
      title: scriptTitle, body: scriptBody, version: script.version + 1, is_current: true,
    }).select().single();
    if (error) return toast({ title: "Couldn't version", description: error.message, variant: "destructive" });
    setScript(data as Script);
    toast({ title: `Saved as v${data.version}` });
  };

  // ----- CALENDAR -----
  const addPost = async () => {
    if (!postDraft.title.trim()) return;
    const { error } = await (supabase as any).from("content_calendar_items").insert({
      project_id: project.id, created_by: currentUserId,
      title: postDraft.title.trim(),
      platform: postDraft.platform || null,
      scheduled_at: postDraft.scheduled_at ? new Date(postDraft.scheduled_at).toISOString() : null,
      caption: postDraft.caption || null,
      asset_url: postDraft.asset_url || null,
      status: postDraft.scheduled_at ? "scheduled" : "idea",
    });
    if (error) return toast({ title: "Couldn't add post", description: error.message, variant: "destructive" });
    setPostDraft({ title: "", platform: "instagram", scheduled_at: "", caption: "", asset_url: "" });
    setOpenPost(false);
    await loadAll();
  };

  const setPostStatus = async (id: string, status: string) => {
    await (supabase as any).from("content_calendar_items").update({ status }).eq("id", id);
    setPosts((p) => p.map((x) => (x.id === id ? { ...x, status } : x)));
  };

  const delPost = async (id: string) => {
    await (supabase as any).from("content_calendar_items").delete().eq("id", id);
    setPosts((p) => p.filter((x) => x.id !== id));
  };

  // ----- APPROVALS -----
  const addApproval = async () => {
    if (!apprDraft.title.trim()) return;
    const { error } = await (supabase as any).from("content_approvals").insert({
      project_id: project.id, created_by: currentUserId,
      title: apprDraft.title.trim(),
      item_type: apprDraft.item_type,
      asset_url: apprDraft.asset_url || null,
    });
    if (error) return toast({ title: "Couldn't submit", description: error.message, variant: "destructive" });
    setApprDraft({ title: "", item_type: "post", asset_url: "" });
    setOpenAppr(false);
    await loadAll();
  };

  const decide = async (a: Approval, status: string, feedback?: string) => {
    const { error } = await (supabase as any).from("content_approvals").update({
      status, feedback: feedback ?? a.feedback, reviewer_id: currentUserId, decided_at: new Date().toISOString(),
    }).eq("id", a.id);
    if (error) return toast({ title: "Couldn't update", description: error.message, variant: "destructive" });
    toast({ title: status === "approved" ? "Approved" : status === "changes_requested" ? "Changes requested" : "Updated" });
    setFeedbackFor(null); setFeedbackText("");
    await loadAll();
  };

  return (
    <section className="px-4 py-5 lg:px-0">
      <div className="flex items-center gap-2 mb-3">
        <span className="h-8 w-8 rounded-xl bg-primary/12 text-primary flex items-center justify-center">
          <Camera className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-sm font-bold leading-tight">Content Studio</h3>
          <p className="text-[11px] text-muted-foreground leading-tight">Shots, script, calendar, approvals — one room.</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="shots" className="text-[11px]"><Camera className="h-3 w-3 mr-1" />Shots</TabsTrigger>
          <TabsTrigger value="script" className="text-[11px]"><FileText className="h-3 w-3 mr-1" />Script</TabsTrigger>
          <TabsTrigger value="calendar" className="text-[11px]"><CalIcon className="h-3 w-3 mr-1" />Calendar</TabsTrigger>
          <TabsTrigger value="approvals" className="text-[11px]">
            <CheckSquare className="h-3 w-3 mr-1" />Approve
            {approvals.filter((a) => a.status === "pending").length > 0 && (
              <span className="ml-1 text-[9px] bg-[hsl(var(--energy)/0.2)] text-[hsl(var(--energy))] px-1 rounded">
                {approvals.filter((a) => a.status === "pending").length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* SHOTS */}
        <TabsContent value="shots" className="mt-3 space-y-2">
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setOpenShot(true)} className="flex-1">
              <Plus className="h-3.5 w-3.5 mr-1" /> Shot
            </Button>
            <Button size="sm" onClick={generateShotList} disabled={genShots} className="flex-1">
              {genShots ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
              Draft from brief
            </Button>
          </div>
          {shotLoading ? (
            <div className="text-xs text-muted-foreground py-6 text-center">Loading shots…</div>
          ) : shots.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/80 p-5 text-center">
              <p className="text-sm font-semibold">No shots yet</p>
              <p className="text-xs text-muted-foreground mt-0.5">Add manually or let Thrive draft a list from your brief.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {shots.map((s) => (
                <li key={s.id} className="rounded-xl border border-border/60 bg-card/40 p-3">
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary text-[10px] font-black flex items-center justify-center shrink-0">
                      {s.scene_no || 1}.{s.shot_no || "—"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold leading-tight">{s.description}</p>
                        <Badge className={`text-[10px] uppercase ${SHOT_STATUS_TONE[s.status]}`}>{s.status}</Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                        {s.shot_type && <span>{s.shot_type}</span>}
                        {s.location && <span>· {s.location}</span>}
                        {s.duration_seconds && <span>· {s.duration_seconds}s</span>}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <select value={s.status} onChange={(e) => setShotStatus(s.id, e.target.value)}
                          className="text-[10px] uppercase bg-transparent border border-border/60 rounded px-1.5 py-0.5 text-muted-foreground">
                          <option value="planned">Planned</option>
                          <option value="shot">Shot</option>
                          <option value="skipped">Skipped</option>
                        </select>
                        <button onClick={() => delShot(s.id)} className="ml-auto text-[10px] text-muted-foreground hover:text-destructive">
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

        {/* SCRIPT */}
        <TabsContent value="script" className="mt-3 space-y-2">
          <div className="flex items-center gap-2">
            <Input value={scriptTitle} onChange={(e) => setScriptTitle(e.target.value)} placeholder="Script title" className="text-sm" />
            {script && <Badge variant="outline" className="shrink-0 text-[10px]">v{script.version}</Badge>}
          </div>
          <Textarea value={scriptBody} onChange={(e) => setScriptBody(e.target.value)} rows={12}
            placeholder="Open on a wide of the workshop. NARRATOR (V.O.):..." className="text-sm font-mono" />
          <div className="flex gap-2">
            <Button size="sm" onClick={saveScript} disabled={savingScript} className="flex-1">
              {savingScript ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
              Save
            </Button>
            {script && (
              <Button size="sm" variant="outline" onClick={newVersion} className="flex-1">
                Save as v{script.version + 1}
              </Button>
            )}
          </div>
        </TabsContent>

        {/* CALENDAR */}
        <TabsContent value="calendar" className="mt-3 space-y-2">
          <Button size="sm" variant="outline" onClick={() => setOpenPost(true)} className="w-full">
            <Plus className="h-3.5 w-3.5 mr-1" /> Schedule a post
          </Button>
          {posts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/80 p-5 text-center">
              <p className="text-sm font-semibold">Empty calendar</p>
              <p className="text-xs text-muted-foreground mt-0.5">Plan posts across IG, TikTok, YouTube and more.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {posts.map((p) => (
                <li key={p.id} className="rounded-xl border border-border/60 bg-card/40 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold leading-tight">{p.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 text-[11px] text-muted-foreground">
                        {p.platform && <span className="capitalize">{p.platform}</span>}
                        {p.scheduled_at && <span>· {format(new Date(p.scheduled_at), "MMM d, h:mm a")}</span>}
                      </div>
                      {p.caption && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{p.caption}</p>}
                    </div>
                    <Badge className={`text-[10px] uppercase shrink-0 ${POST_STATUS_TONE[p.status]}`}>{p.status}</Badge>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <select value={p.status} onChange={(e) => setPostStatus(p.id, e.target.value)}
                      className="text-[10px] uppercase bg-transparent border border-border/60 rounded px-1.5 py-0.5 text-muted-foreground">
                      <option value="idea">Idea</option>
                      <option value="drafted">Drafted</option>
                      <option value="scheduled">Scheduled</option>
                      <option value="published">Published</option>
                    </select>
                    {p.asset_url && (
                      <a href={p.asset_url} target="_blank" rel="noreferrer" className="text-[10px] text-primary inline-flex items-center gap-1">
                        <ExternalLink className="h-3 w-3" /> Asset
                      </a>
                    )}
                    <button onClick={() => delPost(p.id)} className="ml-auto text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        {/* APPROVALS */}
        <TabsContent value="approvals" className="mt-3 space-y-2">
          <Button size="sm" variant="outline" onClick={() => setOpenAppr(true)} className="w-full">
            <Plus className="h-3.5 w-3.5 mr-1" /> Submit for approval
          </Button>
          {approvals.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/80 p-5 text-center">
              <p className="text-sm font-semibold">No pending reviews</p>
              <p className="text-xs text-muted-foreground mt-0.5">Submit cuts, posts, or deliverables to track sign-off.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {approvals.map((a) => (
                <li key={a.id} className="rounded-xl border border-border/60 bg-card/40 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold leading-tight">{a.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 text-[11px] text-muted-foreground">
                        <span className="capitalize">{a.item_type}</span>
                        {a.decided_at && <span>· {format(new Date(a.decided_at), "MMM d")}</span>}
                      </div>
                      {a.feedback && (
                        <div className="mt-2 rounded-lg bg-muted/40 p-2 text-xs">
                          <MessageSquare className="h-3 w-3 inline mr-1" />{a.feedback}
                        </div>
                      )}
                    </div>
                    <Badge className={`text-[10px] uppercase shrink-0 ${APPROVAL_TONE[a.status]}`}>
                      {a.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    {a.asset_url && (
                      <a href={a.asset_url} target="_blank" rel="noreferrer" className="text-[10px] text-primary inline-flex items-center gap-1">
                        <ExternalLink className="h-3 w-3" /> View
                      </a>
                    )}
                    {a.status === "pending" && (
                      <>
                        <Button size="sm" variant="outline" className="h-7 text-[10px] ml-auto" onClick={() => decide(a, "approved")}>
                          <Check className="h-3 w-3 mr-1" /> Approve
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => { setFeedbackFor(a); setFeedbackText(a.feedback || ""); }}>
                          <MessageSquare className="h-3 w-3 mr-1" /> Request changes
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      {/* Add shot dialog */}
      <Dialog open={openShot} onOpenChange={setOpenShot}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a shot</DialogTitle>
            <DialogDescription>What you'll capture, how, where.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Textarea value={shotDraft.description} onChange={(e) => setShotDraft({ ...shotDraft, description: e.target.value })}
              placeholder="Wide of host walking into the studio…" rows={3} />
            <div className="grid grid-cols-2 gap-2">
              <Input value={shotDraft.shot_type} onChange={(e) => setShotDraft({ ...shotDraft, shot_type: e.target.value })} placeholder="Shot type (wide, close-up...)" />
              <Input value={shotDraft.location} onChange={(e) => setShotDraft({ ...shotDraft, location: e.target.value })} placeholder="Location" />
            </div>
            <Input type="number" value={shotDraft.duration_seconds} onChange={(e) => setShotDraft({ ...shotDraft, duration_seconds: e.target.value })} placeholder="Duration (sec)" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenShot(false)}>Cancel</Button>
            <Button onClick={addShot} disabled={!shotDraft.description.trim()}>Add shot</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add post dialog */}
      <Dialog open={openPost} onOpenChange={setOpenPost}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule a post</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Input value={postDraft.title} onChange={(e) => setPostDraft({ ...postDraft, title: e.target.value })} placeholder="Post title" />
            <div className="grid grid-cols-2 gap-2">
              <select value={postDraft.platform} onChange={(e) => setPostDraft({ ...postDraft, platform: e.target.value })}
                className="border border-border/60 rounded-md px-2 py-2 text-sm bg-background">
                <option value="instagram">Instagram</option>
                <option value="tiktok">TikTok</option>
                <option value="youtube">YouTube</option>
                <option value="x">X / Twitter</option>
                <option value="linkedin">LinkedIn</option>
                <option value="other">Other</option>
              </select>
              <Input type="datetime-local" value={postDraft.scheduled_at} onChange={(e) => setPostDraft({ ...postDraft, scheduled_at: e.target.value })} />
            </div>
            <Textarea value={postDraft.caption} onChange={(e) => setPostDraft({ ...postDraft, caption: e.target.value })} placeholder="Caption / hook…" rows={3} />
            <Input value={postDraft.asset_url} onChange={(e) => setPostDraft({ ...postDraft, asset_url: e.target.value })} placeholder="Asset URL (optional)" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenPost(false)}>Cancel</Button>
            <Button onClick={addPost} disabled={!postDraft.title.trim()}>Schedule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submit for approval */}
      <Dialog open={openAppr} onOpenChange={setOpenAppr}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit for approval</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Input value={apprDraft.title} onChange={(e) => setApprDraft({ ...apprDraft, title: e.target.value })} placeholder="What needs sign-off?" />
            <select value={apprDraft.item_type} onChange={(e) => setApprDraft({ ...apprDraft, item_type: e.target.value })}
              className="w-full border border-border/60 rounded-md px-2 py-2 text-sm bg-background">
              <option value="post">Post</option>
              <option value="clip">Clip / cut</option>
              <option value="deliverable">Deliverable</option>
              <option value="caption">Caption</option>
            </select>
            <Input value={apprDraft.asset_url} onChange={(e) => setApprDraft({ ...apprDraft, asset_url: e.target.value })} placeholder="Asset URL (Frame.io, Drive, YouTube…)" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenAppr(false)}>Cancel</Button>
            <Button onClick={addApproval} disabled={!apprDraft.title.trim()}>Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request changes feedback dialog */}
      <Dialog open={!!feedbackFor} onOpenChange={(v) => !v && setFeedbackFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request changes</DialogTitle>
            <DialogDescription>Tell the creator what to revise.</DialogDescription>
          </DialogHeader>
          <Textarea value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} rows={4} placeholder="Tighten the intro, swap the b-roll at 0:08…" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setFeedbackFor(null)}>Cancel</Button>
            <Button onClick={() => feedbackFor && decide(feedbackFor, "changes_requested", feedbackText)}>Send</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
