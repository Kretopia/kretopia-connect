import { useEffect, useRef, useState } from "react";

interface AutoHideNavbarOptions {
  /** Opacity applied once idle (not hidden, just subtly dimmed). */
  idleOpacity?: number;
  /** Ms of no scroll/pointer/keyboard activity before considered idle. */
  idleDelayMs?: number;
  /** Scroll distance from top before hide-on-scroll-down is allowed to kick in. */
  hideThresholdPx?: number;
}

/**
 * Scroll/idle state for a sticky navbar. Deliberately does NOT decide pointer-over
 * or focus-within — those are per-element and belong on the nav's own
 * onMouseEnter/onFocus handlers, combined with this hook's output by the caller.
 *
 * `forceVisible` covers the "never hide" cases that don't depend on the pointer:
 * at the top of the page, a Sheet/Dialog drawer open (menu, notifications,
 * messages), or prefers-reduced-motion.
 */
export function useAutoHideNavbar({
  idleOpacity = 0.94,
  idleDelayMs = 2500,
  hideThresholdPx = 64,
}: AutoHideNavbarOptions = {}) {
  const [hiddenByScroll, setHiddenByScroll] = useState(false);
  const [atTop, setAtTop] = useState(true);
  const [idle, setIdle] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const lastY = useRef(0);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    lastY.current = window.scrollY;

    const resetIdle = () => {
      setIdle(false);
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => setIdle(true), idleDelayMs);
    };

    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY.current;
      setAtTop(y <= 4);
      if (y <= 4) {
        setHiddenByScroll(false);
      } else if (delta > 8 && y > hideThresholdPx) {
        setHiddenByScroll(true);
      } else if (delta < -8) {
        setHiddenByScroll(false);
      }
      lastY.current = y;
      resetIdle();
    };

    resetIdle();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", resetIdle, { passive: true });
    window.addEventListener("keydown", resetIdle);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", resetIdle);
      window.removeEventListener("keydown", resetIdle);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [idleDelayMs, hideThresholdPx]);

  // Never hide while a Sheet/Dialog drawer (menu, notifications, messages) is open.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const check = () => {
      const open =
        document.body.hasAttribute("data-scroll-locked") ||
        !!document.querySelector('[role="dialog"][data-state="open"]');
      setDrawerOpen(open);
    };
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-scroll-locked", "style"],
      childList: true,
      subtree: true,
    });
    return () => obs.disconnect();
  }, []);

  const forceVisible = reducedMotion || atTop || drawerOpen;

  return {
    hiddenByScroll: forceVisible ? false : hiddenByScroll,
    idle: forceVisible ? false : idle,
    idleOpacity,
    forceVisible,
  };
}
