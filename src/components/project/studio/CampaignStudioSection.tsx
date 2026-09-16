import { useEffect, useState } from "react";
import { Megaphone, FileText, LayoutGrid, CheckSquare, Plus, Sparkles, Loader2, Trash2, Save, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface Props {
  project: any;
  currentUserId: string;
}

interface Brief {
  id: string;
  brand_name: string | null;
  objective: string | null;
  audience: string | null;
  tone: string | null;
  key_messages: string[];
  guidelines: string | null;
  kpis: string[];
  budget: number | null;
  currency: string | null;
  start_date: string | null;
  end_date: string | null;
  version: number;
}

interface Asset {
  id: string;
  platform: string | null;
  format: string | null;
  deliverable: string;
  channel: string;
  due_date: string | null;
  status: string;
  asset_url: string | null;
  notes: string | null;
}

interface Approval {
  id: string;
  title: string;
  asset_url: string | null;
  status: string;
  feedback: string | null;
}

const ASSET_STATUS_TONE: Record<string, string> = {
  idea: "bg-muted text-muted-foreground",
  in_progress: "bg-primary/15 text-primary",
  review: "bg-[hsl(var(--energy)/0.15)] text-[hsl(var(--energy))]",
  approved: "bg-[hsl(var(--energy)/0.25)] text-[hsl(var(--energy))] font-semibold",
  scheduled: "bg-energy/15 text-foreground",
  published: "bg-white/15 text-white font-semibold",
};

const CHANNEL_TONE: Record<string, string> = {
  paid: "bg-[hsl(var(--energy)/0.15)] text-[hsl(var(--energy))]",
  organic: "bg-primary/15 text-primary",
  both: "bg-foreground/10 text-foreground",
};

export function CampaignStudioSection({ project, currentUserId }: Props) {
  const { toast } = useToast();
  const [tab, setTab] = useState("brief");

  // Brief
  const [brief, setBrief] = useState<Brief | null>(null);
  const [briefDraft, setBriefDraft] = useState({
    brand_name: "", objective: "", audience: "", tone: "",
    key_messages: "", guidelines: "", kpis: "", budget: "",
  });
  const [savingBrief, setSavingBrief] = useState(false);

  // Assets
  const [assets, setAssets] = useState<Asset[]>([]);
  const [openAsset, setOpenAsset] = useState(false);
  const [assetDraft, setAssetDraft] = useState({ deliverable: "", platform: "instagram", format: "reel", channel: "organic", due_date: "", notes: "" });
  const [genMatrix, setGenMatrix] = useState(false);

  // Approvals
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [openAppr, setOpenAppr] = useState(false);
  const [apprDraft, setApprDraft] = useState({ title: "", asset_url: "" });
  const [feedbackFor, setFeedbackFor] = useState<Approval | null>(null);
  const [feedbackText, setFeedbackText] = useState("");

  const loadAll = async () => {
    const [b, a, ap] = await Promise.all([
      (supabase as any).from("campaign_briefs").select("*").eq("project_id", project.id).eq("is_current", true).order("version", { ascending: false }).limit(1).maybeSingle(),
      (supabase as any).from("campaign_assets").select("*").eq("project_id", project.id).order("order_index"),
      (supabase as any).from("campaign_approvals").select("*").eq("project_id", project.id).order("created_at", { ascending: false }),
    ]);
    if (b.data) {
      setBrief(b.data as Brief);
      setBriefDraft({
        brand_name: b.data.brand_name || "",
        objective: b.data.objective || "",
        audience: b.data.audience || "",
        tone: b.data.tone || "",
        key_messages: (b.data.key_messages || []).join("\n"),
        guidelines: b.data.guidelines || "",
        kpis: (b.data.kpis || []).join("\n"),
        budget: b.data.budget?.toString() || "",
      });
    }
    setAssets((a.data || []) as Asset[]);
    setApprovals((ap.data || []) as Approval[]);
  };

  useEffect(() => { void loadAll(); /* eslint-disable-next-line */ }, [project.id]);

  // ---- BRIEF ----
  const saveBrief = async () => {
    setSavingBrief(true);
    try {
      const payload = {
        brand_name: briefDraft.brand_name || null,
        objective: briefDraft.objective || null,
        audience: briefDraft.audience || null,
        tone: briefDraft.tone || null,
        key_messages: briefDraft.key_messages.split("\n").map((s) => s.trim()).filter(Boolean),
        guidelines: briefDraft.guidelines || null,
        kpis: briefDraft.kpis.split("\n").map((s) => s.trim()).filter(Boolean),
        budget: briefDraft.budget ? parseFloat(briefDraft.budget) : null,
        updated_by: currentUserId,
      };
      if (!brief) {
        const { data, error } = await (supabase as any).from("campaign_briefs").insert({
          project_id: project.id, created_by: currentUserId, ...payload,
        }).select().single();
        if (error) throw error;
        setBrief(data as Brief);
      } else {
        const { error } = await (supabase as any).from("campaign_briefs").update(payload).eq("id", brief.id);
        if (error) throw error;
      }
      toast({ title: "Brief saved" });
      await loadAll();
    } catch (e: any) {
      toast({ title: "Couldn't save", description: e?.message, variant: "destructive" });
    } finally {
      setSavingBrief(false);
    }
  };

  // ---- ASSETS ----
  const generateMatrix = async () => {
    setGenMatrix(true);
    try {
      const { data, error } = await supabase.functions.invoke<{ assets: any[] }>("gen-campaign-matrix", {
        body: {
          brief: project.brief || project.description || briefDraft.guidelines,
          project_title: project.title,
          brand_name: briefDraft.brand_name,
          objective: briefDraft.objective,
          audience: briefDraft.audience,
          tone: briefDraft.tone,
        },
      });
      if (error) throw error;
      const generated = data?.assets || [];
      if (generated.length === 0) {
        toast({ title: "No assets returned", variant: "destructive" });
        return;
      }
      const rows = generated.map((a, i) => ({
        project_id: project.id, created_by: currentUserId,
        platform: a.platform || null,
        format: a.format || null,
        deliverable: a.deliverable || "Untitled",
        channel: ["paid", "organic", "both"].includes(a.channel) ? a.channel : "organic",
        notes: a.notes || null,
        order_index: assets.length + i,
      }));
      const { error: insErr } = await (supabase as any).from("campaign_assets").insert(rows);
      if (insErr) throw insErr;
      toast({ title: `Added ${generated.length} assets` });
      setTab("matrix");
      await loadAll();
    } catch (e: any) {
      toast({ title: "Couldn't draft matrix", description: e?.message, variant: "destructive" });
    } finally {
      setGenMatrix(false);
    }
  };

  const addAsset = async () => {
    if (!assetDraft.deliverable.trim()) return;
    const { error } = await (supabase as any).from("campaign_assets").insert({
      project_id: project.id, created_by: currentUserId,
      deliverable: assetDraft.deliverable.trim(),
      platform: assetDraft.platform || null,
      format: assetDraft.format || null,
      channel: assetDraft.channel,
      due_date: assetDraft.due_date || null,
      notes: assetDraft.notes || null,
      order_index: assets.length,
    });
    if (error) return toast({ title: "Couldn't add", description: error.message, variant: "destructive" });
    setAssetDraft({ deliverable: "", platform: "instagram", format: "reel", channel: "organic", due_date: "", notes: "" });
    setOpenAsset(false);
    await loadAll();
  };

  const setAssetStatus = async (id: string, status: string) => {
    await (supabase as any).from("campaign_assets").update({ status }).eq("id", id);
    setAssets((p) => p.map((s) => (s.id === id ? { ...s, status } : s)));
  };

  const delAsset = async (id: string) => {
    await (supabase as any).from("campaign_assets").delete().eq("id", id);
    setAssets((p) => p.filter((s) => s.id !== id));
  };

  // ---- APPROVALS ----
  const addApproval = async () => {
    if (!apprDraft.title.trim()) return;
    const { error } = await (supabase as any).from("campaign_approvals").insert({
      project_id: project.id, created_by: currentUserId,
      title: apprDraft.title.trim(),
      asset_url: apprDraft.asset_url || null,
    });
    if (error) return toast({ title: "Couldn't submit", description: error.message, variant: "destructive" });
    setApprDraft({ title: "", asset_url: "" });
    setOpenAppr(false);
    await loadAll();
  };

  const decide = async (a: Approval, status: string, feedback?: string) => {
    const { error } = await (supabase as any).from("campaign_approvals").update({
      status, feedback: feedback ?? a.feedback, reviewer_id: currentUserId, decided_at: new Date().toISOString(),
    }).eq("id", a.id);
    if (error) return toast({ title: "Couldn't update", description: error.message, variant: "destructive" });
    toast({ title: status === "approved" ? "Approved" : status === "changes_requested" ? "Changes requested" : "Updated" });
    setFeedbackFor(null); setFeedbackText("");
    await loadAll();
  };

  const pendingCount = approvals.filter((a) => a.status === "pending").length;

  return (
    <section className="px-4 py-5 lg:px-0">
      <div className="flex items-center gap-2 mb-3">
        <span className="h-8 w-8 rounded-xl bg-primary/12 text-primary flex items-center justify-center">
          <Megaphone className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-sm font-bold leading-tight">Campaign Studio</h3>
          <p className="text-[11px] text-muted-foreground leading-tight">Brand brief, asset matrix, paid + organic — one room.</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="brief" className="text-[11px]"><FileText className="h-3 w-3 mr-1" />Brief</TabsTrigger>
          <TabsTrigger value="matrix" className="text-[11px]"><LayoutGrid className="h-3 w-3 mr-1" />Matrix</TabsTrigger>
          <TabsTrigger value="approvals" className="text-[11px]">
            <CheckSquare className="h-3 w-3 mr-1" />Approve
            {pendingCount > 0 && (
              <span className="ml-1 text-[9px] bg-[hsl(var(--energy)/0.2)] text-[hsl(var(--energy))] px-1 rounded">{pendingCount}</span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* BRIEF */}
        <TabsContent value="brief" className="mt-3 space-y-2">
          <Input placeholder="Brand name" value={briefDraft.brand_name} onChange={(e) => setBriefDraft({ ...briefDraft, brand_name: e.target.value })} className="text-sm" />
          <Input placeholder="Objective (e.g., drive 5k signups in 6 weeks)" value={briefDraft.objective} onChange={(e) => setBriefDraft({ ...briefDraft, objective: e.target.value })} className="text-sm" />
          <Input placeholder="Audience" value={briefDraft.audience} onChange={(e) => setBriefDraft({ ...briefDraft, audience: e.target.value })} className="text-sm" />
          <Input placeholder="Tone (e.g., bold, witty, premium)" value={briefDraft.tone} onChange={(e) => setBriefDraft({ ...briefDraft, tone: e.target.value })} className="text-sm" />
          <Textarea placeholder="Key messages (one per line)" rows={3} value={briefDraft.key_messages} onChange={(e) => setBriefDraft({ ...briefDraft, key_messages: e.target.value })} className="text-sm" />
          <Textarea placeholder="Brand guidelines / do's and don'ts" rows={3} value={briefDraft.guidelines} onChange={(e) => setBriefDraft({ ...briefDraft, guidelines: e.target.value })} className="text-sm" />
          <Textarea placeholder="KPIs (one per line)" rows={2} value={briefDraft.kpis} onChange={(e) => setBriefDraft({ ...briefDraft, kpis: e.target.value })} className="text-sm" />
          <Input placeholder="Budget" type="number" value={briefDraft.budget} onChange={(e) => setBriefDraft({ ...briefDraft, budget: e.target.value })} className="text-sm" />
          <div className="flex gap-2">
            <Button size="sm" onClick={saveBrief} disabled={savingBrief} className="flex-1">
              {savingBrief ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
              {brief ? "Update brief" : "Save brief"}
            </Button>
            <Button size="sm" variant="outline" onClick={generateMatrix} disabled={genMatrix} className="flex-1">
              {genMatrix ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
              Draft matrix
            </Button>
          </div>
          {brief && <p className="text-[10px] text-muted-foreground">Brief v{brief.version}</p>}
        </TabsContent>

        {/* MATRIX */}
        <TabsContent value="matrix" className="mt-3 space-y-2">
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setOpenAsset(true)} className="flex-1">
              <Plus className="h-3.5 w-3.5 mr-1" /> Asset
            </Button>
            <Button size="sm" onClick={generateMatrix} disabled={genMatrix} className="flex-1">
              {genMatrix ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
              Draft from brief
            </Button>
          </div>
          {assets.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/80 p-5 text-center">
              <p className="text-sm font-semibold">No assets yet</p>
              <p className="text-xs text-muted-foreground mt-0.5">Save a brief and let Thrive draft a paid + organic matrix.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {assets.map((a) => (
                <li key={a.id} className="rounded-xl border border-border/60 bg-card/40 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-tight">{a.deliverable}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                        {a.platform && <span className="capitalize">{a.platform}</span>}
                        {a.format && <span>· {a.format}</span>}
                        {a.due_date && <span>· due {a.due_date}</span>}
                      </div>
                      {a.notes && <p className="mt-1 text-[11px] text-muted-foreground">{a.notes}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge className={`text-[10px] uppercase ${CHANNEL_TONE[a.channel] || ""}`}>{a.channel}</Badge>
                      <Badge className={`text-[10px] uppercase ${ASSET_STATUS_TONE[a.status] || ""}`}>{a.status.replace("_", " ")}</Badge>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <select value={a.status} onChange={(e) => setAssetStatus(a.id, e.target.value)}
                      className="text-[10px] uppercase bg-transparent border border-border/60 rounded px-1.5 py-0.5 text-muted-foreground">
                      <option value="idea">Idea</option>
                      <option value="in_progress">In progress</option>
                      <option value="review">Review</option>
                      <option value="approved">Approved</option>
                      <option value="scheduled">Scheduled</option>
                      <option value="published">Published</option>
                    </select>
                    <button onClick={() => delAsset(a.id)} className="ml-auto text-muted-foreground hover:text-destructive">
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
              <p className="text-sm font-semibold">No approvals yet</p>
              <p className="text-xs text-muted-foreground mt-0.5">Send creative for sign-off when ready.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {approvals.map((a) => (
                <li key={a.id} className="rounded-xl border border-border/60 bg-card/40 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-tight">{a.title}</p>
                      {a.asset_url && (
                        <a href={a.asset_url} target="_blank" rel="noreferrer" className="text-[11px] text-primary hover:underline break-all">
                          {a.asset_url}
                        </a>
                      )}
                      {a.feedback && <p className="mt-1 text-[11px] text-muted-foreground italic">"{a.feedback}"</p>}
                    </div>
                    <Badge className={`text-[10px] uppercase shrink-0 ${a.status === "approved" ? "bg-white/15 text-white font-semibold" : a.status === "changes_requested" ? "bg-primary/15 text-primary" : a.status === "rejected" ? "bg-muted text-muted-foreground" : "bg-[hsl(var(--energy)/0.15)] text-[hsl(var(--energy))]"}`}>
                      {a.status.replace("_", " ")}
                    </Badge>
                  </div>
                  {a.status === "pending" && (
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => decide(a, "approved")}>
                        <Check className="h-3 w-3 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => { setFeedbackFor(a); setFeedbackText(""); }}>
                        <X className="h-3 w-3 mr-1" /> Changes
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      {/* Add Asset Dialog */}
      <Dialog open={openAsset} onOpenChange={setOpenAsset}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New asset</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Input placeholder="Deliverable (e.g., Launch reel)" value={assetDraft.deliverable} onChange={(e) => setAssetDraft({ ...assetDraft, deliverable: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Platform" value={assetDraft.platform} onChange={(e) => setAssetDraft({ ...assetDraft, platform: e.target.value })} />
              <Input placeholder="Format" value={assetDraft.format} onChange={(e) => setAssetDraft({ ...assetDraft, format: e.target.value })} />
            </div>
            <select value={assetDraft.channel} onChange={(e) => setAssetDraft({ ...assetDraft, channel: e.target.value })}
              className="w-full text-sm bg-transparent border border-border rounded-md px-3 py-2">
              <option value="organic">Organic</option>
              <option value="paid">Paid</option>
              <option value="both">Both</option>
            </select>
            <Input type="date" value={assetDraft.due_date} onChange={(e) => setAssetDraft({ ...assetDraft, due_date: e.target.value })} />
            <Textarea placeholder="Notes" rows={2} value={assetDraft.notes} onChange={(e) => setAssetDraft({ ...assetDraft, notes: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenAsset(false)}>Cancel</Button>
            <Button onClick={addAsset}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submit Approval Dialog */}
      <Dialog open={openAppr} onOpenChange={setOpenAppr}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Submit for approval</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Input placeholder="Title (e.g., Launch reel v2)" value={apprDraft.title} onChange={(e) => setApprDraft({ ...apprDraft, title: e.target.value })} />
            <Input placeholder="Asset URL (optional)" value={apprDraft.asset_url} onChange={(e) => setApprDraft({ ...apprDraft, asset_url: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenAppr(false)}>Cancel</Button>
            <Button onClick={addApproval}>Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Feedback dialog */}
      <Dialog open={!!feedbackFor} onOpenChange={(o) => !o && setFeedbackFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Request changes</DialogTitle></DialogHeader>
          <Textarea placeholder="What needs to change?" rows={4} value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setFeedbackFor(null)}>Cancel</Button>
            <Button onClick={() => feedbackFor && decide(feedbackFor, "changes_requested", feedbackText)}>Send feedback</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
