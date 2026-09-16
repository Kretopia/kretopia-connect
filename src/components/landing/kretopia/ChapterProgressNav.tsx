/**
 * ChapterProgressNav — persistent progress + jump navigation for the
 * landing tutorial. Tracks which of the 8 tutorial chapters is currently
 * in view (via IntersectionObserver, observed by element id rather than
 * React refs since chapters live in different component subtrees — some
 * eager, most lazy-loaded via LandingBelowFold), highlights the active one
 * in the single brand accent, and lets the visitor jump directly to any
 * chapter.
 *
 * Desktop (lg+) only: a slim vertical dot rail, label revealed on
 * hover/focus. Real <button> elements — keyboard-operable with no extra
 * wiring, each carries aria-current for the active chapter. No mobile
 * variant — the segmented top progress bar was removed by request.
 */
import { useEffect, useState } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { CHAPTER_REGISTRY as CHAPTERS } from "./chapterRegistry";

const ACCENT = "#FF2DA1";

interface ChapterProgressNavProps {
  /** Whether the below-fold chapters have mounted yet — re-scans anchors once true. */
  ready: boolean;
}

export const ChapterProgressNav = ({ ready }: ChapterProgressNavProps) => {
  const reducedMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  const [showNav, setShowNav] = useState(false);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;

    let heroIO: IntersectionObserver | undefined;
    let activeIO: IntersectionObserver | undefined;
    let cancelled = false;
    let attempt = 0;

    // LandingBelowFold is a lazy chunk: `ready` flips true as soon as it
    // starts loading, but the actual chapter elements may not exist in the
    // DOM for another frame or two while the Suspense fallback still shows.
    // Poll briefly (a few animation frames, not a fixed timer) until every
    // anchor is present, then attach the real observers once.
    const trySetup = () => {
      if (cancelled) return;
      const els = CHAPTERS
        .map((c) => document.getElementById(c.id))
        .filter((el): el is HTMLElement => el !== null);

      if (els.length < CHAPTERS.length) {
        attempt += 1;
        if (attempt < 60) requestAnimationFrame(trySetup); // ~1s worst case at 60fps
        return;
      }

      // Reveal the nav once the visitor has scrolled past the hero — it
      // would be visual clutter over the opening cinematic frame.
      const heroEl = document.getElementById("kretopia-hero");
      if (heroEl) {
        heroIO = new IntersectionObserver(
          (entries) => entries.forEach((e) => setShowNav(!e.isIntersecting)),
          { rootMargin: "-10% 0px 0px 0px" },
        );
        heroIO.observe(heroEl);
      }

      activeIO = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const idx = CHAPTERS.findIndex((c) => c.id === entry.target.id);
            if (idx !== -1) setActiveIndex(idx);
          });
        },
        { rootMargin: "-45% 0px -45% 0px" }, // fires when a chapter crosses the vertical center
      );
      els.forEach((el) => activeIO!.observe(el));
    };

    trySetup();

    return () => {
      cancelled = true;
      heroIO?.disconnect();
      activeIO?.disconnect();
    };
  }, [ready]);

  const jumpTo = (id: string) => {
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  };

  if (!showNav) return null;

  return (
    <>
      {/* Desktop: vertical dot rail */}
      <nav
        aria-label="Landing tutorial chapters"
        className="hidden lg:flex fixed right-6 top-1/2 -translate-y-1/2 z-40 flex-col items-end gap-3"
      >
        {CHAPTERS.map((c, i) => {
          const active = i === activeIndex;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => jumpTo(c.id)}
              aria-current={active ? "true" : undefined}
              aria-label={`Jump to ${c.label} chapter`}
              className="group flex items-center gap-2.5 focus:outline-none"
            >
              <span
                className="text-[10px] font-medium uppercase tracking-[0.18em] whitespace-nowrap opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 group-focus-visible:opacity-100 group-focus-visible:translate-x-0"
                style={{ color: active ? ACCENT : "rgba(255,255,255,0.6)", fontFamily: "'Satoshi', 'Inter', sans-serif" }}
              >
                {c.label}
              </span>
              <span
                className="block rounded-full transition-all duration-200 group-focus-visible:ring-2 group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-transparent"
                style={{
                  width: active ? "8px" : "6px",
                  height: active ? "8px" : "6px",
                  backgroundColor: active ? ACCENT : "rgba(255,255,255,0.3)",
                  boxShadow: active ? `0 0 0 4px rgba(255,45,161,0.18)` : "none",
                  outlineColor: ACCENT,
                }}
              />
            </button>
          );
        })}
      </nav>
    </>
  );
};

export default ChapterProgressNav;
