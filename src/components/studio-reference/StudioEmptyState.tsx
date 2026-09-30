import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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
      {icon && <div className="k-gradient-chip k-gradient-icon mb-1 flex h-7 w-7 items-center justify-center rounded-lg [&_svg]:h-3.5 [&_svg]:w-3.5">{icon}</div>}
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
        <Button
          type="button"
          variant="link"
          onClick={onRetry}
          className="mt-2 h-auto p-0 text-xs font-semibold text-foreground hover:underline"
        >
          Try again
        </Button>
      )}
    </div>
  );
}
