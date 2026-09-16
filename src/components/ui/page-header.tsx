import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  className?: string;
  size?: "default" | "sm";
}

/**
 * Brand-standard page header.
 * Lime eyebrow → sculptural black H1 → muted subtitle → optional actions.
 * Use this on every primary surface to enforce the cinematic editorial vibe.
 */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  icon: Icon,
  actions,
  className,
  size = "default",
}: PageHeaderProps) {
  const titleSize = size === "sm" ? "text-2xl" : "text-3xl md:text-4xl";
  const iconSize = size === "sm" ? "h-6 w-6" : "h-7 w-7 md:h-8 md:w-8";

  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 border-b-2 border-primary/20 pb-4 mb-6",
        className,
      )}
    >
      <div className="space-y-1 min-w-0 flex-1">
        {eyebrow && <p className="brand-eyebrow">{eyebrow}</p>}
        <h1
          className={cn(
            "font-black tracking-[-0.03em] flex items-start gap-3 leading-[1.05] break-words",
            titleSize,
          )}
        >
          {Icon && <Icon className={cn("text-primary shrink-0 mt-1", iconSize)} />}
          <span className="min-w-0">{title}</span>
        </h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground max-w-xl">{subtitle}</p>
        )}
      </div>
      {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
    </div>
  );
}
