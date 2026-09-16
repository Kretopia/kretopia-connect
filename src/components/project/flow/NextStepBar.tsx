import { memo } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NextStep } from "@/hooks/useProjectFlow";

interface NextStepBarProps {
  nextStep: NextStep;
  onAction: (tab: string, intent?: string) => void;
  className?: string;
}

/**
 * Persistent "Next Step" bar that sits above the tab content
 * across every Desk tab. Drives users forward with one clear CTA.
 */
export const NextStepBar = memo(({ nextStep, onAction, className }: NextStepBarProps) => {
  return (
    <div
      className={cn(
        "border-b border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-4 py-2.5 shrink-0",
        className
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="hidden sm:flex h-8 w-8 rounded-lg bg-primary/15 items-center justify-center shrink-0">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
              Next Step
            </span>
          </div>
          <p className="text-sm font-semibold truncate">{nextStep.title}</p>
          <p className="text-xs text-muted-foreground truncate hidden sm:block">
            {nextStep.description}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {nextStep.secondary && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs hidden md:inline-flex"
              onClick={() => onAction(nextStep.secondary!.tab, nextStep.secondary!.intent)}
            >
              {nextStep.secondary.label}
            </Button>
          )}
          <Button
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => onAction(nextStep.ctaTab, nextStep.ctaIntent)}
          >
            {nextStep.ctaLabel}
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
});

NextStepBar.displayName = "NextStepBar";
