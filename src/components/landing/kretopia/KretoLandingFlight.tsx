import { useEffect, useId, useRef } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
// Temporary Halloween artwork: same flight layers, same motion — only the flying sprite changes.
import halloweenLanding from "@/assets/kreto/halloween/kreto-halloween-landing.png.asset.json";
import flyingRight from "@/assets/brand/kreto/kreto-flying.webp";
import flyingLeft from "@/assets/brand/kreto/kreto-flying-left.webp";
import peekTop from "@/assets/brand/kreto/kreto-peek-top.webp";
import peekBottom from "@/assets/brand/kreto/kreto-peek-bottom.webp";
import peekSide from "@/assets/brand/kreto/kreto-peek-side.webp";
import { bottomBackflip, flipAt, headingAt, ledgeLockAt, lockX, lockY, mediaLedgeLocks, mediaSideLocks, sampleFlight, type Flip, type FlightPose, type FlightStop, type LedgeLock } from "./kretoFlightPath";
import { BOTTOM_HEIGHT, BOTTOM_LEDGE, BOTTOM_SCALE, SIDE_SCALE, SIDE_UPPER_BODY_CLIP, ledgeSlideSpan, planSideHide } from "./kretoPoseGeometry";

const layers = { right: halloweenLanding.url, left: halloweenLanding.url, peekTop, peekBottom, peekSide } as const;
void flyingRight;
void flyingLeft;
type Layer = keyof typeof layers;
const layerKeys = Object.keys(layers) as Layer[];
/** Where the ledge line sits inside each hiding artwork (fraction of its rendered size). */
const LEDGE = { peekTop: 0.81, peekBottom: BOTTOM_LEDGE };
/** Rendered silhouette heights (origin-top scale) used to hide a pose fully behind media. */
const HEIGHT = { peekTop: 1.446, peekBottom: BOTTOM_HEIGHT };
// Hanging pose matches Flying's helmet, not the much taller arms-up silhouette.
const poseClasses: Record<Layer, string> = {
  right: "", left: "", peekTop: "origin-top scale-[1.446]", peekBottom: "origin-top", peekSide: "",
};
/**
 * The side hide artwork (1024 square, body cut by a straight vertical line at ~0.313): the media edge
 * crosses it at `cut`, just past that line so the straight cut stays hidden while the whole dome, both
 * ear lenses and the chest come out. `extent` is the opaque width beyond the cut (artwork right ~0.879).
 */
const SIDE = { cut: 0.33, handsY: 0.33, extent: 0.55 };

/** Flying silhouette's opaque vertical bounds (fraction of its box), with a small bank margin. */
const FLY_ALPHA = { top: 0, bottom: 1 };

const sizeFor = (w: number) => (w >= 1440 ? 300 : w >= 1024 ? 180 : 104);
/** After the scroll settles, the media's real positions are checked once and the flight re-measured if they moved. */
const REMEASURE_IDLE_MS = 180;
// Preserve the original full silhouette: only the real media edge hides the body.
/** Reversing the scroll turns him with one backflip (in the picture plane, so the volume is never flattened). */
const TURN_MS = 520;
/**
 * The hands in front of the media. The sprite itself stays behind it; this overlay redraws only the
 * glove band, from the media edge down (top) or up (bottom), so he reads as gripping the picture.
 * Polygons are in artwork coordinates; the notch keeps the torso and the head dome behind the media.
 */
const GRIP_CLIP = {
  peekTop: "polygon(25% 55.5%, 40% 55.5%, 40% 62.6%, 60% 62.6%, 60% 55.5%, 75% 55.5%, 75% 69%, 25% 69%)",
  peekBottom: "polygon(28% 29.5%, 74% 29.5%, 74% 38%, 62% 38%, 62% 33.3%, 40% 33.3%, 40% 38%, 28% 38%)",
  peekSide: "polygon(24.5% 40%, 31.45% 40%, 31.45% 66%, 24.5% 66%)",
} as const;

/**
 * One decorative figure; real media are foreground occluders, never duplicated.
 * Position, rotation, opacity and artwork are written together in one frame so
 * a pose can never appear at the wrong place (no flicker, no double figure).
 */
