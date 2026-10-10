import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * True once the element has come within `rootMargin` of the viewport, and it
 * stays true: used to start fetching for a section only when it is about to be
 * seen, instead of loading everything below the fold on arrival.
 * Without IntersectionObserver (old browsers, tests) it is true straight away.
 */
export function useInView<T extends Element>(rootMargin = "300px"): [RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(() => typeof IntersectionObserver === "undefined");

  useEffect(() => {
    if (inView) return;
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [inView, rootMargin]);

  return [ref, inView];
}

export default useInView;
