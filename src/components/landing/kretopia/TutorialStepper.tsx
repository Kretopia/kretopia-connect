/**
 * TutorialStepper — the full, all-steps-visible interactive tutorial list
 * used inside FeatureTutorialPanel. Unlike a compact one-step-at-a-time
 * card, every step is its own row in a connected roadmap: click any row
 * (or arrow-key between them) to jump straight to it and expand its
 * detail. Built to fill real space, not sit as a small card.
 */
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";
import type { TutorialStep } from "./FeatureTutorial";

const ACCENT = "#FF2DA1";
const AUTOPLAY_INTERVAL_MS = 4500;

// Rows cascade in top-to-bottom, one after another, the first time the list
// scrolls into view — the paired visual (e.g. the search preview) sits
// outside this component and never moves.
const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};
const rowVariants = {
  hidden: { opacity: 0, y: -10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.2, 0.65, 0.3, 0.95] } },
};

interface TutorialStepperProps {
  steps: TutorialStep[];
  label: string;
  activeStep?: number;
  onStepChange?: (index: number) => void;
  /** Auto-advance through steps on a timer, looping — meant for landing
   * demos that should feel alive as soon as they scroll into view. Stops
   * permanently the moment the visitor takes manual control (click or
   * arrow key), and never runs under prefers-reduced-motion. */
  autoPlay?: boolean;
}

