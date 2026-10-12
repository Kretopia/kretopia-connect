import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import flyingRight from "@/assets/brand/kreto/kreto-flying.webp";
import flyingLeft from "@/assets/brand/kreto/kreto-flying-left.webp";
import peekTop from "@/assets/brand/kreto/kreto-peek-top.webp";
import peekBottom from "@/assets/brand/kreto/kreto-peek-bottom.webp";
import { bottomBackflip, headingAt, ledgeLockAt, lockY, sampleFlight, type FlightPose, type FlightStop, type LedgeLock } from "./kretoFlightPath";

const layers = { right: flyingRight, left: flyingLeft, peekTop, peekBottom } as const;
type Layer = keyof typeof layers;
const layerKeys = Object.keys(layers) as Layer[];
/** Where the ledge line sits inside each hiding artwork (fraction of its rendered size). */
const LEDGE = { peekTop: 0.854, peekBottom: 0.45 };
/** Rendered silhouette heights (origin-top scale) used to hide a pose fully behind media. */
const HEIGHT = { peekTop: 1.446, peekBottom: 1.287 };
// Alpha-bounds normalization: all silhouettes match Flying's 875px height.
const poseClasses: Record<Layer, string> = {
  right: "", left: "", peekTop: "origin-top scale-[1.446]", peekBottom: "origin-top scale-[1.287]",
};

const sizeFor = (w: number) => (w >= 1440 ? 300 : w >= 1024 ? 180 : 104);

/**
 * One decorative figure; real media are foreground occluders, never duplicated.
 * Position, rotation, opacity and artwork are written together in one frame so
 * a pose can never appear at the wrong place (no flicker, no double figure).
 */
