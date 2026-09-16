import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { TutorialStepper } from "@/components/landing/kretopia/TutorialStepper";
import type { TutorialStep } from "@/components/landing/kretopia/FeatureTutorial";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useFirstTimeUser } from "@/hooks/useFirstTimeUser";
import { cn } from "@/lib/utils";

const ACCENT = "hsl(var(--energy))";

interface FeatureAITutorialProps {
  /** Unique per feature, e.g. "studio". Gates the auto-open-once-for-new-users behavior. */
  featureKey: string;
  /** e.g. "How Studio works" */
  label: string;
  steps: TutorialStep[];
  /**
   * "chip"     — inline pill (default, used on pages that own their own layout)
   * "floating" — compact icon button meant to be absolutely positioned by the
   *              parent, so the trigger never stacks between a header and the
   *              first card ("sandwich" effect).
   */
  variant?: "chip" | "floating";
  className?: string;
}

/**
 * Shared "AI tutorial" affordance mounted on every overhauled feature page.
 * Reuses the actual landing-page TutorialStepper (not a re-implementation)
 * inside a forced-dark panel.
 *
 * Auto-open policy: ONLY genuinely new users get the tour pushed at them
 * (useFirstTimeUser — young account / low XP). Everyone else just gets the
 * quiet trigger, so returning users never hit a modal wall. Once seen (or
 * dismissed) it never auto-opens again for that feature on that browser.
 */
export function FeatureAITutorial({
  featureKey,
  label,
  steps,
  variant = "chip",
  className,
}: FeatureAITutorialProps) {
  const storageKey = `kretopia-tutorial-seen:${featureKey}`;
  const [open, setOpen] = useState(false);
  const reducedMotion = useReducedMotion();
  const { isFirstTime, loading } = useFirstTimeUser();

  useEffect(() => {
    if (loading || !isFirstTime) return;
    try {
      if (!localStorage.getItem(storageKey)) setOpen(true);
    } catch {
      /* private-browsing localStorage access can throw — skip auto-open, trigger still works */
    }
  }, [storageKey, isFirstTime, loading]);

  const dismiss = () => {
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      /* noop */
    }
    setOpen(false);
  };

  const sparkle = <Sparkles className={reducedMotion ? "h-3 w-3" : "h-3 w-3 pink-glow-breathe"} />;

  return (
    <>
      {variant === "floating" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={label}
          title={label}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors hover:bg-[rgba(255,45,161,0.12)]",
            className,
          )}
          style={{
            borderColor: "rgba(255,45,161,0.28)",
            backgroundColor: "rgba(255,45,161,0.05)",
            color: ACCENT,
          }}
        >
          {sparkle}
          <span className="hidden sm:inline">How this works</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "mt-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors",
            className,
          )}
          style={{
            borderColor: "rgba(255,45,161,0.3)",
            backgroundColor: "rgba(255,45,161,0.06)",
            color: ACCENT,
          }}
        >
          {sparkle}
          How this works
        </button>
      )}

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : dismiss())}>
        <DialogContent
          className="dark max-w-lg p-0 overflow-hidden border-white/10"
          style={{ backgroundColor: "#05070D" }}
        >
          <DialogTitle className="sr-only">{label}</DialogTitle>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(60% 50% at 50% 0%, rgba(255,45,161,0.12), transparent 65%)" }}
          />
          <div className="relative p-6">
            <p className="landing-eyebrow mb-1">AI-guided tour</p>
            <h2 className="landing-h2 landing-glow text-2xl mb-5">
              {label}
              <span className="pink-glow-breathe" style={{ color: ACCENT }}>.</span>
            </h2>
            <TutorialStepper steps={steps} label={label} autoPlay={!reducedMotion} />
            <button
              type="button"
              onClick={dismiss}
              className="btn-glass btn-glass-primary mt-6 w-full rounded-full px-5 py-2.5 text-sm font-semibold"
            >
              Got it
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default FeatureAITutorial;
