import { cn } from "@/lib/utils";

const BAR_COUNT = 5;
// Per-bar response curve so bars don't move in lockstep with the raw
// level — small, restrained variation, not a decorative flourish.
const BAR_WEIGHTS = [0.5, 0.8, 1, 0.8, 0.5];

export interface VoiceWaveformProps {
  /** Live 0-1 audio level from useVoiceSearch. */
  level: number;
  className?: string;
}

/**
 * Small live waveform driven by real microphone input (see
 * useVoiceSearch's AnalyserNode-based level) — not a generic infinite
 * pulse. Bar heights track the actual level each animation frame; when
 * there's no sound, bars sit flat. Height transitions collapse to
 * near-instant under prefers-reduced-motion via the global rule in
 * index.css, so no separate reduced-motion branch is needed here.
 */
export const VoiceWaveform = ({ level, className }: VoiceWaveformProps) => {
  return (
    <div
      className={cn("flex items-center justify-center gap-[3px] h-4", className)}
      role="img"
      aria-label="Listening"
    >
      {BAR_WEIGHTS.map((weight, i) => {
        const heightPct = Math.max(15, Math.min(100, level * 100 * weight + 15));
        return (
          <span
            key={i}
            className="w-[3px] rounded-full bg-[hsl(var(--color-accent))] transition-[height] duration-100 ease-out"
            style={{ height: `${heightPct}%` }}
          />
        );
      })}
    </div>
  );
};

export default VoiceWaveform;
