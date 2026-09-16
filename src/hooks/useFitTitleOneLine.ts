import { useLayoutEffect, type RefObject } from "react";

/**
 * Shrinks a title element's font-size (between maxRem and minRem) until its
 * content fits on a single line within a sibling wrapper's width. Lets page
 * titles of any length share one centered treatment without hand-tuning a
 * clamp() per page — the wrapper must have a real, content-independent
 * width (e.g. `w-full`) for the overflow check to be meaningful.
 */
export function useFitTitleOneLine(
  wrapperRef: RefObject<HTMLElement>,
  titleRef: RefObject<HTMLElement>,
  deps: unknown[],
  maxRem = 3,
  minRem = 1,
) {
  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    const title = titleRef.current;
    if (!wrapper || !title) return;

    const fit = () => {
      let size = maxRem;
      title.style.whiteSpace = "nowrap";
      title.style.fontSize = `${size}rem`;
      while (title.scrollWidth > wrapper.clientWidth && size > minRem) {
        size -= 0.125;
        title.style.fontSize = `${size}rem`;
      }
      // Still doesn't fit even at the floor -- let it wrap onto a second
      // centered line rather than truncating. A centered ellipsis renders
      // left-aligned (the browser clips the overflowing side), which looks
      // broken; a centered two-line wrap doesn't.
      if (title.scrollWidth > wrapper.clientWidth) {
        title.style.whiteSpace = "normal";
      }
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrapper);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export default useFitTitleOneLine;
