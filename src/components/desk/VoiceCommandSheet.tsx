import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Mic, Square, Loader2, Sparkles, CheckCircle2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface VoiceCommandSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Phase = "idle" | "recording" | "thinking" | "review" | "executing" | "done";

interface Parsed {
  transcript: string;
  intent:
    | "add_task"
    | "mark_paid"
    | "send_invoice"
    | "start_call"
    | "add_note"
    | "jump_project"
    | "unknown";
  project_id: string | null;
  task_title?: string | null;
  due_date?: string | null;
  note?: string | null;
  amount?: number | null;
  summary: string;
}

const MAX_SECONDS = 30;

/**
 * Multi-intent voice command. Speak: "Mark Acme reel as paid", "Add task
 * edit cut 3 by Friday on the brand video", "Start a call on the campaign".
 *
 * Uses voice-command edge fn → confirms → executes via Supabase / navigation.
 */
export const VoiceCommandSheet = ({ open, onOpenChange }: VoiceCommandSheetProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [parsed, setParsed] = useState<Parsed | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const tickRef = useRef<number | null>(null);

  const cleanup = useCallback(() => {
    if (tickRef.current) window.clearInterval(tickRef.current);
    tickRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
  }, []);

  useEffect(() => {
    if (!open) {
      cleanup();
      setPhase("idle");
      setSeconds(0);
      setParsed(null);
    }
  }, [open, cleanup]);

  const blobToBase64 = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onloadend = () => resolve((r.result as string).split(",")[1] ?? "");
      r.onerror = reject;
      r.readAsDataURL(blob);
    });

  const processAudio = useCallback(
    async (blob: Blob, mime: string) => {
      setPhase("thinking");
      try {
        // Pull recent project list so the LLM can match names
        const { data: projects } = await (supabase as any)
          .from("projects")
          .select("id, title")
          .order("updated_at", { ascending: false })
          .limit(20);

        const audio_base64 = await blobToBase64(blob);
        const { data, error } = await supabase.functions.invoke("voice-command", {
          body: {
            audio_base64,
            mime_type: mime,
            projects: projects || [],
            today_iso: new Date().toISOString().slice(0, 10),
          },
        });
        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).error);
        setParsed(data as Parsed);
        setPhase("review");
      } catch (e: any) {
        console.error("voice-command failed", e);
        toast({
          title: "Couldn't read that",
          description: e?.message || "Try again.",
          variant: "destructive",
        });
        setPhase("idle");
      }
    },
    [toast],
  );

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      recorderRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        cleanup();
        if (blob.size > 0) void processAudio(blob, rec.mimeType || "audio/webm");
        else setPhase("idle");
      };
      rec.start();
      setPhase("recording");
      setSeconds(0);
      tickRef.current = window.setInterval(() => {
        setSeconds((s) => {
          const next = s + 1;
          if (next >= MAX_SECONDS && rec.state === "recording") {
            try {
              rec.stop();
            } catch {}
          }
          return next;
        });
      }, 1000) as unknown as number;
    } catch (e) {
      console.error("mic blocked", e);
      toast({
        title: "Mic blocked",
        description: "Allow microphone access to use voice commands.",
        variant: "destructive",
      });
    }
  }, [cleanup, processAudio, toast]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      try {
        recorderRef.current.stop();
      } catch {}
    }
  }, []);

  const executeAction = useCallback(async () => {
    if (!parsed || !user) return;
    setPhase("executing");

    try {
      switch (parsed.intent) {
        case "add_task": {
          if (!parsed.project_id || !parsed.task_title) throw new Error("Missing project or task");
          const { error } = await (supabase as any).from("project_tasks").insert({
            project_id: parsed.project_id,
            created_by: user.id,
            title: parsed.task_title,
            status: "todo",
            due_date: parsed.due_date || null,
          });
          if (error) throw error;
          toast({ title: "Task added", description: parsed.task_title });
          break;
        }

        case "mark_paid": {
          if (!parsed.project_id) throw new Error("Which project?");
          const { data: invoice, error: fetchErr } = await (supabase as any)
            .from("invoices")
            .select("id, status")
            .eq("project_id", parsed.project_id)
            .eq("user_id", user.id)
            .in("status", ["pending", "sent"])
            .order("created_at", { ascending: false })
            .limit(1)
            .single();
          if (fetchErr || !invoice) throw new Error("No open invoice for that project");
          const { error: updErr } = await supabase.rpc("confirm_invoice_paid_manually", {
            p_invoice_id: invoice.id,
            p_payment_method: "Voice command",
          });
          if (updErr) throw updErr;
          toast({ title: "Marked paid", description: parsed.summary });
          break;
        }

        case "send_invoice": {
          if (!parsed.project_id) throw new Error("Which project?");
          onOpenChange(false);
          setTimeout(() => {
            navigate(`/desk/${parsed.project_id}`);
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent("thrivedesk:set-tab", { detail: "finance" }));
              window.dispatchEvent(
                new CustomEvent("thrivedesk:intent", {
                  detail: { tab: "finance", intent: "create-invoice" },
                }),
              );
            }, 300);
          }, 80);
          return;
        }

        case "start_call": {
          if (!parsed.project_id) throw new Error("Which project?");
          onOpenChange(false);
          setTimeout(() => {
            navigate(`/desk/${parsed.project_id}`);
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent("thrivedesk:start-video-call"));
            }, 400);
          }, 80);
          return;
        }

        case "add_note": {
          if (!parsed.project_id || !parsed.note) throw new Error("Missing note text");
          const { error } = await (supabase as any).from("project_notes").insert({
            project_id: parsed.project_id,
            user_id: user.id,
            content: parsed.note,
          });
          if (error) throw error;
          toast({ title: "Note saved" });
          break;
        }

        case "jump_project": {
          if (!parsed.project_id) throw new Error("Which project?");
          onOpenChange(false);
          setTimeout(() => navigate(`/desk/${parsed.project_id}`), 80);
          return;
        }

        default:
          toast({ title: "Didn't catch that", description: parsed.transcript });
      }
      setPhase("done");
      setTimeout(() => onOpenChange(false), 800);
    } catch (e: any) {
      console.error("execute failed", e);
      toast({
        title: "Couldn't do that",
        description: e?.message || "Try again.",
        variant: "destructive",
      });
      setPhase("review");
    }
  }, [parsed, user, toast, navigate, onOpenChange]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl border-t border-border p-0 max-h-[92vh] overflow-y-auto"
      >
        <SheetHeader className="px-5 pt-5 pb-2">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Voice command
          </SheetTitle>
        </SheetHeader>

        <div className="px-5 pb-8 pt-2">
          {(phase === "idle" || phase === "recording") && (
            <div className="flex flex-col items-center py-6">
              <button
                onClick={phase === "recording" ? stopRecording : startRecording}
                className={cn(
                  "h-28 w-28 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95",
                  phase === "recording"
                    ? "bg-destructive text-destructive-foreground animate-pulse"
                    : "bg-primary text-primary-foreground",
                )}
                aria-label={phase === "recording" ? "Stop" : "Record"}
              >
                {phase === "recording" ? (
                  <Square className="h-10 w-10 fill-current" />
                ) : (
                  <Mic className="h-12 w-12" />
                )}
              </button>
              <div className="mt-5 text-center">
                {phase === "recording" ? (
                  <>
                    <div className="text-2xl font-bold tabular-nums">
                      {String(Math.floor(seconds / 60)).padStart(2, "0")}:
                      {String(seconds % 60).padStart(2, "0")}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Tap to stop · auto-stops at {MAX_SECONDS}s
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-sm font-semibold">Tap and tell me what to do</div>
                    <div className="text-xs text-muted-foreground mt-1 max-w-[280px] mx-auto">
                      "Mark the Acme reel as paid", "Add task edit cut 3 by Friday on the brand
                      video", "Start a call on the campaign".
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {phase === "thinking" && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="text-sm font-medium">Reading…</div>
            </div>
          )}

          {phase === "review" && parsed && (
            <div className="space-y-4 pt-2">
              <div className="rounded-xl bg-muted/40 border border-border p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  You said
                </div>
                <div className="text-sm italic text-foreground/80">"{parsed.transcript}"</div>
              </div>

              <div className="rounded-xl bg-primary/5 border border-primary/20 p-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-primary mb-1">
                  Will do
                </div>
                <div className="text-sm font-semibold">{parsed.summary}</div>
                {!parsed.project_id && parsed.intent !== "unknown" && (
                  <div className="text-[11px] text-destructive mt-2">
                    Couldn't match a project. Try saying its name more clearly.
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setPhase("idle")}>
                  <X className="h-4 w-4 mr-1" /> Re-record
                </Button>
                <Button
                  className="flex-1"
                  onClick={executeAction}
                  disabled={parsed.intent === "unknown" || (!parsed.project_id && parsed.intent !== "add_note")}
                >
                  Do it
                </Button>
              </div>
            </div>
          )}

          {phase === "executing" && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="text-sm font-medium">Working on it…</div>
            </div>
          )}

          {phase === "done" && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              <div className="text-sm font-medium">Done</div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
