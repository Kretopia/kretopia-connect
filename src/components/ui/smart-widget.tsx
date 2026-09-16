/**
 * SmartWidget — theme-aware card wrapper carrying the same "AI-vibe"
 * treatment as the landing page's tutorial cards: a glass panel, a
 * breathing ambient glow, a scanning top-edge sweep, and a hover lift.
 * Built for wrapping existing cards (VerifiedCredits, Spotlight, ...)
 * without forcing the landing page's dark-only color scheme onto pages
 * that respect the app's light/dark theme toggle.
 */
import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

const ACCENT = "hsl(var(--energy))";

interface SmartWidgetProps {
  children: ReactNode;
  className?: string;
  /** Disable the scan-line sweep for dense grids where many at once would be noisy. */
  scanLine?: boolean;
  /** Lift + glow on hover — on by default for clickable cards. */
  interactive?: boolean;
}

export const SmartWidget = ({ children, className, scanLine = true, interactive = true }: SmartWidgetProps) => {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      whileHover={interactive && !reducedMotion ? { y: -3 } : undefined}
      transition={{ duration: 0.25, ease: [0.2, 0.65, 0.3, 0.95] }}
      className={cn(
        "group/smart relative overflow-hidden rounded-2xl border bg-card transition-shadow duration-300",
        interactive && "hover:shadow-[0_20px_50px_-25px_rgba(255,45,161,0.45)]",
        className,
      )}
      style={{ borderColor: "rgba(255,45,161,0.16)" }}
    >
      {/* ambient glow — breathes slowly behind the content */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 ai-ambient-breathe opacity-0 group-hover/smart:opacity-100 transition-opacity duration-500"
        style={{ background: "radial-gradient(60% 80% at 15% 0%, rgba(255,45,161,0.10), transparent 65%)" }}
      />

      {/* scanning top-edge sweep */}
      {scanLine && (
        <div aria-hidden className="pointer-events-none absolute top-0 left-0 right-0 h-px overflow-hidden">
          <div
            className="ai-scan-line h-full w-1/3"
            style={{ background: `linear-gradient(90deg, transparent, ${ACCENT}, transparent)` }}
          />
        </div>
      )}

      <div className="relative">{children}</div>
    </motion.div>
  );
};

export default SmartWidget;
