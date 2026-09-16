import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Sparkles, Mic, Loader2, Square, PenLine, Lightbulb, ListChecks,
  CheckCircle2, ArrowLeft, Send, Wand2, Upload, FileText, Clock, Users, Mic2,
} from "lucide-react";
import { extractTextFromFile } from "@/lib/extractBriefDocument";
import { StudioComingAliveLoader } from "@/components/onboarding/claim-flow/StudioComingAliveLoader";

interface SmartBriefBuilderProps {
  projectId: string;
  projectTitle: string;
  onSent?: () => void;
}

interface Collab {
  user_id: string;
  display_name: string | null;
  role: string | null;
}

interface ElevatedBrief {
  title: string;
  summary: string;
  objectives: string[];
  audience: string;
  tone: string;
  success_criteria: string[];
  research_notes: string[];
}

interface SuggDeliverable {
  title: string;
  description?: string;
  kind?: string;
  due_offset_days?: number | null;
  suggested_assignee_id?: string | null;
}

interface SuggTask {
  title: string;
  description?: string;
  due_offset_days?: number | null;
  suggested_assignee_id?: string | null;
  priority?: "low" | "normal" | "high";
}

interface RunOfShowItem {
  time?: string | null;
  duration_min?: number | null;
  segment_title: string;
  notes?: string | null;
}
interface SupplierItem { category: string; name: string; notes?: string | null; }
interface TalentItem { role: string; name: string; notes?: string | null; }

