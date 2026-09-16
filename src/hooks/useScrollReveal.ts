import { useEffect, useRef, useState, type RefObject } from "react";
import { useReducedMotion } from "./useReducedMotion";

interface UseScrollRevealOptions {
  /** IntersectionObserver rootMargin (default: trigger slightly before fully in view). */
  rootMargin?: string;
  /** Stay visible after the first reveal instead of toggling off-screen. Default true. */
  once?: boolean;
}

/**
 * Shared entrance-reveal primitive: a ref to attach and a `visible` boolean,
 * powered by IntersectionObserver. Bypassed (immediately visible) under
 * prefers-reduced-motion or when IntersectionObserver isn't available, so
 * consumers never need their own reduced-motion branch for this part.
 *
 * Standardizes the reveal-on-scroll pattern that was previously hand-rolled
 * per component (landing chapters, tutorial steppers).
 */
export function useScrollReveal<T extends HTMLElement = HTMLDivElement>(
  options: UseScrollRevealOptions = {},
): [RefObject<T>, boolean] {
  const { rootMargin = "-10% 0px -10% 0px", once = true } = options;
  const reducedMotion = useReducedMotion();
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (reducedMotion) {
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            if (once) io.disconnect();
          } else if (!once) {
            setVisible(false);
          }
        });
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reducedMotion, rootMargin, once]);

  return [ref, visible];
}

export default useScrollReveal;
