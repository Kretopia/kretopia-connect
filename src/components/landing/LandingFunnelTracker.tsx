/**
 * LandingFunnelTracker — invisible. Mounted once by KretopiaLanding.
 *
 * Rather than editing every chapter component, this observes the real
 * `<section id="...">` elements already present in the DOM and fires one
 * `landing_section_viewed` per section per page load, plus scroll-depth
 * milestones at 25/50/75/100%.
 *
 * Sections below the fold are lazy-mounted, so the observer re-scans on a
 * MutationObserver rather than assuming everything exists at mount.
 */
import { useEffect, useRef } from "react";
import {
  LANDING_SECTION_ORDER,
  trackLandingScrollDepth,
  trackLandingSectionViewed,
} from "@/lib/landingFunnel";

const DEPTHS: (25 | 50 | 75 | 100)[] = [25, 50, 75, 100];

export const LandingFunnelTracker = () => {
  const seenSections = useRef<Set<string>>(new Set());
  const seenDepths = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;

    const observed = new WeakSet<Element>();

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const id = entry.target.id;
          if (!id || seenSections.current.has(id)) continue;
          seenSections.current.add(id);
          const index = LANDING_SECTION_ORDER.indexOf(id as never);
          trackLandingSectionViewed(id, index);
          io.unobserve(entry.target);
        }
      },
      // Counts as "seen" only once a real slice of it is on screen.
      { threshold: 0.35 },
    );

    const scan = () => {
      document.querySelectorAll<HTMLElement>("section[id]").forEach((el) => {
        if (observed.has(el)) return;
        observed.add(el);
        io.observe(el);
      });
    };

    scan();
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const doc = document.documentElement;
        const scrollable = doc.scrollHeight - window.innerHeight;
        if (scrollable <= 0) return;
        const pct = ((window.scrollY || doc.scrollTop) / scrollable) * 100;
        for (const d of DEPTHS) {
          if (pct >= d && !seenDepths.current.has(d)) {
            seenDepths.current.add(d);
            trackLandingScrollDepth(d);
          }
        }
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      io.disconnect();
      mo.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return null;
};

export default LandingFunnelTracker;
