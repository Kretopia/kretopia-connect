import { ReactNode } from "react";
import { ArrowLeft, LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface WorkflowShellProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  onBack?: () => void;
  /** Optional accent override; defaults to energy lime */
  accentClassName?: string;
  children: ReactNode;
  /** Extra controls (e.g. add button) on the right side of the header */
  actions?: ReactNode;
}

/**
 * Studio-styled shell for project deep tools (Vault, Pad, Call Sheet,
 * Run of Show, Roll Call, Split Sheet, Revisions). Gives every tool a
 * cinematic header that matches the Studio Room aesthetic, while letting
 * the existing tool body render unchanged underneath.
 */
export function WorkflowShell({
  eyebrow,
  title,
  subtitle,
  icon: Icon,
  onBack,
  accentClassName,
  actions,
  children,
}: WorkflowShellProps) {
  return (
    <div className="-m-4 md:-m-6">
      <header className="relative overflow-hidden border-b border-border/60 bg-gradient-to-br from-[hsl(var(--energy)/0.08)] via-background to-primary/5">
        {/* radial accent */}
        <div
          aria-hidden
          className={cn(
            "absolute -top-12 -right-10 h-44 w-44 rounded-full blur-3xl opacity-30",
            accentClassName ?? "bg-[hsl(var(--energy))]",
          )}
        />
        <div className="relative px-4 py-5 md:px-6 md:py-6 flex items-start gap-3">
          {onBack && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 -ml-2 shrink-0"
              onClick={onBack}
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div
            className={cn(
              "shrink-0 flex h-11 w-11 items-center justify-center rounded-xl ring-1 ring-[hsl(var(--energy)/0.4)] bg-[hsl(var(--energy)/0.12)]",
            )}
          >
            <Icon className="h-5 w-5 text-[hsl(var(--energy))]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[hsl(var(--energy))]">
              {eyebrow}
            </p>
            <h1 className="text-xl md:text-2xl font-black leading-tight tracking-tight truncate">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs md:text-sm text-muted-foreground mt-0.5 line-clamp-2">
                {subtitle}
              </p>
            )}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>
      </header>

      <div className="px-4 py-5 md:px-6 md:py-6">{children}</div>
    </div>
  );
}
