/**
 * FeatureTutorialPanel — the full-width, step-reactive tutorial that
 * replaces the old compact one-step-at-a-time card below each chapter's
 * photo. Pairs a large visual preview with the TutorialStepper's full
 * step list; the visual reacts live as the stepper is navigated.
 */
import { useState, type ComponentType } from "react";
import { motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { TutorialStepper } from "./TutorialStepper";
import type { TutorialStep } from "./FeatureTutorial";

interface FeatureTutorialPanelProps {
  steps: TutorialStep[];
  label: string;
  visual: ComponentType<{ activeStep: number; inView: boolean }>;
  reverse?: boolean;
}

export const FeatureTutorialPanel = ({ steps, label, visual: Visual, reverse }: FeatureTutorialPanelProps) => {
  const reducedMotion = useReducedMotion();
  const [activeStep, setActiveStep] = useState(0);
  // Once this panel scrolls into view, the stepper starts auto-advancing on
  // its own — visitors don't have to click anything to see the tutorial play.
  const [inView, setInView] = useState(false);

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      onViewportEnter={() => setInView(true)}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7 }}
      className="mt-16 lg:mt-20"
    >
      <div className={`grid lg:grid-cols-12 gap-8 lg:gap-14 items-start ${reverse ? "lg:[&>*:first-child]:order-2" : ""}`}>
        <div className="lg:col-span-5">
          <Visual activeStep={activeStep} inView={inView} />
        </div>
        <div className="lg:col-span-7">
          <TutorialStepper steps={steps} label={label} activeStep={activeStep} onStepChange={setActiveStep} autoPlay={inView} />
        </div>
      </div>
    </motion.div>
  );
};

export default FeatureTutorialPanel;
