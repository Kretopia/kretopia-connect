/**
 * KretoTyping — Kreto at his laptop. Hover (mouse) or touch makes him type:
 * both hands tap the keyboard in turn, the laptop lid glows and a few key
 * sparks float up. Built on the same model as the landing hero's <KretoWave />:
 *
 *   - the HD art is still; only small layers move. Here the layers are the two
 *     gloves, cut out of the same image with `clip-path`, so there is no second
 *     asset to ship or keep in sync;
 *   - Kreto only shows once the image is decoded, so nothing pops in late;
 *   - one typing burst at a time (a ref guards re-entry), started instantly by
 *     pointer enter or pointer down, and animated with the Web Animations API
 *     on transform/opacity only, so it stays on the compositor;
 *   - nothing moves under `prefers-reduced-motion`; the art is still a mascot.
 *
 * Decorative (aria-hidden): it conveys nothing a screen reader needs. Never use
 * it to signal a real "Kreto is working" state; that is KretoMark's `state`.
 */
import { memo, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import kretoUrl from "@/assets/brand/kreto/kreto-producer-hd.png";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

/** Source art is 1024×1024; Kreto + laptop occupy x 197–924, y 117–1024. */
const ART = 1024;
const BOX = { x: 197, y: 117, w: 727, h: 907 } as const;

/** The art, positioned so the visible figure exactly fills the component's box. */
const ART_STYLE: CSSProperties = {
  width: `${(ART / BOX.w) * 100}%`,
  height: `${(ART / BOX.h) * 100}%`,
  left: `${(-BOX.x / BOX.w) * 100}%`,
  top: `${(-BOX.y / BOX.h) * 100}%`,
};

/** The two black gloves, in art pixels (centre + radii of an ellipse around each). */
const HANDS = {
  left: { cx: 448, cy: 778, rx: 72, ry: 68 },
  right: { cx: 745, cy: 828, rx: 72, ry: 44 },
} as const;

const pct = (n: number) => `${((n / ART) * 100).toFixed(2)}%`;
const clipFor = ({ cx, cy, rx, ry }: (typeof HANDS)[keyof typeof HANDS]) =>
  `ellipse(${pct(rx)} ${pct(ry)} at ${pct(cx)} ${pct(cy)})`;

/** One typing burst (~1.5 s): [time ms, glove travel as % of the art height]. */
const TYPING_MS = 1500;
const TAP_GAP = 210;
const tapSteps = (firstTap: number, taps: number): Array<readonly [number, number]> => {
  const out: Array<readonly [number, number]> = [[0, 0]];
  for (let i = 0; i < taps; i++) {
    const t = firstTap + i * TAP_GAP;
    out.push([t, 0], [t + 50, 1.1], [t + 115, 0]);
  }
  out.push([TYPING_MS, 0]);
  return out;
};
const toKeyframes = (steps: ReadonlyArray<readonly [number, number]>): Keyframe[] =>
  steps.map(([t, y]) => ({ offset: t / TYPING_MS, transform: `translateY(${y}%)`, easing: "ease-in-out" }));

// Hands alternate: the right one starts half a beat after the left.
const LEFT_TAPS = toKeyframes(tapSteps(60, 6));
const RIGHT_TAPS = toKeyframes(tapSteps(165, 6));

const GLOW: Keyframe[] = [
  { opacity: 0, offset: 0 },
  { opacity: 0.55, offset: 0.18 },
  { opacity: 0.25, offset: 0.4 },
  { opacity: 0.5, offset: 0.65 },
  { opacity: 0, offset: 1 },
];

/** Key sparks above the laptop's top edge: [left %, drift px, delay ms]. */
const SPARKS: ReadonlyArray<readonly [number, number, number]> = [
  [50, -10, 0],
  [60, 6, 120],
  [70, -4, 260],
  [78, 10, 380],
  [86, -8, 520],
  [64, 12, 700],
];

export const KretoTyping = memo(function KretoTyping({ className }: { className?: string }) {
  const reducedMotion = useReducedMotion();
  const baseRef = useRef<HTMLImageElement>(null);
  const leftRef = useRef<HTMLImageElement>(null);
  const rightRef = useRef<HTMLImageElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const sparkRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const running = useRef<Animation[] | null>(null);
  const [ready, setReady] = useState(false);

  const checkReady = useCallback(() => {
    const img = baseRef.current;
    if (img?.complete && img.naturalWidth > 0) setReady(true);
  }, []);

  const cancelAll = useCallback(() => {
    running.current?.forEach((a) => a.cancel());
    running.current = null;
  }, []);

  useEffect(() => {
    checkReady(); // image already in cache
    return cancelAll;
  }, [checkReady, cancelAll]);

  /** Pointer enter (mouse) / pointer down (finger, pen): one burst at a time. */
  const play = useCallback(() => {
    if (!ready || reducedMotion || running.current) return;
    const left = leftRef.current;
    const right = rightRef.current;
    if (!left || !right || typeof left.animate !== "function") return;

    const anims: Animation[] = [
      left.animate(LEFT_TAPS, { duration: TYPING_MS }),
      right.animate(RIGHT_TAPS, { duration: TYPING_MS }),
    ];
    const glow = glowRef.current;
    if (glow) anims.push(glow.animate(GLOW, { duration: TYPING_MS }));
    SPARKS.forEach(([, drift, delay], i) => {
      const spark = sparkRefs.current[i];
      if (!spark) return;
      anims.push(
        spark.animate(
          [
            { opacity: 0, transform: "translate(0, 0) scale(0.6)" },
            { opacity: 1, transform: `translate(${drift / 2}px, -9px) scale(1)`, offset: 0.25 },
            { opacity: 0, transform: `translate(${drift}px, -22px) scale(0.8)` },
          ],
          { duration: 760, delay, easing: "ease-out" },
        ),
      );
    });

    running.current = anims;
    // The last tap ends the burst; everything else finishes earlier or at the same time.
    const finish = () => {
      running.current = null;
    };
    anims[0].onfinish = anims[0].oncancel = finish;
  }, [ready, reducedMotion]);

  const layer = "absolute inset-0 h-full w-full select-none object-contain";

  return (
    <div
      aria-hidden
      className={cn("relative aspect-[727/907] touch-manipulation select-none overflow-hidden [-webkit-tap-highlight-color:transparent]", className)}
      onPointerEnter={play}
      onPointerDown={play}
    >
      <div className={cn("absolute transition-opacity duration-300", ready ? "opacity-100" : "opacity-0")} style={ART_STYLE}>
        <img
          ref={baseRef}
          src={kretoUrl}
          alt=""
          width={ART}
          height={ART}
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={checkReady}
          className={layer}
        />
        {/* Laptop-lid glow while he types. */}
        <div
          ref={glowRef}
          className="pointer-events-none absolute rounded-2xl opacity-0 mix-blend-screen"
          style={{
            left: pct(540),
            top: pct(520),
            width: pct(380),
            height: pct(290),
            background: "radial-gradient(ellipse at 55% 50%, hsl(var(--energy) / 0.75), transparent 70%)",
          }}
        />
        {/* The gloves: the same art, cut to each hand, tapped independently. */}
        <img
          ref={leftRef}
          src={kretoUrl}
          alt=""
          draggable={false}
          decoding="async"
          className={layer}
          style={{ clipPath: clipFor(HANDS.left), willChange: "transform" }}
        />
        <img
          ref={rightRef}
          src={kretoUrl}
          alt=""
          draggable={false}
          decoding="async"
          className={layer}
          style={{ clipPath: clipFor(HANDS.right), willChange: "transform" }}
        />
        {SPARKS.map(([left], i) => (
          <span
            key={i}
            ref={(el) => {
              sparkRefs.current[i] = el;
            }}
            className="pointer-events-none absolute h-[1.6%] w-[1.6%] rounded-[2px] bg-[hsl(var(--energy))] opacity-0"
            style={{ left: `${left}%`, top: pct(520) }}
          />
        ))}
      </div>
    </div>
  );
});
