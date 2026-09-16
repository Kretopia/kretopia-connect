import { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2, X, Check, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface BriefVoiceRecorderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (text: string) => Promise<void> | void;
  /** When provided, the recorder will offer to seed starter tasks into this project. */
  projectId?: string;
  userId?: string;
  /** Called after tasks are inserted so the parent can refresh. */
  onTasksCreated?: () => void;
}

type Phase = "idle" | "recording" | "processing" | "review";

interface Deliverable {
  title: string;
  description?: string | null;
  due_date?: string | null;
}

/**
 * Bottom-sheet recorder for "Speak the vision". Records mic audio,
 * sends it to extract-brief (audio source) which transcribes + summarises,
 * then shows an editable summary the user can confirm to save as the brief.
 *
 * If `projectId` is provided, the AI also breaks the brief into starter
 * tasks. The user can pick which to seed (or skip) before saving.
 */
export const BriefVoiceRecorder = ({
  open,
  onOpenChange,
  onSave,
  projectId,
  userId,
  onTasksCreated,
}: BriefVoiceRecorderProps) => {
  const { toast } = useToast();
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const tickRef = useRef<number | null>(null);

  // Reset on close
  useEffect(() => {
    if (!open) {
      stopTimer();
      mediaRef.current?.stream?.getTracks().forEach((t) => t.stop());
      mediaRef.current = null;
      chunksRef.current = [];
      setPhase("idle");
      setSeconds(0);
      setDraft("");
      setSaving(false);
      setDeliverables([]);
      setSelected(new Set());
    }
  }, [open]);

  const startTimer = () => {
    setSeconds(0);
    tickRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
  };
  const stopTimer = () => {
    if (tickRef.current) window.clearInterval(tickRef.current);
    tickRef.current = null;
  };

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await process(blob);
      };
      rec.start();
      mediaRef.current = rec;
      setPhase("recording");
      startTimer();
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Mic blocked",
        description: "Allow microphone access in your browser settings.",
        variant: "destructive",
      });
      onOpenChange(false);
    }
  };

  const stop = () => {
    stopTimer();
    if (mediaRef.current && mediaRef.current.state !== "inactive") {
      mediaRef.current.stop();
    }
    setPhase("processing");
  };

  const blobToBase64 = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1] ?? "");
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const process = async (blob: Blob) => {
    try {
      const data_base64 = await blobToBase64(blob);
      const { data, error } = await supabase.functions.invoke("extract-brief", {
        body: { source: "audio", data_base64, mime_type: "audio/webm" },
      });
      if (error) throw error;
      const summary =
        (data as any)?.project?.summary ||
        (data as any)?.project?.title ||
        (data as any)?.transcript ||
        "";
      if (!summary) throw new Error("Couldn't catch what you said");
      setDraft(summary);
      const list: Deliverable[] = Array.isArray((data as any)?.deliverables)
        ? (data as any).deliverables.slice(0, 8)
        : [];
      setDeliverables(list);
      // Auto-select all by default — one-shot expectation
      setSelected(new Set(list.map((_, i) => i)));
      setPhase("review");
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Couldn't process audio",
        description: err.message ?? "Try again or type the brief.",
        variant: "destructive",
      });
      setPhase("idle");
    }
  };

  const seedTasks = async () => {
    if (!projectId || !userId) return 0;
    const picked = deliverables.filter((_, i) => selected.has(i));
    if (!picked.length) return 0;
    const rows = picked.map((d) => ({
      project_id: projectId,
      title: d.title.slice(0, 200),
      description: d.description ?? null,
      status: "todo",
      created_by: userId,
    }));
    const { error } = await supabase.from("project_tasks").insert(rows);
    if (error) {
      console.warn("seed tasks failed", error);
      return 0;
    }
    return rows.length;
  };

  const confirm = async () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await onSave(trimmed);
      const created = await seedTasks();
      if (created > 0) {
        toast({
          title: `Brief saved · ${created} task${created === 1 ? "" : "s"} added`,
        });
        onTasksCreated?.();
      }
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  const canSeedTasks = !!projectId && !!userId && deliverables.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="p-6 space-y-5 overflow-y-auto">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">Speak the vision</h3>
            <button
              onClick={() => onOpenChange(false)}
              className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {phase === "idle" && (
            <div className="flex flex-col items-center gap-4 py-6">
              <p className="text-sm text-muted-foreground text-center">
                Tap the mic, describe the project — tone, references, who it's for.
                {canSeedTasks === false && projectId
                  ? ""
                  : projectId
                    ? " We'll break it into starter tasks too."
                    : ""}
              </p>
              <button
                type="button"
                onClick={start}
                className="h-20 w-20 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                aria-label="Start recording"
              >
                <Mic className="h-8 w-8" />
              </button>
              {projectId && (
                <p className="text-[11px] text-muted-foreground text-center max-w-[260px]">
                  Tip: mention deliverables (e.g. "shoot Friday, edit by Monday") and we'll turn them into tasks.
                </p>
              )}
            </div>
          )}

          {phase === "recording" && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="text-3xl font-mono tabular-nums">
                {mm}:{ss}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                </span>
                Listening…
              </div>
              <button
                type="button"
                onClick={stop}
                className={cn(
                  "h-20 w-20 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform",
                )}
                aria-label="Stop recording"
              >
                <Square className="h-7 w-7 fill-current" />
              </button>
              <p className="text-xs text-muted-foreground">Tap to stop</p>
            </div>
          )}

          {phase === "processing" && (
            <div className="flex flex-col items-center gap-3 py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Catching the vibe…</p>
            </div>
          )}

          {phase === "review" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  The brief
                </p>
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="min-h-[120px] text-sm"
                  autoFocus
                />
              </div>

              {canSeedTasks && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-primary inline-flex items-center gap-1.5">
                      <ListChecks className="h-3.5 w-3.5" />
                      Starter tasks ({selected.size}/{deliverables.length})
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        setSelected(
                          selected.size === deliverables.length
                            ? new Set()
                            : new Set(deliverables.map((_, i) => i)),
                        )
                      }
                      className="text-[11px] font-medium text-primary hover:underline"
                    >
                      {selected.size === deliverables.length ? "Clear all" : "Select all"}
                    </button>
                  </div>
                  <ul className="space-y-1 max-h-[180px] overflow-y-auto">
                    {deliverables.map((d, i) => {
                      const checked = selected.has(i);
                      return (
                        <li key={i}>
                          <label className="flex items-start gap-2 py-1.5 px-1 rounded cursor-pointer hover:bg-primary/10">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                const next = new Set(selected);
                                if (checked) next.delete(i);
                                else next.add(i);
                                setSelected(next);
                              }}
                              className="mt-0.5 h-4 w-4 accent-primary shrink-0"
                            />
                            <span
                              className={cn(
                                "text-sm leading-snug",
                                !checked && "text-muted-foreground line-through",
                              )}
                            >
                              {d.title}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="text-[11px] text-muted-foreground mt-2">
                    Uncheck any you don't want. They'll appear in the Studio feed.
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={confirm}
                  disabled={saving || !draft.trim()}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-1" />
                      {canSeedTasks && selected.size > 0
                        ? `Save brief + ${selected.size} task${selected.size === 1 ? "" : "s"}`
                        : "Save brief"}
                    </>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setDraft("");
                    setDeliverables([]);
                    setSelected(new Set());
                    setPhase("idle");
                  }}
                  disabled={saving}
                >
                  Redo
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
