import { DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TutorialStepper } from "@/components/landing/kretopia/TutorialStepper";
import type { TutorialStep } from "@/components/landing/kretopia/FeatureTutorial";
import { useReducedMotion } from "@/hooks/useReducedMotion";

export function FeatureTutorialDialogContent({ label, steps, onDismiss }: {
  label: string;
  steps: TutorialStep[];
  onDismiss: () => void;
}) {
  const reducedMotion = useReducedMotion();
  return (
    <DialogContent className="max-w-lg overflow-hidden border-border bg-background p-0 text-foreground">
      <DialogTitle className="sr-only">{label}</DialogTitle>
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,hsl(var(--foreground)/0.06),transparent_65%)]" />
      <div className="relative p-6">
        <p className="landing-eyebrow mb-1">AI-guided tour</p>
        <h2 className="mb-5 text-2xl font-semibold text-foreground">{label}.</h2>
        <TutorialStepper steps={steps} label={label} autoPlay={!reducedMotion} />
        <Button type="button" variant="outline" onClick={onDismiss} className="mt-6 w-full rounded-full border-border text-sm font-semibold">Got it</Button>
      </div>
    </DialogContent>
  );
}