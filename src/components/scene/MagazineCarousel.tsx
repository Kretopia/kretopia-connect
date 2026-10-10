import { useCallback, useEffect, useState, type ComponentProps, type KeyboardEvent, type MouseEvent } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { MagazineArticleCard } from "./MagazineArticleCard";
import { cn } from "@/lib/utils";

type CardArticle = ComponentProps<typeof MagazineArticleCard>["article"];
type CarouselArticle = CardArticle & { is_featured?: boolean };

interface MagazineCarouselProps {
  articles: CarouselArticle[];
  categoryLabel: (category: string) => string;
  canEdit?: boolean;
  onOpen: (article: CarouselArticle) => void;
  onEdit?: (e: MouseEvent, id: string) => void;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * The Magazine as one row: a centred story at full size with the next and the
 * previous leaning in at its sides, a HUD under it (counter, progress beam,
 * previous / next). It replaces a four-column grid that made every story a
 * scroll away. Swipe, drag, the arrow keys and the buttons all move it; under
 * reduced motion the slides still change, they just stop animating.
 */
export function MagazineCarousel({ articles, categoryLabel, canEdit, onOpen, onEdit }: MagazineCarouselProps) {
  const [viewportRef, embla] = useEmblaCarousel({ align: "center", containScroll: false });
  const [selected, setSelected] = useState(0);
  const count = articles.length;

  useEffect(() => {
    if (!embla) return;
    const sync = () => setSelected(embla.selectedScrollSnap());
    sync();
    embla.on("select", sync);
    embla.on("reInit", sync);
    return () => {
      embla.off("select", sync);
      embla.off("reInit", sync);
    };
  }, [embla]);

  // A new list (category, sort, search) starts again from its first story.
  useEffect(() => {
    if (!embla) return;
    embla.reInit();
    embla.scrollTo(0, true);
  }, [embla, articles]);

  const prev = useCallback(() => embla?.scrollPrev(), [embla]);
  const next = useCallback(() => embla?.scrollNext(), [embla]);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
    else if (e.key === "ArrowRight") { e.preventDefault(); next(); }
  };

  const progress = count > 0 ? ((selected + 1) / count) * 100 : 0;

  return (
    <div>
      <div
        ref={viewportRef}
        role="region"
        aria-roledescription="carousel"
        aria-label="Kretopia Magazine stories"
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="overflow-hidden rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--energy))] focus-visible:ring-offset-2 focus-visible:ring-offset-card"
      >
        <div className="flex touch-pan-y py-3">
          {articles.map((article, i) => {
            const active = i === selected;
            return (
              <div
                key={article.id}
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${count}`}
                className="min-w-0 flex-[0_0_80%] px-2 sm:flex-[0_0_52%] lg:flex-[0_0_38%]"
              >
                <div
                  className={cn(
                    "h-full origin-center transition-all duration-500 motion-reduce:transition-none",
                    active ? "scale-100 opacity-100" : "scale-[0.93] opacity-55",
                  )}
                >
                  <MagazineArticleCard
                    slide
                    article={article}
                    featured={!!article.is_featured}
                    categoryLabel={categoryLabel(article.category)}
                    canEdit={canEdit}
                    onOpen={() => onOpen(article)}
                    onEdit={onEdit ? (e) => onEdit(e, article.id) : undefined}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* HUD: counter, progress beam, previous / next */}
      <div className="mt-2 flex items-center gap-3">
        <span className="font-mono text-xs tabular-nums text-muted-foreground" aria-live="polite">
          {pad(Math.min(selected + 1, count))} <span className="opacity-50">/</span> {pad(count)}
        </span>
        <div className="relative h-px flex-1 bg-border" aria-hidden>
          <div
            className="absolute inset-y-0 left-0 h-[2px] -translate-y-1/2 rounded-full bg-[hsl(var(--energy))] shadow-[0_0_10px_hsl(var(--energy)/0.7)] transition-[width] duration-500 motion-reduce:transition-none"
            style={{ width: `${progress}%`, top: "50%" }}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={prev}
            disabled={selected <= 0}
            aria-label="Previous story"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:border-[hsl(var(--energy)/0.5)] disabled:opacity-35"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={next}
            disabled={selected >= count - 1}
            aria-label="Next story"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:border-[hsl(var(--energy)/0.5)] disabled:opacity-35"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

export default MagazineCarousel;
