import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StudioEmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function StudioEmptyState({ icon, title, description, action, className }: StudioEmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card/40 px-6 py-10 text-center", className)}>
      {icon && <div className="text-muted-foreground/60 mb-1">{icon}</div>}
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && <p className="text-xs text-muted-foreground max-w-xs">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

interface StudioErrorStateProps {
  title?: string;
  description: string;
  onRetry?: () => void;
  className?: string;
}

export function StudioErrorState({ title = "Something went wrong", description, onRetry, className }: StudioErrorStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 px-6 py-8 text-center", className)}>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground max-w-xs">{description}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 text-xs font-semibold text-[hsl(var(--energy))] hover:underline"
        >
          Try again
        </button>
      )}
    </div>
  );
}
