import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface RevealProps {
  children: ReactNode;
  /** Stagger index — each step adds 70ms. */
  delayIndex?: number;
  className?: string;
}

/**
 * The landing page's scroll reveal, reusable on any page section so every
 * surface animates in with the same cadence and easing.
 */
export function Reveal({ children, delayIndex = 0, className }: RevealProps) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reducedMotion ? false : { opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10% 0px" }}
      transition={{ duration: 0.7, delay: delayIndex * 0.07, ease: [0.2, 0.65, 0.3, 0.95] }}
    >
      {children}
    </motion.div>
  );
}

export default Reveal;
