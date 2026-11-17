import { useEffect, useRef, useState } from "react";
import { ScoutScanButton } from "@/components/scout/ScoutScanButton";
import { MatchBrand } from "./MatchBrand";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";


/**
 * Match's Pulse: same Scan now pattern as Scout. Re-ranks every member by
 * shared interests on demand, and automatically every 5 minutes.
 */
export function MatchPulse() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [lastScan, setLastScan] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scanningRef = useRef(false);
  const timeout = useRef<ReturnType<typeof setTimeout>>();

  const scan = () => {
    if (!user) { navigate("/auth?next=/match"); return; }
    if (scanningRef.current) return;
    scanningRef.current = true;
    setScanning(true);
    setError(null);
    window.dispatchEvent(new CustomEvent("match:scan"));
    timeout.current = setTimeout(() => { scanningRef.current = false; setScanning(false); setError("timeout"); }, 25000);
  };

  useEffect(() => {
    const onDone = (e: Event) => {
      clearTimeout(timeout.current);
      const detail = (e as CustomEvent<{ count: number; error?: string | null }>).detail;
      setError(detail.error ?? null);
      if (!detail.error) { setCount(detail.count); setLastScan(new Date()); }
      scanningRef.current = false;
      setScanning(false);
    };
    window.addEventListener("match:scanned", onDone);
    return () => {
      window.removeEventListener("match:scanned", onDone);
      clearTimeout(timeout.current);
    };
  }, []);

  return (
    <section
      aria-label="Match Pulse"
      className="mb-4 flex min-h-24 flex-col gap-3 border-b border-border py-4 sm:flex-row sm:items-center"
    >
      <MatchBrand iconOnly />
      <div className="min-w-0 flex-1" aria-live="polite">
        <p className="text-sm font-semibold text-foreground">
          {scanning ? "Scanning creators…" : error ? "Scan unavailable" : "Discover your next collaborator"}
        </p>
        <p className="text-xs text-muted-foreground">
          {error ? "Couldn't refresh profiles. Try again." : count === 0 ? "Your next connection starts here." : lastScan
            ? `${count} profiles available · checked ${lastScan.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
            : "People. Possibilities. Kretopia."}
        </p>
      </div>
      <ScoutScanButton finitePulse label={scanning ? "Scanning creators…" : error ? "Try again" : "Scan now"} busy={scanning} onClick={scan} />
    </section>
  );
}

export default MatchPulse;
