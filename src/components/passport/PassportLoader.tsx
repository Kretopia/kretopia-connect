import { motion } from "framer-motion";
import kMarkAsset from "@/assets/brand/kretopia-k-mark.png.asset.json";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

interface PassportLoaderProps {
  label?: string;
  className?: string;
}

/**
 * The loading state for opening a Creative Passport (CreatorEPK.tsx) --
 * the real K-mark (same asset BrandLogo/KretoMark use, not a generic
 * spinner) breathing inside a slowly rotating brand-gradient ring. Static
 * fallback (no breathing/rotation) under prefers-reduced-motion, same
 * convention as KretoCharacter/ProductLoopSection.
 */
export function PassportLoader({ label = "Opening your Creative Passport…", className }: PassportLoaderProps) {
  const reducedMotion = useReducedMotion();

  return (
    <div className={cn("flex flex-col items-center justify-center gap-5", className)} role="status" aria-label={label}>
      <div className="relative flex h-24 w-24 items-center justify-center">
        {/* Rotating brand-gradient ring -- conic gradient through the three
            signature colors (see BrandDots), masked to a thin ring so it
            reads as a loading arc, not a solid disc. */}
        <motion.div
          aria-hidden
          className="absolute inset-0 rounded-full"
          style={{
            background: "conic-gradient(from 0deg, #9413D2, #E0179C, #FEA61A, #9413D2)",
            WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))",
            mask: "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))",
          }}
          animate={reducedMotion ? undefined : { rotate: 360 }}
          transition={reducedMotion ? undefined : { duration: 2.2, repeat: Infinity, ease: "linear" }}
        />
        {/* Soft ambient glow behind the mark */}
        <div
          aria-hidden
          className="absolute inset-2 rounded-full blur-lg opacity-40"
          style={{ background: "radial-gradient(circle, #E0179C, transparent 70%)" }}
        />
        <motion.img
          src={kMarkAsset.url}
          alt=""
          aria-hidden
          draggable={false}
          className="relative h-12 w-12 select-none object-contain"
          animate={reducedMotion ? undefined : { scale: [1, 1.08, 1] }}
          transition={reducedMotion ? undefined : { duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

export default PassportLoader;
