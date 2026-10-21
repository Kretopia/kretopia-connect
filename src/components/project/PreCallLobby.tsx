import { CallBrand } from "@/components/calls/CallMediaControls";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Video, VideoOff, X, Users } from "lucide-react";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";

interface Props {
  projectName: string;
  joining: boolean;
  /** Called when user taps the primary CTA. Pass mic/cam preferences. */
  onJoin: (opts: { mic: boolean; cam: boolean }) => void;
  onCancel: () => void;
  /** Optional preview of who's already in the room. */
  participantsPreview?: { name: string; avatar?: string | null }[];
  /** Label for the primary CTA. Defaults to "Start call" (host flow). */
  ctaLabel?: string;
}

/**
 * Pre-call lobby — shows your camera, lets you toggle mic/cam, then drops
 * you into the live call when you tap Join. Mirrors the Zoom/Meet warm-up
 * pattern so you know your gear works before you appear.
 */
export const PreCallLobby = ({
  projectName,
  joining,
  onJoin,
  onCancel,
  participantsPreview = [],
  ctaLabel = "Start call",
}: Props) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(true);
  const [camError, setCamError] = useState<string | null>(null);

  // Acquire camera preview on mount, release on unmount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err: any) {
        console.warn("[PreCallLobby] getUserMedia", err);
        setCamError(
          err?.name === "NotAllowedError"
            ? "Camera & mic blocked. Allow access in your browser to preview."
            : "Couldn't access camera. You can still join with mic/cam off.",
        );
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  // Toggle tracks live in the preview so the user sees the change.
  useEffect(() => {
    streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = mic));
  }, [mic]);
  useEffect(() => {
    streamRef.current?.getVideoTracks().forEach((t) => (t.enabled = cam));
  }, [cam]);

  return (
    <div className="k-call-surface absolute inset-0 flex flex-col">
      {/* Header */}
      <header className="k-call-header flex items-center justify-between border-b shrink-0">
        <CallBrand />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
            Ready to join
          </p>
          <p className="text-base font-semibold truncate">{projectName}</p>
        </div>
        <Button variant="ghost"
          type="button"
          onClick={onCancel}
          aria-label="Cancel"
          className="k-call-icon rounded-lg flex items-center justify-center bg-secondary hover:bg-secondary text-foreground transition-colors shrink-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </header>

      {/* Camera preview */}
      <div className="relative flex-1 min-h-0 flex items-center justify-center px-4 py-4 bg-muted">
        <div className="k-call-preview relative w-full max-w-md overflow-hidden bg-muted ring-1 ring-border shadow-2xl">
          {cam && !camError ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover [transform:scaleX(-1)]"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center text-muted-foreground">
              <VideoOff className="h-10 w-10" />
              <p className="text-xs">{camError ?? "Camera off"}</p>
            </div>
          )}

          {/* Floating name chip -- a small frosted pill instead of the old
              opaque strip, so the camera preview stays visible behind it */}
          <div className="absolute bottom-2 left-2 inline-flex items-center rounded-full bg-background/80 backdrop-blur-sm ring-1 ring-border px-2.5 py-1 shadow-sm">
            <p className="text-xs font-medium text-foreground">You</p>
          </div>

          {/* Floating participants preview */}
          {participantsPreview.length > 0 && (
            <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-muted/50 backdrop-blur-sm text-[11px] font-medium">
              <Users className="h-3 w-3" />
              {participantsPreview.length} in room
            </div>
          )}
        </div>
      </div>

      {/* Mic/Cam toggles + Join */}
      <div
        className="k-call-footer space-y-2"
      >
        <div className="flex items-center justify-center gap-3">
          <Button variant="ghost"
            type="button"
            onClick={() => setMic((v) => !v)}
            aria-label={mic ? "Mute mic" : "Unmute mic"}
            className={`h-12 w-12 rounded-full flex items-center justify-center transition-colors ${
              mic
                ? "bg-secondary text-foreground hover:bg-secondary"
                : "bg-destructive text-destructive-foreground"
            }`}
          >
            {mic ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </Button>
          <Button variant="ghost"
            type="button"
            onClick={() => setCam((v) => !v)}
            aria-label={cam ? "Turn camera off" : "Turn camera on"}
            className={`h-12 w-12 rounded-full flex items-center justify-center transition-colors ${
              cam
                ? "bg-secondary text-foreground hover:bg-secondary"
                : "bg-destructive text-destructive-foreground"
            }`}
          >
            {cam ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </Button>
        </div>

        <Button
          type="button"
          onClick={() => onJoin({ mic, cam })}
          disabled={joining}
          className="cta-solid w-full h-12 rounded-full text-base font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          {joining ? (
            <>
              <KretopiaSpinner className="h-4 w-4 mr-2" />
              Starting…
            </>
          ) : (
            ctaLabel
          )}
        </Button>
      </div>
    </div>
  );
};