export function KretoLandingFlight({ ready }: { ready: boolean }) {
  const topGripId = `kreto-top-gloves-${useId().replace(/:/g, "")}`;
  const ref = useRef<HTMLDivElement>(null);
  const imgs = useRef<Partial<Record<Layer, HTMLImageElement | null>>>({});
  const gripRef = useRef<HTMLDivElement>(null);
  const gripImgs = useRef<Partial<Record<"peekTop" | "peekBottom" | "peekSide", HTMLImageElement | null>>>({});
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
    let idleTimer = 0;
    let lastSignature = "";
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
        // One geometry for the slides and the resting ledge, so they join without a jump; the
        // geometry itself is re-measured when the media move (see the idle check below).
        targetX = lockX(activeLock, scroll);
        targetY = lockY(activeLock, scroll);
      } else {
        const follow = Math.min(1, Math.max(0, (scroll - 180) / 240));
        const visibleY = Math.max(-bounds.top + window.innerHeight * 0.2, Math.min(-bounds.top + window.innerHeight * 0.72 - size, point.y));
        if (corridor && Number.isFinite(corridor.maxY) && !zone) {
          // Between two media he is calibrated to the screen, not to the page: a band of the viewport that
          // drifts a little along the corridor, the same whichever way the page goes. He eases away from
          // where he let go of the last media, and is clamped below so he never overlaps a media.
          const u = Math.min(1, Math.max(0, (scroll - corridor.from) / Math.max(1, corridor.to - corridor.from)));
          const onScreen = -bounds.top + window.innerHeight * (0.26 + 0.2 * u);
          const e = Math.min(1, u * 2);
          const w = e * e * (3 - 2 * e);
          targetY = Number.isFinite(corridor.minY) ? corridor.minY + (onScreen - corridor.minY) * w : onScreen;
        } else {
          targetY = zone || (corridor && Number.isFinite(corridor.maxY)) ? point.y : point.y + (visibleY - point.y) * follow;
        }
        if (corridor) targetY = corridor.maxY >= corridor.minY ? Math.max(corridor.minY, Math.min(corridor.maxY, targetY)) : (corridor.minY + corridor.maxY) / 2;
        targetX = point.x;
      }
      // Tight gaps between media leave no room for banking without overlapping one.
      const roomy = !corridor || (!Number.isFinite(corridor.maxY) && targetY > corridor.minY + size);
      const now = performance.now();
      // His body faces the way he is actually flying: the path's x direction as the page goes down, and
      // the reverse as it goes up (he retraces it). Where he hovers or climbs straight, he keeps his
      // heading. A change of heading is one backflip, the artwork swapped at the top of the roll.
      const destinationDx = corridor ? (corridor.endX - corridor.startX) * direction : 0;
      const travel = Math.abs(destinationDx) > 3 ? Math.sign(destinationDx) * direction : headingAt(stops, scroll, 40, 3);
      if (travel !== 0) {
        const wantHeading: 1 | -1 = travel * direction > 0 ? 1 : -1;
        if (!first && wantHeading !== heading) { turnStart = now; turnFrom = heading; }
        heading = wantHeading;
      }
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
      // First half of a turn keeps the artwork he was flying with, the second half shows the new one:
      // the swap happens at the top of the roll.
      // The grip pose waits for the last moment: Flying all the way down to the edge, the hands only at
      // the end of the approach, and Flying again as soon as he lets go.
      let art: FlightPose = pose;
      if (activeLock?.phase) {
        const t = (scroll - activeLock.from) / Math.max(1, activeLock.to - activeLock.from);
        art = activeLock.phase === "arrive" ? (t >= 0.5 ? pose : "fly") : t >= 0.5 ? "fly" : pose;
      }
      const faceNow = turning && turnT < 0.5 ? turnFrom : heading;
      const layer: Layer = art === "peekTop" || art === "peekBottom" || art === "peekSide" ? art : faceNow === 1 ? "right" : "left";
      const isPeek = layer !== "right" && layer !== "left";
      show(layer, art);
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
      for (const key of ["peekTop", "peekBottom", "peekSide"] as const) {
        const g = gripImgs.current[key];
        if (g) g.style.visibility = key === art ? "visible" : "hidden";
      }
      if (art === "peekSide" && activeLock) {
        // The same mirror and fit on the sprite and on its hands overlay, about the point where the
        // media edge crosses the artwork, so the hands never move relative to the edge.
        const mirror = activeLock.side === "left" ? -1 : 1;
        const k = (activeLock.scale ?? 1) * SIDE_SCALE;
        const originX = SIDE.cut * 100;
        for (const image of [imgs.current.peekSide, gripImgs.current.peekSide]) {
          if (!image) continue;
          image.style.transformOrigin = `${originX}% ${SIDE.handsY * 100}%`;
          image.style.transform = `scale(${mirror * k}, ${k})`;
        }
      }
      // Exclusive ownership prevents two silhouettes during Hero takeoff.
      const inFlight = scroll >= 65 || getComputedStyle(hero).display === "none";
      el.style.opacity = inFlight ? "1" : "0";
      // The hands are drawn over the media for as long as he holds the edge.
      // No hands on the side hide: only the head comes out.
      const gripping = activeLock?.pose !== "peekSide" && activeLock?.hidden !== undefined && isPeek;
      grip.style.opacity = inFlight && gripping ? "1" : "0";
      hero.style.opacity = inFlight ? "0" : "1";
      if (settling || turning) queue();
    };
    const queue = () => { if (!frame) frame = requestAnimationFrame(paint); };

    /** Document positions of every media: a change means the layout moved and the geometry is stale. */
    const signature = () => {
      const top = parent.getBoundingClientRect().top;
      return mediaEls.map(m => { const r = m.getBoundingClientRect(); return `${Math.round(r.top - top)}:${Math.round(r.height)}:${Math.round(r.left)}`; }).join("|") + `|${parent.scrollHeight}`;
    };

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
      // The hop is toward the first media he is flying to, never away from it.
      const firstRect = parent.querySelector<HTMLElement>("[data-kreto-flight-media]")?.getBoundingClientRect();
      const firstX = firstRect ? firstRect.left - bounds.left + firstRect.width / 2 : vw / 2;
      const awayX = firstX >= x0 ? 1 : -1;
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
      const mediaList = Array.from(parent.querySelectorAll<HTMLElement>("[data-kreto-flight-media]"));
      mediaList.forEach((media, index) => {
        const rect = media.getBoundingClientRect();
        const top = docY(rect.top);
        const bottom = docY(rect.bottom);
        const left = rect.left - bounds.left;
        const previous = stops[stops.length - 1];
        const topAt = Math.max(previous.scroll + 200, top + origin - vh * 0.38);
        const bottomAt = Math.max(topAt + 520, bottom + origin - vh * 0.6);
        // The next media's arrival is measured from this release (topAt >= previous stop + 200), so
        // delaying it until the bottom edge leaves the viewport pushed every following arrival, and
        // everything he does at it, above the top of the screen. It stays where it was.
        const release = bottomAt + hold;
        const inset = size * 0.18;
        const mediaLeft = Math.max(8, left + inset);
        const mediaRight = Math.max(mediaLeft, Math.min(vw - size - 8, left + rect.width - size - inset));
        // One media in two holds him; the others he flips past.
        const attach = index % 2 === 0;
        // The others he plays hide and seek beside: at Flying's size, from behind the edge on the side away from the
        // text, coming out as far as the margin allows (the rest of him stays behind the media).
        const rectRight = left + rect.width;
        const textRect = media.closest("section")?.querySelector<HTMLElement>("[data-kreto-flight-content]")?.getBoundingClientRect();
        const textBeside = textRect && textRect.top < rect.bottom && textRect.bottom > rect.top;
        const plan = attach ? null : planSideHide({
          vw, mediaLeft: left, mediaRight: rectRight, size, extent: SIDE.extent,
          text: textBeside && textRect ? { left: textRect.left - bounds.left, right: textRect.right - bounds.left } : null,
        });
        const sideMode = !!plan;
        const sideOf: "left" | "right" = plan?.side ?? "right";
        const sideW = plan ? plan.full : 0;
        // Pulled toward the media by what the margin cannot show, so less of him comes out and no more.
        const held = plan ? plan.full - plan.reveal : 0;
        const sideX = (sideOf === "right" ? rectRight - held : left + held) - SIDE.cut * size;
        // Fully behind the edge: nothing of him is past it.
        const sideHiddenX = sideOf === "right"
          ? rectRight - SIDE.cut * size - sideW - 2
          : left - SIDE.cut * size + sideW + 2;
        // The far left or far right of the media, whichever is nearer where he comes from: a straighter flight.
        const x = sideMode
          ? sideX
          : Math.abs(previous.x - mediaLeft) <= Math.abs(previous.x - mediaRight) ? mediaLeft : mediaRight;
        // Where he comes out at the bottom edge: the extreme nearest the next media he is flying to, so the
        // way across (behind this one) is a targeted diagonal, not a hug of the corners.
        const nextRect = mediaList[index + 1]?.getBoundingClientRect();
        const nextCenter = nextRect ? nextRect.left - bounds.left + nextRect.width / 2 : vw - size / 2 - 24;
        const xBottom = sideMode
          ? x
          : Math.abs(nextCenter - size / 2 - mediaLeft) <= Math.abs(nextCenter - size / 2 - mediaRight) ? mediaLeft : mediaRight;
        // The side hide's stops are not clamped: his box may extend past the viewport (transparent there).
        const put = sideMode
          ? (scroll: number, px: number, py: number): FlightStop => ({ scroll, x: px, y: py, rotate: 0, opacity: 1, pose: "fly" })
          : fly;
        const topY = top - size * LEDGE.peekTop;
        const bottomY = bottom - size * LEDGE.peekBottom;
        // Hidden heights: the whole silhouette sits behind the media.
        const hiddenTop = Math.max(topY, Math.min(top, bottom - size * HEIGHT.peekTop));
        const hiddenBottom = Math.min(bottomY, Math.max(top, bottom - size * HEIGHT.peekBottom));
        const mid = (topAt + bottomAt) / 2;
        const afterTop = top + origin + size * 0.15 + 90;
        const beforeBottom = bottom + origin - vh - 90;
        const middle = afterTop <= beforeBottom ? Math.min(Math.max(mid, afterTop), beforeBottom) : mid;
        const slide = ledgeSlideSpan(topAt, middle, release);
        const arriveY = top - size * FLY_ALPHA.bottom;
        const departY = bottom - size * FLY_ALPHA.top;
        // Contiguous locks: Kreto never leaves a hideaway pose while the media is in play.
        mediaEls[index] = media;
        if (attach) {
          const made = mediaLedgeLocks({ topAt, middle, release, slide, x, xBottom, arriveY, topY, hiddenTop, hiddenBottom, bottomY, departY });
          made.forEach(lock => { lock.media = index; });
          ledgeLocks.push(...made);
          flips.push({ from: release + 30, to: release + 220, kind: index % 4 === 0 ? "spin" : "backflip" });
        } else {
          flips.push({ from: topAt - 240, to: topAt - 50, kind: index % 4 === 1 ? "backflip" : "spin" });
          if (sideMode) {
            const h = bottom - top;
            const span = release - topAt;
            const sideSlide = Math.min(140, span * 0.18);
            const made = mediaSideLocks({
              topAt, release, slide: sideSlide, reveal: Math.min(260, (span - 2 * sideSlide) * 0.3),
              flyX: x, hiddenX: sideHiddenX, arriveY,
              sideY1: top + h * 0.28 - SIDE.handsY * size, sideY2: top + h * 0.62 - SIDE.handsY * size,
              departY, side: sideOf, scale: 1,
            });
            made.forEach(lock => { lock.media = index; });
            ledgeLocks.push(...made);
          }
        }
        mediaZones.push({ from: topAt - 60, to: release + 40, left: mediaLeft, right: mediaRight, top, bottom });
        // Flying is never allowed to overlap a media: it arrives fully above the
        // top edge and departs fully below the bottom edge.
        corridors.push({ from: corridorFrom, to: topAt, minY: corridorMin, maxY: arriveY, startX: corridorX, endX: x });
        corridorFrom = release;
        corridorMin = departY;
        corridorX = xBottom;
        stops.push(
          put(topAt - 100, x, arriveY - size * 0.12),
          put(topAt - 1, x, arriveY),
          ...(attach
            ? [
                { ...fly(topAt, x, topY), pose: "peekTop" as const },
                { ...fly(topAt + 1, x, topY), pose: "peekTop" as const },
                { ...fly(release - 1, xBottom, bottomY), pose: "peekBottom" as const },
                { ...fly(release, xBottom, bottomY), pose: "peekBottom" as const },
              ]
            : []),
          put(release + 1, xBottom, departY),
          put(release + 100, xBottom, departY + size * 0.12),
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
      lastSignature = signature();
      queue();
    };
    const observer = new ResizeObserver(measure);
    observer.observe(parent);
    const onScroll = () => {
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => { if (signature() !== lastSignature) measure(); }, REMEASURE_IDLE_MS);
      queue();
    };
    scrollTarget.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure);
    measure();
    mediaEls.forEach(media => observer.observe(media));
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
    <svg width="0" height="0" aria-hidden="true" className="absolute pointer-events-none">
      <defs>
        <clipPath id={topGripId} clipPathUnits="objectBoundingBox">
          {/* Two independent contours: no rectangular torso bridge between the hands. */}
          <path d="M .253 .558 Q .29 .531 .346 .553 Q .38 .558 .399 .606 L .396 .636 L .38 .64 L .371 .68 Q .352 .695 .337 .676 Q .319 .7 .303 .68 Q .281 .695 .268 .674 L .258 .631 Q .239 .6 .253 .558 Z" />
          <path d="M .609 .605 Q .62 .554 .679 .552 Q .739 .536 .757 .591 L .75 .638 L .737 .676 Q .724 .699 .704 .679 Q .685 .696 .671 .679 Q .65 .698 .637 .675 L .626 .639 L .604 .631 Z" />
        </clipPath>
      </defs>
    </svg>
    <div ref={ref} aria-hidden="true" data-kreto-flight data-pose="fly" data-facing="left"
      className="pointer-events-none absolute left-0 top-0 z-[2] h-[104px] w-[104px] select-none will-change-transform lg:h-[180px] lg:w-[180px] min-[1440px]:h-[300px] min-[1440px]:w-[300px]"
      style={{ opacity: 0 }}>
      <div className="relative h-full w-full">
        {layerKeys.map(key => (
          <img key={key} ref={node => { imgs.current[key] = node; }} src={layers[key]} alt="" width={1024} height={1024}
            decoding="sync" draggable={false}
            className={`absolute inset-0 h-full w-full object-contain ${poseClasses[key]}`}
            style={{ visibility: key === "left" ? "visible" : "hidden", transform: key === "peekBottom" ? `scale(${BOTTOM_SCALE})` : undefined, clipPath: key === "peekSide" ? SIDE_UPPER_BODY_CLIP : undefined }} />
        ))}
      </div>
    </div>
    {/* The hands, one level above the media (z-[3]): same box, same transform, only the glove band. */}
    <div ref={gripRef} aria-hidden="true" data-kreto-grip className={`${sizeClass} z-[4] transition-opacity duration-150 motion-reduce:transition-none`} style={{ opacity: 0 }}>
      <div className="relative h-full w-full">
        {(["peekTop", "peekBottom", "peekSide"] as const).map(key => (
          <img key={key} ref={node => { gripImgs.current[key] = node; }} src={layers[key]} alt="" width={1024} height={1024}
            decoding="sync" draggable={false}
            className={`absolute inset-0 h-full w-full object-contain ${poseClasses[key]}`}
            style={{ visibility: "hidden", transform: key === "peekBottom" ? `scale(${BOTTOM_SCALE})` : undefined, clipPath: key === "peekTop" ? `url(#${topGripId})` : GRIP_CLIP[key] }} />
        ))}
      </div>
    </div>
    </>
  );
}
