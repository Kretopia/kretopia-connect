import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface OnboardingXPCounterProps {
  xp: number;
  className?: string;
}

/**
 * Running XP counter that pulses when the value increases.
 * Purely presentational — XP is awarded server-side once onboarding completes.
 */
export function OnboardingXPCounter({ xp, className }: OnboardingXPCounterProps) {
  const [displayed, setDisplayed] = useState(xp);
  const [pulse, setPulse] = useState(false);
  const prev = useRef(xp);

  useEffect(() => {
    if (xp === prev.current) return;
    // Quick tween
    const start = prev.current;
    const delta = xp - start;
    const duration = 500;
    const startTs = performance.now();
    let raf = 0;
    const tick = (ts: number) => {
      const t = Math.min(1, (ts - startTs) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayed(Math.round(start + delta * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 600);
    prev.current = xp;
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [xp]);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-xs font-semibold text-primary transition-transform",
        pulse && "scale-110 bg-primary/15",
        className,
      )}
      aria-live="polite"
    >
      <Sparkles className={cn("h-3.5 w-3.5", pulse && "animate-pulse")} />
      <span className="tabular-nums">+{displayed} XP</span>
    </div>
  );
}