export const TutorialStepper = ({ steps, label, activeStep, onStepChange, autoPlay = false }: TutorialStepperProps) => {
  const reducedMotion = useReducedMotion();
  const isControlled = activeStep !== undefined;
  const [internalIndex, setInternalIndex] = useState(0);
  const index = isControlled ? (activeStep as number) : internalIndex;
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [userTookControl, setUserTookControl] = useState(false);

  const goTo = (i: number, manual = false) => {
    if (manual) setUserTookControl(true);
    const clamped = Math.max(0, Math.min(steps.length - 1, i));
    if (isControlled) onStepChange?.(clamped);
    else setInternalIndex(clamped);
  };

  // Loop through steps automatically once in view — pauses for good the
  // moment the visitor clicks a step or navigates with arrow keys.
  useEffect(() => {
    if (!autoPlay || reducedMotion || userTookControl || steps.length < 2) return;
    const id = window.setInterval(() => {
      goTo((index + 1) % steps.length);
    }, AUTOPLAY_INTERVAL_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, reducedMotion, userTookControl, index, steps.length]);

  const onRowKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = Math.min(steps.length - 1, i + 1);
      goTo(next, true);
      rowRefs.current[next]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = Math.max(0, i - 1);
      goTo(prev, true);
      rowRefs.current[prev]?.focus();
    }
  };

  // Switching the active step changes THAT row's own height (collapsed
  // rows render no detail block at all; the active one adds a body
  // paragraph + "Next:" pill) — with nothing reserving space for that,
  // every click changed the whole list's height and pushed everything
  // below it (rest of the section, the next chapter) up or down. Floor
  // the list at the height it would be with every row collapsed plus one
  // row's worth of expansion, so the active row can move *within* that
  // reserved space freely but the page around it never has to. Same
  // "min-h floor, not a hard clamp" technique FeatureTutorial already
  // uses for its own single-card layout (min-h-[184px]) — sized here per
  // instance since the roadmap's total height depends on step count.
  const minListHeight = steps.length * 88 + 120;

  return (
    <motion.div
      aria-label={label}
      className="relative"
      style={{ minHeight: `${minListHeight}px` }}
      initial={reducedMotion ? false : "hidden"}
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
      variants={reducedMotion ? undefined : listVariants}
    >
      {steps.map((step, i) => {
        const isActive = i === index;
        const isPast = i < index;
        const isLast = i === steps.length - 1;
        const Icon = step.icon;
        const panelId = `${label.replace(/\s+/g, "-").toLowerCase()}-panel-${i}`;

        return (
          <motion.div key={step.title} className="relative" variants={reducedMotion ? undefined : rowVariants}>
            <button
              ref={(el) => { rowRefs.current[i] = el; }}
              type="button"
              aria-expanded={isActive}
              aria-controls={panelId}
              onClick={() => goTo(i, true)}
              onKeyDown={(e) => onRowKeyDown(e, i)}
              className="group relative flex w-full items-start gap-4 rounded-xl px-3 py-3.5 sm:px-4 text-left transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2"
              style={{
                outlineColor: ACCENT,
                backgroundColor: isActive ? "rgba(255,45,161,0.07)" : "transparent",
              }}
            >
              {/* icon + connecting roadmap line */}
              <span className="relative flex flex-col items-center shrink-0 self-stretch">
                <span
                  className="relative flex h-11 w-11 items-center justify-center rounded-full transition-all duration-300"
                  style={{
                    backgroundColor: isActive ? "rgba(255,45,161,0.16)" : "rgba(255,255,255,0.04)",
                    border: isActive || isPast ? `1px solid ${ACCENT}` : "1px solid rgba(255,255,255,0.14)",
                    boxShadow: isActive ? "0 0 0 4px rgba(255,45,161,0.10)" : "none",
                  }}
                >
                  {isActive && (
                    <span
                      aria-hidden
                      className="absolute inset-0 rounded-full ai-orbit-ring"
                      style={{
                        background:
                          "conic-gradient(from 0deg, transparent 0%, rgba(255,45,161,0.85) 12%, transparent 32%, transparent 58%, rgba(255,45,161,0.65) 74%, transparent 94%)",
                      }}
                    />
                  )}
                  {Icon && (
                    <Icon
                      className="relative h-[18px] w-[18px]"
                      style={{ color: isActive || isPast ? ACCENT : "rgba(255,255,255,0.45)" }}
                      aria-hidden
                    />
                  )}
                </span>
                {!isLast && (
                  <span
                    aria-hidden
                    className="mt-1 w-px flex-1 transition-colors duration-500"
                    style={{ backgroundColor: isPast ? ACCENT : "rgba(255,255,255,0.12)", minHeight: "18px" }}
                  />
                )}
              </span>

              <div className="min-w-0 flex-1 pt-1.5 pb-1">
                <div className="flex items-center gap-2.5">
                  <span
                    className={cn("text-[10px] font-medium tabular-nums", isActive && "pink-glow-breathe")}
                    style={{ color: isActive ? ACCENT : "rgba(255,255,255,0.5)" }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3
                    className={cn("font-semibold transition-colors duration-300", isActive ? "text-white" : "text-white/55 group-hover:text-white/75")}
                    style={{ fontFamily: "'Satoshi', 'Inter', sans-serif", fontSize: isActive ? "1.0625rem" : "0.9375rem" }}
                  >
                    {step.title}
                  </h3>
                </div>

                <AnimatePresence initial={false}>
                  {isActive && (
                    <motion.div
                      id={panelId}
                      role="region"
                      aria-label={step.title}
                      initial={reducedMotion ? false : { opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={reducedMotion ? undefined : { opacity: 0, height: 0 }}
                      transition={{ duration: 0.3, ease: [0.2, 0.65, 0.3, 0.95] }}
                      className="overflow-hidden"
                    >
                      <p className="mt-2 pr-2 text-sm leading-relaxed text-white/60" style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}>
                        {step.body}
                      </p>
                      {!isLast && (
                        <span
                          className="mt-3 inline-flex items-center gap-1 text-xs font-medium pink-glow-breathe"
                          style={{ color: ACCENT, fontFamily: "'Satoshi', 'Inter', sans-serif" }}
                        >
                          Next: {steps[i + 1].title}
                          <ChevronRight className="h-3 w-3" aria-hidden />
                        </span>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </button>
          </motion.div>
        );
      })}
    </motion.div>
  );
};

export default TutorialStepper;
