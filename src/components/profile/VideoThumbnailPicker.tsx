import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Image as ImageIcon, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface VideoThumbnailPickerProps {
  /** Public URL of the uploaded video (must be CORS-accessible) */
  videoUrl: string;
  /** Called when user confirms a frame — receives a JPEG blob */
  onCapture: (blob: Blob, dataUrl: string) => void;
  /** Optional: number of preset frames to suggest */
  presetCount?: number;
  className?: string;
}

/**
 * Lets the user scrub through an uploaded video and pick any frame as the cover thumbnail.
 * Uses HTML5 <video> + <canvas> entirely client-side — no backend or external service.
 */
export const VideoThumbnailPicker = ({
  videoUrl,
  onCapture,
  presetCount = 4,
  className,
}: VideoThumbnailPickerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [presets, setPresets] = useState<{ time: number; dataUrl: string }[]>([]);
  const [generating, setGenerating] = useState(false);
  const [selectedTime, setSelectedTime] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");

  // When video metadata loads, generate preset thumbnails
  const handleLoadedMetadata = async () => {
    const video = videoRef.current;
    if (!video || !video.duration || !isFinite(video.duration)) return;
    setDuration(video.duration);
    await generatePresets(video.duration);
  };

  const captureFrame = (time: number): Promise<{ blob: Blob; dataUrl: string }> => {
    return new Promise((resolve, reject) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return reject(new Error("Video/canvas missing"));

      const onSeeked = () => {
        video.removeEventListener("seeked", onSeeked);
        const w = video.videoWidth || 640;
        const h = video.videoHeight || 360;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas context missing"));
        try {
          ctx.drawImage(video, 0, 0, w, h);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          canvas.toBlob(
            (blob) => {
              if (blob) resolve({ blob, dataUrl });
              else reject(new Error("toBlob returned null"));
            },
            "image/jpeg",
            0.85
          );
        } catch (e) {
          // CORS taint — common with cross-origin videos
          reject(e);
        }
      };

      video.addEventListener("seeked", onSeeked);
      video.currentTime = Math.max(0, Math.min(time, video.duration - 0.1));
    });
  };

  const generatePresets = async (dur: number) => {
    setGenerating(true);
    const times = Array.from({ length: presetCount }, (_, i) => (dur / (presetCount + 1)) * (i + 1));
    const results: { time: number; dataUrl: string }[] = [];
    for (const t of times) {
      try {
        const { dataUrl } = await captureFrame(t);
        results.push({ time: t, dataUrl });
        setPresets([...results]);
      } catch (e) {
        console.warn("Preset capture failed at", t, e);
      }
    }
    setGenerating(false);
  };

  const handleScrub = async (value: number[]) => {
    const t = value[0];
    setCurrentTime(t);
    try {
      const { dataUrl } = await captureFrame(t);
      setPreviewUrl(dataUrl);
      setSelectedTime(t);
    } catch (e) {
      console.warn("Scrub capture failed", e);
    }
  };

  const handleConfirm = async () => {
    const time = selectedTime ?? currentTime;
    try {
      const { blob, dataUrl } = await captureFrame(time);
      onCapture(blob, dataUrl);
    } catch (e) {
      console.error("Capture confirm failed", e);
    }
  };

  const selectPreset = (p: { time: number; dataUrl: string }) => {
    setSelectedTime(p.time);
    setCurrentTime(p.time);
    setPreviewUrl(p.dataUrl);
    if (videoRef.current) videoRef.current.currentTime = p.time;
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="rounded-lg border bg-card p-3 space-y-3">
        <div className="flex items-center gap-2 text-xs font-medium">
          <ImageIcon className="h-4 w-4 text-energy" />
          Pick a cover frame
        </div>

        {/* Hidden video element used for frame extraction */}
        <video
          ref={videoRef}
          src={videoUrl}
          crossOrigin="anonymous"
          preload="metadata"
          muted
          playsInline
          onLoadedMetadata={handleLoadedMetadata}
          className="w-full max-h-48 rounded bg-black object-contain"
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Live preview of selected frame */}
        {previewUrl && (
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground">Selected frame:</p>
            <img src={previewUrl} alt="Selected frame" className="w-full max-h-32 rounded object-contain bg-muted" />
          </div>
        )}

        {/* Scrubber */}
        {duration > 0 && (
          <div className="space-y-1">
            <Slider
              value={[currentTime]}
              min={0}
              max={duration}
              step={0.1}
              onValueChange={handleScrub}
            />
            <p className="text-[10px] text-muted-foreground text-center">
              {currentTime.toFixed(1)}s / {duration.toFixed(1)}s
            </p>
          </div>
        )}

        {/* Preset thumbnails */}
        {generating && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Generating preview frames...
          </div>
        )}
        {presets.length > 0 && (
          <div className="grid grid-cols-4 gap-1.5">
            {presets.map((p, i) => (
              <button
                key={i}
                type="button"
                onClick={() => selectPreset(p)}
                className={cn(
                  "relative rounded overflow-hidden border-2 transition-all",
                  selectedTime === p.time ? "border-energy ring-2 ring-energy/30" : "border-transparent hover:border-muted-foreground/40"
                )}
              >
                <img src={p.dataUrl} alt={`Frame at ${p.time.toFixed(1)}s`} className="w-full aspect-video object-cover" />
                {selectedTime === p.time && (
                  <div className="absolute top-0.5 right-0.5 bg-energy rounded-full p-0.5">
                    <Check className="h-2.5 w-2.5 text-energy-foreground" />
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        <Button
          type="button"
          onClick={handleConfirm}
          disabled={selectedTime === null || generating}
          size="sm"
          className="w-full"
        >
          <Check className="h-3 w-3 mr-1" />
          Use this frame as cover
        </Button>
      </div>
    </div>
  );
};
