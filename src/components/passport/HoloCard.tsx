import { useEffect, useRef, useState, type ReactNode } from "react";

interface HoloCardProps {
  children: ReactNode;
  className?: string;
  /** Compatibility only: Holo cards never tilt. */
  maxTilt?: number;
  /** The blurred coloured halo behind the card. On by default; off leaves the card on the page's own background. */
  glow?: boolean;
}

/**
 * HoloCard — premium collectible-card shell (Pokémon TCG feel).
 * Stable holographic sheen, layered depth and edge highlight.
 * No pointer transforms: the card and its hit target never rotate.
 */
export function HoloCard({ children, className, glow = true }: HoloCardProps) {
  const ref = useRef<HTMLDivElement>(null);
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

  return (
    <div className={className}>
      <div
        ref={ref}
        className="relative h-full rounded-2xl"
      >
        {/* Depth glow behind the card — slow ambient breathe reads as "AI-aware" presence */}
        {glow && (
          <div
            aria-hidden
            className="ai-ambient-breathe pointer-events-none absolute -inset-2 rounded-[26px] blur-2xl"
            style={{
              background:
                "linear-gradient(135deg, hsl(var(--signal-teal)/0.35), transparent 45%, hsl(var(--signal-pink,320 100% 60%)/0.14))",
              animationPlayState: inView ? "running" : "paused",
            }}
          />
        )}

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
              opacity: 0.28,
              background: "radial-gradient(120% 90% at 50% 50%, hsl(var(--foreground)/0.55), hsl(var(--foreground)/0.08) 35%, transparent 65%)",
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
