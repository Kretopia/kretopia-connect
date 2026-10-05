import { useState } from "react";
import { Fingerprint } from "lucide-react";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FeatureTutorialDialogContent } from "@/components/features/FeatureTutorialDialogContent";
import type { TutorialStep } from "./FeatureTutorial";

interface KretopiaFeatureTutorialProps {
  steps: TutorialStep[];
  featureName: string;
}

export function KretopiaFeatureTutorial({ steps, featureName }: KretopiaFeatureTutorialProps) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" aria-label={`Open how ${featureName} works`}
          className="group h-12 w-full gap-2.5 rounded-full border-foreground/30 bg-card text-foreground shadow-sm hover:border-foreground/60 hover:bg-accent focus-visible:ring-ring">
          <Fingerprint className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110" aria-hidden />
          See how it works
        </Button>
      </DialogTrigger>
      <FeatureTutorialDialogContent label={`How ${featureName} works`} steps={steps} onDismiss={() => setOpen(false)} />
    </Dialog>
  );
}

export default KretopiaFeatureTutorial;
