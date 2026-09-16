import { LucideIcon } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

interface ActionConfig {
  label: string;
  onClick: () => void;
  icon?: LucideIcon;
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  /** Short eyebrow tag shown above the title (e.g. "Inbox zero") */
  eyebrow?: string;
  /** Primary call-to-action — uses the brand lime button */
  action?: ActionConfig;
  /** Secondary call-to-action — ghost style */
  secondaryAction?: ActionConfig;
  /** Visual emphasis: 'lime' (default) or 'purple' for matching context */
  accent?: "lime" | "purple";
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  eyebrow,
  action,
  secondaryAction,
  accent = "lime",
  className,
}: EmptyStateProps) {
  const isLime = accent === "lime";
  const orbBg = isLime ? "bg-energy/10 border-energy/30 shadow-glow-lime" : "bg-primary/10 border-primary/30 shadow-glow-purple";
  const iconColor = isLime ? "text-energy" : "text-primary";
  const PrimaryIcon = action?.icon;
  const SecondaryIcon = secondaryAction?.icon;

  return (
    <div className={cn("flex flex-col items-center justify-center py-12 px-4 text-center", className)}>
      <div className={cn("mb-5 mx-auto w-20 h-20 rounded-2xl border-2 flex items-center justify-center", orbBg)}>
        <Icon className={cn("h-10 w-10", iconColor)} />
      </div>
      {eyebrow && <p className="brand-eyebrow mb-2">{eyebrow}</p>}
      <h3 className="text-xl font-black tracking-[-0.02em] mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-5">{description}</p>
      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row items-center gap-2">
          {action && (
            <Button onClick={action.onClick} variant={isLime ? "lime" : "gradient"} size="sm" className="gap-2 rounded-full">
              {PrimaryIcon && <PrimaryIcon className="h-4 w-4" />}
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button onClick={secondaryAction.onClick} variant="ghost" size="sm" className="gap-2 rounded-full text-muted-foreground hover:text-foreground">
              {SecondaryIcon && <SecondaryIcon className="h-4 w-4" />}
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
