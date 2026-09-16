import { useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, AlertCircle } from "lucide-react";

interface RecordingReplayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Derived from call_kind via the same KIND_LABEL map used on /recordings — never a fabricated title. */
  title: string;
  /** e.g. "2 hours ago · 5m 30s" — only the parts that are real get included by the caller. */
  subtitle?: string;
  /** Signed Daily access-link, already minted by the caller via get-recording-link. Undefined while loading. */
  url: string | null;
  loading: boolean;
  error: string | null;
  /** Explicit focus-return target -- the loading→video content swap while
   * open can disrupt Radix's default onCloseAutoFocus tracking, so this is
   * handled explicitly rather than relied on implicitly. */
  onCloseAutoFocus?: (event: Event) => void;
}

/**
 * Kretopia-native replay modal. Reuses the exact signed-URL flow
 * WatchReplayButton already had (get-recording-link, server-side
 * authorization) -- this only changes where that URL gets played back.
 */
export function RecordingReplayDialog({ open, onOpenChange, title, subtitle, url, loading, error, onCloseAutoFocus }: RecordingReplayDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Stop playback the moment the dialog starts closing, not just on unmount --
  // otherwise audio can keep playing through the close animation.
  useEffect(() => {
    if (!open && videoRef.current) {
      videoRef.current.pause();
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </DialogHeader>

        <div className="rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center">
          {loading ? (
            <div className="flex flex-col items-center gap-2 text-white/70">
              <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
              <span className="text-sm">Loading recording…</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-2 text-white/70 px-6 text-center">
              <AlertCircle className="h-6 w-6" aria-hidden />
              <span className="text-sm">{error}</span>
            </div>
          ) : url ? (
            <video
              ref={videoRef}
              src={url}
              controls
              className="h-full w-full"
              preload="metadata"
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default RecordingReplayDialog;