async function blobToBase64(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = String(reader.result || "");
      resolve(r.includes(",") ? r.split(",")[1] : r);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

const offsetToISODate = (offset: number | null | undefined): string | null => {
  if (offset == null) return null;
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

export const SmartBriefBuilder = ({ projectId, projectTitle, onSent }: SmartBriefBuilderProps) => {
  const { toast } = useToast();
  const [stage, setStage] = useState<"input" | "review">("input");
  const [tab, setTab] = useState<"type" | "voice" | "upload">("upload");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);

  // voice
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);

  // upload
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadFileName, setUploadFileName] = useState<string | null>(null);
  const [uploadedText, setUploadedText] = useState<string>("");
  const [uploadInfo, setUploadInfo] = useState<string | null>(null);

  // collaborators (assignee dropdowns)
  const [collabs, setCollabs] = useState<Collab[]>([]);

  // elevated result (editable)
  const [brief, setBrief] = useState<ElevatedBrief | null>(null);
  const [deliverables, setDeliverables] = useState<SuggDeliverable[]>([]);
  const [tasks, setTasks] = useState<SuggTask[]>([]);
  const [runOfShow, setRunOfShow] = useState<RunOfShowItem[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [talent, setTalent] = useState<TalentItem[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("project_collaborators")
        .select("user_id, role, agent_role, profiles:user_id(display_name)")
        .eq("project_id", projectId)
        .eq("status", "accepted");
      const list: Collab[] = (data ?? [])
        .filter((r: any) => r.user_id)
        .map((r: any) => ({
          user_id: r.user_id,
          display_name: r.profiles?.display_name ?? null,
          role: r.role ?? r.agent_role ?? null,
        }));

      // include project owner
      const { data: project } = await (supabase as any)
        .from("projects")
        .select("created_by, profiles:created_by(display_name)")
        .eq("id", projectId)
        .maybeSingle();
      if (project?.created_by && !list.find((c) => c.user_id === project.created_by)) {
        list.unshift({
          user_id: project.created_by,
          display_name: (project as any).profiles?.display_name ?? "Project owner",
          role: "owner",
        });
      }
      setCollabs(list);
    })().catch(() => { /* non-blocking */ });
  }, [projectId]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setVoiceBlob(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch {
      toast({ title: "Microphone blocked", description: "Allow mic access to record a brief.", variant: "destructive" });
    }
  };
  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const runElevate = async (payload: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("elevate-brief", { body: payload });
    if (error) throw error;
    if (!data?.elevated_brief) throw new Error("No brief returned");
    setBrief(data.elevated_brief);
    setDeliverables(data.deliverables ?? []);
    setTasks(data.tasks ?? []);
    setRunOfShow(Array.isArray(data.run_of_show) ? data.run_of_show : []);
    setSuppliers(Array.isArray(data.suppliers) ? data.suppliers : []);
    setTalent(Array.isArray(data.talent) ? data.talent : []);
    setStage("review");
  };

  const basePayload = () => ({
    project_title: projectTitle,
    collaborators: collabs.map((c) => ({
      user_id: c.user_id,
      display_name: c.display_name,
      role: c.role,
    })),
  });

  const elevateFromText = async (textBody: string) => {
    setBusy(true);
    try {
      await runElevate({ ...basePayload(), source: "text", text: textBody });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't elevate brief";
      toast({ title: "Smart Brief failed", description: msg, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const elevate = async () => {
    setBusy(true);
    try {
      const payload: Record<string, unknown> = basePayload();
      if (tab === "voice") {
        if (!voiceBlob) throw new Error("Record something first");
        payload.source = "audio";
        payload.data_base64 = await blobToBase64(voiceBlob);
        payload.mime_type = "audio/webm";
      } else if (tab === "upload") {
        if (!uploadedText.trim()) throw new Error("Upload a document first");
        payload.source = "text";
        payload.text = `[Uploaded brief — ${uploadFileName ?? "document"}]\n\n${uploadedText}`;
      } else {
        if (!text.trim()) throw new Error("Type a few words first");
        payload.source = "text";
        payload.text = text;
      }
      await runElevate(payload);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't elevate brief";
      toast({ title: "Smart Brief failed", description: msg, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const onPickFile = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    setUploadInfo(null);
    setUploadError(null);
    try {
      if (file.size > 25 * 1024 * 1024) throw new Error("File too large (max 25 MB)");
      const result = await extractTextFromFile(file);
      if (!result.text.trim()) throw new Error("No readable text found in this document. If it's a scanned PDF, paste the text into the Type tab.");
      setUploadFileName(file.name);
      setUploadedText(result.text);
      setUploadInfo(
        `${file.name} · ${result.pages} page${result.pages === 1 ? "" : "s"}${result.truncated ? " · truncated to fit" : ""}`,
      );
      // Auto-elevate immediately — user shouldn't have to tap a second button
      await elevateFromText(`[Uploaded brief — ${file.name}]\n\n${result.text}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't read file";
      setUploadError(msg);
      toast({ title: "Upload failed", description: msg, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const updateTask = (i: number, patch: Partial<SuggTask>) => {
    setTasks((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  };
  const updateDeliverable = (i: number, patch: Partial<SuggDeliverable>) => {
    setDeliverables((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  };
  const removeTask = (i: number) => setTasks((prev) => prev.filter((_, idx) => idx !== i));
  const removeDeliverable = (i: number) => setDeliverables((prev) => prev.filter((_, idx) => idx !== i));

  const sendToTeam = async () => {
    if (!brief) return;
    setSending(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const me = userRes?.user?.id;
      if (!me) throw new Error("Not signed in");

      // 1. Save deliverables to the board
      if (deliverables.length) {
        const rows = deliverables
          .filter((d) => d.title.trim())
          .map((d, i) => ({
            project_id: projectId,
            title: d.title.trim().slice(0, 200),
            description: d.description ?? null,
            status: "pending",
            version: 1,
            source: "ai-elevated",
            kind: d.kind ?? "other",
            sort_order: i,
            due_date: offsetToISODate(d.due_offset_days),
            submitted_by: me,
            assignee_id: d.suggested_assignee_id || null,
            moodboard: [] as never,
          }));
        if (rows.length) {
          const { error } = await supabase.from("project_deliverables").insert(rows as never);
          if (error) throw error;
        }
      }

      // 2. Save tasks (auto-assigned)
      if (tasks.length) {
        const taskRows = tasks
          .filter((t) => t.title.trim())
          .map((t) => ({
            project_id: projectId,
            title: t.title.trim().slice(0, 200),
            description: t.description ?? null,
            status: "todo",
            priority: t.priority ?? "normal",
            assigned_to: t.suggested_assignee_id || null,
            created_by: me,
            due_date: offsetToISODate(t.due_offset_days)
              ? new Date(offsetToISODate(t.due_offset_days)!).toISOString()
              : null,
            labels: ["smart-brief"],
          }));
        if (taskRows.length) {
          const { error } = await supabase.from("project_tasks").insert(taskRows as never);
          if (error) throw error;
        }
      }

      // 3. Run of show
      if (runOfShow.length) {
        const rosRows = runOfShow
          .filter((r) => r.segment_title?.trim())
          .map((r, i) => ({
            project_id: projectId,
            created_by: me,
            segment_title: r.segment_title.trim().slice(0, 200),
            time_slot: r.time && /^\d{1,2}:\d{2}$/.test(r.time) ? `${r.time}:00` : null,
            duration_min: r.duration_min ?? null,
            notes: r.notes ?? null,
            position: i,
          }));
        if (rosRows.length) {
          await supabase.from("project_run_of_show").insert(rosRows as never).then(() => {}, () => {});
        }
      }

      // 4. Suppliers
      if (suppliers.length) {
        const supRows = suppliers
          .filter((s) => s.name?.trim())
          .map((s) => ({
            project_id: projectId,
            created_by: me,
            category: s.category || "other",
            name: s.name.trim().slice(0, 200),
            notes: s.notes ?? null,
            status: "lead",
          }));
        if (supRows.length) {
          await supabase.from("event_suppliers").insert(supRows as never).then(() => {}, () => {});
        }
      }

      // 5. Talent
      if (talent.length) {
        const tRows = talent
          .filter((t) => t.name?.trim())
          .map((t) => ({
            project_id: projectId,
            created_by: me,
            role: t.role || "performer",
            name: t.name.trim().slice(0, 200),
            notes: t.notes ?? null,
            status: "invited",
          }));
        if (tRows.length) {
          await supabase.from("event_talent").insert(tRows as never).then(() => {}, () => {});
        }
      }

      // 6. Save the elevated brief itself as a project note for reference
      await supabase
        .from("project_notes")
        .insert({
          project_id: projectId,
          created_by: me,
          title: `Brief: ${brief.title}`,
          content: [
            `**Summary**\n${brief.summary}`,
            `**Audience**\n${brief.audience}`,
            `**Tone & direction**\n${brief.tone}`,
            `**Objectives**\n${brief.objectives.map((o) => `• ${o}`).join("\n")}`,
            `**Success criteria**\n${brief.success_criteria.map((s) => `• ${s}`).join("\n")}`,
            brief.research_notes.length
              ? `**Research notes**\n${brief.research_notes.map((r) => `• ${r}`).join("\n")}`
              : "",
          ]
            .filter(Boolean)
            .join("\n\n"),
        } as never)
        .then(() => {}, () => { /* notes table optional — don't block */ });

      // 7. Notify each unique assignee that work was assigned
      const assignees = new Set<string>();
      tasks.forEach((t) => t.suggested_assignee_id && t.suggested_assignee_id !== me && assignees.add(t.suggested_assignee_id));
      deliverables.forEach((d) => d.suggested_assignee_id && d.suggested_assignee_id !== me && assignees.add(d.suggested_assignee_id));
      if (assignees.size) {
        const notifs = Array.from(assignees).map((uid) => ({
          user_id: uid,
          type: "brief_assigned",
          title: "New brief from your collaborator",
          message: `"${brief.title}" — tasks and deliverables are ready for you in ${projectTitle}`,
          action_url: `/desk/${projectId}`,
          action_text: "Open brief",
          category: "project",
          priority: "high",
        }));
        await supabase.from("notifications").insert(notifs as never).then(() => {}, () => {});
      }

      const extras: string[] = [];
      if (runOfShow.length) extras.push(`${runOfShow.length} run-of-show items`);
      if (suppliers.length) extras.push(`${suppliers.length} suppliers`);
      if (talent.length) extras.push(`${talent.length} talent`);
      toast({
        title: "Brief sent",
        description: [
          `${tasks.length} tasks · ${deliverables.length} deliverables`,
          extras.length ? extras.join(" · ") : null,
          "Assignees notified.",
        ].filter(Boolean).join(" · "),
      });
      // reset
      setStage("input");
      setText("");
      setVoiceBlob(null);
      setUploadedText("");
      setUploadFileName(null);
      setUploadInfo(null);
      setBrief(null);
      setTasks([]);
      setDeliverables([]);
      setRunOfShow([]);
      setSuppliers([]);
      setTalent([]);
      onSent?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't send brief";
      toast({ title: "Save failed", description: msg, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  // ---------- INPUT STAGE ----------
  if (stage === "input") {
    return (
      <Card>
        <CardContent className="pt-5 sm:pt-6 px-4 sm:px-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Wand2 className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold">Smart Brief</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Drop a plan, type the rough idea, or speak it. We'll polish the brief, generate
                tasks, and route them to the right people.
              </p>
            </div>
          </div>

          {busy && (
            <div className="mb-4 animate-fade-in">
              <StudioComingAliveLoader />
              <p className="text-xs text-center text-muted-foreground mt-2">
                Reading your document and shaping the studio…
              </p>
            </div>
          )}

          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="upload" className="gap-1.5"><Upload className="h-3.5 w-3.5" />Upload</TabsTrigger>
              <TabsTrigger value="type" className="gap-1.5"><PenLine className="h-3.5 w-3.5" />Type</TabsTrigger>
              <TabsTrigger value="voice" className="gap-1.5"><Mic className="h-3.5 w-3.5" />Voice</TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="space-y-3 pt-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.md,.markdown,.csv,application/pdf,text/plain,text/markdown,text/csv"
                className="hidden"
                onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
              />
              <div
                className={`flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed rounded-xl transition-colors ${busy ? "opacity-50 pointer-events-none" : "cursor-pointer hover:border-primary/60 hover:bg-primary/5"}`}
                onClick={() => !busy && fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); }}
                onDrop={(e) => { e.preventDefault(); if (!busy) onPickFile(e.dataTransfer.files?.[0] ?? null); }}
              >
                {uploadFileName && !uploadError ? (
                  <>
                    <FileText className="h-10 w-10 text-primary" />
                    <p className="text-sm font-semibold text-center">{uploadFileName}</p>
                    {uploadInfo && <p className="text-xs text-muted-foreground text-center">{uploadInfo}</p>}
                    <Button variant="outline" size="sm" disabled={busy} onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                      Choose another file
                    </Button>
                  </>
                ) : (
                  <>
                    <Upload className="h-10 w-10 text-primary" />
                    <p className="text-base font-semibold text-center">Drop a brief, plan, or PDF here</p>
                    <p className="text-xs text-muted-foreground text-center max-w-sm">
                      Already used another AI to plan this? Drop the doc — we'll spread it across
                      the studio: brief, tasks, deliverables, run-of-show, suppliers & talent.
                    </p>
                    <Button variant="default" size="sm">Browse files</Button>
                  </>
                )}
              </div>
              {uploadError && (
                <div className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md p-2.5">
                  {uploadError}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground text-center">
                Supported: PDF, .txt, .md, .csv · max 25 MB · auto-organizes on drop
              </p>
            </TabsContent>

            <TabsContent value="type" className="space-y-3 pt-4">
              <Textarea
                placeholder="e.g. 'Need a podcast launch campaign — 3 IG reels, a teaser trailer, cover art. Drop date May 20.'"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={5}
                maxLength={3000}
              />
              <Button onClick={elevate} disabled={busy || !text.trim()} className="w-full">
                {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Elevate this brief
              </Button>
            </TabsContent>

            <TabsContent value="voice" className="space-y-3 pt-4">
              <div className="flex flex-col items-center justify-center gap-3 p-6 border-2 border-dashed rounded-lg">
                {!recording ? (
                  <Button onClick={startRecording} variant="outline" size="lg" className="gap-2">
                    <Mic className="h-5 w-5" /> Start recording
                  </Button>
                ) : (
                  <Button onClick={stopRecording} variant="destructive" size="lg" className="gap-2">
                    <Square className="h-5 w-5" /> Stop
                  </Button>
                )}
                {voiceBlob && !recording && (
                  <>
                    <audio controls src={URL.createObjectURL(voiceBlob)} className="w-full" />
                    <Button onClick={elevate} disabled={busy} className="w-full">
                      {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                      Elevate this brief
                    </Button>
                  </>
                )}
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Speak naturally — what you need, who it's for, deadlines.
              </p>
            </TabsContent>
          </Tabs>

          {collabs.length === 0 && (
            <div className="mt-4 text-xs text-muted-foreground bg-muted/30 rounded-md p-3">
              💡 Tip: Invite a collaborator first so we can auto-assign tasks to them.
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // ---------- REVIEW STAGE ----------
  const summaryRows = [
    { label: "Tasks", n: tasks.length, where: "Studio feed" },
    { label: "Deliverables", n: deliverables.length, where: "Vault → Deliverables" },
    { label: "Run of show", n: runOfShow.length, where: "Event → Run of show" },
    { label: "Suppliers", n: suppliers.length, where: "Event → Suppliers" },
    { label: "Talent", n: talent.length, where: "Event → Talent" },
  ].filter((r) => r.n > 0);

  return (
    <div className="space-y-4">
      {/* What we did — at-a-glance */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent animate-fade-in">
        <CardContent className="pt-5 px-4 sm:px-6">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Here's what landed in your studio</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Review and tweak below, then tap <span className="font-medium">Send brief</span> to push everything live.
          </p>
          {summaryRows.length > 0 ? (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {summaryRows.map((r) => (
                <li key={r.label} className="flex items-center gap-2 text-xs">
                  <Badge variant="secondary" className="rounded-full font-bold tabular-nums min-w-[28px] justify-center">{r.n}</Badge>
                  <span className="font-medium">{r.label}</span>
                  <span className="text-muted-foreground">→ {r.where}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">Just the brief — no tasks or deliverables generated.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5 sm:pt-6 px-4 sm:px-6">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setStage("input")} className="gap-1.5 -ml-2">
                <ArrowLeft className="h-4 w-4" /> Edit input
              </Button>
            </div>
            <Badge variant="secondary" className="gap-1"><Sparkles className="h-3 w-3" /> Elevated</Badge>
          </div>

          {brief && (
            <div className="space-y-3">
              <Input
                value={brief.title}
                onChange={(e) => setBrief({ ...brief, title: e.target.value })}
                className="text-base font-semibold"
              />
              <Textarea
                value={brief.summary}
                onChange={(e) => setBrief({ ...brief, summary: e.target.value })}
                rows={2}
                className="text-sm"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Audience</label>
                  <Input value={brief.audience} onChange={(e) => setBrief({ ...brief, audience: e.target.value })} className="text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Tone</label>
                  <Input value={brief.tone} onChange={(e) => setBrief({ ...brief, tone: e.target.value })} className="text-sm" />
                </div>
              </div>

              {brief.research_notes.length > 0 && (
                <div className="rounded-md bg-primary/5 border border-primary/20 p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Lightbulb className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-semibold">Research notes</span>
                  </div>
                  <ul className="text-xs space-y-1 text-muted-foreground">
                    {brief.research_notes.map((r, i) => <li key={i}>• {r}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tasks */}
      {tasks.length > 0 && (
        <Card>
          <CardContent className="pt-5 sm:pt-6 px-4 sm:px-6">
            <div className="flex items-center gap-2 mb-3">
              <ListChecks className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">Tasks ({tasks.length})</h3>
              <Badge variant="outline" className="text-[10px] ml-auto">Auto-assigned</Badge>
            </div>
            <ScrollArea className="max-h-[40vh] pr-2">
              <div className="space-y-2">
                {tasks.map((t, i) => (
                  <div key={i} className="rounded-md border p-3 space-y-2 bg-card">
                    <div className="flex items-start gap-2">
                      <Input
                        value={t.title}
                        onChange={(e) => updateTask(i, { title: e.target.value })}
                        className="text-sm font-medium flex-1"
                      />
                      <Button variant="ghost" size="sm" onClick={() => removeTask(i)} className="h-8 px-2 text-muted-foreground">×</Button>
                    </div>
                    {t.description && (
                      <p className="text-xs text-muted-foreground">{t.description}</p>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <Select
                        value={t.suggested_assignee_id ?? "unassigned"}
                        onValueChange={(v) => updateTask(i, { suggested_assignee_id: v === "unassigned" ? null : v })}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Assignee" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {collabs.map((c) => (
                            <SelectItem key={c.user_id} value={c.user_id}>
                              {c.display_name ?? "Collaborator"} {c.role && `· ${c.role}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={t.priority ?? "normal"}
                        onValueChange={(v) => updateTask(i, { priority: v as "low" | "normal" | "high" })}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low priority</SelectItem>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="high">High priority</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Deliverables */}
      {deliverables.length > 0 && (
        <Card>
          <CardContent className="pt-5 sm:pt-6 px-4 sm:px-6">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">Deliverables ({deliverables.length})</h3>
            </div>
            <ScrollArea className="max-h-[40vh] pr-2">
              <div className="space-y-2">
                {deliverables.map((d, i) => (
                  <div key={i} className="rounded-md border p-3 space-y-2 bg-card">
                    <div className="flex items-start gap-2">
                      <Input
                        value={d.title}
                        onChange={(e) => updateDeliverable(i, { title: e.target.value })}
                        className="text-sm font-medium flex-1"
                      />
                      <Button variant="ghost" size="sm" onClick={() => removeDeliverable(i)} className="h-8 px-2 text-muted-foreground">×</Button>
                    </div>
                    {d.description && (
                      <p className="text-xs text-muted-foreground">{d.description}</p>
                    )}
                    <Select
                      value={d.suggested_assignee_id ?? "unassigned"}
                      onValueChange={(v) => updateDeliverable(i, { suggested_assignee_id: v === "unassigned" ? null : v })}
                    >
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Assignee" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {collabs.map((c) => (
                          <SelectItem key={c.user_id} value={c.user_id}>
                            {c.display_name ?? "Collaborator"} {c.role && `· ${c.role}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Run of show */}
      {runOfShow.length > 0 && (
        <Card>
          <CardContent className="pt-5 sm:pt-6 px-4 sm:px-6">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">Run of show ({runOfShow.length})</h3>
              <Badge variant="outline" className="text-[10px] ml-auto">From document</Badge>
            </div>
            <ScrollArea className="max-h-[40vh] pr-2">
              <ol className="space-y-1.5">
                {runOfShow.map((r, i) => (
                  <li key={i} className="rounded-md border bg-card px-3 py-2 flex items-start gap-3">
                    <span className="text-xs font-mono w-12 shrink-0 text-muted-foreground pt-0.5">
                      {r.time ?? "—"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-snug">{r.segment_title}</p>
                      {r.notes && <p className="text-xs text-muted-foreground mt-0.5">{r.notes}</p>}
                    </div>
                    {r.duration_min ? (
                      <span className="text-[10px] text-muted-foreground shrink-0 pt-0.5">{r.duration_min}m</span>
                    ) : null}
                  </li>
                ))}
              </ol>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {(suppliers.length > 0 || talent.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {suppliers.length > 0 && (
            <Card>
              <CardContent className="pt-5 px-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">Suppliers ({suppliers.length})</h3>
                </div>
                <ul className="space-y-1.5">
                  {suppliers.map((s, i) => (
                    <li key={i} className="text-xs">
                      <span className="font-medium">{s.name}</span>
                      <span className="text-muted-foreground"> · {s.category}</span>
                      {s.notes && <p className="text-[11px] text-muted-foreground mt-0.5">{s.notes}</p>}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          {talent.length > 0 && (
            <Card>
              <CardContent className="pt-5 px-4">
                <div className="flex items-center gap-2 mb-2">
                  <Mic2 className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">Talent ({talent.length})</h3>
                </div>
                <ul className="space-y-1.5">
                  {talent.map((t, i) => (
                    <li key={i} className="text-xs">
                      <span className="font-medium">{t.name}</span>
                      <span className="text-muted-foreground"> · {t.role}</span>
                      {t.notes && <p className="text-[11px] text-muted-foreground mt-0.5">{t.notes}</p>}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div className="sticky bottom-2 z-10">
        <Button onClick={sendToTeam} disabled={sending || !brief} size="lg" className="w-full shadow-lg">
          {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
          Send brief & assign work
        </Button>
      </div>
    </div>
  );
};
