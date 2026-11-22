import { useRef, useState } from "react";
import { Pencil, Play, RotateCcw, Scissors, Trash2, Upload } from "lucide-react";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { analytics } from "@/lib/analytics";
import { parseIntroVideo, withIntroTrim } from "@/lib/passport/introVideoTrim";
import { checkIntroVideoFile, formatMb, INTRO_VIDEO_MAX_BYTES, introUploadError, introUploadStatus, type IntroUploadPhase } from "@/lib/passport/introVideoUpload";

interface VideoIntroSectionProps {
  videoUrl?: string | null;
  isOwnProfile: boolean;
  onRefresh: () => void;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** The Passport's intro video, shown where the work videos are, with replace, trim and delete for its owner. */
export const VideoIntroSection = ({ videoUrl, isOwnProfile, onRefresh }: VideoIntroSectionProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [url, setUrl] = useState<string | null>(videoUrl ?? null);
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [trimOpen, setTrimOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [duration, setDuration] = useState(0);
  const [range, setRange] = useState<[number, number]>([0, 0]);
  const fileRef = useRef<HTMLInputElement>(null);
  const trimVideoRef = useRef<HTMLVideoElement>(null);
  // Upload status, shown in words: selected file, uploading, saving, saved or failed (with a retry that keeps the file).
  const [phase, setPhase] = useState<IntroUploadPhase>("idle");
  const [pending, setPending] = useState<File | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [playbackError, setPlaybackError] = useState(false);
  const inFlight = useRef(false);

  const save = async (next: string | null) => {
    if (!user) return false;
    const { error } = await supabase.from("profiles").update({ video_intro_url: next }).eq("user_id", user.id);
    if (error) { toast({ title: "Could not save", description: error.message, variant: "destructive" }); return false; }
    setUrl(next);
    onRefresh();
    return true;
  };

  const handleUpload = async (file: File) => {
    if (!user || inFlight.current) return; // one upload at a time: a double tap or a second pick is ignored
    const check = checkIntroVideoFile(file);
    if ("message" in check) {
      setPending(null);
      setFailure(check.message);
      setPhase("failed");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setPending(file);
    setFailure(null);
    setPhase("uploading");
    try {
      const path = `${user.id}/video-intro.${check.ext}`;
      const { error } = await supabase.storage.from("portfolio").upload(path, file, { upsert: true, contentType: file.type || undefined });
      if (error) throw error;
      setPhase("saving");
      const { data } = supabase.storage.from("portfolio").getPublicUrl(path);
      // Success is only shown once the Passport row points at the new file.
      if (!(await save(`${data.publicUrl}?v=${Date.now()}`))) {
        setFailure("The video uploaded, but it couldn't be saved to your Passport.");
        setPhase("failed");
        analytics.introVideoUpload("failure", "save");
        return;
      }
      setPending(null);
      setPlaybackError(false);
      setPhase("saved");
      analytics.introVideoUpload("success");
      setPlaying(false);
    } catch (err) {
      setFailure(introUploadError(err));
      setPhase("failed");
      analytics.introVideoUpload("failure", "upload");
    } finally {
      inFlight.current = false;
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const status = introUploadStatus(phase, pending, failure);

  const handleRemove = async () => {
    setBusy(true);
    if (await save(null)) toast({ title: "Video intro removed" });
    setBusy(false);
    setPlaying(false);
  };

  const openTrim = () => {
    if (!url) return;
    const { trim } = parseIntroVideo(url);
    setRange([trim.start, trim.end ?? 0]);
    setDuration(0);
    setTrimOpen(true);
  };

  const saveTrim = async () => {
    if (!url) return;
    setBusy(true);
    if (await save(withIntroTrim(url, { start: range[0], end: range[1] }, duration))) toast({ title: "Video intro trimmed" });
    setBusy(false);
    setTrimOpen(false);
    setPlaying(false);
  };

  if (!url && !isOwnProfile) return null;
  const parsed = url ? parseIntroVideo(url) : null;

  /** Stops playback at the cut's end; the start comes from the URL fragment. */
  const stopAtEnd = (end: number | null) => (e: React.SyntheticEvent<HTMLVideoElement>) => {
    if (end !== null && e.currentTarget.currentTime >= end) e.currentTarget.pause();
  };

  const input = (
    <input ref={fileRef} type="file" accept="video/*" className="hidden" disabled={busy}
      onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
  );

  return (
    <section aria-labelledby="passport-intro-video">
      <h3 id="passport-intro-video" className="mb-3 text-xs font-semibold uppercase text-muted-foreground">Video intro</h3>
      {input}
      {url && parsed ? (
        <div className="space-y-2">
          <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted">
            {playing ? (
              <video src={url} controls autoPlay playsInline className="h-full w-full bg-background object-contain"
                onTimeUpdate={stopAtEnd(parsed.trim.end)} onEnded={() => setPlaying(false)} onError={() => setPlaybackError(true)} />
            ) : (
              <button type="button" onClick={() => setPlaying(true)} aria-label="Play video intro"
                className="group relative block h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <video src={`${parsed.src}#t=${parsed.trim.start || 0.1}`} muted playsInline preload="metadata" className="h-full w-full object-cover"
                  onError={() => setPlaybackError(true)} onLoadedData={() => setPlaybackError(false)} />
                <span className="absolute left-3 bottom-3 grid h-11 w-11 place-items-center rounded-full bg-background/90 text-foreground shadow transition-transform group-hover:scale-105 motion-reduce:transition-none">
                  <Play className="h-5 w-5" aria-hidden />
                </span>
              </button>
            )}
            {playbackError && !busy && (
              <div className="absolute inset-0 grid place-items-center bg-muted p-4 text-center text-sm text-muted-foreground">
                {isOwnProfile
                  ? "This video is saved, but this browser can't play it. MP4 (H.264) plays everywhere: replace it if viewers can't see it."
                  : "This video can't play in this browser."}
              </div>
            )}
            {busy && <div className="absolute inset-0 grid place-items-center bg-background/60"><KretopiaSpinner className="h-6 w-6 text-primary" /></div>}
          </div>
          {isOwnProfile && (
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
                <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Replace
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={busy} onClick={openTrim}>
                <Scissors className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Trim
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setConfirmDelete(true)} className="text-destructive">
                <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Delete
              </Button>
            </div>
          )}
        </div>
      ) : (
        <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
          className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-muted/40 transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
            {busy ? <KretopiaSpinner className="h-5 w-5" /> : <Upload className="h-5 w-5" aria-hidden />}
          </span>
          <span className="text-sm font-semibold">{busy ? "Uploading your video intro…" : "Add a video intro"}</span>
          <span className="text-xs text-muted-foreground">30–60s, max {formatMb(INTRO_VIDEO_MAX_BYTES)}</span>
        </button>
      )}
      {isOwnProfile && status && (
        <div role="status" aria-live="polite" className={`mt-2 flex flex-wrap items-center gap-2 text-xs ${phase === "failed" ? "text-destructive" : "text-muted-foreground"}`}>
          {(phase === "uploading" || phase === "saving") && <KretopiaSpinner className="h-3.5 w-3.5" />}
          <span>{status}</span>
          {phase === "failed" && pending && (
            <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => handleUpload(pending)}>
              <RotateCcw className="mr-1 h-3 w-3" aria-hidden /> Retry
            </Button>
          )}
        </div>
      )}

      <Dialog open={trimOpen} onOpenChange={setTrimOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Trim video intro</DialogTitle>
            <DialogDescription>Choose where your intro starts and ends. Your original file is kept.</DialogDescription>
          </DialogHeader>
          {parsed && (
            <div className="space-y-4">
              <video ref={trimVideoRef} src={parsed.src} controls playsInline preload="metadata"
                className="aspect-video w-full rounded-lg bg-muted object-contain"
                onLoadedMetadata={(e) => {
                  const d = e.currentTarget.duration || 0;
                  setDuration(d);
                  setRange(([s, en]) => [Math.min(s, d), en > 0 && en <= d ? en : d]);
                }}
                onTimeUpdate={(e) => { if (e.currentTarget.currentTime >= range[1] && range[1] > 0) e.currentTarget.pause(); }} />
              {duration > 0 ? (
                <>
                  <Slider min={0} max={duration} step={0.1} minStepsBetweenThumbs={1} value={range}
                    aria-label="Trim range"
                    onValueChange={(v) => {
                      const next: [number, number] = [v[0], v[1]];
                      if (trimVideoRef.current) trimVideoRef.current.currentTime = next[0] !== range[0] ? next[0] : next[1];
                      setRange(next);
                    }} />
                  <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
                    <span>Start {fmt(range[0])}</span>
                    <span>{fmt(range[1] - range[0])} kept</span>
                    <span>End {fmt(range[1])}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-center py-2"><KretopiaSpinner className="h-5 w-5 text-primary" /></div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTrimOpen(false)}>Cancel</Button>
            <Button onClick={saveTrim} disabled={busy || duration === 0}>Save trim</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your video intro?</AlertDialogTitle>
            <AlertDialogDescription>It will no longer appear on your Passport. You can add a new one anytime.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
};
