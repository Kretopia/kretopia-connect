import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import flyingRight from "@/assets/brand/kreto/kreto-flying.webp";
import flyingLeft from "@/assets/brand/kreto/kreto-flying-left.webp";
import peekTop from "@/assets/brand/kreto/kreto-peek-top.webp";
import peekBottom from "@/assets/brand/kreto/kreto-peek-bottom.webp";
import { bottomBackflip, flipAt, ledgeLockAt, lockY, mediaLedgeLocks, sampleFlight, type Flip, type FlightPose, type FlightStop, type LedgeLock } from "./kretoFlightPath";

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

/** Flying silhouette's opaque vertical bounds (fraction of its box), with a small bank margin. */
const FLY_ALPHA = { top: 0, bottom: 1 };

const sizeFor = (w: number) => (w >= 1440 ? 300 : w >= 1024 ? 180 : 104);
/** Where along a media's width Kreto flies or attaches, cycled so no two neighbours repeat. */
const MEDIA_X = [0.65, 0.3, 0.25, 0.75];
/** After a scroll gesture ends, Kreto waits this long before popping out of his hiding place. */
const SCROLL_IDLE_MS = 160;
/** Reversing the scroll turns him with one backflip (in the picture plane, so the volume is never flattened). */
const TURN_MS = 520;
/**
 * The hands in front of the media. The sprite itself stays behind it; this overlay redraws only the
 * glove band, from the media edge down (top) or up (bottom), so he reads as gripping the picture.
 * Polygons are in artwork coordinates; the notch keeps the torso and the head dome behind the media.
 */
const GRIP_CLIP = {
  peekTop: "polygon(25% 58.5%, 40% 58.5%, 40% 62.6%, 60% 62.6%, 60% 58.5%, 75% 58.5%, 75% 69%, 25% 69%)",
  peekBottom: "polygon(28% 29.5%, 74% 29.5%, 74% 36%, 62% 36%, 62% 33.3%, 40% 33.3%, 40% 36%, 28% 36%)",
} as const;

/**
 * One decorative figure; real media are foreground occluders, never duplicated.
 * Position, rotation, opacity and artwork are written together in one frame so
 * a pose can never appear at the wrong place (no flicker, no double figure).
 */
