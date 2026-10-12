import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue } from "framer-motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import flying from "@/assets/brand/kreto/kreto-flying.png";
import tucked from "@/assets/brand/kreto/kreto-flight-tuck.png";
import peeking from "@/assets/brand/kreto/kreto-flight-peek.png";
import { sampleFlight, type FlightPose, type FlightStop } from "./kretoFlightPath";

const poses = { fly: flying, tuck: tucked, peek: peeking };
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
    let stops: FlightStop[] = [];
    let frame = 0;
    let activePose: FlightPose = "fly";
    const paint = () => {
      frame = 0;
      const point = sampleFlight(stops, window.scrollY);
      if (!point) return;
      x.set(point.x); y.set(point.y); rotate.set(point.rotate);
      rotateY.set(point.turn); scale.set(point.scale); opacity.set(point.opacity);
      // Cross-fade from the original, aligned waving layers at takeoff.
      hero.style.opacity = String(1 - Math.min(1, window.scrollY / 160));
      if (point.pose !== activePose) { activePose = point.pose; setPose(point.pose); }
    };
    const queue = () => { if (!frame) frame = requestAnimationFrame(paint); };
    const measure = () => {
      const bounds = parent.getBoundingClientRect();
      const origin = bounds.top + window.scrollY;
      const size = window.innerWidth >= 1440 ? 240 : window.innerWidth >= 1024 ? 180 : 104;
      const start = hero.getBoundingClientRect();
      const visibleHero = start.width > 0;
      const initialX = visibleHero ? start.left - bounds.left : window.innerWidth - size - 16;
      const initialY = visibleHero ? start.top + window.scrollY - origin : Math.min(window.innerHeight * 0.7, 620);
      const base: FlightStop = { scroll: 0, x: initialX, y: initialY, rotate: 0, turn: 0, scale: 1, opacity: 0, pose: "fly" };
      stops = [base, { ...base, scroll: 160, y: initialY + 120, rotate: 18, opacity: 1 }];
      hideaways.forEach((id, index) => {
        const media = parent.querySelector<HTMLElement>(`#${id} [data-kreto-flight-media]`);
        if (!media) return;
        const rect = media.getBoundingClientRect();
        const centerY = rect.top + window.scrollY - origin + rect.height * 0.45;
        const at = Math.max(stops[stops.length - 1].scroll + 600, centerY + origin - window.innerHeight * 0.48);
        const left = rect.left - bounds.left;
        const side = index % 2 === 0 ? 1 : -1;
        const edge = side === 1 ? left + rect.width - size * 0.34 : left - size * 0.66;
        const safeEdge = Math.max(8, Math.min(window.innerWidth - size - 8, edge));
        const turn = index % 2 === 0 ? 0 : 180;
        const make = (delta: number, extra: Partial<FlightStop>): FlightStop => ({
          ...base, scroll: at + delta, x: safeEdge, y: centerY, rotate: 0, turn,
          scale: 0.86, opacity: 1, pose: "fly", ...extra,
        });
        stops.push(
          make(-420, { y: centerY - 260, rotate: -18, pose: "tuck" }),
          make(-220, { y: centerY - 100, rotate: -360, pose: "tuck" }),
          make(-80, { rotate: -360, pose: "peek" }),
          make(80, { x: left + rect.width * 0.5 - size / 2, rotate: -360, pose: "peek" }),
          make(230, { x: safeEdge, y: centerY + 120, rotate: -360, pose: "peek" }),
          make(430, { y: centerY + 290, rotate: -360, turn: turn + 180 }),
        );
      });
      const last = stops[stops.length - 1];
      const end = parent.scrollHeight - window.innerHeight + origin;
      if (end > last.scroll + 200) {
        stops.push({ ...last, scroll: end - 120, x: Math.max(8, window.innerWidth - size - 24), y: parent.scrollHeight - size - 220, rotate: -720, turn: 360, pose: "tuck" });
        stops.push({ ...last, scroll: end, x: Math.max(8, window.innerWidth - size - 24), y: parent.scrollHeight - size - 120, rotate: -720, turn: 360, pose: "peek", opacity: 0 });
      }
      queue();
    };
    const observer = new ResizeObserver(measure);
    observer.observe(parent);
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", measure);
    measure();
    return () => {
      observer.disconnect(); cancelAnimationFrame(frame);
      window.removeEventListener("scroll", queue);
      window.removeEventListener("resize", measure);
      hero.style.removeProperty("opacity");
    };
  }, [ready, reduced, x, y, rotate, rotateY, scale, opacity]);

  return (
    <motion.div ref={ref} aria-hidden="true" data-kreto-flight data-pose={pose}
      className="pointer-events-none absolute left-0 top-0 z-[2] h-[104px] w-[104px] select-none lg:h-[180px] lg:w-[180px] min-[1440px]:h-[240px] min-[1440px]:w-[240px]"
      style={{ x, y, rotate, rotateY, scale, opacity }}>
      {Object.entries(poses).map(([key, src]) => (
        <img key={key} src={src} alt="" width={1024} height={1024} decoding="async" draggable={false}
          className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-150 ${key === pose ? "opacity-100" : "opacity-0"} ${key === "tuck" ? "rotate-180" : ""}`} />
      ))}
    </motion.div>
  );
}