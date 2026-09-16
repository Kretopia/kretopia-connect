import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface TodaySectionShellProps {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  trailing?: ReactNode;
  seeAllTo?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Shared visual shell for Today's three top-level components (Focus / More
 * from Today / Momentum) — one consistent header + card system instead of
 * three unrelated ones, per the overhaul spec's "wrap each component using
 * a shared interactive dashboard primitive."
 */
export function TodaySectionShell({
  icon,
  eyebrow,
  title,
  trailing,
  seeAllTo,
  children,
  className,
}: TodaySectionShellProps) {
  return (
    <section className={cn("rounded-3xl border border-border bg-card p-4 sm:p-5", className)}>
      <header className="flex items-center justify-between gap-3 mb-3.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {icon}
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{eyebrow}</p>
            <h2 className="text-base font-bold leading-tight text-foreground truncate">{title}</h2>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {trailing}
          {seeAllTo && (
            <Link to={seeAllTo} className="text-xs font-semibold text-primary hover:underline whitespace-nowrap">
              See all
            </Link>
          )}
        </div>
      </header>
      {children}
    </section>
  );
}

export default TodaySectionShell;