export function KretoLandingFlight({ ready }: { ready: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const imgs = useRef<Partial<Record<Layer, HTMLImageElement | null>>>({});
  const gripRef = useRef<HTMLDivElement>(null);
  const gripImgs = useRef<Partial<Record<"peekTop" | "peekBottom", HTMLImageElement | null>>>({});
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    const parent = el?.parentElement;
    const hero = parent?.querySelector<HTMLElement>("[data-kreto-wave]");
    const grip = gripRef.current;
    if (!el || !grip || !parent || !hero || reduced) {
      if (el) el.style.opacity = "0";
      if (grip) grip.style.opacity = "0";
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
    let ledgeLocks: LedgeLock[] = [];
    let flips: Flip[] = [];
    // Sticky attach: tucked behind the media while the page moves, out on the ledge once it stops.
    let peek = 1;
    let lastScrollAt = 0;
    let idleTimer = 0;
    let turnStart = -1;
    let turnFrom: 1 | -1 = heading;
    let mediaEls: HTMLElement[] = [];
    let activeLock: LedgeLock | undefined;
    let wasLocked = false;
    let mediaZones: { from: number; to: number; left: number; right: number; top: number; bottom: number }[] = [];
    /** Free-flight corridors keep Flying fully between two media, never overlapping one. */
    let corridors: { from: number; to: number; minY: number; maxY: number; startX: number; endX: number }[] = [];
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
      if (Math.abs(scroll - previousScroll) > 8) {
        direction = scroll > previousScroll ? 1 : -1;
        previousScroll = scroll;
      }
      const point = sampleFlight(stops, scroll);
      if (!point || !artworkReady) return;
      const size = sizeFor(window.innerWidth);
      const ahead = sampleFlight(stops, scroll + direction * 12);
      const climb = ahead ? (ahead.y - point.y - direction * 12) / 12 : 0;
      const bounds = parent.getBoundingClientRect();
      const zone = mediaZones.find(zone => scroll >= zone.from && scroll <= zone.to);
      activeLock = ledgeLockAt(ledgeLocks, scroll, activeLock);
      const pose: FlightPose = activeLock?.pose ?? "fly";
      const corridor = activeLock ? undefined : corridors.find(c => scroll >= c.from && scroll <= c.to);

      let targetX: number;
      let targetY: number;
      if (activeLock) {
        targetX = activeLock.x;
        let base = lockY(activeLock, scroll);
        let hidden = activeLock.hidden;
        const mediaEl = activeLock.media !== undefined ? mediaEls[activeLock.media] : undefined;
        if (hidden !== undefined && mediaEl) {
          // A resting lock reads the media's live edge every frame: no margin, whatever has shifted since measure().
          const r = mediaEl.getBoundingClientRect();
          const top = r.top - bounds.top;
          const bottom = r.bottom - bounds.top;
          if (activeLock.pose === "peekTop") {
            base = top - size * LEDGE.peekTop;
            hidden = Math.max(base, Math.min(top, bottom - size * HEIGHT.peekTop));
          } else {
            base = bottom - size * LEDGE.peekBottom;
            hidden = Math.min(base, Math.max(top, bottom - size * HEIGHT.peekBottom));
          }
        }
        targetY = hidden !== undefined ? base + (hidden - base) * (1 - peek) : base;
      } else {
        const follow = Math.min(1, Math.max(0, (scroll - 180) / 240));
        const visibleY = Math.max(-bounds.top + window.innerHeight * 0.2, Math.min(-bounds.top + window.innerHeight * 0.72 - size, point.y));
        targetY = zone || (corridor && Number.isFinite(corridor.maxY)) ? point.y : point.y + (visibleY - point.y) * follow;
        if (corridor) targetY = corridor.maxY >= corridor.minY ? Math.max(corridor.minY, Math.min(corridor.maxY, targetY)) : (corridor.minY + corridor.maxY) / 2;
        targetX = point.x;
      }
      // Tight gaps between media leave no room for banking without overlapping one.
      const roomy = !corridor || (!Number.isFinite(corridor.maxY) && targetY > corridor.minY + size);
      const now = performance.now();
      const idleNow = now - lastScrollAt >= SCROLL_IDLE_MS;
      const peekTarget = idleNow ? 1 : 0;
      peek += (peekTarget - peek) * 0.22;
      const peeking = Math.abs(peekTarget - peek) >= 0.01;
      if (!peeking) peek = peekTarget;
      // One direction, set by the scroll alone: down faces right, up faces left. Only a reversal of the
      // scroll turns him, and he does it with a full backflip.
      const wantHeading: 1 | -1 = direction === 1 ? 1 : -1;
      if (!first && wantHeading !== heading) { turnStart = now; turnFrom = heading; }
      heading = wantHeading;
      const turnT = turnStart >= 0 ? (now - turnStart) / TURN_MS : 1;
      const turning = turnT < 1 && !activeLock;
      const bank = !activeLock && !zone && roomy ? heading * Math.max(-8, Math.min(8, climb * 10)) : 0;
      const targetR = activeLock || !roomy ? 0 : point.rotate + (!zone ? bottomBackflip(scroll, endScroll) : 0) + bank;

      // Locks are attached to document geometry: no easing at all. Free flight
      // eases toward the scroll-driven target for a smooth, constant glide.
      let settling = false;
      if (first || activeLock || wasLocked || Math.abs(cur.y - targetY) > window.innerHeight) {
        cur.x = targetX; cur.y = targetY; cur.r = targetR; first = false;
      } else {
        const k = 0.32;
        cur.x += (targetX - cur.x) * k; cur.y += (targetY - cur.y) * k; cur.r += (targetR - cur.r) * k;
        settling = Math.abs(targetX - cur.x) > 0.4 || Math.abs(targetY - cur.y) > 0.4 || Math.abs(targetR - cur.r) > 0.2;
        if (!settling) { cur.x = targetX; cur.y = targetY; cur.r = targetR; }
      }
      // Easing must not drag Flying into a media either.
      if (corridor) cur.y = corridor.maxY >= corridor.minY ? Math.max(corridor.minY, Math.min(corridor.maxY, cur.y)) : (corridor.minY + corridor.maxY) / 2;
      if (!roomy) cur.r = 0;
      wasLocked = !!activeLock;
      // First half of a turn keeps the artwork he was flying with, the second half
      // shows the new one: the swap happens while the figure is edge-on.
      // The grip pose waits for the last moment: Flying all the way down to the edge, the hands only at
      // the end of the approach, and Flying again as soon as he lets go.
      let art: FlightPose = pose;
      if (activeLock?.phase) {
        const t = (scroll - activeLock.from) / Math.max(1, activeLock.to - activeLock.from);
        art = activeLock.phase === "arrive" ? (t >= 0.9 ? pose : "fly") : t >= 0.1 ? "fly" : pose;
      }
      const faceNow = turning && turnT < 0.5 ? turnFrom : heading;
      show(art === "peekTop" || art === "peekBottom" ? art : faceNow === 1 ? "right" : "left", art);
      // Every pirouette is an in-plane roll of the 3D-rendered sprite: it keeps its volume, never goes edge-on.
      const flip = activeLock ? undefined : flipAt(flips, scroll);
      const flipRoll = flip ? (flip.kind === "backflip" ? -1 : 1) * heading * 360 * flip.t : 0;
      const turnRoll = turning ? -heading * 360 * (turnT * turnT * (3 - 2 * turnT)) : 0;
      // The media alone occludes Kreto: no artificial wipe to make Flying vanish.
      // Peek entry/exit shares Flying's endpoint and retraces it on ascent.
      el.style.clipPath = "none";
      const transform = `translate3d(${cur.x}px, ${cur.y}px, 0) rotate(${cur.r + flipRoll + turnRoll}deg)`;
      el.style.transform = transform;
      grip.style.transform = transform;
      for (const key of ["peekTop", "peekBottom"] as const) {
        const g = gripImgs.current[key];
        if (g) g.style.visibility = key === art ? "visible" : "hidden";
      }
      // Exclusive ownership prevents two silhouettes during Hero takeoff.
      const inFlight = scroll >= 65 || getComputedStyle(hero).display === "none";
      el.style.opacity = inFlight ? "1" : "0";
      // The hands are drawn over the media only while he rests on the edge, never while tucked or moving.
      const gripping = activeLock?.hidden !== undefined && (art === "peekTop" || art === "peekBottom") && peek > 0.98;
      grip.style.opacity = inFlight && gripping ? "1" : "0";
      hero.style.opacity = inFlight ? "0" : "1";
      if (settling || peeking || turning) queue();
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
      flips = [];
      mediaEls = [];
      corridors = [];
      activeLock = undefined;
      let corridorFrom = 240;
      let corridorMin = -Infinity;
      let corridorX = stops[stops.length - 1].x;
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
        const x = Math.max(mediaLeft, Math.min(mediaRight, left + rect.width * MEDIA_X[index % MEDIA_X.length] - size / 2));
        // One media in two holds him; the others he flips past.
        const attach = index % 2 === 0;
        const topY = top - size * LEDGE.peekTop;
        const bottomY = bottom - size * LEDGE.peekBottom;
        // Hidden heights: the whole silhouette sits behind the media.
        const hiddenTop = Math.max(topY, Math.min(top, bottom - size * HEIGHT.peekTop));
        const hiddenBottom = Math.min(bottomY, Math.max(top, bottom - size * HEIGHT.peekBottom));
        const middle = (topAt + bottomAt) / 2;
        const slide = Math.min(90, (middle - topAt) / 3);
        const arriveY = top - size * FLY_ALPHA.bottom;
        const departY = bottom - size * FLY_ALPHA.top;
        // Contiguous locks: Kreto never leaves a hideaway pose while the media is in play.
        mediaEls[index] = media;
        if (attach) {
          const made = mediaLedgeLocks({ topAt, middle, release, slide, x, arriveY, topY, hiddenTop, hiddenBottom, bottomY, departY });
          made.forEach(lock => { lock.media = index; });
          ledgeLocks.push(...made);
          flips.push({ from: release + 30, to: release + 220, kind: index % 4 === 0 ? "spin" : "backflip" });
        } else {
          flips.push({ from: topAt - 240, to: topAt - 50, kind: index % 4 === 1 ? "backflip" : "spin" });
        }
        mediaZones.push({ from: topAt - 60, to: release + 40, left: mediaLeft, right: mediaRight, top, bottom });
        // Flying is never allowed to overlap a media: it arrives fully above the
        // top edge and departs fully below the bottom edge.
        corridors.push({ from: corridorFrom, to: topAt, minY: corridorMin, maxY: arriveY, startX: corridorX, endX: x });
        corridorFrom = release;
        corridorMin = departY;
        corridorX = x;
        stops.push(
          fly(topAt - 100, x, arriveY - size * 0.12),
          fly(topAt - 1, x, arriveY),
          ...(attach
            ? [
                { ...fly(topAt, x, topY), pose: "peekTop" as const },
                { ...fly(topAt + 1, x, topY), pose: "peekTop" as const },
                { ...fly(release - 1, x, bottomY), pose: "peekBottom" as const },
                { ...fly(release, x, bottomY), pose: "peekBottom" as const },
              ]
            : []),
          fly(release + 1, x, departY),
          fly(release + 100, x, departY + size * 0.12),
        );
      });
      // The line the loop section opens with: he somersaults as he reaches it.
      const pastWork = parent.querySelector<HTMLElement>("[data-kreto-backflip]");
      if (pastWork) {
        const at = docY(pastWork.getBoundingClientRect().top) + origin - vh * 0.5;
        flips.push({ from: at - 130, to: at + 130, kind: "backflip" });
      }
      const last = stops[stops.length - 1];
      const end = parent.scrollHeight - vh + origin;
      endScroll = end;
      if (end > last.scroll + 240) {
        stops.push(glide(end - 280, vw - size - 24, vh * 0.5));
        stops.push(glide(end, vw - size - 24, vh * 0.55));
      }
      corridors.push({ from: corridorFrom, to: Infinity, minY: corridorMin, maxY: Infinity, startX: corridorX, endX: vw - size - 24 });
      // Keep stops strictly ordered even with short media and tall viewports.
      stops = stops.reduce<FlightStop[]>((ordered, stop) => {
        const prev = ordered[ordered.length - 1];
        ordered.push({ ...stop, scroll: prev ? Math.max(stop.scroll, prev.scroll + 1) : stop.scroll });
        return ordered;
      }, []);
      shown = undefined;
      queue();
    };
    const observer = new ResizeObserver(measure);
    observer.observe(parent);
    const onScroll = () => {
      lastScrollAt = performance.now();
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(queue, SCROLL_IDLE_MS + 20);
      queue();
    };
    scrollTarget.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure);
    measure();
    return () => {
      cancelled = true;
      observer.disconnect(); cancelAnimationFrame(frame);
      window.clearTimeout(idleTimer);
      scrollTarget.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
      hero.style.removeProperty("opacity");
    };
  }, [ready, reduced]);

  const sizeClass = "pointer-events-none absolute left-0 top-0 h-[104px] w-[104px] select-none will-change-transform lg:h-[180px] lg:w-[180px] min-[1440px]:h-[300px] min-[1440px]:w-[300px]";
  return (
    <>
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
    {/* The hands, one level above the media (z-[3]): same box, same transform, only the glove band. */}
    <div ref={gripRef} aria-hidden="true" data-kreto-grip className={`${sizeClass} z-[4]`} style={{ opacity: 0 }}>
      <div className="relative h-full w-full">
        {(["peekTop", "peekBottom"] as const).map(key => (
          <img key={key} ref={node => { gripImgs.current[key] = node; }} src={layers[key]} alt="" width={1024} height={1024}
            decoding="sync" draggable={false}
            className={`absolute inset-0 h-full w-full object-contain ${poseClasses[key]}`}
            style={{ visibility: "hidden", clipPath: GRIP_CLIP[key] }} />
        ))}
      </div>
    </div>
    </>
  );
}
