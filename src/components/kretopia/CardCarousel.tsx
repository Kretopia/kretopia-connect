import { Children, useState, type ReactNode } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  type CarouselApi,
} from "@/components/ui/carousel";
import { CarouselPositionDots } from "@/components/ui/glass/CarouselPositionDots";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";
import { Reveal } from "./Reveal";

interface CardCarouselProps {
  /** Each child becomes one slide. */
  children: ReactNode;
  /** Accessible label, e.g. "Plans". */
  label: string;
  /** Tailwind basis per slide — controls how many cards are visible. */
  itemClassName?: string;
  className?: string;
}

/**
 * Shared card rail. Any section that would otherwise stack a wall of cards
 * gets swipeable on touch, arrow-driven on desktop, with the same restrained
 * motion language as the landing page (no colour beyond the magenta accent
 * already carried by the dots and glass arrows).
 */
export function CardCarousel({ children, label, itemClassName, className }: CardCarouselProps) {
  const [api, setApi] = useState<CarouselApi>();
  const reducedMotion = useReducedMotion();
  const items = Children.toArray(children);

  if (items.length === 0) return null;

  return (
    <Reveal className={cn("relative", className)}>
      <Carousel
        setApi={setApi}
        opts={{ align: "start", dragFree: false, duration: reducedMotion ? 0 : 22 }}
        className="w-full"
        aria-label={label}
      >
        <CarouselContent className="-ml-3">
          {items.map((child, i) => (
            <CarouselItem
              key={i}
              className={cn("pl-3 basis-[86%] sm:basis-1/2 lg:basis-1/3", itemClassName)}
            >
              <div className="h-full">{child}</div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious variant="glass" className="hidden sm:flex -left-3" aria-label={`Previous — ${label}`} />
        <CarouselNext variant="glass" className="hidden sm:flex -right-3" aria-label={`Next — ${label}`} />
      </Carousel>
      <CarouselPositionDots api={api} label={label} className="mt-3" />
    </Reveal>
  );
}

export default CardCarousel;
