import { Radar } from "lucide-react";

import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { GlassCtaButton } from "@/components/ui/glass-cta";
import { cn } from "@/lib/utils";

interface ScoutScanButtonProps {
  label: string;
  /** A scan or a live re-check is running: the button cannot be fired twice. */
  busy: boolean;
  onClick: () => void;
}

/**
 * Scout's one action. Two radar rings ping out from the button, a sheen sweeps
 * across it, and while a scan runs the rings speed up and a beam runs along its
 * foot. All of it is decoration (aria-hidden, pointer-events none) driven by
 * CSS that stops under prefers-reduced-motion, so the button is a still glass
 * pill there. The label and the busy state stay the real signal.
 */
export function ScoutScanButton({ label, busy, onClick }: ScoutScanButtonProps) {
  return (
    <div data-busy={busy} className="scout-scan relative flex w-full justify-center sm:w-auto">
      <span aria-hidden className="scout-scan-ring" />
      <span aria-hidden className="scout-scan-ring scout-scan-ring-late" />
      <GlassCtaButton
        size="lg"
        onClick={onClick}
        disabled={busy}
        aria-busy={busy}
        icon={busy ? <KretopiaSpinner className="h-5 w-5" /> : <Radar className="h-5 w-5" aria-hidden />}
        className={cn("relative z-10 min-h-14 w-full justify-center overflow-hidden sm:w-auto sm:min-w-[20rem]")}
      >
        <span aria-hidden className="scout-scan-sheen" />
        {label}
        <span aria-hidden className="scout-scan-beam" />
      </GlassCtaButton>
    </div>
  );
}

export default ScoutScanButton;
