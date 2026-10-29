import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

export interface DeckCard {
  id: string;
  /** Short name, used in announcements and the dots' labels. */
  label: string;
  node: ReactNode;
}

interface TodayDeckProps {
  cards: DeckCard[];
  /**
   * A bar that belongs to the deck, shown above it and exactly as wide as the cards: the page width in the flat and
   * swipe modes, and the roulette's own width (left edge of the left card to right edge of the right card) in the roulette.
   */
  lead?: ReactNode;
}

/**
 * The roulette's visible width, left edge of the left card to right edge of the right card: 883px, measured in a browser
 * (the front card is a fixed 26rem and the side cards stand 62% of it to each side, scaled and turned). It does not
 * depend on the page width, so the bar can be this wide, centred.
 */
const ROULETTE_EXTENT = "mx-auto w-full max-w-[55.2rem]";

/** Pointer travel before a drag counts as a drag, and before it turns the deck by one card. */
const DRAG_SLOP_PX = 6;
const DRAG_STEP_PX = 56;
/** A press that starts on one of these is a click on a control, never the start of a drag. */
const INTERACTIVE = "a,button,input,textarea,select,summary,[role='button'],[data-no-drag]";

/**
 * Today's primary cards as one controlled deck:
 *
 *  - fine pointer, wide screen   -> a 3D roulette (this file's RouletteDeck)
 *  - touch / narrow              -> a native horizontal swipe row with controls
 *  - prefers-reduced-motion      -> all cards at once, flat, nothing moves
 *
 * It never turns by itself. Every mode keeps every card's information and
 * every CTA reachable, and none of them captures vertical scrolling.
 */
export function TodayDeck({ cards, lead }: TodayDeckProps) {
  const reduced = useReducedMotion();
  const wide = useMediaQuery("(min-width: 1024px)");
  const finePointer = useMediaQuery("(hover: hover) and (pointer: fine)");

  const roulette = !reduced && wide && finePointer;
  const deck = reduced ? <FlatDeck cards={cards} /> : roulette ? <RouletteDeck cards={cards} /> : <SwipeDeck cards={cards} />;
  if (!lead) return deck;
  return (
    <div className="space-y-5">
      <div className={cn(roulette && ROULETTE_EXTENT)}>{lead}</div>
      {deck}
    </div>
  );
}

/* ───────────────────────── reduced motion: flat ───────────────────────── */

function FlatDeck({ cards }: TodayDeckProps) {
  return (
    <div role="group" aria-label="Today cards" className="grid auto-rows-fr gap-4 lg:grid-cols-3 lg:gap-5">
      {cards.map((c) => (
        <div key={c.id} className="min-w-0 [&>*]:h-full">
          {c.node}
        </div>
      ))}
    </div>
  );
}

/* ───────────────────────── touch / narrow: swipe ───────────────────────── */

