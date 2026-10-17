import { useState, useRef, useEffect, useCallback } from "react";

interface SwipeGesturesOptions {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  swipeThreshold?: number;
  dragThreshold?: number;
}

export const useSwipeGestures = ({
  onSwipeLeft,
  onSwipeRight,
  swipeThreshold = 150,
  dragThreshold = 80
}: SwipeGesturesOptions) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isAnimating, setIsAnimating] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const offset = useRef(0);
  const dragging = useRef(false);
  const animating = useRef(false);
  const mounted = useRef(true);
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const resetSwipe = useCallback(() => {
    start.current = null;
    offset.current = 0;
    dragging.current = false;
    setIsDragging(false);
    setDragOffset({ x: 0, y: 0 });
    setSwipeDirection(null);
  }, []);

  const animateSwipe = useCallback(async (direction: "left" | "right") => {
    if (animating.current) return false;
    animating.current = true;
    setIsAnimating(true);
    start.current = null;
    dragging.current = false;
    setIsDragging(false);
    setSwipeDirection(direction);
    const targetX = direction === "right" ? window.innerWidth * 1.5 : -window.innerWidth * 1.5;
    setDragOffset({ x: targetX, y: 0 });
    const duration = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 300;
    await new Promise(resolve => setTimeout(resolve, duration));
    if (!mounted.current) return false;
    resetSwipe();
    animating.current = false;
    setIsAnimating(false);
    return true;
  }, [resetSwipe]);

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (animating.current || ('button' in e && e.button !== 0)) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, textarea, select, [role="button"]')) return;
    const point = 'touches' in e ? e.touches[0] : e;
    if (!point) return;
    start.current = { x: point.clientX, y: point.clientY };
    offset.current = 0;
  };

  const handleDragMove = useCallback((e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    if (!start.current || animating.current) return;
    const point = 'touches' in e ? e.touches[0] : e;
    if (!point) return;
    const deltaX = point.clientX - start.current.x;
    const deltaY = point.clientY - start.current.y;
    if (dragging.current || (Math.abs(deltaX) > 8 && Math.abs(deltaX) > Math.abs(deltaY) * 1.3)) {
      dragging.current = true;
      setIsDragging(true);
      if (e.cancelable) e.preventDefault();
      offset.current = deltaX;
      setDragOffset({ x: deltaX, y: 0 });
      setSwipeDirection(Math.abs(deltaX) > dragThreshold ? (deltaX > 0 ? 'right' : 'left') : null);
    } else if (Math.abs(deltaY) > 15) {
      resetSwipe();
    }
  }, [dragThreshold, resetSwipe]);

  const handleDragEnd = useCallback(() => {
    if (!start.current || animating.current) return;
    start.current = null;
    if (dragging.current && Math.abs(offset.current) > swipeThreshold) {
      const direction = offset.current > 0 ? 'right' : 'left';
      const callback = direction === 'right' ? onSwipeRight : onSwipeLeft;
      void animateSwipe(direction).then(completed => { if (completed) callback(); });
    } else {
      resetSwipe();
    }
  }, [animateSwipe, onSwipeLeft, onSwipeRight, resetSwipe, swipeThreshold]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleDragMove);
    window.addEventListener('mouseup', handleDragEnd);
    window.addEventListener('touchmove', handleDragMove, { passive: false });
    window.addEventListener('touchend', handleDragEnd);
    window.addEventListener('touchcancel', resetSwipe);
    window.addEventListener('blur', resetSwipe);
    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);
      window.removeEventListener('touchcancel', resetSwipe);
      window.removeEventListener('blur', resetSwipe);
    };
  }, [handleDragMove, handleDragEnd, resetSwipe]);

  return {
    isDragging,
    isAnimating,
    dragOffset,
    swipeDirection,
    cardRef,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    resetSwipe,
    animateSwipe
  };
};
