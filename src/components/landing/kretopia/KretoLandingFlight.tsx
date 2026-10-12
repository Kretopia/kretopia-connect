import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue } from "framer-motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import flying from "@/assets/brand/kreto/kreto-flying.png";
import flyingLeft from "@/assets/brand/kreto/kreto-flying-left.png";
import tucked from "@/assets/brand/kreto/kreto-flight-tuck.png";
import peeking from "@/assets/brand/kreto/kreto-flight-peek.png";
import { sampleFlight, type FlightPose, type FlightStop } from "./kretoFlightPath";

const poses = { fly: flying, flyLeft: flyingLeft, tuck: tucked, peek: peeking };
const hideaways = ["chapter-passport", "chapter-match", "chapter-studio"];

/** One decorative figure; real media are foreground occluders, never duplicated. */
export function KretoLandingFlight({ ready }: { ready: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [pose, setPose] = useState<FlightPose>("fly");
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const scale = useMotionValue(1);
  const opacity = useMotionValue(0);

  useEffect(() => {
    const parent = ref.current?.parentElement;
    const hero = parent?.querySelector<HTMLElement>("[data-kreto-wave]");
    if (!parent || !hero || reduced) {
      opacity.set(0);
      return;
    }
    // AppContent scrolls its own full-height shell, not the browser window.
    let ancestor = parent.parentElement;
    while (ancestor && !/auto|scroll/.test(getComputedStyle(ancestor).overflowY)) ancestor = ancestor.parentElement;
    const scrollRoot = ancestor;
    const scrollTarget = scrollRoot ?? window;
    const scrollTop = () => scrollRoot?.scrollTop ?? window.scrollY;
    let stops: FlightStop[] = [];
    let protectedAreas: { x: number; y: number; width: number; height: number }[] = [];
    let frame = 0;
    let activePose: FlightPose = "fly";
    const paint = () => {
      frame = 0;
      const point = sampleFlight(stops, scrollTop());
      if (!point) return;
      x.set(point.x); y.set(point.y); rotate.set(point.rotate);
      rotateY.set(point.turn); scale.set(point.scale);
      const size = window.innerWidth >= 1440 ? 240 : window.innerWidth >= 1024 ? 180 : 104;
      const overlapsText = protectedAreas.some(area => point.x + size > area.x && point.x < area.x + area.width && point.y + size > area.y && point.y < area.y + area.height);
      opacity.set(overlapsText ? 0 : point.opacity);
      // Cross-fade from the original, aligned waving layers at takeoff.
      hero.style.opacity = String(1 - Math.min(1, scrollTop() / 160));
      if (point.pose !== activePose) { activePose = point.pose; setPose(point.pose); }
    };
    const queue = () => { if (!frame) frame = requestAnimationFrame(paint); };
    const measure = () => {
      const bounds = parent.getBoundingClientRect();
      const origin = bounds.top + scrollTop();
      protectedAreas = Array.from(parent.querySelectorAll<HTMLElement>('[data-kreto-flight-content]')).map(el => {
        const rect = el.getBoundingClientRect();
        return { x: rect.left - bounds.left, y: rect.top + scrollTop() - origin, width: rect.width, height: rect.height };
      });
      const size = window.innerWidth >= 1440 ? 240 : window.innerWidth >= 1024 ? 180 : 104;
      const start = hero.getBoundingClientRect();
      const visibleHero = start.width > 0;
      const initialX = visibleHero ? start.left - bounds.left : window.innerWidth - size - 16;
      const initialY = visibleHero ? start.top + scrollTop() - origin : Math.min(window.innerHeight * 0.7, 620);
      const base: FlightStop = { scroll: 0, x: initialX, y: initialY, rotate: 0, turn: 0, scale: 1, opacity: 0, pose: "fly" };
      stops = [base, { ...base, scroll: 160, y: initialY + 120, rotate: 18, opacity: 1 }];
      hideaways.forEach((id, index) => {
        const media = parent.querySelector<HTMLElement>(`#${id} [data-kreto-flight-media]`);
        if (!media) return;
        const rect = media.getBoundingClientRect();
        const centerY = rect.top + scrollTop() - origin + rect.height * 0.45;
        const at = Math.max(stops[stops.length - 1].scroll + 600, centerY + origin - window.innerHeight * 0.48);
        const left = rect.left - bounds.left;
        // Use the outer edge, away from the adjacent headline and controls.
        const side = index === 2 ? 1 : -1;
        const edge = side === 1 ? left + rect.width - size * 0.34 : left - size * 0.66;
        const safeEdge = Math.max(8, Math.min(window.innerWidth - size - 8, edge));
        // Alternate flight direction per hideaway: odd legs use the left-facing pose.
        const headingLeft = index % 2 === 1;
        const make = (delta: number, extra: Partial<FlightStop>): FlightStop => ({
          ...base, scroll: at + delta, x: safeEdge, y: centerY, rotate: 0, turn: 0,
          scale: 1, opacity: 1, pose: headingLeft ? "flyLeft" : "fly", ...extra,
        });
        stops.push(
          make(-420, { y: rect.top + scrollTop() - origin - size * 1.3, rotate: -16, pose: "tuck" }),
          // Backflip: one full in-plane roll of the tucked pose, no flat sideways spin.
          make(-220, { y: rect.top + scrollTop() - origin - size * 0.9, rotate: -190, pose: "tuck" }),
          make(-80, { x: left + rect.width * 0.65 - size / 2, y: rect.top + scrollTop() - origin - size * 0.6, rotate: -14, pose: "peek" }),
          make(80, { x: left + rect.width * 0.5 - size / 2, rotate: 0, pose: "peek" }),
          make(230, { x: left + rect.width * 0.35 - size / 2, y: rect.bottom + scrollTop() - origin - size * 0.3, rotate: 12, pose: "peek" }),
          // 190° pirouette: full-body spin that ends facing the new travel direction.
          make(430, { y: rect.bottom + scrollTop() - origin + 30, rotate: headingLeft ? -190 : 190, pose: headingLeft ? "fly" : "flyLeft" }),
        );
      });
      const last = stops[stops.length - 1];
      const end = parent.scrollHeight - window.innerHeight + origin;
      if (end > last.scroll + 200) {
        stops.push({ ...last, scroll: end - 120, x: Math.max(8, window.innerWidth - size - 24), y: parent.scrollHeight - size - 220, rotate: -20, pose: "tuck" });
        stops.push({ ...last, scroll: end, x: Math.max(8, window.innerWidth - size - 24), y: parent.scrollHeight - size - 120, rotate: 0, pose: "peek", opacity: 0 });
      }
      queue();
    };
    const observer = new ResizeObserver(measure);
    observer.observe(parent);
    scrollTarget.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", measure);
    measure();
    return () => {
      observer.disconnect(); cancelAnimationFrame(frame);
      scrollTarget.removeEventListener("scroll", queue);
      window.removeEventListener("resize", measure);
      hero.style.removeProperty("opacity");
    };
  }, [ready, reduced, x, y, rotate, rotateY, scale, opacity]);

  return (
    <motion.div ref={ref} aria-hidden="true" data-kreto-flight data-pose={pose}
      className="pointer-events-none absolute left-0 top-0 z-[2] h-[104px] w-[104px] select-none [filter:drop-shadow(0_22px_28px_rgba(15,23,42,0.35))_drop-shadow(0_0_26px_rgba(139,92,246,0.28))] lg:h-[180px] lg:w-[180px] min-[1440px]:h-[240px] min-[1440px]:w-[240px]"
      style={{ x, y, rotate, rotateY, scale, opacity }}>
      {Object.entries(poses).map(([key, src]) => (
        <img key={key} src={src} alt="" width={1024} height={1024} decoding="async" draggable={false}
          className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-150 ${key === pose ? "opacity-100" : "opacity-0"} `} />
      ))}
    </motion.div>
  );
}