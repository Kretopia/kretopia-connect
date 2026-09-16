/**
 * FeatureTutorial — the one shared, interactive tutorial surface used by
 * every landing-page feature chapter. A glowing icon ring and a brief
 * typing-indicator flourish precede each step's text reveal.
 *
 * Static content (steps are authored, not fetched), so there's no
 * loading/error state to model. Every interaction contract still holds:
 * clickable step pills, keyboard (ArrowLeft/ArrowRight/Home/End), touch
 * swipe, a visible progress indicator, and full behavior under
 * prefers-reduced-motion — the typing flourish is skipped entirely and
 * step transitions cut instantly instead of animating.
 *
 * Deliberately framework-agnostic about *what* a step shows — the caller
 * passes a title/body per step and an optional small icon, so this same
 * component works for Search, Passport, Scout, Match, Studio, SoundStages,
 * Kreto, Verified Credits and the Messages empty state without a bespoke
 * implementation per feature.
 */
import { useEffect, useRef, useState, type KeyboardEvent, type TouchEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

const ACCENT = "#FF2DA1";
const SWIPE_THRESHOLD_PX = 40;
const THINKING_MS = 360;

export interface TutorialStep {
  title: string;
  body: string;
  icon?: LucideIcon;
}

interface FeatureTutorialProps {
  steps: TutorialStep[];
  /** Announced to screen readers as the tutorial's subject, e.g. "Scout tutorial". */
  label: string;
  /** Controlled mode: parent owns the active step (e.g. to drive a visual
   * preview alongside it). Omit both for the previous self-contained
   * behavior — used as-is by Messages.tsx today. */
  activeStep?: number;
  onStepChange?: (index: number) => void;
}

export const FeatureTutorial = ({ steps, label, activeStep, onStepChange }: FeatureTutorialProps) => {
  const reducedMotion = useReducedMotion();
  const isControlled = activeStep !== undefined;
  const [internalIndex, setInternalIndex] = useState(0);
  const index = isControlled ? activeStep : internalIndex;
  const [thinking, setThinking] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const firstRender = useRef(true);

  // Brief "composing" flourish before each new step's text reveals — skipped
  // entirely under reduced motion and on first mount (nothing to transition
  // from yet).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (reducedMotion) return;
    setThinking(true);
    const t = window.setTimeout(() => setThinking(false), THINKING_MS);
    return () => window.clearTimeout(t);
  }, [index, reducedMotion]);

  const goTo = (i: number) => {
    const clamped = Math.max(0, Math.min(steps.length - 1, i));
    if (isControlled) onStepChange?.(clamped);
    else setInternalIndex(clamped);
  };
  const next = () => goTo(index + 1);
  const prev = () => goTo(index - 1);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") { e.preventDefault(); next(); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
    else if (e.key === "Home") { e.preventDefault(); goTo(0); }
    else if (e.key === "End") { e.preventDefault(); goTo(steps.length - 1); }
  };

  const onTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current === null) return;
    const dx = (e.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
    if (dx < 0) next(); else prev();
  };

  const step = steps[index];
  const Icon = step.icon;
  const isFirst = index === 0;
  const isLast = index === steps.length - 1;
  const showThinking = thinking && !reducedMotion;

  return (
    <div
      role="group"
      aria-label={label}
      aria-roledescription="tutorial"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      className="relative rounded-2xl overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
      style={{
        background: "linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.015))",
        border: "1px solid rgba(255,255,255,0.10)",
        boxShadow: "0 30px 80px -40px rgba(255,45,161,0.35)",
        outlineColor: ACCENT,
      }}
    >
      {/* ambient glow — breathes slowly, an "always-on" AI presence */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 ai-ambient-breathe"
        style={{ background: "radial-gradient(60% 80% at 15% 0%, rgba(255,45,161,0.14), transparent 65%)" }}
      />

      {/* Continuous scan-line sweep along the top edge */}
      <div aria-hidden className="pointer-events-none absolute top-0 left-0 right-0 h-px overflow-hidden">
        <div
          className="ai-scan-line h-full w-1/3"
          style={{ background: "linear-gradient(90deg, transparent, rgba(255,45,161,0.9), transparent)" }}
        />
      </div>

      {/* Header — just the step counter, no AI badge */}
      <div
        className="relative flex items-center justify-end px-4 py-2.5 sm:px-5"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
      >
        <span
          className="text-[10px] font-medium tabular-nums"
          style={{ color: "rgba(255,255,255,0.35)", fontFamily: "'Satoshi', 'Inter', sans-serif" }}
        >
          {String(index + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}
        </span>
      </div>

      <div className="relative px-5 py-7 sm:px-6 sm:py-8 min-h-[184px] flex flex-col justify-center">
        <AnimatePresence mode="wait">
          {showThinking ? (
            <motion.div
              key="thinking"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-1.5 h-[92px]"
              aria-hidden
            >
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: ACCENT }}
                  animate={{ opacity: [0.25, 1, 0.25], y: [0, -3, 0] }}
                  transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
                />
              ))}
            </motion.div>
          ) : (
            <motion.div
              key={index}
              initial={reducedMotion ? false : { opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reducedMotion ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: 0.35, ease: [0.2, 0.65, 0.3, 0.95] }}
              className="flex items-start gap-3.5"
            >
              {Icon && (
                <motion.div
                  className="relative mt-0.5 h-14 w-14 shrink-0"
                  initial={reducedMotion ? false : { scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.4, ease: [0.2, 0.65, 0.3, 0.95] }}
                >
                  {/* Slowly orbiting gradient ring — the "AI is active" signal */}
                  <div
                    aria-hidden
                    className="absolute inset-0 rounded-full ai-orbit-ring"
                    style={{
                      background:
                        "conic-gradient(from 0deg, transparent 0%, rgba(255,45,161,0.95) 12%, transparent 32%, transparent 58%, rgba(255,45,161,0.75) 74%, transparent 94%)",
                    }}
                  />
                  {/* Breathing halo behind the ring */}
                  <div
                    aria-hidden
                    className="absolute -inset-1.5 rounded-full ai-ambient-breathe"
                    style={{ background: "radial-gradient(circle, rgba(255,45,161,0.28), transparent 70%)" }}
                  />
                  {/* Icon box, inset so the ring peeks out around its edge */}
                  <span
                    className="absolute inset-[3px] flex items-center justify-center rounded-full"
                    style={{ backgroundColor: "#0b0e16", border: "1px solid rgba(255,45,161,0.3)" }}
                  >
                    <Icon className="h-[18px] w-[18px]" style={{ color: ACCENT }} aria-hidden />
                  </span>
                </motion.div>
              )}
              <div className="min-w-0 pt-1.5">
                <h3 className="text-base sm:text-lg font-semibold text-white" style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}>
                  {step.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-white/60" style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}>
                  {step.body}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div
        className="relative flex items-center justify-between gap-3 px-5 py-3.5 sm:px-6"
        style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
      >
        <button
          type="button"
          onClick={prev}
          disabled={isFirst}
          aria-label="Previous step"
          className="btn-glass btn-glass-outline flex h-8 w-8 items-center justify-center rounded-full disabled:opacity-30 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2"
          style={{ outlineColor: ACCENT }}
        >
          <ChevronLeft className="h-4 w-4 text-white/80" aria-hidden />
        </button>

        {/* Clickable step pills — the progress indicator doubles as jump nav */}
        <div className="flex items-center gap-1.5" role="tablist" aria-label={`${label} steps`}>
          {steps.map((s, i) => (
            <button
              key={s.title}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Go to step ${i + 1}: ${s.title}`}
              onClick={() => goTo(i)}
              className={cn(
                "relative h-1.5 rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2",
                i === index && "ai-ambient-breathe",
              )}
              style={{
                width: i === index ? "22px" : "6px",
                backgroundColor: i <= index ? ACCENT : "rgba(255,255,255,0.18)",
                boxShadow: i === index ? "0 0 8px rgba(255,45,161,0.65)" : "none",
                outlineColor: ACCENT,
              }}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={next}
          disabled={isLast}
          aria-label="Next step"
          className="btn-glass btn-glass-outline flex h-8 w-8 items-center justify-center rounded-full disabled:opacity-30 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2"
          style={{ outlineColor: ACCENT }}
        >
          <ChevronRight className="h-4 w-4 text-white/80" aria-hidden />
        </button>
      </div>
    </div>
  );
};

export default FeatureTutorial;
