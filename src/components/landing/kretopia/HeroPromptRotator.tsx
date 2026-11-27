import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { cn } from "@/lib/utils";

import { HERO_PROMPTS, HERO_PROMPT_INTERVAL_MS, nextPromptIndex, type HeroPrompt } from "@/lib/heroJourneys";

interface HeroPromptRotatorProps {
  reducedMotion: boolean;
  /** Stops the rotation while the search is in use (its results are open). */
  paused?: boolean;
  /** A prompt was picked: put its words in the search. */
  onPick: (prompt: HeroPrompt) => void;
  prompts?: readonly HeroPrompt[];
  /** Merged into the row: a host can align it or give it a fixed width. */
  className?: string;
}

/**
 * One example search at a time under the field ("Try: Find a film editor"), changing every few seconds. It is a real button:
 * picking an example puts its words in the search and shows the answers. It never takes anything from the field, stops while the
 * pointer or focus is on it or the search is open, and under prefers-reduced-motion it simply shows the first example and stays.
 * The row has a fixed height, so a longer example never moves the content below it.
 */
export function HeroPromptRotator({ reducedMotion, paused = false, onPick, prompts = HERO_PROMPTS, className }: HeroPromptRotatorProps) {
  const [index, setIndex] = useState(0);
  const [held, setHeld] = useState(false);
  const rotating = !reducedMotion && !paused && !held && prompts.length > 1;

  useEffect(() => {
    if (!rotating) return;
    const timer = window.setInterval(() => {
      // A hidden tab has nobody to read it: let it wait.
      if (document.visibilityState === "hidden") return;
      setIndex((i) => nextPromptIndex(i, prompts.length));
    }, HERO_PROMPT_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [rotating, prompts.length]);

  const prompt = prompts[index] ?? prompts[0];
  if (!prompt) return null;

  return (
    <div className={cn("flex h-7 items-center justify-center gap-2 text-xs text-muted-foreground", className)} data-testid="hero-prompts">
      <span aria-hidden>Try</span>
      <button
        type="button"
        onClick={() => onPick(prompt)}
        onPointerEnter={() => setHeld(true)}
        onPointerLeave={() => setHeld(false)}
        onFocus={() => setHeld(true)}
        onBlur={() => setHeld(false)}
        className="relative inline-flex h-7 min-w-0 items-center overflow-hidden rounded-md px-1.5 text-xs font-medium text-foreground/80 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/50"
        aria-label={`Try searching: ${prompt.label}`}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={prompt.label}
            className="block truncate"
            initial={reducedMotion ? false : { opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? undefined : { opacity: 0, y: -5 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            {prompt.label}
          </motion.span>
        </AnimatePresence>
      </button>
    </div>
  );
}

export default HeroPromptRotator;
