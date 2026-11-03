import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CARD_RADIUS, CARD_SHADOW } from "@/components/cards/cardTokens";
import { HOLO_FOIL, foilGradient } from "./holoFoil";

interface HoloCardProps {
  children: ReactNode;
  className?: string;
  /** Max tilt in degrees. Gentle by default: every Holo card shares one amplitude. */
  maxTilt?: number;
  /** The blurred coloured halo behind the card. On by default; off leaves the card on the page's own background. */
  glow?: boolean;
}

/**
 * HoloCard — premium collectible-card shell (Pokémon TCG feel).
 * Pointer-tracked tilt, a holographic sheen that follows the pointer, layered depth and an edge highlight.
 * Transform and opacity only: no size, position or margin ever changes, and touch screens and people who prefer
 * reduced motion get the same card flat.
 */
export function HoloCard({ children, className, maxTilt = 5, glow = true }: HoloCardProps) {
  // The pointer is tracked on this outer wrapper, which never moves. Tracking it on the tilted card itself made the
  // card's own edge slide out from under the pointer near a corner: the tilt reset, the pointer was over the card
  // again, the tilt came back, and the card trembled. The wrapper's box is stable, so the pointer is either in it or not.
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [glare, setGlare] = useState({ x: 50, y: 50, on: false });
  const [inView, setInView] = useState(true);

  // The ambient glow and scan-line are continuous decorative animations —
  // stop them when the card scrolls offscreen so they don't run forever.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const interactive = useCallback(() => {
    if (typeof window === "undefined") return false;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  }, []);

  const onMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!interactive() || !ref.current) return;
      const r = ref.current.getBoundingClientRect();
      const px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      const py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
      setTilt({ x: (0.5 - py) * maxTilt * 2, y: (px - 0.5) * maxTilt * 2 });
      setGlare({ x: px * 100, y: py * 100, on: true });
    },
    [interactive, maxTilt],
  );

  const onLeave = useCallback(() => {
    setTilt({ x: 0, y: 0 });
    setGlare((g) => ({ ...g, on: false }));
  }, []);

  return (
    <div ref={ref} onPointerMove={onMove} onPointerLeave={onLeave} className={cn("[perspective:1200px]", className)}>
      <div
        className={cn("relative h-full transition-transform duration-300 ease-out will-change-transform [transform-style:preserve-3d] motion-reduce:transition-none", CARD_RADIUS)}
        style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateZ(0)` }}
      >
        {/* Depth glow behind the card — slow ambient breathe reads as "AI-aware" presence */}
        {glow && (
          <div
            aria-hidden
            className="ai-ambient-breathe pointer-events-none absolute -inset-2 rounded-[26px] blur-2xl"
            style={{
              background:
                "linear-gradient(135deg, hsl(var(--signal-teal)/0.22), transparent 45%, hsl(var(--signal-pink,320 100% 60%)/0.09))",
              transform: "translateZ(-24px)",
              animationPlayState: inView ? "running" : "paused",
            }}
          />
        )}

        {/* Card body */}
        <div className={cn("relative h-full overflow-hidden", CARD_RADIUS, CARD_SHADOW)}>
          {/* Material gloss — soft top-edge light catch, laminated-stock feel */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-[1]"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 8%, transparent 22%)",
            }}
          />

          {/* Scan-line sweep along the top edge — same "actively scanning" motion as the AI tutorial surfaces */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden z-10">
            <div
              className="ai-scan-line h-full w-1/3"
              style={{
                background: "linear-gradient(90deg, transparent, hsl(var(--signal-teal)/0.9), transparent)",
                animationPlayState: inView ? "running" : "paused",
              }}
            />
          </div>
          {children}

          {/* Foil sheen */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 mix-blend-soft-light transition-opacity duration-300"
            style={{
              opacity: glare.on ? HOLO_FOIL.activeOpacity : HOLO_FOIL.idleOpacity,
              background: foilGradient(glare.x, glare.y),
            }}
          />
          {/* Prismatic edge */}
          <div
            aria-hidden
            className={cn("pointer-events-none absolute inset-0", CARD_RADIUS)}
            style={{
              padding: 1,
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.35), rgba(255,255,255,0.02) 30%, rgba(255,255,255,0.02) 70%, rgba(255,255,255,0.28))",
              WebkitMask:
                "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
              WebkitMaskComposite: "xor",
              maskComposite: "exclude",
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default HoloCard;
