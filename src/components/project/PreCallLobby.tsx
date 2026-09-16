import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Video, VideoOff, Loader2, X, Users } from "lucide-react";

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
    <div className="absolute inset-0 flex flex-col bg-[#0b0b0f] text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-white/5 shrink-0">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/40 font-semibold">
            Ready to join
          </p>
          <p className="text-base font-semibold truncate">{projectName}</p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel"
          className="h-9 w-9 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 text-white/80 transition-colors shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      {/* Camera preview */}
      <div className="relative flex-1 min-h-0 flex items-center justify-center px-4 py-4 bg-black">
        <div className="relative w-full max-w-md aspect-[3/4] sm:aspect-video rounded-2xl overflow-hidden bg-[#111] ring-1 ring-white/10 shadow-2xl">
          {cam && !camError ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover [transform:scaleX(-1)]"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/50">
              <VideoOff className="h-10 w-10" />
              <p className="text-xs">{camError ?? "Camera off"}</p>
            </div>
          )}

          {/* Bottom gradient label */}
          <div className="absolute inset-x-0 bottom-0 px-3 py-2 bg-gradient-to-t from-black/70 to-transparent">
            <p className="text-xs font-medium">You</p>
          </div>

          {/* Floating participants preview */}
          {participantsPreview.length > 0 && (
            <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-black/50 backdrop-blur-sm text-[11px] font-medium">
              <Users className="h-3 w-3" />
              {participantsPreview.length} in room
            </div>
          )}
        </div>
      </div>

      {/* Mic/Cam toggles + Join */}
      <div
        className="px-4 pt-4 border-t border-white/5 shrink-0 space-y-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
      >
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setMic((v) => !v)}
            aria-label={mic ? "Mute mic" : "Unmute mic"}
            className={`h-12 w-12 rounded-full flex items-center justify-center transition-colors ${
              mic
                ? "bg-white/10 text-white hover:bg-white/15"
                : "bg-destructive text-destructive-foreground"
            }`}
          >
            {mic ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </button>
          <button
            type="button"
            onClick={() => setCam((v) => !v)}
            aria-label={cam ? "Turn camera off" : "Turn camera on"}
            className={`h-12 w-12 rounded-full flex items-center justify-center transition-colors ${
              cam
                ? "bg-white/10 text-white hover:bg-white/15"
                : "bg-destructive text-destructive-foreground"
            }`}
          >
            {cam ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </button>
        </div>

        <Button
          type="button"
          onClick={() => onJoin({ mic, cam })}
          disabled={joining}
          className="w-full h-12 rounded-full text-base font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          {joining ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
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
