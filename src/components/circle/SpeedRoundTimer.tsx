import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

/**
 * mm:ss countdown for the current pairing.
 * Shows red pulse in the last 10s. Renders nothing when no pair / past time.
 */
export const SpeedRoundTimer = ({
  startedAt,
  slotSeconds,
}: {
  startedAt: string | null | undefined;
  slotSeconds: number;
}) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(iv);
  }, []);

  if (!startedAt) return null;
  const startMs = new Date(startedAt).getTime();
  const elapsed = Math.max(0, Math.floor((now - startMs) / 1000));
  const remaining = Math.max(0, slotSeconds - elapsed);
  const mm = Math.floor(remaining / 60).toString().padStart(2, "0");
  const ss = (remaining % 60).toString().padStart(2, "0");
  const warning = remaining > 0 && remaining <= 10;
  const ended = remaining === 0;

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tabular-nums shadow-lg ${
        ended
          ? "bg-primary/90 text-primary-foreground"
          : warning
          ? "bg-destructive/95 text-destructive-foreground animate-pulse"
          : "bg-black/70 text-white border border-white/15"
      }`}
      aria-live="polite"
    >
      <Clock className="h-3 w-3" />
      {ended ? "Wrap up…" : `${mm}:${ss}`}
    </div>
  );
};
