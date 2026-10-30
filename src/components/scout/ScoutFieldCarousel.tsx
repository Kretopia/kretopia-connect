import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Native touch/trackpad rail; gentle edge-hover scrolling only for fine pointers. */
export function ScoutFieldCarousel({ label, children }: { label: string; children: ReactNode }) {
  const rail = useRef<HTMLUListElement>(null);
  const direction = useRef(0);
  const frame = useRef(0);
  const [position, setPosition] = useState({ previous: false, next: false });
  const update = () => {
    const el = rail.current;
    if (el) setPosition({ previous: el.scrollLeft > 2, next: el.scrollLeft + el.clientWidth < el.scrollWidth - 2 });
  };
  const stop = () => { direction.current = 0; cancelAnimationFrame(frame.current); };
  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => { observer.disconnect(); cancelAnimationFrame(frame.current); };
  }, [children]);
  const step = (sign: number) => {
    const el = rail.current;
    if (el) el.scrollBy({ left: sign * el.clientWidth * 0.8, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };
  return (
    <div className="relative min-w-0">
      <div className="mb-2 flex justify-end gap-1">
        <Button size="icon" variant="ghost" className="h-9 w-9" disabled={!position.previous} onClick={() => step(-1)} aria-label={`Previous — ${label}`} title="Previous"><ArrowLeft className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" className="h-9 w-9" disabled={!position.next} onClick={() => step(1)} aria-label={`Next — ${label}`} title="Next"><ArrowRight className="h-4 w-4" /></Button>
      </div>
      <ul ref={rail} role="region" aria-roledescription="carousel" aria-label={label} tabIndex={0}
        className="flex min-w-0 gap-3 overflow-x-auto overscroll-x-contain pb-3 pt-1 [scrollbar-width:thin] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-energy [&>li]:w-[min(82vw,320px)] [&>li]:max-w-full [&>li]:shrink-0"
        onScroll={update} onPointerLeave={stop} onPointerDown={stop} onFocusCapture={stop}
        onKeyDown={(e) => { if (e.target !== e.currentTarget) return; if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); step(e.key === "ArrowLeft" ? -1 : 1); } }}
        onPointerMove={(e) => {
          if (e.pointerType !== "mouse" || !window.matchMedia("(hover: hover) and (pointer: fine)").matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
          const el = rail.current;
          if (!el || el.contains(document.activeElement)) return;
          const box = el.getBoundingClientRect();
          const x = e.clientX - box.left;
          const next = x < 60 ? -1 : x > box.width - 60 ? 1 : 0;
          if (next === direction.current) return;
          stop(); direction.current = next;
          let last = performance.now();
          const tick = (now: number) => {
            if (!direction.current || !rail.current) return;
            rail.current.scrollLeft += direction.current * Math.min(now - last, 32) * 0.24;
            last = now; frame.current = requestAnimationFrame(tick);
          };
          if (next) frame.current = requestAnimationFrame(tick);
        }}>
        {children}
      </ul>
    </div>
  );
}