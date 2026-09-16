/**
 * FixedProgressiveCard — Section 7 of the Global Typography, UX/UI and
 * AI-Powered Motion Overhaul.
 *
 * A bounded scroll region whose content stays pinned in the viewport
 * while native scroll — not a timer, not an IntersectionObserver "play
 * once" trigger — deterministically drives a top-to-bottom reveal of six
 * fixed slots: eyebrow → title → subtitle → key value → supporting item
 * → CTA. Scrolling back up un-reveals it the same way it revealed,
 * because the mapping is a pure function of scroll position, not a
 * one-shot animation state machine.
 *
 * The pin is computed in JS as a `transform: translateY()`, not CSS
 * `position: sticky`. The app's own shared shell (App.tsx's root
 * `<div className="h-full overflow-auto">`, present on every route)
 * gives every page an ancestor with `overflow: auto` above this
 * component — and per the CSS spec, ANY ancestor with an overflow value
 * other than `visible` becomes the containing block for
 * `position: sticky`, regardless of whether that ancestor actually
 * scrolls. That silently breaks native sticky here: it un-pins early,
 * the card scrolls off mid-reveal, and the section's height reads as
 * broken/jumpy.
 *
 * The pinned element's `position: absolute` never changes — it is
 * always positioned relative to the same container, at the same width.
 * An earlier version toggled between `position: absolute` (before/after
 * phases) and `position: fixed` (pinned phase) to dodge the ancestor
 * overflow problem; `fixed`'s `left/right: 0` resolves against the
 * *viewport*, while `absolute`'s resolves against the *container* — so
 * every phase change silently snapped the card's box between the
 * container's (padded, narrower) width and the full viewport width,
 * shifting it sideways at both transition points. That box-size jump on
 * every pin/release is what read as the section moving unpredictably.
 * Holding `position: absolute` constant and driving the three phases
 * (before/pinned/after) purely through `translateY()` keeps the box
 * geometry identical throughout — only its vertical offset changes, by
 * one continuous formula, so there is nothing left to jump.
 *
 * Explicitly NOT:
 * - scroll-hijacking — nothing calls preventDefault() or sets scrollTop;
 *   the browser's own scroll is the only input.
 * - infinite scroll — the pinned region has a fixed, finite height
 *   (`scrollSpan` viewport-heights) and then releases for good.
 * - scroll-snapping — no scroll-snap-* CSS anywhere in this component or
 *   its scroll ancestors.
 *
 * Reduced motion / static fallback: under prefers-reduced-motion, skips
 * the scroll rig entirely and renders every slot visible immediately in
 * normal document flow (no pinning, no bounded-height spacer) — this is
 * also what a user gets if JS never runs (e.g. print, some crawlers),
 * since the motion values simply default to their end state and there's
 * no CSS-only pin to fall back on.
 */
import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/** Real three-phase pin, measured against actual layout — the same thing
 *  native `position: sticky` computes internally, done manually because
 *  an ancestor's `overflow: auto` breaks sticky for this component.
 *
 *  Writes directly to the DOM via the ref instead of React state: routing
 *  this through useState/re-render added a render-cycle of lag between
 *  the real scroll position and the style update landing, which showed up
 *  as real, measurable layout-shift entries (CLS ~0.5) — a visible jump —
 *  even though the math was correct. Direct style mutation inside the
 *  same rAF-scheduled handler is the same pattern the six content slots
 *  already use via Framer Motion's style={motionValue}, which measured
 *  zero layout shift; this follows it instead of fighting React for
 *  something that has to be synchronous with scroll.
 *
 *  The element's `position` never changes (always `absolute`, set once in
 *  the JSX below) — only `transform: translateY()` moves it. Working out
 *  the desired viewport-relative top for each phase and then converting
 *  that into a translateY *relative to the element's untransformed
 *  position* (`desiredTop - containerRect.top`) reproduces the identical
 *  three phases as switching position types, but as one continuous
 *  function with no box-geometry change to jump at the seams. */
