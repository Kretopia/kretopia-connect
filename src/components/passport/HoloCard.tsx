import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface HoloCardProps {
  children: ReactNode;
  className?: string;
  /** Max tilt in degrees. */
  maxTilt?: number;
}

/**
 * HoloCard — premium collectible-card shell (Pokémon TCG feel).
 * Pointer-tracked 3D tilt, holographic sheen, layered depth and edge highlight.
 * Pure CSS/transform: no dependencies, GPU-composited, disabled for touch
 * devices and for users who prefer reduced motion.
 */
export function HoloCard({ children, className, maxTilt = 8 }: HoloCardProps) {
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
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      setTilt({ x: (0.5 - py) * maxTilt * 2, y: (px - 0.5) * maxTilt * 2 });
      setGlare({ x: px * 100, y: py * 100, on: true });
    },
    [interactive, maxTilt]
  );

  const onLeave = useCallback(() => {
    setTilt({ x: 0, y: 0 });
    setGlare((g) => ({ ...g, on: false }));
  }, []);

  return (
    <div className={cn("[perspective:1200px]", className)}>
      <div
        ref={ref}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        className="relative h-full rounded-2xl transition-transform duration-300 ease-out will-change-transform [transform-style:preserve-3d]"
        style={{
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateZ(0)`,
        }}
      >
        {/* Depth glow behind the card — slow ambient breathe reads as "AI-aware" presence */}
        <div
          aria-hidden
          className="ai-ambient-breathe pointer-events-none absolute -inset-2 rounded-[26px] blur-2xl"
          style={{
            background:
              "linear-gradient(135deg, hsl(var(--signal-teal)/0.35), transparent 45%, hsl(var(--signal-pink,320 100% 60%)/0.14))",
            transform: "translateZ(-40px)",
            animationPlayState: inView ? "running" : "paused",
          }}
        />

        {/* Card body */}
        <div className="relative h-full overflow-hidden rounded-2xl shadow-[0_20px_50px_-20px_rgba(0,0,0,0.75),0_2px_0_0_rgba(255,255,255,0.06)_inset]">
          {/* Material gloss — soft top-edge light catch, laminated-stock feel */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-[1]"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.03) 8%, transparent 22%)",
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
              opacity: glare.on ? 0.85 : 0.28,
              background: `radial-gradient(120% 90% at ${glare.x}% ${glare.y}%, rgba(255,255,255,0.55), rgba(255,255,255,0.08) 35%, transparent 65%)`,
            }}
          />
          {/* Prismatic edge */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-2xl"
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
