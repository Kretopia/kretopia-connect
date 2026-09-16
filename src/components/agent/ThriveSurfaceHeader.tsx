import { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { ThriveMark } from "./ThriveMark";
import { cn } from "@/lib/utils";

interface Props {
  /** Main title — usually "Thrive" or "Thrive · Capabilities" */
  title: string;
  /** Tiny chip on the right (e.g., "On: Desk") */
  surfaceLabel?: string;
  /** Subtext under the title, one short line */
  subtitle?: string;
  /** Right-side action slot (buttons / clear / help) */
  actions?: ReactNode;
  className?: string;
}

/**
 * Shared header for every Thrive surface (Copilot drawer, Capabilities sheet,
 * Approvals Hub bottom sheet, Plan-mode panel). Keeps the visual language
 * identical so the user knows "this is Thrive" no matter where it appears.
 */
export const ThriveSurfaceHeader = ({
  title,
  surfaceLabel,
  subtitle,
  actions,
  className,
}: Props) => {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <ThriveMark size="md" />
          <h2 className="text-base font-bold tracking-tight truncate">{title}</h2>
          {surfaceLabel && (
            <Badge variant="secondary" className="text-[10px] uppercase tracking-wider shrink-0">
              On: {surfaceLabel}
            </Badge>
          )}
        </div>
        {subtitle && (
          <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-1 shrink-0">{actions}</div>}
    </div>
  );
};
