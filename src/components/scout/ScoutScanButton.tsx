import { Radar } from "lucide-react";

import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { PulseGlassCtaButton } from "@/components/ui/pulse-glass-cta";

interface ScoutScanButtonProps {
  label: string;
  /** A scan or a live re-check is running: the button cannot be fired twice. */
  busy: boolean;
  onClick: () => void;
}

/**
 * Scout's one action, on the shared pulse button (PulseGlassCtaButton): two radar rings ping out from it, a sheen
 * sweeps across it, and while a scan runs the rings speed up and a beam runs along its foot. Under
 * prefers-reduced-motion it is a still glass pill; the label and the busy state stay the real signal.
 */
export function ScoutScanButton({ label, busy, onClick }: ScoutScanButtonProps) {
  return (
    <PulseGlassCtaButton
      size="lg"
      busy={busy}
      onClick={onClick}
      disabled={busy}
      aria-busy={busy}
      icon={busy ? <KretopiaSpinner className="h-5 w-5" /> : <Radar className="h-5 w-5" aria-hidden />}
      wrapperClassName="w-full justify-center sm:w-auto"
      className="min-h-14 w-full justify-center sm:w-auto sm:min-w-[20rem]"
    >
      {label}
    </PulseGlassCtaButton>
  );
}

export default ScoutScanButton;
