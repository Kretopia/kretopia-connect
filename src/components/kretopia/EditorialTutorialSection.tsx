/**
 * EditorialTutorialSection — the landing chapter's interactive tutorial
 * (FeatureTutorialPanel: step-reactive visual + auto-advancing stepper),
 * lifted onto standalone pages so Verified Credits, Spotlight and About all
 * teach themselves exactly the way the landing page does. Zero clicks
 * required: the stepper starts playing as soon as it scrolls into view.
 */
import type { ComponentType } from "react";
import { motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { FeatureTutorialPanel } from "@/components/landing/kretopia/FeatureTutorialPanel";
import type { TutorialStep } from "@/components/landing/kretopia/FeatureTutorial";

const ACCENT = "#FF2DA1";

interface EditorialTutorialSectionProps {
  eyebrow: string;
  heading: React.ReactNode;
  accentWord?: string;
  body?: string;
  steps: TutorialStep[];
  label: string;
  visual: ComponentType<{ activeStep: number; inView: boolean }>;
  reverse?: boolean;
  id?: string;
}

export const EditorialTutorialSection = ({
  eyebrow, heading, accentWord, body, steps, label, visual, reverse, id,
}: EditorialTutorialSectionProps) => {
  const reducedMotion = useReducedMotion();

  return (
    <section
      id={id}
      className="relative overflow-hidden border-b border-white/[0.06]"
      style={{ backgroundColor: "#05070D" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(45% 55% at 78% 30%, rgba(255,45,161,0.10), transparent 62%)" }}
      />

      <div className="relative mx-auto max-w-[1320px] px-5 sm:px-8 lg:px-12 py-16 sm:py-24">
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8 }}
          className="max-w-2xl"
        >
          <p className="landing-eyebrow mb-4">{eyebrow}</p>
          <h2 className="landing-h2 landing-glow">
            {heading}
            {accentWord && (
              <>
                {" "}
                <span className="landing-accent">{accentWord}</span>
              </>
            )}
            <span className="pink-glow-breathe" style={{ color: ACCENT }}>.</span>
          </h2>
          {body && <p className="landing-sub mt-6">{body}</p>}
        </motion.div>

        <FeatureTutorialPanel steps={steps} label={label} visual={visual} reverse={reverse} />
      </div>
    </section>
  );
};

export default EditorialTutorialSection;