export function KretoLandingFlight({ ready }: { ready: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const imgs = useRef<Partial<Record<Layer, HTMLImageElement | null>>>({});
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    const parent = el?.parentElement;
    const hero = parent?.querySelector<HTMLElement>("[data-kreto-wave]");
    if (!el || !parent || !hero || reduced) {
      if (el) el.style.opacity = "0";
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
    Promise.all(layerKeys.map(key => imgs.current[key]?.decode().catch(() => undefined)))
      .then(() => { if (!cancelled) { artworkReady = true; queue(); } });
    let heading: 1 | -1 = -1;
    let shown: Layer | undefined;
    let first = true;
    let previousScroll = scrollTop();
    let direction: -1 | 1 = 1;
    let endScroll = 0;
    let poseScroll = -100;
    let ledgeLocks: LedgeLock[] = [];
    let activeLock: LedgeLock | undefined;
    let mediaZones: { from: number; to: number; left: number; right: number; top: number; bottom: number }[] = [];
    /** Free-flight corridors keep Flying fully between two media, never overlapping one. */
    let corridors: { from: number; to: number; minY: number; maxY: number }[] = [];
    const cur = { x: 0, y: 0, r: 0 };

    const show = (layer: Layer, pose: FlightPose) => {
      if (layer === shown) return;
      // Hide the previous artwork and reveal the next in the same synchronous write.
      for (const key of layerKeys) {
        const image = imgs.current[key];
        if (image) image.style.visibility = key === layer ? "visible" : "hidden";
      }
      shown = layer;
      el.dataset.pose = pose;
      el.dataset.facing = heading === 1 ? "right" : "left";
    };

    const paint = () => {
      frame = 0;
      const scroll = scrollTop();
      if (Math.abs(scroll - previousScroll) > 1) direction = scroll > previousScroll ? 1 : -1;
      previousScroll = scroll;
      const point = sampleFlight(stops, scroll);
      if (!point || !artworkReady) return;
      const size = sizeFor(window.innerWidth);
      const ahead = sampleFlight(stops, scroll + direction * 12);
      const climb = ahead ? (ahead.y - point.y - direction * 12) / 12 : 0;
      const bounds = parent.getBoundingClientRect();
      const zone = mediaZones.find(zone => scroll >= zone.from && scroll <= zone.to);
      activeLock = ledgeLockAt(ledgeLocks, scroll, activeLock);
      const pose: FlightPose = activeLock?.pose ?? "fly";
      if (activeLock) poseScroll = scroll;
      const corridor = activeLock ? undefined : corridors.find(c => scroll >= c.from && scroll <= c.to);

      let targetX: number;
      let targetY: number;
      if (activeLock) {
        targetX = activeLock.x;
        targetY = lockY(activeLock, scroll);
      } else {
        const follow = Math.min(1, Math.max(0, (scroll - 180) / 240));
        const visibleY = Math.max(-bounds.top + window.innerHeight * 0.2, Math.min(-bounds.top + window.innerHeight * 0.72 - size, point.y));
        targetY = zone ? point.y : point.y + (visibleY - point.y) * follow;
        if (corridor && corridor.maxY >= corridor.minY) targetY = Math.max(corridor.minY, Math.min(corridor.maxY, targetY));
        targetX = zone ? Math.max(zone.left, Math.min(zone.right, point.x)) : point.x;
        // Heading changes only at the start of a free journey, never from jitter.
        if (Math.abs(scroll - poseScroll) > 60) {
          const dir = headingAt(stops, scroll, 40, 3) * direction;
          if (dir !== 0 && dir !== heading) { heading = dir < 0 ? -1 : 1; poseScroll = scroll; }
        }
      }
      const bank = !activeLock && !zone ? heading * Math.max(-8, Math.min(8, climb * 10)) : 0;
      const targetR = activeLock ? 0 : point.rotate + (!zone ? bottomBackflip(scroll, endScroll) : 0) + bank;

      // Locks are attached to document geometry: no easing at all. Free flight
      // eases toward the scroll-driven target for a smooth, constant glide.
      let settling = false;
      if (first || activeLock || Math.abs(cur.y - targetY) > window.innerHeight) {
        cur.x = targetX; cur.y = targetY; cur.r = targetR; first = false;
      } else {
        const k = 0.32;
        cur.x += (targetX - cur.x) * k; cur.y += (targetY - cur.y) * k; cur.r += (targetR - cur.r) * k;
        settling = Math.abs(targetX - cur.x) > 0.4 || Math.abs(targetY - cur.y) > 0.4 || Math.abs(targetR - cur.r) > 0.2;
        if (!settling) { cur.x = targetX; cur.y = targetY; cur.r = targetR; }
      }
      // Easing must not drag Flying into a media either.
      if (corridor && corridor.maxY >= corridor.minY) cur.y = Math.max(corridor.minY, Math.min(corridor.maxY, cur.y));
      show(pose === "peekTop" || pose === "peekBottom" ? pose : heading === 1 ? "right" : "left", pose);
      el.style.transform = `translate3d(${cur.x}px, ${cur.y}px, 0) rotate(${cur.r}deg)`;
      // Exclusive ownership prevents two silhouettes during Hero takeoff.
      const inFlight = scroll >= 65 || getComputedStyle(hero).display === "none";
      el.style.opacity = inFlight ? "1" : "0";
      hero.style.opacity = inFlight ? "0" : "1";
      if (settling) queue();
    };
    const queue = () => { if (!frame) frame = requestAnimationFrame(paint); };

    const measure = () => {
      const bounds = parent.getBoundingClientRect();
      const origin = bounds.top + scrollTop();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const size = sizeFor(vw);
      const clampX = (v: number) => Math.max(8, Math.min(vw - size - 8, v));
      const docY = (v: number) => v + scrollTop() - origin;
      const start = hero.getBoundingClientRect();
      const visibleHero = start.width > 0;
      const x0 = visibleHero ? start.left - bounds.left : vw - size - 16;
      const y0 = visibleHero ? docY(start.top) : Math.min(vh * 0.7, 620);
      const fly = (scroll: number, px: number, py: number, extra: Partial<FlightStop> = {}): FlightStop =>
        ({ scroll, x: clampX(px), y: py, rotate: 0, opacity: 1, pose: "fly", ...extra });
      const glide = (scroll: number, px: number, screenY: number) => fly(scroll, px, screenY + scroll - origin);
      // Takeoff: a small upward hop out of the wave, then a long gliding arc into the page.
      const awayX = x0 > vw / 2 ? -1 : 1;
      stops = [
        { scroll: 0, x: x0, y: y0, rotate: 0, opacity: 0, pose: "fly" },
        fly(90, x0 + awayX * size * 0.12, y0 - size * 0.22),
        fly(240, x0 + awayX * size * 0.9, y0 + size * 0.35),
      ];
      mediaZones = [];
      ledgeLocks = [];
      corridors = [];
      activeLock = undefined;
      let corridorFrom = 240;
      let corridorMin = -Infinity;
      const hold = Math.max(180, vh * 0.3);
      parent.querySelectorAll<HTMLElement>("[data-kreto-flight-media]").forEach((media, index) => {
        const rect = media.getBoundingClientRect();
        const top = docY(rect.top);
        const bottom = docY(rect.bottom);
        const left = rect.left - bounds.left;
        const previous = stops[stops.length - 1];
        const topAt = Math.max(previous.scroll + 200, top + origin - vh * 0.38);
        const bottomAt = Math.max(topAt + 520, bottom + origin - vh * 0.6);
        const release = bottomAt + hold;
        const inset = size * 0.18;
        const mediaLeft = Math.max(8, left + inset);
        const mediaRight = Math.max(mediaLeft, Math.min(vw - size - 8, left + rect.width - size - inset));
        const x = Math.max(mediaLeft, Math.min(mediaRight, left + rect.width * (index % 2 === 0 ? 0.65 : 0.35) - size / 2));
        const topY = top - size * LEDGE.peekTop;
        const bottomY = bottom - size * LEDGE.peekBottom;
        // Hidden heights: the whole silhouette sits behind the media.
        const hiddenTop = Math.max(topY, Math.min(top, bottom - size * HEIGHT.peekTop));
        const hiddenBottom = Math.min(bottomY, Math.max(top, bottom - size * HEIGHT.peekBottom));
        const middle = (topAt + bottomAt) / 2;
        const slide = Math.min(90, (middle - topAt) / 3);
        // Contiguous locks: Kreto never leaves a hideaway pose while the media is in play.
        ledgeLocks.push(
          { from: topAt, to: middle - slide, x, y: topY, pose: "peekTop" },
          { from: middle - slide, to: middle, x, y: topY, y2: hiddenTop, pose: "peekTop" },
          { from: middle, to: middle + slide, x, y: hiddenBottom, y2: bottomY, pose: "peekBottom" },
          { from: middle + slide, to: release, x, y: bottomY, pose: "peekBottom" },
        );
        mediaZones.push({ from: topAt - 60, to: release + 40, left: mediaLeft, right: mediaRight, top, bottom });
        // Flying is never allowed to overlap a media: it arrives fully above the
        // top edge and departs fully below the bottom edge.
        const arriveY = top - size;
        const departY = bottom + 2;
        corridors.push({ from: corridorFrom, to: topAt, minY: corridorMin, maxY: arriveY });
        corridorFrom = release;
        corridorMin = departY;
        stops.push(
          fly(topAt - 100, x, arriveY - size * 0.12),
          fly(topAt - 1, x, arriveY),
          { ...fly(topAt, x, topY), pose: "peekTop" },
          { ...fly(topAt + 1, x, topY), pose: "peekTop" },
          { ...fly(release - 1, x, bottomY), pose: "peekBottom" },
          { ...fly(release, x, bottomY), pose: "peekBottom" },
          fly(release + 1, x, departY),
          fly(release + 100, x, departY + size * 0.12),
        );
      });
      const last = stops[stops.length - 1];
      const end = parent.scrollHeight - vh + origin;
      endScroll = end;
      if (end > last.scroll + 240) {
        stops.push(glide(end - 280, vw - size - 24, vh * 0.5));
        stops.push(glide(end, vw - size - 24, vh * 0.55));
      }
      corridors.push({ from: corridorFrom, to: Infinity, minY: corridorMin, maxY: Infinity });
      // Keep stops strictly ordered even with short media and tall viewports.
      stops = stops.reduce<FlightStop[]>((ordered, stop) => {
        const prev = ordered[ordered.length - 1];
        ordered.push({ ...stop, scroll: prev ? Math.max(stop.scroll, prev.scroll + 1) : stop.scroll });
        return ordered;
      }, []);
      const initial = headingAt(stops, 200);
      if (first && initial !== 0) heading = initial;
      shown = undefined;
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
  }, [ready, reduced]);

  return (
    <div ref={ref} aria-hidden="true" data-kreto-flight data-pose="fly" data-facing="left"
      className="pointer-events-none absolute left-0 top-0 z-[2] h-[104px] w-[104px] select-none will-change-transform lg:h-[180px] lg:w-[180px] min-[1440px]:h-[300px] min-[1440px]:w-[300px]"
      style={{ opacity: 0 }}>
      <div className="relative h-full w-full">
        {layerKeys.map(key => (
          <img key={key} ref={node => { imgs.current[key] = node; }} src={layers[key]} alt="" width={1024} height={1024}
            decoding="sync" draggable={false}
            className={`absolute inset-0 h-full w-full object-contain ${poseClasses[key]}`}
            style={{ visibility: key === "left" ? "visible" : "hidden" }} />
        ))}
      </div>
    </div>
  );
}
