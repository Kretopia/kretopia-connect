import {
  useEffect, useRef, useState, type ReactNode
} from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type View = "carousel" | "grid" | "list";

export function ScoutFieldCarousel({
  label, heading, children, view = "carousel",
}: {
  label: string;
  heading?: ReactNode;
  children: ReactNode;
  view?: View;
}) {
  const ref = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({
    previous: false,
    next: false,
  });

  const update = () => {
    const el = ref.current;
    if (el) {
      setEdges({
        previous: el.scrollLeft > 3,
        next: el.scrollLeft + el.clientWidth < el.scrollWidth - 3,
      });
    }
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.scrollLeft = 0;
    update();

    const observer = new ResizeObserver(update);
    observer.observe(el);

    return () => observer.disconnect();
  }, [view, children]);

  const scroll = (direction: number) => {
    const el = ref.current;
    if (!el) return;

    el.scrollBy({
      left: direction * Math.max(260, el.clientWidth * 0.75),
      behavior: window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches ? "auto" : "smooth",
    });
  };

  return (
    <div data-scout-view={view}
      className="scout-v23__rail min-w-0">

      <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0">{heading}</div>

        {view === "carousel" && (
          <div className="flex shrink-0 gap-1 rounded-full border border-border bg-background/80 p-1">
            <Button type="button" size="icon" variant="ghost"
              className="h-8 w-8"
              disabled={!edges.previous}
              onClick={() => scroll(-1)}
              aria-label={`Previous — ${label}`}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            <Button type="button" size="icon" variant="ghost"
              className="h-8 w-8"
              disabled={!edges.next}
              onClick={() => scroll(1)}
              aria-label={`Next — ${label}`}
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <ul
        ref={ref}
        role="region"
        aria-label={label}
        aria-roledescription={
          view === "carousel" ? "carousel" : undefined
        }
        tabIndex={view === "carousel" ? 0 : undefined}
        onScroll={update}
        onKeyDown={(event) => {
          if (
            view !== "carousel" ||
            event.target !== event.currentTarget
          ) return;

          if (
            event.key === "ArrowLeft" ||
            event.key === "ArrowRight"
          ) {
            event.preventDefault();
            scroll(event.key === "ArrowLeft" ? -1 : 1);
          }
        }}
        className={
          view === "carousel"
            ? "flex min-w-0 snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain pb-4 pt-1 [scrollbar-width:thin] [&>li]:w-[min(86vw,338px)] [&>li]:max-w-full [&>li]:shrink-0 [&>li]:snap-start"
            : view === "grid"
              ? "grid min-w-0 grid-cols-1 gap-4 pb-4 md:grid-cols-2 2xl:grid-cols-3 [&>li]:min-w-0"
              : "flex min-w-0 flex-col gap-3 pb-4 [&>li]:w-full [&>li]:min-w-0"
        }
      >
        {children}
      </ul>
    </div>
  );
}