function usePin(containerRef: RefObject<HTMLElement>, pinnedRef: RefObject<HTMLElement>) {
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    let raf = 0;
    // Only the container's own position changes on every scroll frame; the
    // pinned element's height only changes on resize/content change, so it's
    // measured there instead of on every scroll tick — one layout read per
    // frame instead of two keeps this cheap enough to never register as a
    // long task even under a fast, continuous scroll.
    let pinnedHeight = 0;
    let top = 64;

    const remeasure = () => {
      top = mq.matches ? 80 : 64;
      pinnedHeight = pinnedRef.current?.getBoundingClientRect().height || pinnedRef.current?.offsetHeight || 0;
    };

    const apply = () => {
      raf = 0;
      const container = containerRef.current;
      const pinned = pinnedRef.current;
      if (!container || !pinned) return;
      const containerRect = container.getBoundingClientRect();

      pinned.style.minHeight = `calc(100vh - ${top}px)`;

      let desiredTop: number;
      if (containerRect.top > top) {
        desiredTop = containerRect.top; // before: untouched, no shift
      } else if (containerRect.bottom - pinnedHeight <= top) {
        desiredTop = containerRect.bottom - pinnedHeight; // after: pinned to container's bottom
      } else {
        desiredTop = top; // pinned: held at the viewport offset
      }

      const translateY = desiredTop - containerRect.top;
      pinned.style.transform = translateY ? `translateY(${translateY}px)` : "";
    };

    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(apply);
    };
    const onResize = () => {
      remeasure();
      onScroll();
    };

    remeasure();
    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    mq.addEventListener?.("change", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      mq.removeEventListener?.("change", onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [containerRef, pinnedRef]);
}

const EASE = [0.2, 0.65, 0.3, 0.95] as const;

interface FixedProgressiveCardProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** The single most important value shown — the reason this card exists. */
  keyValue: ReactNode;
  /** Small trailing detail below the key value (e.g. a reassurance line). */
  supportingItem?: ReactNode;
  cta: ReactNode;
  className?: string;
  /** How much scroll (in viewport-heights) drives the reveal before the
   *  card releases from its pin. Bounded and finite — not infinite scroll. */
  scrollSpan?: number;
}

function useSlot(progress: MotionValue<number>, start: number, end: number) {
  const opacity = useTransform(progress, [start, end], [0, 1]);
  const y = useTransform(progress, [start, end], [22, 0]);
  return { opacity, y };
}

export function FixedProgressiveCard({
  eyebrow,
  title,
  subtitle,
  keyValue,
  supportingItem,
  cta,
  className,
  scrollSpan = 1.6,
}: FixedProgressiveCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  usePin(containerRef, pinnedRef);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Six windows across [0,1], each overlapping the next so the cascade
  // reads as continuous rather than six separate pops.
  const eyebrowSlot = useSlot(scrollYProgress, 0, 0.14);
  const titleSlot = useSlot(scrollYProgress, 0.08, 0.3);
  const subtitleSlot = useSlot(scrollYProgress, 0.24, 0.44);
  const keyValueSlot = useSlot(scrollYProgress, 0.4, 0.6);
  const supportingSlot = useSlot(scrollYProgress, 0.56, 0.74);
  const ctaSlot = useSlot(scrollYProgress, 0.7, 0.9);

  const content = (
    <div className="mx-auto max-w-2xl px-5 text-center">
      {eyebrow && (
        <motion.div style={reducedMotion ? undefined : eyebrowSlot} className="mb-4">
          {eyebrow}
        </motion.div>
      )}
      <motion.div style={reducedMotion ? undefined : titleSlot}>{title}</motion.div>
      {subtitle && (
        <motion.div style={reducedMotion ? undefined : subtitleSlot} className="mt-5">
          {subtitle}
        </motion.div>
      )}
      <motion.div style={reducedMotion ? undefined : keyValueSlot} className="mt-9">
        {keyValue}
      </motion.div>
      {supportingItem && (
        <motion.div style={reducedMotion ? undefined : supportingSlot} className="mt-4">
          {supportingItem}
        </motion.div>
      )}
      <motion.div style={reducedMotion ? undefined : ctaSlot} className="mt-6">
        {cta}
      </motion.div>
    </div>
  );

  // Static fallback: everything visible immediately, normal flow, no pin,
  // no bounded-height spacer — nothing to reduce motion of and nothing
  // that depends on JS having measured a scroll container.
  if (reducedMotion) {
    return (
      <div className={cn("relative py-24 sm:py-28", className)}>{content}</div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn("relative", className)}
      style={{ height: `${scrollSpan * 100}vh` }}
    >
      {/* position/top/left/right are permanent — usePin only ever writes
          `transform`. Before usePin's effect runs (first paint) there's no
          transform yet, which is exactly the correct "before" phase for
          anyone who hasn't scrolled into the section, true on first paint. */}
      <div
        ref={pinnedRef}
        className="flex flex-col justify-center overflow-hidden py-16"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          minHeight: "calc(100vh - 4rem)",
          transitionTimingFunction: `cubic-bezier(${EASE.join(",")})`,
        }}
      >
        {content}
      </div>
    </div>
  );
}

export default FixedProgressiveCard;
