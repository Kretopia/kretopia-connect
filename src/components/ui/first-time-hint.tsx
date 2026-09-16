import { useState, useEffect } from "react";
import { X, Lightbulb, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface FirstTimeHintProps {
  /** Stable key used to persist dismissal in localStorage */
  storageKey: string;
  /** Short bold lead, e.g. "Swipe right to connect" */
  title: string;
  /** Supporting line, kept under ~120 chars */
  description: string;
  /** Icon shown on the left. Defaults to Lightbulb. */
  icon?: LucideIcon;
  /** Visual emphasis */
  tone?: "info" | "energy";
  className?: string;
}

const KEY_PREFIX = "ft-hint:v1:";

/**
 * Dismissible inline tip aimed at first-time users on a surface.
 * Use sparingly — one per surface, only when the affordance isn't obvious.
 *
 *   <FirstTimeHint
 *     storageKey="match.swipe"
 *     title="Swipe right to connect"
 *     description="Swipe left to pass. Tap the heart or X if you'd rather use buttons."
 *   />
 */
export function FirstTimeHint({
  storageKey,
  title,
  description,
  icon: Icon = Lightbulb,
  tone = "info",
  className,
}: FirstTimeHintProps) {
  const [hidden, setHidden] = useState<boolean>(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setHidden(window.localStorage.getItem(KEY_PREFIX + storageKey) === "1");
    } catch { setHidden(false); }
  }, [storageKey]);

  if (hidden) return null;

  const dismiss = () => {
    setHidden(true);
    try { window.localStorage.setItem(KEY_PREFIX + storageKey, "1"); } catch { /* noop */ }
  };

  const isEnergy = tone === "energy";

  return (
    <div
      role="note"
      className={cn(
        "relative flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left",
        isEnergy
          ? "border-energy/30 bg-energy/5 text-foreground"
          : "border-primary/25 bg-primary/5 text-foreground",
        className,
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
          isEnergy ? "bg-energy/15 text-energy" : "bg-primary/15 text-primary",
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1 pr-5">
        <p className="text-xs font-bold leading-snug">{title}</p>
        <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss tip"
        className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
