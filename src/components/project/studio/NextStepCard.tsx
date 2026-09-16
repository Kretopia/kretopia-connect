import { ArrowRight, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NextStep } from "@/hooks/useProjectFlow";

interface NextStepCardProps {
  nextStep: NextStep;
  onAction: (tab: string, intent?: string) => void;
  className?: string;
}

/**
 * In-feed Next Step card — replaces passive "what's next?" thinking with
 * one decisive CTA. Cinematic brand styling: violet gradient base, lime
 * energy eyebrow, sculptural type, soft glow.
 */
export const NextStepCard = ({ nextStep, onAction, className }: NextStepCardProps) => {
  return (
    <section className={cn("px-4 pt-4", className)}>
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border border-primary/40 p-4 sm:p-5",
          "bg-gradient-to-br from-primary/20 via-primary/5 to-transparent",
          "shadow-[var(--shadow-card)]",
        )}
      >
        {/* Decorative violet glow + lime spark in corner */}
        <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-primary/30 blur-3xl pointer-events-none" />
        <div className="absolute top-3 right-3 h-1.5 w-1.5 rounded-full bg-[hsl(var(--energy))] shadow-[0_0_10px_hsl(var(--energy)/0.9)]" />

        <div className="relative flex items-start gap-3">
          {/* Lime energy icon — the "do this" pulse */}
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--energy))] text-[hsl(var(--energy-foreground))] shadow-[0_0_18px_hsl(var(--energy)/0.45)]">
            <Zap className="h-5 w-5" strokeWidth={2.5} />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[hsl(var(--energy))] mb-1">
              Your Next Move
            </p>
            <h3 className="text-lg sm:text-xl font-black tracking-[-0.02em] leading-[1.15] text-foreground">
              {nextStep.title}
            </h3>
            <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground leading-relaxed">
              {nextStep.description}
            </p>

            <div className="mt-3.5 flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                className="h-9 px-4 gap-1.5 rounded-full font-semibold shadow-[var(--shadow-glow)]"
                onClick={() => onAction(nextStep.ctaTab, nextStep.ctaIntent)}
              >
                {nextStep.ctaLabel}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
              {nextStep.secondary && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-9 px-3 text-xs text-muted-foreground hover:text-foreground rounded-full"
                  onClick={() =>
                    onAction(nextStep.secondary!.tab, nextStep.secondary!.intent)
                  }
                >
                  {nextStep.secondary.label}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
