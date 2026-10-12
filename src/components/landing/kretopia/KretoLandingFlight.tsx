import { useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, useSpring, type AnimationPlaybackControls } from "framer-motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import flyingRight from "@/assets/brand/kreto/kreto-flying.webp";
import flyingLeft from "@/assets/brand/kreto/kreto-flying-left.webp";
import peekTop from "@/assets/brand/kreto/kreto-peek-top.webp";
import peekBottom from "@/assets/brand/kreto/kreto-peek-bottom.webp";
import { headingAt, sampleFlight, type FlightPose, type FlightStop } from "./kretoFlightPath";

const layers = { right: flyingRight, left: flyingLeft, peekTop, peekBottom } as const;
type Layer = keyof typeof layers;
const hideaways = ["chapter-passport", "chapter-match", "chapter-studio"];
/** Where the ledge line sits inside each hiding artwork (fraction of its height). */
const LEDGE = { peekTop: 0.62, peekBottom: 0.32 };
const SPRING = { stiffness: 140, damping: 24, mass: 0.7 };

const sizeFor = (w: number) => (w >= 1440 ? 240 : w >= 1024 ? 180 : 104);

/** One decorative figure; real media are foreground occluders, never duplicated. */
export function KretoLandingFlight({ ready }: { ready: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [pose, setPose] = useState<FlightPose>("fly");
  const [facing, setFacing] = useState<1 | -1>(-1);
  const x = useSpring(0, SPRING);
  const y = useSpring(0, SPRING);
  const rotate = useSpring(0, { stiffness: 110, damping: 20, mass: 0.8 });
  const rotateY = useMotionValue(0);
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
    let turning: AnimationPlaybackControls | undefined;
    let turnToken = 0;
    let first = true;

    // 180° pirouette: rotate edge-on, swap to the artwork facing the new way, rotate back in.
    const pirouette = (next: 1 | -1) => {
      const token = ++turnToken;
      turning?.stop();
      turning = animate(rotateY, 90, {
        duration: 0.16, ease: "easeIn",
        onComplete: () => {
          if (token !== turnToken) return;
          setFacing(next);
          rotateY.set(-90);
          turning = animate(rotateY, 0, { duration: 0.26, ease: [0.2, 0.9, 0.3, 1] });
        },
      });
    };

    const paint = () => {
      frame = 0;
      const scroll = scrollTop();
      const point = sampleFlight(stops, scroll);
      if (!point) return;
      const size = sizeFor(window.innerWidth);
      const dir = headingAt(stops, scroll);
      if (dir !== 0 && dir !== heading) {
        heading = dir;
        if (point.pose === "fly" && !first) pirouette(dir);
        else { turnToken++; turning?.stop(); rotateY.set(0); setFacing(dir); }
      }
      // Bank with the climb/dive so the nose leads, mirrored for each heading.
      const ahead = sampleFlight(stops, scroll + 24);
      const climb = ahead ? (ahead.y - point.y) / 24 : 0;
      const bank = point.pose === "fly" ? heading * Math.max(-16, Math.min(16, climb * 22)) : 0;
      if (first) { x.jump(point.x); y.jump(point.y); rotate.jump(point.rotate + bank); first = false; }
      else { x.set(point.x); y.set(point.y); rotate.set(point.rotate + bank); }
      const overlapsText = point.pose === "fly" && protectedAreas.some(area => point.x + size > area.x && point.x < area.x + area.width && point.y + size > area.y && point.y < area.y + area.height);
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
        fly(110, x0 + awayX * size * 0.12, y0 - size * 0.22),
        fly(320, x0 + awayX * size * 0.9, y0 + size * 0.35),
      ];
      let spin = 0;
      hideaways.forEach((id, index) => {
        const media = parent.querySelector<HTMLElement>(`#${id} [data-kreto-flight-media]`);
        if (!media) return;
        const rect = media.getBoundingClientRect();
        const top = docY(rect.top);
        const bottom = docY(rect.bottom);
        const left = rect.left - bounds.left;
        const prev = stops[stops.length - 1];
        const onTop = index % 2 === 0;
        // Time the hideaway so the ledge sits comfortably inside the viewport.
        const ledgeAt = onTop ? top + origin - vh * 0.38 : bottom + origin - vh * 0.6;
        const at = Math.max(prev.scroll + 700, ledgeAt);
        const peekX = clampX(left + rect.width * [0.7, 0.3, 0.62][index] - size / 2);
        const fromSide: 1 | -1 = prev.x > peekX ? 1 : -1;
        const exitSide = (clampX(peekX - fromSide * size * 1.6) === peekX - fromSide * size * 1.6 ? -fromSide : fromSide) as 1 | -1;
        if (onTop) {
          // Lands on the top edge: hands on the ledge, head above the image.
          const py = top - size * LEDGE.peekTop;
          stops.push(
            glide(at - 540, peekX + fromSide * size * 1.5, vh * 0.3, spin),
            fly(at - 270, peekX + fromSide * size * 0.4, py - size * 0.4, spin),
            { ...fly(at - 130, peekX, py, spin), pose: "peekTop" },
            { ...fly(at + 130, peekX, py, spin), pose: "peekTop" },
            glide(at + 320, peekX + exitSide * size * 0.45, vh * 0.2, spin),
          );
        } else {
          // Hangs from the bottom edge: hands under the ledge, body below the image.
          const py = bottom - size * LEDGE.peekBottom;
          stops.push(
            glide(at - 560, peekX + fromSide * size * 1.4, vh * 0.35, spin),
            glide(at - 290, peekX + fromSide * size * 0.5, Math.min(vh - size - 16, vh * 0.68), spin),
            { ...fly(at - 130, peekX, py, spin), pose: "peekBottom" },
            { ...fly(at + 130, peekX, py, spin), pose: "peekBottom" },
            glide(at + 320, peekX + exitSide * size * 0.45, vh * 0.5, spin),
          );
        }
        // 360° backflip on the way out (nose up first), then keep gliding the same way.
        const last = stops[stops.length - 1];
        spin -= exitSide * 360;
        stops.push(glide(at + 620, last.x + exitSide * size * 1.3, vh * 0.4, spin));
      });
      const last = stops[stops.length - 1];
      const end = parent.scrollHeight - window.innerHeight + origin;
      if (end > last.scroll + 240) {
        stops.push(fly(end - 140, vw - size - 24, parent.scrollHeight - size - 240, spin));
        stops.push(fly(end, vw - size - 24, parent.scrollHeight - size - 140, spin, { opacity: 0 }));
      }
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
      observer.disconnect(); cancelAnimationFrame(frame); turning?.stop();
      scrollTarget.removeEventListener("scroll", queue);
      window.removeEventListener("resize", measure);
      hero.style.removeProperty("opacity");
    };
  }, [ready, reduced, x, y, rotate, rotateY, opacity]);

  const visible: Layer = pose === "fly" ? (facing === 1 ? "right" : "left") : pose;
  const hiding = pose !== "fly";

  return (
    <motion.div ref={ref} aria-hidden="true" data-kreto-flight data-pose={pose} data-facing={facing === 1 ? "right" : "left"}
      className={`pointer-events-none absolute left-0 top-0 h-[104px] w-[104px] select-none [filter:drop-shadow(0_22px_28px_rgba(15,23,42,0.35))_drop-shadow(0_0_26px_rgba(139,92,246,0.28))] lg:h-[180px] lg:w-[180px] min-[1440px]:h-[240px] min-[1440px]:w-[240px] ${hiding ? "z-[4]" : "z-[2]"}`}
      style={{ x, y, rotate, rotateY, opacity, transformPerspective: 900 }}>
      {(Object.keys(layers) as Layer[]).map(key => (
        <img key={key} src={layers[key]} alt="" width={1024} height={1024} decoding="async" draggable={false}
          className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-200 ${key === visible ? "opacity-100" : "opacity-0"}`} />
      ))}
    </motion.div>
  );
}
