import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { FeatureTutorialDialogContent } from "./FeatureTutorialDialogContent";
import type { TutorialStep } from "@/components/landing/kretopia/FeatureTutorial";
import { useFirstTimeUser } from "@/hooks/useFirstTimeUser";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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
 * inside a theme-aware panel.
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

  const sparkle = <Sparkles className="h-3 w-3" />;

  return (
    <>
      {variant === "floating" ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          aria-label={label}
          title={label}
          className={cn(
            "inline-flex h-auto items-center gap-1.5 rounded-full border-border bg-background/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground",
            className,
          )}
        >
          {sparkle}
          <span className="hidden sm:inline">How this works</span>
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          className={cn(
            "mt-3 inline-flex h-auto items-center gap-1.5 rounded-full border-border bg-background/80 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground",
            className,
          )}
        >
          {sparkle}
          How this works
        </Button>
      )}

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : dismiss())}>
        <FeatureTutorialDialogContent label={label} steps={steps} onDismiss={dismiss} />
      </Dialog>
    </>
  );
}

export default FeatureAITutorial;
