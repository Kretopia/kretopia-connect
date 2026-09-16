import { useState, useRef } from "react";

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
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    setDragStart({ x: clientX, y: clientY });
  };
  
  const handleDragMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (dragStart.x === 0 && dragStart.y === 0) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const deltaX = clientX - dragStart.x;
    const deltaY = clientY - dragStart.y;
    
    const horizontalDistance = Math.abs(deltaX);
    const verticalDistance = Math.abs(deltaY);
    
    const isHorizontalSwipe = horizontalDistance > verticalDistance * 3 && horizontalDistance > 60;
    
    if (isHorizontalSwipe) {
      if (!isDragging) {
        setIsDragging(true);
      }
      e.preventDefault();
      setDragOffset({ x: deltaX, y: 0 });
      
      if (Math.abs(deltaX) > dragThreshold) {
        setSwipeDirection(deltaX > 0 ? "right" : "left");
      } else {
        setSwipeDirection(null);
      }
    } else if (verticalDistance > 15 && !isDragging) {
      setDragStart({ x: 0, y: 0 });
      setDragOffset({ x: 0, y: 0 });
    }
  };

  const handleDragEnd = () => {
    if (!isDragging) {
      setDragStart({ x: 0, y: 0 });
      return;
    }
    
    setIsDragging(false);
    
    if (Math.abs(dragOffset.x) > swipeThreshold) {
      if (dragOffset.x > 0) {
        onSwipeRight();
      } else {
        onSwipeLeft();
      }
    } else {
      resetSwipe();
    }
    
    setDragStart({ x: 0, y: 0 });
  };

  const resetSwipe = () => {
    setDragOffset({ x: 0, y: 0 });
    setSwipeDirection(null);
  };

  const animateSwipe = async (direction: "left" | "right") => {
    setSwipeDirection(direction);
    const targetX = direction === "right" ? window.innerWidth * 1.5 : -window.innerWidth * 1.5;
    setDragOffset({ x: targetX, y: 0 });
    
    await new Promise(resolve => setTimeout(resolve, 300));
    
    resetSwipe();
  };

  return {
    isDragging,
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
