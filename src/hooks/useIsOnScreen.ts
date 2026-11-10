import { useEffect, useState } from "react";

/**
 * Whether an element is on screen right now (it goes back to false when it scrolls away; useInView, by contrast, stays true once seen).
 * Returns a ref callback and the answer. Without IntersectionObserver (an old browser, a test) the element counts as on screen, so
 * whatever depends on it never ends up showing a second copy.
 */
export function useIsOnScreen<T extends Element>(): [(node: T | null) => void, boolean] {
  const [node, setNode] = useState<T | null>(null);
  const [onScreen, setOnScreen] = useState(true);

  useEffect(() => {
    if (!node || typeof IntersectionObserver === "undefined") {
      setOnScreen(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => setOnScreen(!!entry?.isIntersecting));
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  return [setNode, onScreen];
}

export default useIsOnScreen;
