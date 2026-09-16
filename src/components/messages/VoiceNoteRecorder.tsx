import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Loader2, Trash2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface VoiceNoteRecorderProps {
  onSend: (url: string, durationSec: number) => void;
  disabled?: boolean;
}

export const VoiceNoteRecorder = ({ onSend, disabled }: VoiceNoteRecorderProps) => {
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRef.current = mr;
      chunksRef.current = [];
      setDuration(0);

      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setPreviewBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start();
      setRecording(true);
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    } catch {
      toast({ title: "Mic access denied", description: "Allow microphone access to record voice notes.", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    mediaRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
  };

  const cancel = () => {
    setPreviewUrl(null);
    setPreviewBlob(null);
    setDuration(0);
  };

  const send = async () => {
    if (!previewBlob) return;
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Please sign in to send voice notes.");
      const fileName = `voice-${Date.now()}.webm`;
      // RLS: portfolio bucket requires the first folder = auth.uid()
      const filePath = `${user.id}/voice-notes/${fileName}`;
      const { error } = await supabase.storage
        .from("portfolio")
        .upload(filePath, previewBlob, { contentType: "audio/webm", upsert: false });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("portfolio").getPublicUrl(filePath);
      onSend(publicUrl, duration);
      cancel();
    } catch (e: any) {
      console.error("[VoiceNoteRecorder] upload failed:", e);
      toast({
        title: "Upload failed",
        description: e?.message || "Could not send voice note.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  if (previewUrl) {
    return (
      <div className="flex items-center gap-2 bg-muted rounded-full px-2 py-1.5 w-full">
        <audio src={previewUrl} controls className="h-8 flex-1 max-w-[180px]" />
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={cancel}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
        <Button type="button" size="icon" className="h-8 w-8 rounded-full" onClick={send} disabled={uploading}>
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    );
  }

  if (recording) {
    return (
      <div className="flex items-center gap-2 bg-destructive/10 rounded-full px-3 py-1.5">
        <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
        <span className="text-xs font-medium tabular-nums">{Math.floor(duration / 60)}:{String(duration % 60).padStart(2, "0")}</span>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={stopRecording}>
          <Square className="h-4 w-4 text-destructive fill-destructive" />
        </Button>
      </div>
    );
  }

  return (
    <Button type="button" variant="ghost" size="icon" disabled={disabled} onClick={startRecording} className="rounded-full text-muted-foreground hover:text-foreground" title="Record voice note">
      <Mic className="h-5 w-5" />
    </Button>
  );
};

interface VoiceNotePlayerProps {
  url: string;
  duration?: number;
  isOwn: boolean;
}

export const VoiceNotePlayer = ({ url, duration, isOwn }: VoiceNotePlayerProps) => (
  <div className={`flex items-center gap-2 rounded-2xl px-3 py-2 ${isOwn ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted rounded-bl-sm"}`}>
    <Mic className="h-4 w-4 flex-shrink-0" />
    <audio src={url} controls className="h-8 max-w-[200px]" />
    {duration ? <span className="text-xs tabular-nums opacity-70">{Math.floor(duration / 60)}:{String(duration % 60).padStart(2, "0")}</span> : null}
  </div>
);
