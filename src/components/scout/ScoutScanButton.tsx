import { Radar } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { PulseGlassCtaButton } from "@/components/ui/pulse-glass-cta";

interface ScoutScanButtonProps {
  label: string;
  /** A scan or a live re-check is running: the button cannot be fired twice. */
  busy: boolean;
  onClick: () => void;
  finitePulse?: boolean;
}

/**
 * Scout's one action, on the shared pulse button (PulseGlassCtaButton): two radar rings ping out from it, a sheen
 * sweeps across it, and while a scan runs the rings speed up and a beam runs along its foot. Under
 * prefers-reduced-motion it is a still glass pill; the label and the busy state stay the real signal.
 */
export function ScoutScanButton({ label, busy, onClick, finitePulse = false }: ScoutScanButtonProps) {
  const [quiet, setQuiet] = useState(false);
  useEffect(() => {
    if (!finitePulse) return;
    const timer = setTimeout(() => setQuiet(true), 7000);
    return () => clearTimeout(timer);
  }, [finitePulse]);
  return (
    <PulseGlassCtaButton
      size="lg"
      busy={busy}
      onClick={() => { if (finitePulse) setQuiet(true); onClick(); }}
      disabled={busy}
      aria-busy={busy}
      icon={busy ? <KretopiaSpinner className="h-5 w-5" /> : <Radar className="h-5 w-5" aria-hidden />}
      wrapperClassName={cn("w-full justify-center sm:w-auto", finitePulse && "[&>span]:[animation-iteration-count:1] [&_.k-pulse-cta-sheen]:[animation-iteration-count:1]", quiet && "[&>span]:[animation:none] [&_.k-pulse-cta-sheen]:[animation:none] [&_.k-pulse-cta-beam]:[animation:none]")}
      className="min-h-14 w-full justify-center sm:w-auto sm:min-w-[20rem]"
    >
      {label}
    </PulseGlassCtaButton>
  );
}

export default ScoutScanButton;
