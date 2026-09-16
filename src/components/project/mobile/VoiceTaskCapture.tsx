import { useState, useRef, useEffect, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mic, Square, Loader2, Sparkles, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Collaborator {
  id: string;
  full_name: string;
  avatar_url?: string | null;
}

interface VoiceTaskCaptureProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectTitle?: string;
  currentUserId: string;
  collaborators?: Collaborator[];
  onTaskCreated: () => void;
}

type Phase = "idle" | "recording" | "processing" | "review";

interface ExtractedTask {
  transcript: string;
  title: string;
  description: string | null;
  due_date: string | null;
  assignee_user_id: string | null;
}

const MAX_SECONDS = 60;

export const VoiceTaskCapture = ({
  open,
  onOpenChange,
  projectId,
  projectTitle,
  currentUserId,
  collaborators = [],
  onTaskCreated,
}: VoiceTaskCaptureProps) => {
  const { toast } = useToast();
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [extracted, setExtracted] = useState<ExtractedTask | null>(null);
  const [saving, setSaving] = useState(false);

  // editable fields after extraction
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assignee, setAssignee] = useState<string>("unassigned");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }, []);

  // Reset everything when the sheet closes
  useEffect(() => {
    if (!open) {
      cleanup();
      setPhase("idle");
      setSeconds(0);
      setExtracted(null);
      setTitle("");
      setDescription("");
      setDueDate("");
      setAssignee("unassigned");
      setSaving(false);
    }
  }, [open, cleanup]);

  const blobToBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const processAudio = useCallback(
    async (blob: Blob, mimeType: string) => {
      setPhase("processing");
      try {
        const base64 = await blobToBase64(blob);
        const { data, error } = await supabase.functions.invoke("voice-to-task", {
          body: {
            audio_base64: base64,
            mime_type: mimeType,
            collaborators: collaborators.map((c) => ({
              id: c.id,
              full_name: c.full_name,
            })),
            today_iso: new Date().toISOString().slice(0, 10),
            project_title: projectTitle,
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        const task = data as ExtractedTask;
        setExtracted(task);
        setTitle(task.title || "");
        setDescription(task.description || "");
        setDueDate(task.due_date || "");
        setAssignee(task.assignee_user_id || "unassigned");
        setPhase("review");
      } catch (e: any) {
        console.error("voice-to-task failed:", e);
        const msg = String(e?.message || "");
        const isRateLimit = /429|rate.?limit|daily limit|quota/i.test(msg);
        const isTranscribe = /transcrib|audio|whisper|gemini/i.test(msg);
        toast({
          title: isRateLimit
            ? "Slow down a moment"
            : isTranscribe
              ? "Couldn't hear that clearly"
              : "Couldn't read that",
          description: isRateLimit
            ? "You've hit today's voice limit. Type the task instead, or try again tomorrow."
            : isTranscribe
              ? "Try a quieter spot, or type the task below."
              : "Try recording again, or type the task instead.",
          variant: "destructive",
        });
        // Drop into manual review so the user can still capture the task
        setPhase("review");
      }
    },
    [collaborators, projectTitle, toast],
  );

  const startRecording = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        toast({
          title: "Voice not supported",
          description: "Your browser doesn't support voice capture.",
          variant: "destructive",
        });
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : MediaRecorder.isTypeSupported("audio/mp4")
            ? "audio/mp4"
            : "";

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const finalMime = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: finalMime });
        cleanup();
        if (blob.size > 0) {
          void processAudio(blob, finalMime);
        } else {
          setPhase("idle");
          setSeconds(0);
        }
      };

      recorder.start();
      setPhase("recording");
      setSeconds(0);
      timerRef.current = window.setInterval(() => {
        setSeconds((s) => {
          const next = s + 1;
          if (next >= MAX_SECONDS) {
            // auto-stop at the cap
            try {
              recorder.state === "recording" && recorder.stop();
            } catch {}
          }
          return next;
        });
      }, 1000) as unknown as number;
    } catch (e: any) {
      console.error("mic permission failed:", e);
      toast({
        title: "Microphone blocked",
        description: "Allow microphone access in your browser settings to record.",
        variant: "destructive",
      });
      setPhase("idle");
    }
  }, [cleanup, processAudio, toast]);

  const stopRecording = useCallback(() => {
    const r = mediaRecorderRef.current;
    if (r && r.state === "recording") {
      try {
        r.stop();
      } catch (e) {
        console.error("stop failed", e);
      }
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!title.trim()) {
      toast({ title: "Title required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("project_tasks").insert({
        project_id: projectId,
        created_by: currentUserId,
        title: title.trim(),
        description: description.trim() || null,
        due_date: dueDate || null,
        status: "todo",
        assigned_to: assignee === "unassigned" ? null : assignee,
      });
      if (error) throw error;
      toast({ title: "Task added", description: "From your voice memo." });
      onTaskCreated();
      onOpenChange(false);
    } catch (e: any) {
      console.error("save task failed", e);
      toast({
        title: "Couldn't save task",
        description: e?.message || "Try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }, [title, description, dueDate, assignee, projectId, currentUserId, toast, onTaskCreated, onOpenChange]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl border-t border-border p-0 max-h-[92vh] overflow-y-auto"
      >
        <SheetHeader className="px-5 pt-5 pb-2">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Voice to Task
          </SheetTitle>
        </SheetHeader>

        <div className="px-5 pb-8 pt-2">
          {(phase === "idle" || phase === "recording") && (
            <div className="flex flex-col items-center py-6">
              <button
                onClick={phase === "recording" ? stopRecording : startRecording}
                className={cn(
                  "h-28 w-28 rounded-full flex items-center justify-center shadow-lg active:scale-95",
                  phase === "recording"
                    ? "bg-destructive text-destructive-foreground animate-pulse transition-colors"
                    : "btn-glass btn-glass-primary",
                )}
                aria-label={phase === "recording" ? "Stop recording" : "Start recording"}
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
                    <div className="text-sm font-semibold">Tap to record</div>
                    <div className="text-xs text-muted-foreground mt-1 max-w-[260px]">
                      Try: "Send the brief to Sarah by Friday" or "Edit reel cut 3 tomorrow."
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {phase === "processing" && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="text-sm font-medium">Reading your memo…</div>
              <div className="text-xs text-muted-foreground">Pulling out the task, date, and assignee.</div>
            </div>
          )}

          {phase === "review" && extracted && (
            <div className="space-y-4 pt-2">
              <div className="rounded-xl bg-muted/40 border border-border p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  You said
                </div>
                <div className="text-sm italic text-foreground/80">"{extracted.transcript}"</div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="vt-title" className="text-xs">Task</Label>
                <Input
                  id="vt-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What needs doing?"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="vt-due" className="text-xs">Due date</Label>
                  <Input
                    id="vt-due"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="vt-assignee" className="text-xs">Assignee</Label>
                  <Select value={assignee} onValueChange={setAssignee}>
                    <SelectTrigger id="vt-assignee">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {collaborators.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {(description || extracted.description) && (
                <div className="space-y-1.5">
                  <Label htmlFor="vt-desc" className="text-xs">Notes</Label>
                  <Textarea
                    id="vt-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                  />
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setExtracted(null);
                    setTitle("");
                    setDescription("");
                    setDueDate("");
                    setAssignee("unassigned");
                    setPhase("idle");
                    setSeconds(0);
                  }}
                  disabled={saving}
                >
                  <X className="h-4 w-4 mr-1" /> Re-record
                </Button>
                <Button className="flex-1" onClick={handleSave} disabled={saving || !title.trim()}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add task"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
