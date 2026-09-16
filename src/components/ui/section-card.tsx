import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  /** Small uppercase label at the top of the card, e.g. "Kreto Action Center". */
  title: string;
  /** Optional one-line caption under the title. */
  subtitle?: string;
  children: ReactNode;
  className?: string;
  /** Tailwind gap between children — varies slightly by call site's content density. */
  gap?: "2.5" | "3" | "4";
}

/**
 * Shared control-room card shell. Extracted after the exact same
 * `rounded-2xl border border-border bg-card p-4` + uppercase-label pattern
 * showed up four times independently (Passport's Kreto Action Center and
 * Trust & Opportunity Center, Studio's Session & Activity and Casting &
 * Collaborators) — one real definition instead of four copies that could
 * drift apart.
 */
export function SectionCard({ title, subtitle, children, className, gap = "4" }: SectionCardProps) {
  return (
    <div className={cn(
      "rounded-2xl border border-border bg-card p-4",
      gap === "2.5" ? "space-y-2.5" : gap === "3" ? "space-y-3" : "space-y-4",
      className,
    )}>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground/70 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export default SectionCard;
