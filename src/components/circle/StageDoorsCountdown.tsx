import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Radio } from "lucide-react";

/**
 * Pre-show countdown shown to RSVPs on a curated stage. Updates every second
 * so the page feels alive instead of a static "in 2h" label. It is only shown
 * while the stage is still scheduled, so reaching zero means the start time has
 * passed, not that the doors are open: only the host opens them (status "live").
 */
export function StageDoorsCountdown({ startsAt }: { startsAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const start = new Date(startsAt).getTime();
  const diff = Math.max(0, start - now);
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  const secs = Math.floor((diff % 60_000) / 1000);

  const imminent = diff > 0 && diff < 10 * 60_000; // last 10 min
  const due = diff === 0; // start time reached; the stage is still waiting for its host

  return (
    <Card
      className={
        "p-4 text-center border " +
        (due
          ? "bg-muted/40 border-border"
          : imminent
            ? "bg-energy/10 border-energy/40"
            : "bg-primary/5 border-primary/30")
      }
    >
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground flex items-center justify-center gap-1.5">
        <Radio className={"h-3 w-3 " + (imminent ? "animate-pulse motion-reduce:animate-none" : "")} />
        {due ? "Waiting for the host to open the doors" : "Doors open in"}
      </p>
      {due && <p className="mt-1 text-xs text-muted-foreground">This page updates on its own when the Stage goes live.</p>}
      {!due && (
        <div className="mt-2 flex items-end justify-center gap-2 font-mono tabular-nums">
          {days > 0 && <TimeBlock value={days} label="d" />}
          <TimeBlock value={hours} label="h" />
          <TimeBlock value={mins} label="m" />
          <TimeBlock value={secs} label="s" />
        </div>
      )}
    </Card>
  );
}

function TimeBlock({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-baseline gap-0.5">
      <span className="text-3xl font-black leading-none">
        {String(value).padStart(2, "0")}
      </span>
      <span className="text-xs font-bold text-muted-foreground">{label}</span>
    </div>
  );
}
