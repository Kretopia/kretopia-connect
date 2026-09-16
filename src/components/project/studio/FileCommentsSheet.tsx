import { useEffect, useMemo, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, MessageCircle, Send, Trash2, Pin, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { MoodboardThumb } from "./MoodboardThumb";
import { getProjectFileSignedUrl } from "@/lib/projectFiles";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface FileCommentsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: {
    id: string;
    file_name: string;
    file_url: string;
    file_type?: string | null;
  } | null;
  currentUserId: string;
}

interface CommentRow {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  timestamp_seconds: number | null;
  profiles?: { full_name: string; avatar_url: string | null } | null;
}

const fmtTimestamp = (sec: number) => {
  if (sec < 0 || !Number.isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

export const FileCommentsSheet = ({
  open,
  onOpenChange,
  file,
  currentUserId,
}: FileCommentsSheetProps) => {
  const { toast } = useToast();
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [pinTime, setPinTime] = useState<number | null>(null);

  // Media playback state (video / audio)
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const isImage = file?.file_type?.startsWith("image/");
  const isVideo = file?.file_type?.startsWith("video/");
  const isAudio = file?.file_type?.startsWith("audio/");
  const isMedia = isVideo || isAudio;

  // Resolve signed URL for media playback
  useEffect(() => {
    if (!open || !file || !isMedia) {
      setSignedUrl(null);
      return;
    }
    let cancelled = false;
    getProjectFileSignedUrl(file.file_url, { expiresIn: 3600 })
      .then((u) => {
        if (!cancelled) setSignedUrl(u);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, file, isMedia]);

  // Initial load + realtime subscription
  useEffect(() => {
    if (!open || !file?.id) {
      setComments([]);
      return;
    }
    let cancelled = false;
    setLoading(true);

    const load = async () => {
      const { data, error } = await supabase
        .from("file_comments")
        .select("id, content, user_id, created_at, timestamp_seconds")
        .eq("file_id", file.id)
        .order("timestamp_seconds", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });
      if (cancelled) return;
      if (error) {
        console.error("[FileCommentsSheet] load", error);
        setLoading(false);
        return;
      }
      const userIds = Array.from(new Set((data ?? []).map((c) => c.user_id)));
      let profileMap: Record<string, { full_name: string; avatar_url: string | null }> = {};
      if (userIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, full_name, avatar_url")
          .in("user_id", userIds);
        profs?.forEach((p: any) => {
          profileMap[p.user_id] = { full_name: p.full_name, avatar_url: p.avatar_url };
        });
      }
      setComments(
        (data ?? []).map((c: any) => ({ ...c, profiles: profileMap[c.user_id] ?? null })),
      );
      setLoading(false);
    };

    void load().catch((e) => {
      console.error("[FileCommentsSheet] unexpected", e);
      setLoading(false);
    });

    const channel = supabase
      .channel(`file-comments:${file.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "file_comments", filter: `file_id=eq.${file.id}` },
        () => {
          void load();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [open, file?.id]);

  const handleSend = async () => {
    const content = draft.trim();
    if (!content || !file?.id || sending) return;
    setSending(true);
    const { error } = await supabase.from("file_comments").insert({
      file_id: file.id,
      user_id: currentUserId,
      content,
      timestamp_seconds: pinTime,
    } as any);
    setSending(false);
    if (error) {
      toast({ title: "Couldn't post comment", description: error.message, variant: "destructive" });
      return;
    }
    setDraft("");
    setPinTime(null);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("file_comments").delete().eq("id", id);
    if (error) {
      toast({ title: "Couldn't delete", description: error.message, variant: "destructive" });
    }
  };

  const seekTo = (sec: number) => {
    const m = mediaRef.current;
    if (!m) return;
    m.currentTime = sec;
    void m.play().catch(() => {});
  };

  const pinCurrentMoment = () => {
    const m = mediaRef.current;
    if (m) setPinTime(Math.floor(m.currentTime));
  };

  const timestampedComments = useMemo(
    () => comments.filter((c) => c.timestamp_seconds != null),
    [comments],
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[92vh] flex flex-col p-0 gap-0 rounded-t-2xl"
      >
        <SheetHeader className="px-4 pt-4 pb-3 border-b border-border/60 shrink-0">
          <SheetTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="h-4 w-4 text-[hsl(var(--energy))]" />
            {isMedia ? "Notes & timestamps" : "Notes on this file"}
          </SheetTitle>
          <p className="text-xs text-muted-foreground truncate text-left">
            {file?.file_name}
          </p>
        </SheetHeader>

        {/* Media preview */}
        {file && isImage && (
          <div className="px-4 py-3 shrink-0 bg-muted/30">
            <div className="rounded-xl overflow-hidden ring-1 ring-border max-h-48 flex items-center justify-center bg-background">
              <MoodboardThumb storedUrl={file.file_url} alt={file.file_name} className="max-h-48 w-auto object-contain" />
            </div>
          </div>
        )}

        {file && isMedia && (
          <div className="px-4 py-3 shrink-0 bg-black/90 space-y-2">
            {signedUrl ? (
              <>
                {isVideo ? (
                  <video
                    ref={mediaRef as any}
                    src={signedUrl}
                    controls
                    playsInline
                    className="w-full max-h-[40vh] rounded-lg bg-black"
                    onLoadedMetadata={(e) => setDuration((e.currentTarget as HTMLVideoElement).duration || 0)}
                    onTimeUpdate={(e) => setCurrentTime((e.currentTarget as HTMLVideoElement).currentTime)}
                  />
                ) : (
                  <audio
                    ref={mediaRef as any}
                    src={signedUrl}
                    controls
                    className="w-full"
                    onLoadedMetadata={(e) => setDuration((e.currentTarget as HTMLAudioElement).duration || 0)}
                    onTimeUpdate={(e) => setCurrentTime((e.currentTarget as HTMLAudioElement).currentTime)}
                  />
                )}

                {/* Scrubber-pinned comment markers */}
                {duration > 0 && timestampedComments.length > 0 && (
                  <div className="relative h-6">
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 rounded-full bg-white/20" />
                    {timestampedComments.map((c) => {
                      const left = Math.min(100, Math.max(0, ((c.timestamp_seconds || 0) / duration) * 100));
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => seekTo(c.timestamp_seconds || 0)}
                          aria-label={`Jump to ${fmtTimestamp(c.timestamp_seconds || 0)}`}
                          title={`${fmtTimestamp(c.timestamp_seconds || 0)} — ${c.content.slice(0, 60)}`}
                          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3 w-3 rounded-full bg-[hsl(var(--energy))] ring-2 ring-background hover:scale-125 transition-transform shadow-[0_0_8px_hsl(var(--energy)/0.8)]"
                          style={{ left: `${left}%` }}
                        />
                      );
                    })}
                  </div>
                )}

                {/* Pin current moment */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-white/70 tabular-nums">
                    {fmtTimestamp(currentTime)}
                    {duration > 0 && <> / {fmtTimestamp(duration)}</>}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-7 gap-1.5 rounded-full"
                    onClick={pinCurrentMoment}
                  >
                    <Pin className="h-3 w-3" />
                    Pin this moment
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 text-white/60 animate-spin" />
              </div>
            )}
          </div>
        )}

        {/* Comments list */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              <MessageCircle className="h-6 w-6 mx-auto mb-2 opacity-40" />
              {isMedia
                ? "Play it, then pin a moment to leave a note."
                : "Be the first to leave a note."}
            </div>
          ) : (
            comments.map((c) => {
              const isMine = c.user_id === currentUserId;
              const ts = c.timestamp_seconds;
              return (
                <div key={c.id} className="flex gap-2.5 group">
                  <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                    <AvatarImage src={c.profiles?.avatar_url || undefined} />
                    <AvatarFallback className="text-[10px] font-bold">
                      {c.profiles?.full_name?.charAt(0)?.toUpperCase() ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-xs font-semibold">
                        {isMine ? "You" : c.profiles?.full_name ?? "Member"}
                      </span>
                      {ts != null && (
                        <button
                          type="button"
                          onClick={() => seekTo(ts)}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                            "bg-[hsl(var(--energy)/0.15)] text-[hsl(var(--energy))] hover:bg-[hsl(var(--energy)/0.25)]",
                          )}
                          aria-label={`Jump to ${fmtTimestamp(ts)}`}
                        >
                          <Play className="h-2.5 w-2.5 fill-current" />
                          {fmtTimestamp(ts)}
                        </button>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                      {c.content}
                    </p>
                  </div>
                  {isMine && (
                    <button
                      type="button"
                      onClick={() => handleDelete(c.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-opacity"
                      aria-label="Delete comment"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Composer */}
        <div className="p-3 border-t border-border/60 shrink-0 bg-background space-y-2">
          {pinTime != null && (
            <Badge
              variant="outline"
              className="gap-1 border-[hsl(var(--energy)/0.4)] text-[hsl(var(--energy))]"
            >
              <Pin className="h-3 w-3" />
              Pinning at {fmtTimestamp(pinTime)}
              <button
                type="button"
                className="ml-1 opacity-60 hover:opacity-100"
                onClick={() => setPinTime(null)}
                aria-label="Remove pin"
              >
                ×
              </button>
            </Badge>
          )}
          <div className="flex gap-2 items-end">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={
                pinTime != null
                  ? `Note at ${fmtTimestamp(pinTime)}…`
                  : isMedia
                  ? "Leave a note (or pin a moment first)…"
                  : "Leave a note…"
              }
              rows={1}
              className="resize-none min-h-[40px] max-h-32 rounded-xl bg-muted/40 border-border/50"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
            />
            <Button
              size="icon"
              className="rounded-xl shrink-0"
              disabled={!draft.trim() || sending}
              onClick={handleSend}
              aria-label="Post note"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
