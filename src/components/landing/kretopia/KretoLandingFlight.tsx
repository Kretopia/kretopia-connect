import { useEffect, useRef, useState } from "react";
import { motion, useSpring } from "framer-motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import flyingRight from "@/assets/brand/kreto/kreto-flying.webp";
import flyingLeft from "@/assets/brand/kreto/kreto-flying-left.webp";
import peekTop from "@/assets/brand/kreto/kreto-peek-top.webp";
import peekBottom from "@/assets/brand/kreto/kreto-peek-bottom.webp";
import { headingAt, sampleFlight, travelHeading, withFlightTurns, type FlightPose, type FlightStop } from "./kretoFlightPath";

const layers = { right: flyingRight, left: flyingLeft, peekTop, peekBottom } as const;
type Layer = keyof typeof layers;
/** Where the ledge line sits inside each hiding artwork (fraction of its height). */
const LEDGE = { peekTop: 0.62, peekBottom: 0.32 };
const SPRING = { stiffness: 240, damping: 30, mass: 0.55 };

const sizeFor = (w: number) => (w >= 1440 ? 240 : w >= 1024 ? 180 : 104);

/** One decorative figure; real media are foreground occluders, never duplicated. */
export function KretoLandingFlight({ ready }: { ready: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [pose, setPose] = useState<FlightPose>("fly");
  const [facing, setFacing] = useState<1 | -1>(-1);
  const x = useSpring(0, SPRING);
  const y = useSpring(0, SPRING);
  const rotate = useSpring(0, SPRING);
  const opacity = useSpring(0, { stiffness: 220, damping: 32 });

  useEffect(() => {
    const parent = ref.current?.parentElement;
    const hero = parent?.querySelector<HTMLElement>("[data-kreto-wave]");
    if (!parent || !hero || reduced) {
      opacity.jump(0);
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
    let heading: 1 | -1 = -1;
    let first = true;
    let previousScroll = scrollTop();
    let direction: -1 | 1 = 1;

    const paint = () => {
      frame = 0;
      const scroll = scrollTop();
      if (Math.abs(scroll - previousScroll) > 1) direction = scroll > previousScroll ? 1 : -1;
      previousScroll = scroll;
      const point = sampleFlight(stops, scroll);
      if (!point) return;
      const size = sizeFor(window.innerWidth);
      const dir = travelHeading(stops, scroll, direction);
      if (dir !== 0 && dir !== heading) {
        heading = dir;
        setFacing(dir);
      }
      // Bank with the climb/dive so the nose leads, mirrored for each heading.
      const ahead = sampleFlight(stops, scroll + direction * 12);
      const climb = ahead ? (ahead.y - point.y) / 12 : 0;
      const bank = point.pose === "fly" ? heading * Math.max(-16, Math.min(16, climb * 22)) : 0;
      const bounds = parent.getBoundingClientRect();
      const flightY = point.pose === "fly" && scroll > 120
        ? Math.max(-bounds.top + 72, Math.min(-bounds.top + window.innerHeight - size - 48, point.y)) : point.y;
      if (first) { x.jump(point.x); y.jump(flightY); rotate.jump(point.rotate + bank); first = false; }
      else { x.set(point.x); y.set(flightY); rotate.set(point.rotate + bank); }
      const overlapsText = point.pose === "fly" && protectedAreas.some(area => point.x + size > area.x && point.x < area.x + area.width && flightY + size > area.y && flightY < area.y + area.height);
      opacity.set(overlapsText ? 0 : point.opacity);
      // Cross-fade from the original, aligned waving layers at takeoff.
      hero.style.opacity = String(1 - Math.min(1, scroll / 120));
      if (point.pose !== activePose) { activePose = point.pose; setPose(point.pose); }
    };
    const queue = () => { if (!frame) frame = requestAnimationFrame(paint); };

    const measure = () => {
      const bounds = parent.getBoundingClientRect();
      const origin = bounds.top + scrollTop();
      const vw = window.innerWidth;
      const size = sizeFor(vw);
      const clampX = (v: number) => Math.max(8, Math.min(vw - size - 8, v));
      const docY = (v: number) => v + scrollTop() - origin;
      protectedAreas = Array.from(parent.querySelectorAll<HTMLElement>("[data-kreto-flight-content]")).map(el => {
        const rect = el.getBoundingClientRect();
        return { x: rect.left - bounds.left, y: docY(rect.top), width: rect.width, height: rect.height };
      });
      const start = hero.getBoundingClientRect();
      const visibleHero = start.width > 0;
      const x0 = visibleHero ? start.left - bounds.left : vw - size - 16;
      const y0 = visibleHero ? docY(start.top) : Math.min(window.innerHeight * 0.7, 620);
      const vh = window.innerHeight;
      const fly = (scroll: number, px: number, py: number, rotate = 0, extra: Partial<FlightStop> = {}): FlightStop =>
        ({ scroll, x: clampX(px), y: py, rotate, opacity: 1, pose: "fly", ...extra });
      // Free-flight stops are pinned to a screen height so Kreto stays in view between hideaways.
      const glide = (scroll: number, px: number, screenY: number, rotate = 0) =>
        fly(scroll, px, screenY + scroll - origin, rotate);
      // Takeoff: a small upward hop out of the wave, then a long gliding arc into the page.
      const awayX = x0 > vw / 2 ? -1 : 1;
      stops = [
        { scroll: 0, x: x0, y: y0, rotate: 0, opacity: 0, pose: "fly" },
        fly(90, x0 + awayX * size * 0.12, y0 - size * 0.22),
        fly(240, x0 + awayX * size * 0.9, y0 + size * 0.35),
      ];
      let spin = 0;
      parent.querySelectorAll<HTMLElement>("[data-kreto-flight-media]").forEach((media, index) => {
        const rect = media.getBoundingClientRect();
        const top = docY(rect.top);
        const bottom = docY(rect.bottom);
        const left = rect.left - bounds.left;
        const prev = stops[stops.length - 1];
        const onTop = index % 2 === 0;
        // Time the hideaway so the ledge sits comfortably inside the viewport.
        const ledgeAt = onTop ? top + origin - vh * 0.38 : bottom + origin - vh * 0.6;
        const at = Math.max(prev.scroll + (index === 0 ? 700 : 720), ledgeAt);
        const peekX = clampX(left + rect.width * (onTop ? 0.7 : 0.3) - size / 2);
        const fromSide: 1 | -1 = prev.x > peekX ? 1 : -1;
        const exitSide = (clampX(peekX - fromSide * size * 1.6) === peekX - fromSide * size * 1.6 ? -fromSide : fromSide) as 1 | -1;
        if (onTop) {
          // Lands on the top edge: hands on the ledge, head above the image.
          const py = top - size * LEDGE.peekTop;
          stops.push(
            glide(at - 540, peekX + fromSide * size * 1.5, vh * 0.3, spin),
            fly(at - 270, peekX + fromSide * size * 0.4, py - size * 0.4, spin),
            { ...fly(at - 130, peekX, py, spin), pose: "peekTop" },
             { ...fly(at + 250, peekX, py, spin), pose: "peekTop" },
             glide(at + 350, peekX + exitSide * size * 0.45, vh * 0.2, spin),
          );
        } else {
          // Hangs from the bottom edge: hands under the ledge, body below the image.
          const py = bottom - size * LEDGE.peekBottom;
          stops.push(
            fly(at - 560, peekX + fromSide * size * 1.4, top + rect.height * 0.35, spin),
            fly(at - 290, peekX + fromSide * size * 0.5, bottom - size * 0.8, spin),
            { ...fly(at - 130, peekX, py, spin), pose: "peekBottom" },
             { ...fly(at + 250, peekX, py, spin), pose: "peekBottom" },
             glide(at + 350, peekX + exitSide * size * 0.45, vh * 0.5, spin),
          );
        }
        // 360° backflip on the way out (nose up first), then keep gliding the same way.
        const last = stops[stops.length - 1];
        spin -= exitSide * 360;
        stops.push(glide(at + 470, last.x + exitSide * size * 1.3, vh * 0.4, spin));
      });
      const last = stops[stops.length - 1];
      const end = parent.scrollHeight - window.innerHeight + origin;
      if (end > last.scroll + 240) {
        stops.push(fly(end - 140, vw - size - 24, parent.scrollHeight - size - 240, spin));
        stops.push(glide(end, vw - size - 24, vh * 0.55, spin));
      }
      stops = withFlightTurns(stops);
      const initial = headingAt(stops, 200);
      if (initial !== 0) { heading = initial; setFacing(initial); }
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
  }, [ready, reduced, x, y, rotate, opacity]);

  const visible: Layer = pose === "fly" ? (facing === 1 ? "right" : "left") : pose;

  return (
    <motion.div ref={ref} aria-hidden="true" data-kreto-flight data-pose={pose} data-facing={facing === 1 ? "right" : "left"}
      className="pointer-events-none absolute left-0 top-0 z-[2] h-[104px] w-[104px] select-none lg:h-[180px] lg:w-[180px] min-[1440px]:h-[240px] min-[1440px]:w-[240px]"
      style={{ x, y, rotate, opacity }}>
      <motion.div className="relative h-full w-full" animate={pose === "fly" && !reduced ? { y: [0, -5, 0] } : { y: 0 }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}>
      {(Object.keys(layers) as Layer[]).map(key => (
        <img key={key} src={layers[key]} alt="" width={1024} height={1024} decoding="async" draggable={false}
          className={`absolute inset-0 h-full w-full object-contain ${key === visible ? "opacity-100" : "opacity-0"}`} />
      ))}
      </motion.div>
    </motion.div>
  );
}
