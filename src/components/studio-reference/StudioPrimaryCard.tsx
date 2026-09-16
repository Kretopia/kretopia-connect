import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StudioPrimaryCardProps {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  /** One dominant action — this card should never carry more than one primary CTA. */
  action?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/**
 * Studio-grammar primary card — same flat, bordered surface as
 * CreditsOverviewCard and StudioRoom's cards (rounded-2xl, border-border,
 * bg-card, one controlled gradient wash, no arbitrary glow). Used as the
 * single dominant "what is this feature, what should I do next" card at
 * the top of a Studio-reference surface.
 */
export function StudioPrimaryCard({ eyebrow, title, description, action, icon, children, className }: StudioPrimaryCardProps) {
  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-border bg-card p-5 sm:p-6", className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{ background: "radial-gradient(120% 100% at 0% 0%, hsl(var(--energy) / 0.06), transparent 60%)" }}
      />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
          {eyebrow && (
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{eyebrow}</p>
          )}
          <div className="flex items-center gap-2.5">
            {icon && <span className="text-[hsl(var(--energy))] shrink-0">{icon}</span>}
            <p className="text-xl font-bold text-foreground leading-tight">{title}</p>
          </div>
          {description && <p className="text-sm text-muted-foreground max-w-md">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children && <div className="relative mt-4">{children}</div>}
    </div>
  );
}