function SwipeDeck({ cards }: TodayDeckProps) {
  const n = cards.length;
  const trackRef = useRef<HTMLDivElement>(null);
  const frame = useRef<number | null>(null);
  const [index, setIndex] = useState(0);

  // Which card is nearest the middle of the track, updated once per frame, not per scroll event.
  const onScroll = useCallback(() => {
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const track = trackRef.current;
      if (!track) return;
      const middle = track.scrollLeft + track.clientWidth / 2;
      let best = 0;
      let bestDistance = Infinity;
      Array.from(track.children).forEach((child, i) => {
        const el = child as HTMLElement;
        const distance = Math.abs(el.offsetLeft + el.offsetWidth / 2 - middle);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = i;
        }
      });
      setIndex(best);
    });
  }, []);

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  const goTo = useCallback((i: number) => {
    const track = trackRef.current;
    const el = track?.children[i] as HTMLElement | undefined;
    if (!track || !el) return;
    track.scrollTo({ left: el.offsetLeft - (track.clientWidth - el.offsetWidth) / 2, behavior: "smooth" });
    setIndex(i);
  }, []);

  const step = (dir: 1 | -1) => goTo(Math.min(n - 1, Math.max(0, index + dir)));

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      step(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      step(-1);
    }
  };

  return (
    <div role="group" aria-roledescription="carousel" aria-label="Today cards" className="space-y-3">
      <div
        ref={trackRef}
        tabIndex={0}
        onScroll={onScroll}
        onKeyDown={onKeyDown}
        className="relative flex snap-x snap-mandatory items-stretch gap-3 overflow-x-auto rounded-2xl pb-1 [scrollbar-width:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--energy)/0.5)] [&::-webkit-scrollbar]:hidden"
      >
        {cards.map((c, i) => (
          <div
            key={c.id}
            role="group"
            aria-roledescription="slide"
            aria-label={`Card ${i + 1} of ${n}`}
            className="min-w-0 shrink-0 basis-[88%] snap-center [&>*]:h-full"
          >
            {c.node}
          </div>
        ))}
      </div>
      <DeckControls
        cards={cards}
        active={index}
        onSelect={goTo}
        onPrev={() => step(-1)}
        onNext={() => step(1)}
        prevDisabled={index === 0}
        nextDisabled={index === n - 1}
      />
    </div>
  );
}

/* ───────────────────────── fine pointer, wide: 3D roulette ───────────────────────── */

/** Where a slide sits relative to the front one: -1 left, 0 front, +1 right. */
const offsetOf = (i: number, active: number, n: number) => {
  const d = (i - active + n) % n;
  return d === 0 ? 0 : d <= n / 2 ? d : d - n;
};

