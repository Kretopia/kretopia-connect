import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KretoMark } from "@/components/brand/KretoMark";

const AUTO_SCAN_MS = 5 * 60 * 1000;

/**
 * Match's Pulse: same Scan now pattern as Scout. Re-ranks every member by
 * shared interests on demand, and automatically every 5 minutes.
 */
export function MatchPulse() {
  const [scanning, setScanning] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [lastScan, setLastScan] = useState<Date | null>(null);
  const scanningRef = useRef(false);

  const scan = () => {
    if (scanningRef.current) return;
    scanningRef.current = true;
    setScanning(true);
    window.dispatchEvent(new CustomEvent("match:scan"));
  };

  useEffect(() => {
    const onDone = (e: Event) => {
      setCount((e as CustomEvent<{ count: number }>).detail.count);
      setLastScan(new Date());
      scanningRef.current = false;
      setScanning(false);
    };
    window.addEventListener("match:scanned", onDone);
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") scan();
    }, AUTO_SCAN_MS);
    return () => {
      window.removeEventListener("match:scanned", onDone);
      window.clearInterval(id);
    };
  }, []);

  return (
    <section
      aria-label="Match Pulse"
      className="mb-4 flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3"
    >
      <KretoMark size="sm" state={scanning ? "active" : "idle"} />
      <div className="min-w-0 flex-1" aria-live="polite">
        <p className="text-sm font-semibold text-foreground">
          {scanning ? "Scanning members…" : count === null ? "Pulse" : `${count} people share your interests`}
        </p>
        <p className="text-xs text-muted-foreground">
          {lastScan
            ? `Last scan ${lastScan.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · auto every 5 min`
            : "Ranked by shared roles, skills and passions, close or distant"}
        </p>
      </div>
      <Button size="sm" variant="outline" onClick={scan} disabled={scanning} className="min-h-11 shrink-0">
        {scanning ? <KretoMark size="xs" state="active" /> : <RefreshCw className="h-3.5 w-3.5" />}
        <span className="ml-1.5 text-xs">Scan now</span>
      </Button>
    </section>
  );
}

export default MatchPulse;
