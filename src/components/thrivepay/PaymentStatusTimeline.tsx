import { Check, Clock, X, RotateCcw, AlertTriangle, CircleDot } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  createdAt: string;
  /** Raw status value as stored — pending | completed | failed | cancelled (transactions),
   *  or paid | refunded | disputed (payment_history-style) — mapped below. */
  status: string;
}

const TERMINAL_STEP: Record<string, { label: string; icon: typeof Check; tone: string }> = {
  completed: { label: "Completed", icon: Check, tone: "text-green-500 border-green-500 bg-green-500/10" },
  paid: { label: "Completed", icon: Check, tone: "text-green-500 border-green-500 bg-green-500/10" },
  succeeded: { label: "Completed", icon: Check, tone: "text-green-500 border-green-500 bg-green-500/10" },
  released: { label: "Released", icon: Check, tone: "text-green-500 border-green-500 bg-green-500/10" },
  failed: { label: "Failed", icon: X, tone: "text-red-500 border-red-500 bg-red-500/10" },
  cancelled: { label: "Cancelled", icon: X, tone: "text-muted-foreground border-border bg-muted" },
  refunded: { label: "Refunded", icon: RotateCcw, tone: "text-amber-500 border-amber-500 bg-amber-500/10" },
  disputed: { label: "Disputed", icon: AlertTriangle, tone: "text-red-500 border-red-500 bg-red-500/10" },
};

/**
 * Only ever renders states the data actually supports — a transaction row
 * carries a single current status, not a full timestamped history, so this
 * shows exactly two real points (created, current state) rather than
 * fabricating intermediate steps (e.g. a fake "processing" stage) that
 * were never recorded.
 */
export function PaymentStatusTimeline({ createdAt, status }: Props) {
  const terminal = TERMINAL_STEP[status] ?? {
    label: "Pending",
    icon: Clock,
    tone: "text-amber-500 border-amber-500 bg-amber-500/10",
  };
  const isPending = !TERMINAL_STEP[status];

  return (
    <div className="flex items-center gap-0">
      <Step icon={CircleDot} label="Created" sublabel={new Date(createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })} tone="text-muted-foreground border-border bg-muted" active />
      <div className={cn("h-px flex-1 mx-1", isPending ? "bg-border" : "bg-primary/40")} />
      <Step icon={terminal.icon} label={terminal.label} sublabel={isPending ? "In progress" : "Current state"} tone={terminal.tone} active />
    </div>
  );
}

function Step({
  icon: Icon,
  label,
  sublabel,
  tone,
  active,
}: {
  icon: typeof Check;
  label: string;
  sublabel: string;
  tone: string;
  active: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1 text-center min-w-[84px]">
      <div className={cn("h-8 w-8 rounded-full border flex items-center justify-center", active ? tone : "text-muted-foreground border-border")}>
        <Icon className="h-4 w-4" />
      </div>
      <span className="text-xs font-medium">{label}</span>
      <span className="text-[10px] text-muted-foreground leading-tight">{sublabel}</span>
    </div>
  );
}
