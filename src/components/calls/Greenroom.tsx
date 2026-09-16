// Greenroom — pre-call warmup. Mic + cam OFF by default.
// Device pickers, self preview, knock-or-join CTA. Mobile-first.
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Mic, MicOff, Video, VideoOff, Loader2, Settings2, ChevronDown,
} from "lucide-react";

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
    <div className="absolute inset-0 flex flex-col bg-[#0b0b0f] text-white">
      {/* Header */}
      <header className="px-4 pt-4 pb-2 shrink-0">
        <p className="text-[11px] uppercase tracking-[0.2em] text-primary/80 font-semibold">
          Greenroom
        </p>
        <h1 className="text-lg sm:text-xl font-bold truncate">{title}</h1>
        <p className="text-xs text-white/50 mt-1">
          Camera and mic are off. Turn them on when you're ready.
        </p>
      </header>

      {/* Preview */}
      <div className="flex-1 min-h-0 flex items-center justify-center px-4 py-3">
        <div className="relative w-full max-w-md aspect-[3/4] sm:aspect-video rounded-2xl overflow-hidden bg-[#111] ring-1 ring-white/10 shadow-2xl">
          {cam && !permError ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover [transform:scaleX(-1)]"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/50 px-6 text-center">
              <VideoOff className="h-10 w-10" />
              <p className="text-xs">{permError ?? "Camera off"}</p>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 px-3 py-2 bg-gradient-to-t from-black/70 to-transparent flex items-center justify-between">
            <p className="text-xs font-medium">
              {needsName ? guestName || "You" : "You"}
            </p>
            {mic && (
              <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                <Mic className="h-3 w-3" /> live
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div
        className="px-4 pt-3 border-t border-white/5 shrink-0 space-y-3"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
      >
        {needsName && (
          <Input
            placeholder="Your name"
            value={guestName}
            onChange={(e) => onGuestNameChange?.(e.target.value)}
            className="bg-white/10 border-white/20 text-white placeholder:text-white/40 h-11"
          />
        )}

        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setMic((v) => !v)}
            aria-label={mic ? "Mute mic" : "Unmute mic"}
            className={`h-12 w-12 rounded-full flex items-center justify-center transition-colors ${
              mic ? "bg-white/10 text-white" : "bg-white/5 text-white/70"
            }`}
          >
            {mic ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </button>
          <button
            type="button"
            onClick={() => setCam((v) => !v)}
            aria-label={cam ? "Camera off" : "Camera on"}
            className={`h-12 w-12 rounded-full flex items-center justify-center transition-colors ${
              cam ? "bg-white/10 text-white" : "bg-white/5 text-white/70"
            }`}
          >
            {cam ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </button>
          <button
            type="button"
            onClick={() => setShowSettings((v) => !v)}
            aria-label="Device settings"
            className="h-12 w-12 rounded-full flex items-center justify-center bg-white/5 text-white/70 hover:bg-white/10"
          >
            <Settings2 className="h-5 w-5" />
          </button>
        </div>

        {showSettings && (
          <div className="space-y-2 rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
            <DevicePicker label="Microphone" value={micId} onChange={setMicId} options={mics} />
            <DevicePicker label="Camera" value={camId} onChange={setCamId} options={cams} />
            {speakers.length > 0 && (
              <DevicePicker label="Speaker" value={spkId} onChange={setSpkId} options={speakers} />
            )}
          </div>
        )}

        <Button
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
          className="w-full h-12 rounded-full text-base font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          {joining ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Joining…
            </>
          ) : (
            ctaLabel
          )}
        </Button>

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
      <span className="text-[11px] uppercase tracking-wider text-white/50">{label}</span>
      <div className="relative mt-1">
        <select
          value={value ?? options[0]?.deviceId ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none h-10 rounded-lg bg-black/40 border border-white/10 px-3 pr-8 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/60"
        >
          {options.length === 0 && <option value="">Default</option>}
          {options.map((o) => (
            <option key={o.deviceId} value={o.deviceId}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 pointer-events-none" />
      </div>
    </label>
  );
}
