import { useId } from "react";
import { motion } from "framer-motion";
import kMarkAsset from "@/assets/brand/kretopia-k-mark.png.asset.json";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { AnimatedNumber } from "./AnimatedNumber";

const RADIUS = 50;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface RecordRingProps {
  /** 0-100; clamped. */
  percent: number;
  /** Optional "N of M steps" detail, folded into the accessible name. */
  steps?: { done: number; total: number };
}

/**
 * Kretopia-branded completeness ring: the official K-mark sits at the
 * centre, the progress arc sweeps the brand gradient (blue -> purple ->
 * magenta -> amber, same stops as --k-text-gradient), and the percentage
 * rides the ring's lower edge as a chip. Replaces a plain single-colour
 * ring whose accent token resolves to plain white on dark.
 */
export function RecordRing({ percent, steps }: RecordRingProps) {
  const reduced = useReducedMotion();
  const gradientId = useId();
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  const label = `Record ${value}% complete${steps ? `, ${steps.done} of ${steps.total} steps done` : ""}`;

  return (
    <div role="img" aria-label={label} className="relative mb-3 h-[108px] w-[108px] shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: "var(--k-g-1)" }} />
            <stop offset="35%" style={{ stopColor: "var(--k-g-2)" }} />
            <stop offset="70%" style={{ stopColor: "var(--k-g-3)" }} />
            <stop offset="100%" style={{ stopColor: "var(--k-g-4)" }} />
          </linearGradient>
        </defs>
        <circle cx="60" cy="60" r={RADIUS} fill="none" stroke="hsl(var(--muted))" strokeWidth="9" />
        {value > 0 && (
          <motion.circle
            cx="60"
            cy="60"
            r={RADIUS}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            style={{ filter: "drop-shadow(0 0 5px hsl(var(--k-purple) / 0.55))" }}
            initial={{ strokeDashoffset: reduced ? CIRCUMFERENCE * (1 - value / 100) : CIRCUMFERENCE }}
            animate={{ strokeDashoffset: CIRCUMFERENCE * (1 - value / 100) }}
            transition={{ duration: reduced ? 0 : 1.1, ease: "easeOut" }}
          />
        )}
      </svg>

      <img
        src={kMarkAsset.url}
        alt=""
        aria-hidden
        draggable={false}
        className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 select-none object-contain"
      />

      <span
        aria-hidden
        className="absolute -bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-border bg-card px-2.5 py-0.5 text-sm font-black leading-tight tabular-nums shadow-sm"
      >
        <span className="k-gradient-text">
          <AnimatedNumber value={value} />%
        </span>
      </span>
    </div>
  );
}

export default RecordRing;
