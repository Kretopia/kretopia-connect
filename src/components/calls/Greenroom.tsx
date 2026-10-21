import { CallBrand } from "@/components/calls/CallMediaControls";
// Greenroom — pre-call warmup. Mic + cam OFF by default.
// Device pickers, self preview, knock-or-join CTA. Mobile-first.
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Mic, MicOff, Video, VideoOff, Settings2, ChevronDown,
} from "lucide-react";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";

type Device = { deviceId: string; label: string };

interface Props {
  title: string;
  /** Show name field for guests (no auth) */
  needsName?: boolean;
  guestName?: string;
  onGuestNameChange?: (v: string) => void;
  /** Primary CTA label, e.g. "Join now" or "Knock to join" */
  ctaLabel: string;
  joining?: boolean;
  onJoin: (opts: {
    mic: boolean;
    cam: boolean;
    micDeviceId?: string;
    camDeviceId?: string;
    speakerDeviceId?: string;
  }) => void;
  /** Optional secondary action (e.g. copy invite link) */
  secondary?: React.ReactNode;
}

export const Greenroom = ({
  title,
  needsName,
  guestName = "",
  onGuestNameChange,
  ctaLabel,
  joining,
  onJoin,
  secondary,
}: Props) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Off by default per spec — user opts in.
  const [mic, setMic] = useState(false);
  const [cam, setCam] = useState(false);
  const [permError, setPermError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const [mics, setMics] = useState<Device[]>([]);
  const [cams, setCams] = useState<Device[]>([]);
  const [speakers, setSpeakers] = useState<Device[]>([]);
  const [micId, setMicId] = useState<string>();
  const [camId, setCamId] = useState<string>();
  const [spkId, setSpkId] = useState<string>();

  const refreshDevices = async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const norm = (kind: MediaDeviceKind) =>
        all
          .filter((d) => d.kind === kind)
          .map((d, i) => ({
            deviceId: d.deviceId,
            label: d.label || `${kind.replace("input", "").replace("output", "")} ${i + 1}`,
          }));
      setMics(norm("audioinput"));
      setCams(norm("videoinput"));
      setSpeakers(norm("audiooutput"));
    } catch (e) {
      console.warn("[Greenroom] enumerateDevices", e);
    }
  };

  // Stop any active stream
  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  // Acquire / refresh preview stream when mic/cam/device changes
  useEffect(() => {
    let cancelled = false;
    const want = mic || cam;
    if (!want) {
      stop();
      return;
    }
    (async () => {
      try {
        stop();
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: mic ? (micId ? { deviceId: { exact: micId } } : true) : false,
          video: cam ? (camId ? { deviceId: { exact: camId } } : true) : false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current && cam) videoRef.current.srcObject = stream;
        setPermError(null);
        // Labels populate after first permission grant
        refreshDevices();
      } catch (err: any) {
        console.warn("[Greenroom] getUserMedia", err);
        setPermError(
          err?.name === "NotAllowedError"
            ? "Camera & mic blocked. Allow access to preview."
            : "Couldn't access your devices.",
        );
        setMic(false);
        setCam(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mic, cam, micId, camId]);

  // First device list (no labels until granted)
  useEffect(() => {
    refreshDevices();
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canJoin = useMemo(() => {
    if (joining) return false;
    if (needsName && !guestName.trim()) return false;
    return true;
  }, [joining, needsName, guestName]);

  return (
    <div className="k-call-surface absolute inset-0 flex flex-col">
      {/* Header */}
      <header className="k-call-header shrink-0">
        <CallBrand />
        <p className="text-[11px] uppercase tracking-[0.2em] text-primary/80 font-semibold">
          Greenroom
        </p>
        <h1 className="text-lg sm:text-xl font-bold truncate">{title}</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Camera and mic are off. Turn them on when you're ready.
        </p>
      </header>

      {/* Preview */}
      <div className="flex-1 min-h-0 flex items-center justify-center px-4 py-3">
        <div className="k-call-preview relative w-full max-w-md overflow-hidden bg-background ring-1 ring-border shadow-2xl">
          {cam && !permError ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover [transform:scaleX(-1)]"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground px-6 text-center">
              <VideoOff className="h-10 w-10" />
              <p className="text-xs">{permError ?? "Camera off"}</p>
            </div>
          )}
          {/* Floating name chip -- same frosted pill as the project lobby,
              so the camera preview stays visible behind it */}
          <div className="absolute bottom-2 left-2 inline-flex items-center gap-1.5 rounded-full bg-background/80 backdrop-blur-sm ring-1 ring-border px-2.5 py-1 shadow-sm">
            <p className="text-xs font-medium text-foreground">
              {needsName ? guestName || "You" : "You"}
            </p>
            {mic && (
              <span className="flex items-center gap-1 text-[11px] text-success">
                <Mic className="h-3 w-3" /> live
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div
        className="k-call-footer space-y-2 max-h-[60dvh] overflow-y-auto"
      >
        {needsName && (
          <Input
            placeholder="Your name"
            value={guestName}
            onChange={(e) => onGuestNameChange?.(e.target.value)}
            className="bg-secondary border-border text-foreground placeholder:text-muted-foreground h-11"
          />
        )}

        <div className="flex items-center justify-center gap-3">
          <Button variant="ghost"
            type="button"
            onClick={() => setMic((v) => !v)}
            aria-label={mic ? "Mute mic" : "Unmute mic"}
            className={`h-12 w-12 rounded-full flex items-center justify-center transition-colors ${
              mic ? "bg-secondary text-foreground" : "bg-secondary text-muted-foreground"
            }`}
          >
            {mic ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </Button>
          <Button variant="ghost"
            type="button"
            onClick={() => setCam((v) => !v)}
            aria-label={cam ? "Camera off" : "Camera on"}
            className={`h-12 w-12 rounded-full flex items-center justify-center transition-colors ${
              cam ? "bg-secondary text-foreground" : "bg-secondary text-muted-foreground"
            }`}
          >
            {cam ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </Button>
          <Button variant="ghost"
            type="button"
            onClick={() => setShowSettings((v) => !v)}
            aria-label="Device settings"
            className="h-12 w-12 rounded-full flex items-center justify-center bg-secondary text-muted-foreground hover:bg-secondary"
          >
            <Settings2 className="h-5 w-5" />
          </Button>
        </div>

        {showSettings && (
          <div className="space-y-2 rounded-xl bg-secondary p-3 ring-1 ring-border">
            <DevicePicker label="Microphone" value={micId} onChange={setMicId} options={mics} />
            <DevicePicker label="Camera" value={camId} onChange={setCamId} options={cams} />
            {speakers.length > 0 && (
              <DevicePicker label="Speaker" value={spkId} onChange={setSpkId} options={speakers} />
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() =>
            onJoin({
              mic,
              cam,
              micDeviceId: micId,
              camDeviceId: camId,
              speakerDeviceId: spkId,
            })
          }
          disabled={!canJoin}
          className="w-full h-12 inline-flex items-center justify-center rounded-full text-base font-semibold bg-foreground text-background hover:opacity-90 disabled:opacity-60 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {joining ? (
            <>
              <KretopiaSpinner className="h-4 w-4 mr-2" />
              Joining…
            </>
          ) : (
            ctaLabel
          )}
        </button>

        {secondary}
      </div>
    </div>
  );
};

function DevicePicker({
  label, value, onChange, options,
}: {
  label: string;
  value?: string;
  onChange: (v: string) => void;
  options: Device[];
}) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="relative mt-1">
        <select
          value={value ?? options[0]?.deviceId ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none h-10 rounded-lg bg-secondary border border-border px-3 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60"
        >
          {options.length === 0 && <option value="">Default</option>}
          {options.map((o) => (
            <option key={o.deviceId} value={o.deviceId}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      </div>
    </label>
  );
}
