import { useEffect, useRef, useState } from "react";
import { motion, useSpring } from "framer-motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import flyingRight from "@/assets/brand/kreto/kreto-flying.webp";
import flyingLeft from "@/assets/brand/kreto/kreto-flying-left.webp";
import peekTop from "@/assets/brand/kreto/kreto-peek-top.webp";
import peekBottom from "@/assets/brand/kreto/kreto-peek-bottom.webp";
import { bottomBackflip, headingAt, sampleFlight, type FlightPose, type FlightStop } from "./kretoFlightPath";

const layers = { right: flyingRight, left: flyingLeft, peekTop, peekBottom } as const;
type Layer = keyof typeof layers;
/** Where the ledge line sits inside each hiding artwork (fraction of its height). */
const LEDGE = { peekTop: 0.854, peekBottom: 0.45 };
const SPRING = { stiffness: 150, damping: 30, mass: 0.6 };
// Alpha-bounds normalization: all silhouettes match Flying's 875px height.
const poseClasses: Record<Layer, string> = {
  right: "", left: "", peekTop: "origin-top scale-[1.446]", peekBottom: "origin-top scale-[1.287]",
};

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
    let frame = 0;
    let cancelled = false;
    let artworkReady = false;
    Promise.all([...ref.current?.querySelectorAll("img") ?? []].map(image => image.decode().catch(() => undefined)))
      .then(() => { if (!cancelled) { artworkReady = true; queue(); } });
    let activePose: FlightPose = "fly";
    let heading: 1 | -1 = -1;
    let first = true;
    let previousScroll = scrollTop();
    let direction: -1 | 1 = 1;
    let endScroll = 0;
    let poseScroll = -100;
    let mediaZones: { from: number; to: number; left: number; right: number; top: number; bottom: number }[] = [];

    const paint = () => {
      frame = 0;
      const scroll = scrollTop();
      if (Math.abs(scroll - previousScroll) > 1) direction = scroll > previousScroll ? 1 : -1;
      previousScroll = scroll;
      const point = sampleFlight(stops, scroll);
      if (!point || !artworkReady) return;
      const size = sizeFor(window.innerWidth);
      // Bank with the climb/dive so the nose leads, mirrored for each heading.
      const ahead = sampleFlight(stops, scroll + direction * 12);
      const climb = ahead ? (ahead.y - point.y - direction * 12) / 12 : 0;
      const bounds = parent.getBoundingClientRect();
      const zone = mediaZones.find(zone => scroll >= zone.from && scroll <= zone.to);
      const requestedPose = point.pose;
      // Spatial hysteresis prevents repeated switches around a ledge threshold.
      if (requestedPose !== activePose && Math.abs(scroll - poseScroll) > 28) {
        activePose = requestedPose; poseScroll = scroll; setPose(requestedPose);
      }
      const renderPose = activePose;
      const follow = Math.min(1, Math.max(0, (scroll - 180) / 240));
      const visibleY = Math.max(-bounds.top + window.innerHeight * 0.2, Math.min(-bounds.top + window.innerHeight * 0.72 - size, point.y));
      const flightY = !zone && renderPose === "fly" ? point.y + (visibleY - point.y) * follow : point.y;
      const flightX = zone ? Math.max(zone.left, Math.min(zone.right, point.x)) : point.x;
      // Change heading only while fully covered, or once at the start of a
      // direct inter-media journey; never from tiny scroll-direction changes.
      const covered = zone && flightY >= zone.top && flightY + size * 1.28 <= zone.bottom;
      if (covered || (!zone && Math.abs(scroll - poseScroll) > 100)) {
        const tangent = headingAt(stops, scroll, 40, 3);
        const dir = tangent * direction;
        if (dir !== 0 && dir !== heading) { heading = dir < 0 ? -1 : 1; setFacing(heading); poseScroll = scroll; }
      }
      const bank = !zone && renderPose === "fly" ? heading * Math.max(-8, Math.min(8, climb * 10)) : 0;
      const targetRotation = point.rotate + (!zone ? bottomBackflip(scroll, endScroll) : 0) + bank;
      if (first) { x.jump(flightX); y.jump(flightY); rotate.jump(targetRotation); first = false; }
      else {
        x.set(flightX);
        // Fast scroll jumps must not leave the spring chasing an offscreen location.
        if (Math.abs(y.get() - flightY) > window.innerHeight) y.jump(flightY);
        else y.set(flightY);
        rotate.set(targetRotation);
      }
      // Exclusive ownership prevents two silhouettes during Hero takeoff.
      // The artwork swap occurs during the small launch hop, never by fading.
      const inFlight = scroll >= 65 || getComputedStyle(hero).display === "none";
      opacity.jump(inFlight ? 1 : 0);
      hero.style.opacity = inFlight ? "0" : "1";
    };
    const queue = () => { if (!frame) frame = requestAnimationFrame(paint); };

    const measure = () => {
      const bounds = parent.getBoundingClientRect();
      const origin = bounds.top + scrollTop();
      const vw = window.innerWidth;
      const size = sizeFor(vw);
      const clampX = (v: number) => Math.max(8, Math.min(vw - size - 8, v));
      const docY = (v: number) => v + scrollTop() - origin;
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
      const spin = 0;
      mediaZones = [];
      parent.querySelectorAll<HTMLElement>("[data-kreto-flight-media]").forEach((media, index) => {
        const rect = media.getBoundingClientRect();
        const top = docY(rect.top);
        const bottom = docY(rect.bottom);
        const left = rect.left - bounds.left;
        const previous = stops[stops.length - 1];
        const topAt = Math.max(previous.scroll + 200, top + origin - vh * 0.38);
        const bottomAt = Math.max(topAt + 520, bottom + origin - vh * 0.6);
        const inset = size * 0.18;
        const mediaLeft = Math.max(8, left + inset);
        const mediaRight = Math.max(mediaLeft, Math.min(vw - size - 8, left + rect.width - size - inset));
        const topX = Math.max(mediaLeft, Math.min(mediaRight, left + rect.width * (index % 2 === 0 ? 0.65 : 0.35) - size / 2));
        const bottomX = topX;
        const topY = top - size * LEDGE.peekTop;
        const bottomY = bottom - size * LEDGE.peekBottom;
        const middle = (topAt + 170 + bottomAt) / 2;
        mediaZones.push({ from: topAt - 60, to: bottomAt + 220, left: mediaLeft, right: mediaRight, top, bottom });
        stops.push(
          fly(topAt - 100, topX, topY - size * 0.12, spin),
          { ...fly(topAt, topX, topY, spin), pose: "peekTop" },
          { ...fly(topAt + 170, topX, topY, spin), pose: "peekTop" },
          fly(middle, topX, top + Math.max(0, (rect.height - size * 1.446) / 2), spin),
          { ...fly(bottomAt, bottomX, bottomY, spin), pose: "peekBottom" },
          { ...fly(bottomAt + 180, bottomX, bottomY, spin), pose: "peekBottom" },
        );
        stops.push(fly(bottomAt + 280, bottomX, bottomY + size * 0.12, spin));
      });
      const last = stops[stops.length - 1];
      const end = parent.scrollHeight - window.innerHeight + origin;
      endScroll = end;
      if (end > last.scroll + 240) {
        stops.push(glide(end - 280, vw - size - 24, vh * 0.5, spin));
        stops.push(glide(end, vw - size - 24, vh * 0.55, spin));
      }
      // Keep stops strictly ordered even with short media and tall viewports.
      stops = stops.reduce<FlightStop[]>((ordered, stop) => {
        const previous = ordered[ordered.length - 1];
        ordered.push({ ...stop, scroll: previous ? Math.max(stop.scroll, previous.scroll + 1) : stop.scroll });
        return ordered;
      }, []);
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
      cancelled = true;
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
      <motion.div className="relative h-full w-full" animate={!reduced && pose === "fly" ? { y: [0, -3, 0] } : { y: 0 }} transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}>
      {(Object.keys(layers) as Layer[]).map(key => (
        <img key={key} src={layers[key]} alt="" width={1024} height={1024} decoding="sync" draggable={false}
          className={`absolute inset-0 h-full w-full object-contain ${poseClasses[key]} ${key === visible ? "block" : "hidden"}`} />
      ))}
      </motion.div>
    </motion.div>
  );
}