function RouletteDeck({ cards }: TodayDeckProps) {
  const n = cards.length;
  const [active, setActive] = useState(0);
  // Pointer movement is tracked in refs: nothing re-renders until the deck actually turns.
  const drag = useRef<{ x: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  const step = useCallback((dir: 1 | -1) => setActive((a) => (a + dir + n) % n), [n]);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if ((e.target as Element).closest(INTERACTIVE)) return;
    drag.current = { x: e.clientX, moved: false };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (d && Math.abs(e.clientX - d.x) > DRAG_SLOP_PX) d.moved = true;
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > DRAG_STEP_PX) step(dx < 0 ? 1 : -1);
    if (d.moved) {
      // the click that follows a drag belongs to the drag, not to whatever is under the pointer
      suppressClick.current = true;
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 0);
    }
  };
  // Leaving mid-drag just forgets the drag; the current card stays where it was.
  const cancelDrag = () => {
    drag.current = null;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return; // arrows only when the deck itself has focus
    if (e.key === "ArrowRight") {
      e.preventDefault();
      step(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      step(-1);
    }
  };

  // `relative`: the sr-only live region below is position:absolute and needs a containing block of its own. Without one it is placed
  // against the page, outside the app's scroller, and stretches the DOCUMENT's scroll height: scrolling past the bottom of Today then
  // dragged the whole app up and left an empty band under it.
  return (
    <div role="group" aria-roledescription="carousel" aria-label="Today cards" className="group relative space-y-3">
      <div
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={cancelDrag}
        onPointerLeave={cancelDrag}
        onClickCapture={(e) => {
          if (suppressClick.current) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        // pan-y: vertical scrolling stays with the page, horizontal motion is ours
        className="relative grid touch-pan-y select-none place-items-center rounded-2xl py-2 [perspective:1600px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--energy)/0.5)]"
      >
        {cards.map((c, i) => {
          const off = offsetOf(i, active, n);
          const front = off === 0;
          const hidden = Math.abs(off) > 1;
          return (
            <div
              key={c.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`Card ${i + 1} of ${n}`}
              data-position={front ? "front" : off < 0 ? "left" : "right"}
              // A card at the side comes forward when it is clicked or when something inside it takes focus.
              onClickCapture={(e) => {
                if (!front) {
                  e.preventDefault();
                  e.stopPropagation();
                  setActive(i);
                }
              }}
              onFocusCapture={() => {
                if (!front) setActive(i);
              }}
              style={{
                transform: front
                  ? "translate3d(0,0,0) rotateY(0deg) scale(1)"
                  : `translate3d(${Math.sign(off) * 62}%,0,0) rotateY(${-Math.sign(off) * 24}deg) scale(0.86)`,
                opacity: hidden ? 0 : front ? 1 : 0.72,
                zIndex: front ? 20 : 10,
                pointerEvents: hidden ? "none" : undefined,
              }}
              className={cn(
                "col-start-1 row-start-1 h-full w-[min(100%,26rem)] min-w-0 rounded-2xl [&>*]:h-full",
                "transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.2,0.65,0.3,0.95)] motion-reduce:transition-none",
                front
                  ? "shadow-[0_0_0_1px_hsl(var(--energy)/0.3),0_24px_48px_-28px_hsl(var(--energy)/0.5)]"
                  : "cursor-pointer",
              )}
            >
              {c.node}
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => step(-1)}
          aria-label="Previous card"
          className="absolute left-2 top-1/2 z-30 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-foreground opacity-0 transition-opacity hover:border-foreground/40 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--energy)/0.5)] group-focus-within:opacity-100 group-hover:opacity-100 motion-reduce:transition-none"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => step(1)}
          aria-label="Next card"
          className="absolute right-2 top-1/2 z-30 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-foreground opacity-0 transition-opacity hover:border-foreground/40 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--energy)/0.5)] group-focus-within:opacity-100 group-hover:opacity-100 motion-reduce:transition-none"
        >
          <ChevronRight className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <DeckDots cards={cards} active={active} onSelect={setActive} />
      <p className="sr-only" aria-live="polite">
        Card {active + 1} of {n}: {cards[active]?.label}
      </p>
    </div>
  );
}

/* ───────────────────────── shared controls ───────────────────────── */

function DeckDots({ cards, active, onSelect }: { cards: DeckCard[]; active: number; onSelect: (i: number) => void }) {
  return (
    <div className="flex items-center justify-center" role="group" aria-label="Choose a card">
      {cards.map((c, i) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onSelect(i)}
          aria-label={`Show card ${i + 1} of ${cards.length}: ${c.label}`}
          aria-current={i === active ? "true" : undefined}
          className="group/dot inline-flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--energy)/0.5)]"
        >
          <span
            aria-hidden
            className={cn(
              "h-1.5 rounded-full transition-[width,background-color] duration-300 motion-reduce:transition-none",
              i === active ? "w-6 bg-foreground" : "w-1.5 bg-muted-foreground/50 group-hover/dot:bg-muted-foreground",
            )}
          />
        </button>
      ))}
    </div>
  );
}

function DeckControls({
  cards,
  active,
  onSelect,
  onPrev,
  onNext,
  prevDisabled,
  nextDisabled,
}: {
  cards: DeckCard[];
  active: number;
  onSelect: (i: number) => void;
  onPrev: () => void;
  onNext: () => void;
  prevDisabled: boolean;
  nextDisabled: boolean;
}) {
  const arrow =
    "inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:border-foreground/40 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--energy)/0.5)]";
  return (
    // relative: keeps the sr-only live region at the bottom of this row inside it (see the roulette above)
    <div className="relative flex items-center justify-between">
      <button type="button" onClick={onPrev} disabled={prevDisabled} aria-label="Previous card" className={arrow}>
        <ChevronLeft className="h-5 w-5" aria-hidden />
      </button>
      <DeckDots cards={cards} active={active} onSelect={onSelect} />
      <button type="button" onClick={onNext} disabled={nextDisabled} aria-label="Next card" className={arrow}>
        <ChevronRight className="h-5 w-5" aria-hidden />
      </button>
      <p className="sr-only" aria-live="polite">
        Card {active + 1} of {cards.length}: {cards[active]?.label}
      </p>
    </div>
  );
}

export default TodayDeck;
