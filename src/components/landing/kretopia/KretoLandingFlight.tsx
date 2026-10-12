import { useEffect, useRef, useState } from "react";
import { motion, useSpring } from "framer-motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import flyingRight from "@/assets/brand/kreto/kreto-flying.webp";
import flyingLeft from "@/assets/brand/kreto/kreto-flying-left.webp";
import peekTop from "@/assets/brand/kreto/kreto-peek-top.webp";
import peekBottom from "@/assets/brand/kreto/kreto-peek-bottom.webp";
import { headingAt, sampleFlight, type FlightPose, type FlightStop } from "./kretoFlightPath";

const layers = { right: flyingRight, left: flyingLeft, peekTop, peekBottom } as const;
type Layer = keyof typeof layers;
/** Where the ledge line sits inside each hiding artwork (fraction of its height). */
const LEDGE = { peekTop: 0.62, peekBottom: 0.32 };
const SPRING = { stiffness: 180, damping: 28, mass: 0.6 };

const sizeFor = (w: number) => (w >= 1440 ? 300 : w >= 1024 ? 180 : 104);

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
    let lastHeadingChange = 0;

    const paint = () => {
      frame = 0;
      const scroll = scrollTop();
      if (Math.abs(scroll - previousScroll) > 1) direction = scroll > previousScroll ? 1 : -1;
      previousScroll = scroll;
      const point = sampleFlight(stops, scroll);
      if (!point) return;
      const size = sizeFor(window.innerWidth);
      // Bank with the climb/dive so the nose leads, mirrored for each heading.
      const ahead = sampleFlight(stops, scroll + direction * 12);
      const climb = ahead ? (ahead.y - point.y) / 12 : 0;
      const bounds = parent.getBoundingClientRect();
      const offscreen = point.y + bounds.top < -size || point.y + bounds.top > window.innerHeight;
      const renderPose = scroll > 120 && offscreen ? "fly" : point.pose;
      const bank = renderPose === "fly" ? heading * Math.max(-16, Math.min(16, climb * 22)) : 0;
      const flightY = scroll > 120
        ? Math.max(-bounds.top + window.innerHeight * 0.2, Math.min(-bounds.top + window.innerHeight * 0.72 - size, point.y)) : point.y;
      const flightX = point.x;
      // Follow actual rendered travel, not the next scripted stop. A dead zone
      // prevents left/right chatter while hovering or reversing a short scroll.
      const dx = flightX - x.get();
      const now = performance.now();
      if (renderPose === "fly" && Math.abs(dx) > 6 && now - lastHeadingChange > 180) {
        const dir = dx > 0 ? 1 : -1;
        if (dir !== heading) { heading = dir; setFacing(dir); lastHeadingChange = now; }
      }
      const targetRotation = point.rotate + bank;
      if (first) { x.jump(flightX); y.jump(flightY); rotate.jump(targetRotation); first = false; }
      else {
        x.set(flightX);
        // Fast scroll jumps must not leave the spring chasing an offscreen location.
        if (Math.abs(y.get() - flightY) > window.innerHeight) y.jump(flightY);
        else y.set(flightY);
        rotate.set(targetRotation);
      }
      const handoff = Math.min(1, Math.max(0, scroll / 180));
      const blend = handoff * handoff * (3 - 2 * handoff);
      opacity.jump(blend);
      // Cross-fade from the original, aligned waving layers at takeoff.
      hero.style.opacity = String(1 - blend);
      if (renderPose !== activePose) { activePose = renderPose; setPose(renderPose); }
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
        const previous = stops[stops.length - 1];
        const topAt = Math.max(previous.scroll + 200, top + origin - vh * 0.38);
        const bottomAt = Math.max(topAt + 360, bottom + origin - vh * 0.6);
        const topX = clampX(left + rect.width * (index % 2 === 0 ? 0.7 : 0.3) - size / 2);
        const bottomX = clampX(left + rect.width * (index % 2 === 0 ? 0.3 : 0.7) - size / 2);
        const leftSide = clampX(left - size * 0.6);
        const rightSide = clampX(left + rect.width - size * 0.4);
        const firstSide = index % 2 === 0 ? rightSide : leftSide;
        const secondSide = index % 2 === 0 ? leftSide : rightSide;
        const topY = top - size * LEDGE.peekTop;
        const bottomY = bottom - size * LEDGE.peekBottom;
        const middle = (topAt + bottomAt) / 2;
        stops.push(
          fly(topAt - 100, topX, topY - size * 0.45, spin),
          { ...fly(topAt, topX, topY, spin), pose: "peekTop" },
          { ...fly(topAt + 80, topX, topY, spin), pose: "peekTop" },
          fly(middle - 40, firstSide, top + rect.height * 0.25, spin),
          fly(middle + 40, secondSide, top + rect.height * 0.65, spin),
          { ...fly(bottomAt, bottomX, bottomY, spin), pose: "peekBottom" },
          { ...fly(bottomAt + 90, bottomX, bottomY, spin), pose: "peekBottom" },
        );
        // One unhurried backflip during the journey, never at every ledge.
        if (index === 1) spin += 360;
        stops.push(glide(bottomAt + 330, secondSide, vh * 0.45, spin));
      });
      const last = stops[stops.length - 1];
      const end = parent.scrollHeight - window.innerHeight + origin;
      if (end > last.scroll + 240) {
        stops.push(fly(end - 140, vw - size - 24, parent.scrollHeight - size - 240, spin));
        stops.push(glide(end - 45, vw - size - 24, vh * 0.55, spin,));
        stops.push(glide(end, vw - size - 24, vh * 0.55, spin));
      }
      // Keep stops strictly ordered even with short media and tall viewports.
      stops = stops.map((stop, i) => ({ ...stop, scroll: i === 0 ? stop.scroll : Math.max(stop.scroll, stops[i - 1].scroll + 1) }));
      const initial = headingAt(stops, 200);
      if (first && initial !== 0) { heading = initial; setFacing(initial); }
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

  const visible: Layer = pose === "peekTop" || pose === "peekBottom" ? pose : facing === 1 ? "right" : "left";

  return (
    <motion.div ref={ref} aria-hidden="true" data-kreto-flight data-pose={pose} data-facing={facing === 1 ? "right" : "left"}
      className="pointer-events-none absolute left-0 top-0 z-[2] h-[104px] w-[104px] select-none lg:h-[180px] lg:w-[180px] min-[1440px]:h-[300px] min-[1440px]:w-[300px]"
      style={{ x, y, rotate, opacity }}>
      <motion.div className="relative h-full w-full" animate={!reduced ? { y: [0, -3, 0] } : { y: 0 }} transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}>
      {(Object.keys(layers) as Layer[]).map(key => (
        <motion.img key={key} src={layers[key]} alt="" width={1024} height={1024} decoding="sync" draggable={false}
          initial={false} animate={{ opacity: key === visible ? 1 : 0 }} transition={{ duration: reduced ? 0 : 0.18, ease: "easeInOut" }}
          className="absolute inset-0 h-full w-full object-contain" />
      ))}
      </motion.div>
    </motion.div>
  );
}
