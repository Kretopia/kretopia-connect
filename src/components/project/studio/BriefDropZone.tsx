import { useRef, useState } from "react";
import { Upload, Loader2, X, Link2, Sparkles, AlertCircle, ImagePlus, Mic, Send, FileEdit, ArrowRight, MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { extractTextFromFile, compressImage, fileToBase64 } from "@/lib/extractBriefDocument";
import { StudioComingAliveLoader } from "@/components/onboarding/claim-flow/StudioComingAliveLoader";

interface BriefDropZoneProps {
  projectId: string;
  projectTitle: string;
  isOwner: boolean;
  onIngested: () => void;
}

interface IngestSummary {
  fileName: string;
  brief?: string;
  tasks: number;
  deliverables: number;
  runOfShow: number;
  suppliers: number;
  talent: number;
  facts: number;
  entities: number;
}

/** A brief `elevate-brief` drafted from an upload, held for review before
 * any of it touches the Project — see the Drop Zone review gate below. */
interface PendingElevation {
  fileName: string;
  brief: { title: string; summary: string; audience?: string; tone?: string };
  tasks: Array<{ title: string; description?: string; due_offset_days?: number | null; suggested_assignee_id?: string | null; priority?: string }>;
  deliverables: Array<{ title: string; description?: string; kind?: string; due_offset_days?: number | null; suggested_assignee_id?: string | null }>;
  runOfShow: Array<{ segment_title: string; time?: string; duration_min?: number | null; notes?: string | null }>;
  suppliers: Array<{ category: string; name: string; notes?: string | null }>;
  talent: Array<{ role: string; name: string; notes?: string | null }>;
}

const offsetToISODate = (offset: number | null | undefined): string | null => {
  if (offset == null) return null;
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

const TEXT_EXTS = /\.(pdf|txt|md|markdown|csv)$/i;

/**
 * Studio drop zone — the unified entry point. Drop anything (plan, contract,
 * budget, sponsor deck, voice note, photos, paste a link) and we route it
 * through `studio-ingest` so it lands in the Studio Brain as reusable facts
 * and entities. Text-shaped documents (PDF/MD/CSV/TXT) are also elevated
 * via `elevate-brief` to populate tasks, deliverables, run-of-show etc.
 */
export const BriefDropZone = ({
  projectId,
  projectTitle,
  isOwner,
  onIngested,
}: BriefDropZoneProps) => {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<IngestSummary | null>(null);
  const [pendingElevation, setPendingElevation] = useState<PendingElevation | null>(null);
  const [applyingElevation, setApplyingElevation] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [showLink, setShowLink] = useState(false);
  const [open, setOpen] = useState(false);
  const [draftText, setDraftText] = useState("");

  if (!isOwner) return null;

  const sourceKindFor = (file: File): string => {
    const n = file.name.toLowerCase();
    const t = file.type.toLowerCase();
    if (t.startsWith("image/")) return "image";
    if (t.startsWith("audio/") || /\.(m4a|mp3|wav|webm|ogg)$/.test(n)) return "voice";
    if (n.endsWith(".pdf") || t === "application/pdf") return "pdf";
    if (n.endsWith(".eml") || n.endsWith(".msg")) return "email";
    if (/budget|invoice|quote/.test(n)) return "budget";
    if (/contract|agreement|nda|sow/.test(n)) return "contract";
    if (/deck|pitch|sponsor|proposal/.test(n)) return "deck";
    return "brief";
  };

  const callIngest = async (payload: Record<string, unknown>) => {
    const { data, error: invErr } = await supabase.functions.invoke("studio-ingest", {
      body: { project_id: projectId, project_title: projectTitle, ...payload },
    });
    if (invErr) throw invErr;
    if (data?.error) throw new Error(String(data.error));
    return data ?? { facts: 0, entities: 0 };
  };

  const ingestFile = async (file: File | null) => {
    if (!file) return;
    setError(null);
    setSummary(null);
    setBusy(true);
    try {
      if (file.size > 25 * 1024 * 1024) throw new Error("File too large (max 25 MB)");

      const isImage = file.type.startsWith("image/");
      const isAudio = file.type.startsWith("audio/") || /\.(m4a|mp3|wav|webm|ogg)$/i.test(file.name);
      const isTextDoc = TEXT_EXTS.test(file.name) || file.type === "application/pdf" || file.type.startsWith("text/");
      const source_kind = sourceKindFor(file);

      let elevated: any = null;
      let extractedText = "";
      let visionPayload: { image_base64?: string; image_mime?: string } = {};
      let audioPayload: { audio_base64?: string; audio_mime?: string } = {};

      if (isImage) {
        // Phase D — route images through vision extraction
        const { base64, mime } = await compressImage(file);
        visionPayload = { image_base64: base64, image_mime: mime };
        extractedText = "";
      } else if (isAudio) {
        // Phase D+ — voice notes go straight to Gemini audio
        if (file.size > 15 * 1024 * 1024) throw new Error("Audio too large (max 15 MB)");
        const base64 = await fileToBase64(file);
        audioPayload = { audio_base64: base64, audio_mime: file.type || "audio/webm" };
        extractedText = "";
      } else if (isTextDoc) {
        try {
          const extracted = await extractTextFromFile(file);
          extractedText = extracted.text.trim();
        } catch {
          extractedText = "";
        }

        // Scanned PDF fallback — render first page as image and route through
        // vision so a scanned deck never hard-fails.
        if (!extractedText && file.type === "application/pdf") {
          try {
            const { renderPdfFirstPageToImage } = await import("@/lib/extractBriefDocument");
            const img = await renderPdfFirstPageToImage(file);
            visionPayload = { image_base64: img.base64, image_mime: img.mime };
          } catch {
            throw new Error("Couldn't read this PDF. Try a screenshot or a text-based export.");
          }
        } else if (!extractedText) {
          throw new Error("No readable text found.");
        }

        // Brief-elevation path for plan-like documents only
        if (extractedText && (source_kind === "brief" || source_kind === "pdf")) {
          const { data, error: elevateErr } = await supabase.functions.invoke("elevate-brief", {
            body: {
              source: "text",
              text: `[Uploaded — ${file.name}]\n\n${extractedText}`,
              project_title: projectTitle,
            },
          });
          if (!elevateErr && data?.elevated_brief) elevated = data;
        }
      } else if (file.type.startsWith("text/") || /\.(csv|tsv|md|txt|json|yml|yaml)$/i.test(file.name)) {
        // Plain text-ish files not caught by TEXT_EXTS — read as text.
        try {
          extractedText = (await file.text()).slice(0, 200_000);
        } catch {
          extractedText = `[${source_kind} drop — ${file.name}]`;
        }
      } else {
        // other — let downstream classify; pass a hint string
        extractedText = `[${source_kind} drop — ${file.name}]`;
      }


      // 1. Brief elevation — REVIEW GATE (Studio overhaul v2, Drop Zone
      // security risk #2). This used to write tasks/deliverables/run-of-
      // show/suppliers/talent/description/notes straight to the DB the
      // moment elevate-brief returned. Now it's only staged in
      // pendingElevation; nothing here touches the Project until the user
      // explicitly clicks "Add to Project" (see applyElevation below).
      let stagedElevation: PendingElevation | null = null;
      if (elevated?.elevated_brief) {
        const brief = elevated.elevated_brief;
        stagedElevation = {
          fileName: file.name,
          brief: { title: brief.title, summary: brief.summary, audience: brief.audience, tone: brief.tone },
          tasks: Array.isArray(elevated.tasks) ? elevated.tasks : [],
          deliverables: Array.isArray(elevated.deliverables) ? elevated.deliverables : [],
          runOfShow: Array.isArray(elevated.run_of_show) ? elevated.run_of_show : [],
          suppliers: Array.isArray(elevated.suppliers) ? elevated.suppliers : [],
          talent: Array.isArray(elevated.talent) ? elevated.talent : [],
        };
      }

      // 2. Studio Brain — record facts + entities (always)
      let brainErr: string | null = null;
      const brainRes = await callIngest({
        source_kind,
        text: extractedText || undefined,
        file_name: file.name,
        hint: elevated?.elevated_brief?.title,
        ...visionPayload,
        ...audioPayload,
      }).catch((err) => {
        console.error("studio-ingest failed", err);
        brainErr = err?.message || "Brain didn't update";
        return { facts: 0, entities: 0 };
      });

      // Phase F — also file the drop into the Vault so the original lives
      // alongside the Brain's extracted facts. Without this, PDFs/docs get
      // parsed into facts/entities and then thrown away — they never appear
      // in the Vault. Images go in too (as moodboard refs).
      try {
        const { data: userRes } = await supabase.auth.getUser();
        const me = userRes?.user?.id;
        if (me) {
          const ext = file.name.split(".").pop() || "bin";
          const path = `${projectId}/drop-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("project-files")
            .upload(path, file, {
              cacheControl: "3600",
              upsert: false,
              contentType: file.type || undefined,
            });
          if (!upErr) {
            const { data: inserted } = await supabase
              .from("project_files")
              .insert({
                project_id: projectId,
                user_id: me,
                file_name: file.name,
                file_url: path,
                file_type: isImage ? "image" : (file.type || "application/octet-stream"),
                file_size: file.size,
              } as never)
              .select("id")
              .maybeSingle();
            // Route non-image drops into the right Vault folder.
            if (inserted?.id && !isImage) {
              supabase.functions
                .invoke("route-vault-file", {
                  body: { project_id: projectId, file_id: inserted.id },
                })
                .catch(() => {});
            }
          } else {
            console.warn("[dropzone] vault upload failed", upErr);
          }
        }
      } catch (e) {
        console.warn("[dropzone] vault archive failed", e);
      }



      if (brainErr) {
        toast({ title: "Brain didn't fully update", description: brainErr, variant: "destructive" });
      }
      // Notify any open Brain panels to refresh counts/lists.
      window.dispatchEvent(new CustomEvent("studio-brain:updated", { detail: { projectId } }));
      // Vault file + Brain facts/entities already landed above -- refresh
      // now. Tasks/deliverables/etc from a staged elevation have NOT been
      // written yet; that refresh happens again in applyElevation() once
      // the user confirms.
      onIngested();

      if (stagedElevation) {
        // Hold the review gate instead of the auto-confirmed summary panel.
        setPendingElevation(stagedElevation);
        toast({ title: "Kreto drafted a brief", description: "Review it below before it's added to your Project." });
      } else {
        setSummary({
          fileName: file.name,
          tasks: 0, deliverables: 0, runOfShow: 0, suppliers: 0, talent: 0,
          facts: brainRes.facts ?? 0,
          entities: brainRes.entities ?? 0,
        });
        if (!brainErr) {
          toast({
            title: "Studio Brain updated",
            description: `${brainRes.facts ?? 0} facts · ${brainRes.entities ?? 0} entities remembered`,
          });
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't process drop";
      setError(msg);
      toast({ title: "Drop failed", description: msg, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  /** Explicit confirmation — writes exactly what pendingElevation staged
   * (title/summary → projects.description, plus tasks/deliverables/run-of-
   * show/suppliers/talent/a brief note), the same shape the old inline
   * code wrote, just gated behind a real user decision now. */
  const applyElevation = async () => {
    if (!pendingElevation) return;
    setApplyingElevation(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const me = userRes?.user?.id;
      if (!me) throw new Error("Not signed in");
      const { brief, tasks, deliverables, runOfShow, suppliers, talent } = pendingElevation;

      const briefText = [brief.summary, "", `Audience: ${brief.audience}`, `Tone: ${brief.tone}`].filter(Boolean).join("\n");
      await supabase.from("projects").update({ description: briefText.slice(0, 4000) }).eq("id", projectId);

      if (tasks.length) {
        const rows = tasks.filter((t) => t.title?.trim()).map((t) => ({
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
        if (rows.length) await supabase.from("project_tasks").insert(rows as never).then(() => {}, () => {});
      }
      if (deliverables.length) {
        const rows = deliverables.filter((d) => d.title?.trim()).map((d, i) => ({
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
        if (rows.length) await supabase.from("project_deliverables").insert(rows as never).then(() => {}, () => {});
      }
      if (runOfShow.length) {
        const rows = runOfShow.filter((r) => r.segment_title?.trim()).map((r, i) => ({
          project_id: projectId,
          created_by: me,
          segment_title: r.segment_title.trim().slice(0, 200),
          time_slot: r.time && /^\d{1,2}:\d{2}$/.test(r.time) ? `${r.time}:00` : null,
          duration_min: r.duration_min ?? null,
          notes: r.notes ?? null,
          position: i,
        }));
        if (rows.length) await supabase.from("project_run_of_show").insert(rows as never).then(() => {}, () => {});
      }
      if (suppliers.length) {
        const rows = suppliers.filter((s) => s.name?.trim()).map((s) => ({
          project_id: projectId,
          created_by: me,
          category: s.category || "other",
          name: s.name.trim().slice(0, 200),
          notes: s.notes ?? null,
          status: "lead",
        }));
        if (rows.length) await supabase.from("event_suppliers").insert(rows as never).then(() => {}, () => {});
      }
      if (talent.length) {
        const rows = talent.filter((t) => t.name?.trim()).map((t) => ({
          project_id: projectId,
          created_by: me,
          role: t.role || "performer",
          name: t.name.trim().slice(0, 200),
          notes: t.notes ?? null,
          status: "invited",
        }));
        if (rows.length) await supabase.from("event_talent").insert(rows as never).then(() => {}, () => {});
      }
      await supabase.from("project_notes").insert({
        project_id: projectId,
        created_by: me,
        title: `Brief: ${brief.title}`,
        content: [
          `**Summary**\n${brief.summary}`,
          `**Audience**\n${brief.audience}`,
          `**Tone**\n${brief.tone}`,
        ].filter(Boolean).join("\n\n"),
      } as never).then(() => {}, () => {});

      toast({
        title: "Added to your Project",
        description: `${tasks.length} tasks · ${deliverables.length} deliverables`,
      });
      setPendingElevation(null);
      onIngested();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't apply those changes";
      toast({ title: "Couldn't apply", description: msg, variant: "destructive" });
    } finally {
      setApplyingElevation(false);
    }
  };

  const discardElevation = () => {
    setPendingElevation(null);
    toast({ title: "Discarded", description: "Nothing was added to your Project." });
  };

  const ingestLink = async () => {
    const url = linkValue.trim();
    if (!url) return;
    setError(null);
    setSummary(null);
    setBusy(true);
    try {
      const brainRes = await callIngest({
        source_kind: "link",
        url,
        text: `Link dropped into Studio: ${url}`,
        hint: "Extract anything reusable from this URL's title/topic.",
      });
      setSummary({
        fileName: url,
        tasks: 0, deliverables: 0, runOfShow: 0, suppliers: 0, talent: 0,
        facts: brainRes.facts ?? 0,
        entities: brainRes.entities ?? 0,
      });
      setLinkValue("");
      setShowLink(false);
      toast({
        title: "Link remembered",
        description: `${brainRes.facts ?? 0} facts · ${brainRes.entities ?? 0} entities`,
      });
      onIngested();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't ingest link";
      setError(msg);
      toast({ title: "Link failed", description: msg, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const ingestThought = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setError(null);
    setSummary(null);
    setBusy(true);
    try {
      const brainRes = await callIngest({
        source_kind: "note",
        text: trimmed,
        hint: "User-typed thought dropped into the Studio.",
      });
      // Also drop it into the Pad so it's visible, not just in the Brain.
      try {
        const { data: userRes } = await supabase.auth.getUser();
        const me = userRes?.user?.id;
        if (me) {
          await supabase.from("project_notes").insert({
            project_id: projectId,
            created_by: me,
            title: trimmed.slice(0, 60),
            content: trimmed,
          } as never).then(() => {}, () => {});
        }
      } catch { /* noop */ }
      setSummary({
        fileName: "Thought",
        tasks: 0, deliverables: 0, runOfShow: 0, suppliers: 0, talent: 0,
        facts: brainRes.facts ?? 0,
        entities: brainRes.entities ?? 0,
      });
      toast({
        title: "Got it",
        description: `Filed to the Pad · Brain +${brainRes.facts ?? 0} facts`,
      });
      onIngested();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't save thought";
      setError(msg);
      toast({ title: "Thought failed", description: msg, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };


  if (busy) {
    return (
      <div className="px-4 pt-5">
        <StudioComingAliveLoader />
        <p className="text-xs text-center text-muted-foreground mt-2">
          Reading and remembering for the Studio Brain…
        </p>
      </div>
    );
  }

  if (pendingElevation) {
    const rows = [
      { n: pendingElevation.tasks.length, label: "Tasks", where: "Studio feed" },
      { n: pendingElevation.deliverables.length, label: "Deliverables", where: "Vault" },
      { n: pendingElevation.runOfShow.length, label: "Run of show", where: "Event" },
      { n: pendingElevation.suppliers.length, label: "Suppliers", where: "Event" },
      { n: pendingElevation.talent.length, label: "Talent", where: "Event" },
    ].filter((r) => r.n > 0);

    return (
      <div className="px-4 pt-5">
        <div className="relative rounded-2xl border-2 border-primary/40 bg-gradient-to-br from-primary/10 via-card to-card p-4 sm:p-5 animate-fade-in">
          <div className="flex items-center gap-2 mb-2">
            <FileEdit className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Review before it's added</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-1 truncate">
            From <span className="font-medium text-foreground">{pendingElevation.fileName}</span>
          </p>
          <p className="text-sm font-medium mb-1">{pendingElevation.brief.title}</p>
          {pendingElevation.brief.summary && (
            <p className="text-xs text-muted-foreground mb-3 line-clamp-3">{pendingElevation.brief.summary}</p>
          )}
          <p className="text-[11px] text-muted-foreground mb-3">
            Nothing below is in your Project yet.
          </p>
          {rows.length > 0 ? (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-3">
              {rows.map((r) => (
                <li key={r.label} className="flex items-center gap-2 text-xs">
                  <Badge variant="secondary" className="rounded-full font-bold tabular-nums min-w-[28px] justify-center">
                    {r.n}
                  </Badge>
                  <span className="font-medium">{r.label}</span>
                  <span className="text-muted-foreground">→ {r.where}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground mb-3">Just a brief — no tasks or deliverables detected.</p>
          )}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={applyElevation}
              disabled={applyingElevation}
              className="h-8 text-xs gap-1.5 rounded-full"
            >
              {applyingElevation ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              Add to Project
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={discardElevation}
              disabled={applyingElevation}
              className="h-8 text-xs rounded-full"
            >
              Discard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (summary) {
    const rows = [
      { n: summary.facts, label: "Facts", where: "Studio Brain" },
      { n: summary.entities, label: "Entities", where: "Studio Brain" },
      { n: summary.tasks, label: "Tasks", where: "Studio feed" },
      { n: summary.deliverables, label: "Deliverables", where: "Vault" },
      { n: summary.runOfShow, label: "Run of show", where: "Event" },
      { n: summary.suppliers, label: "Suppliers", where: "Event" },
      { n: summary.talent, label: "Talent", where: "Event" },
    ].filter((r) => r.n > 0);

    return (
      <div className="px-4 pt-5">
        <div className="relative rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/10 via-card to-card p-4 sm:p-5 animate-fade-in">
          <button
            type="button"
            onClick={() => setSummary(null)}
            className="absolute top-2 right-2 h-7 w-7 rounded-full hover:bg-muted/60 flex items-center justify-center text-muted-foreground"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Studio Brain remembered this</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3 truncate">
            From <span className="font-medium text-foreground">{summary.fileName}</span>
            {summary.brief ? <> · {summary.brief}</> : null}
          </p>
          {rows.length > 0 ? (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {rows.map((r) => (
                <li key={r.label} className="flex items-center gap-2 text-xs">
                  <Badge variant="secondary" className="rounded-full font-bold tabular-nums min-w-[28px] justify-center">
                    {r.n}
                  </Badge>
                  <span className="font-medium">{r.label}</span>
                  <span className="text-muted-foreground">→ {r.where}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">Saved — no new facts detected.</p>
          )}
          <div className="flex items-center gap-2 mt-3">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1.5 rounded-full"
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="h-3 w-3" /> Drop another
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs gap-1.5 rounded-full"
              onClick={() => setShowLink(true)}
            >
              <Link2 className="h-3 w-3" /> Paste link
            </Button>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,text/*,image/*,audio/*,.csv,.tsv,.md,.json,.yaml,.yml,.docx"
            className="hidden"
            onChange={(e) => ingestFile(e.target.files?.[0] ?? null)}
          />
        </div>
      </div>
    );
  }

  // === Cinematic skydive bullseye — ONE true Drop Zone for anything ===
  return (
    <section className="px-4 pt-5 pb-2 space-y-3">
      <header>
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[hsl(var(--energy))]">
          Drop Zone
        </p>
        <h2 className="text-lg font-black leading-none tracking-tight">
          Feed the Kretopia Brain
        </h2>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Drop a brief, file, voice note or link. Kreto will sort the useful parts
          into this Project for you to review.
        </p>
      </header>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,text/*,image/*,audio/*,.csv,.tsv,.md,.json,.yaml,.yml,.docx"
        className="hidden"
        onChange={(e) => {
          ingestFile(e.target.files?.[0] ?? null);
          if (inputRef.current) inputRef.current.value = "";
        }}
      />

      {!open ? (
        <div
          role="button"
          tabIndex={0}
          onClick={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setOpen(true);
            }
          }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) ingestFile(f);
          }}
          className={cn(
            "glass-surface relative w-full rounded-2xl p-4 cursor-pointer transition-all",
            "border border-dashed border-white/12 hover:border-[hsl(var(--energy)/0.5)]",
            dragOver && "border-[hsl(var(--energy)/0.7)] bg-white/[0.03] scale-[1.005]",
          )}
          aria-label="Open Drop Zone"
        >
          <div className="flex items-center gap-3.5">
            <span
              aria-hidden
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl"
              style={{ background: "linear-gradient(135deg, hsl(0 0% 100% / 0.06), hsl(var(--energy) / 0.16))" }}
            >
              <Upload className="h-4.5 w-4.5" style={{ color: "hsl(var(--energy))" }} />
            </span>
            <div className="min-w-0 flex-1 text-left">
              <p className="text-sm font-semibold leading-tight">
                {dragOver ? "Drop it here" : "Drop a file, or tap to add anything"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                PDF, image, voice note, link or a quick thought
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground/60 shrink-0" aria-hidden />
          </div>

          {/* Quick actions — same input modes as before, as a normal row
              instead of four buttons floating in the corners of a target. */}
          <div className="mt-3.5 flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:border-white/20 transition-colors"
            >
              <ImagePlus className="h-3 w-3" /> Image
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:border-white/20 transition-colors"
            >
              <Mic className="h-3 w-3" /> Voice
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setOpen(true); setShowLink(true); }}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:border-white/20 transition-colors"
            >
              <Link2 className="h-3 w-3" /> Link
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setOpen(true); }}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:border-white/20 transition-colors"
            >
              <MessageSquarePlus className="h-3 w-3" /> Idea
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-[hsl(var(--energy)/0.4)] p-3 space-y-2.5 bg-card shadow-[0_0_30px_hsl(var(--energy)/0.15)]">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-[hsl(var(--energy))] flex items-center justify-center shrink-0">
              <Sparkles className="h-3.5 w-3.5 text-background" />
            </div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[hsl(var(--energy))]">
              Ready for your drop
            </p>
            <Badge variant="secondary" className="ml-auto rounded-full text-[9px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
              Remembers everything
            </Badge>
          </div>

          <textarea
            autoFocus
            rows={3}
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            placeholder="Paste a link, write a thought, or tap a button below to add a file / voice note."
            className="w-full resize-none bg-transparent text-sm border-0 focus-visible:outline-none px-1 placeholder:text-muted-foreground/70"
          />

          {showLink && (
            <Input
              value={linkValue}
              onChange={(e) => setLinkValue(e.target.value)}
              placeholder="https://… venue, sponsor, doc"
              className="h-9 text-sm"
              onKeyDown={(e) => { if (e.key === "Enter") ingestLink(); }}
            />
          )}

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              <Button type="button" size="sm" variant="ghost" className="h-8 text-xs gap-1.5"
                onClick={() => inputRef.current?.click()}>
                <Upload className="h-3.5 w-3.5" /> File
              </Button>
              <Button type="button" size="sm" variant="ghost" className="h-8 text-xs gap-1.5"
                onClick={() => setShowLink((v) => !v)}>
                <Link2 className="h-3.5 w-3.5" /> {showLink ? "Hide link" : "Link"}
              </Button>
            </div>
            <div className="flex gap-1.5">
              <Button size="sm" variant="ghost" className="h-8 text-xs"
                onClick={() => { setOpen(false); setDraftText(""); setLinkValue(""); setShowLink(false); setError(null); }}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs gap-1.5 bg-[hsl(var(--energy))] hover:bg-[hsl(var(--energy)/0.9)] text-background font-bold"
                disabled={!draftText.trim() && !linkValue.trim()}
                onClick={async () => {
                  if (linkValue.trim()) {
                    await ingestLink();
                  }
                  if (draftText.trim()) {
                    const t = draftText;
                    setDraftText("");
                    await ingestThought(t);
                  }
                  setOpen(false);
                }}
              >
                <Send className="h-3 w-3" />
                Add to Project
              </Button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md p-2.5 flex items-start gap-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </section>
  );
};

