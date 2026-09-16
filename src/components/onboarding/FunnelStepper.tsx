import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const ONBOARDING_STEPS = [
  { key: "signup", label: "Sign up" },
  { key: "discover", label: "First Stamp" },
  { key: "review", label: "Launch Passport" },
] as const;

type StepKey = (typeof ONBOARDING_STEPS)[number]["key"];

export interface FunnelStep {
  key: string;
  label: string;
}

interface FunnelStepperProps {
  current: string;
  /** Defaults to the onboarding funnel's own 3 steps for backward
   *  compatibility -- pass a different array to reuse this same stepper
   *  (identical grid math, connector line, done/active/upcoming states)
   *  for another multi-step flow (e.g. New Room's Describe/Review/Create). */
  steps?: readonly FunnelStep[];
  className?: string;
}

/**
 * Unified Landing → Signup → Onboarding step indicator.
 * Renders three dots with connector lines and labels.
 *
 * A first attempt used `flex justify-between` on the three dot+label
 * columns, expecting their anchor points to land at exactly 0%/50%/100%.
 * That's only true if all three columns are the same width — they aren't:
 * `justify-between` sizes each column to fit its OWN label
 * (`whitespace-nowrap`), so "Sign up" gets a narrow column and "Launch
 * Passport" gets a much wider one, and the dot (centered *within its own
 * column* via `items-center`) drifts off the true evenly-spaced point by
 * however much that column's width differs from the others — the same
 * "the label decides the dot's position" bug as the very first version,
 * just smaller. A CSS grid with three explicit equal `1fr` tracks doesn't
 * have that failure mode: each track's width is fixed by the grid, not by
 * its content, so a long label can only overflow its own track visually —
 * it can never widen it or shift the dot centered inside it. That makes
 * the three dot centers land at exactly 1/6, 3/6 and 5/6 of the row width
 * by construction, which is also exactly where the connector track's
 * `left-[16.667%] right-[16.667%]` inset points to — no per-label
 * measurement needed for the two to agree.
 */
export function FunnelStepper({ current, steps = ONBOARDING_STEPS, className }: FunnelStepperProps) {
  const currentIdx = steps.findIndex((s) => s.key === current);

  return (
    <div className={cn("w-full", className)}>
      <div className="relative grid" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        <div
          className="pointer-events-none absolute top-4 h-0.5 -translate-y-1/2 rounded-full bg-muted overflow-hidden"
          style={{ left: `${50 / steps.length}%`, right: `${50 / steps.length}%` }}
        >
          <div
            className="h-full bg-[hsl(var(--signal-teal))] transition-all duration-500"
            style={{ width: `${(currentIdx / (steps.length - 1)) * 100}%` }}
          />
        </div>
        {steps.map((step, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          return (
            <div key={step.key} className="relative z-10 flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center text-[12px] font-bold transition-all",
                  done && "bg-[hsl(var(--signal-teal))] text-white",
                  active && "bg-[hsl(var(--signal-teal))] text-white ring-4 ring-[hsl(var(--signal-teal))]/20 scale-110 shadow-[0_0_0_1px_hsl(var(--signal-teal))]",
                  !done && !active && "bg-muted text-muted-foreground border border-border",
                )}
                aria-current={active ? "step" : undefined}
              >
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className={cn(
                  "text-[10px] font-semibold whitespace-nowrap transition-colors",
                  active && "text-[hsl(var(--signal-teal))]",
                  done && "text-foreground",
                  !done && !active && "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export type { StepKey };
