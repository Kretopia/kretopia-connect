import { ReactNode, forwardRef } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { X, Heart } from "lucide-react";

interface SwipeCardProps {
  children: ReactNode;
  dragOffset: { x: number; y: number };
  swipeDirection: "left" | "right" | null;
  isDragging: boolean;
  onMouseDown?: (e: React.MouseEvent) => void;
  onMouseMove?: (e: React.MouseEvent) => void;
  onMouseUp?: () => void;
  onMouseLeave?: () => void;
  onTouchStart?: (e: React.TouchEvent) => void;
  onTouchMove?: (e: React.TouchEvent) => void;
  onTouchEnd?: () => void;
  className?: string;
  showOverlay?: boolean;
}

export const SwipeCard = forwardRef<HTMLDivElement, SwipeCardProps>(
  (
    {
      children,
      dragOffset,
      swipeDirection,
      isDragging,
      onMouseDown,
      onMouseMove,
      onMouseUp,
      onMouseLeave,
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      className,
      showOverlay = true
    },
    ref
  ) => {
    const rotation = dragOffset.x * 0.04; // Slightly reduced rotation for smoother feel
    const opacity = 1 - Math.abs(dragOffset.x) / (window.innerWidth * 0.8);
    const scale = isDragging ? 1.02 : 1; // Subtle lift when dragging

    return (
      <Card
        ref={ref}
        className={cn(
          "relative overflow-hidden shadow-xl border-2 cursor-grab select-none",
          "active:cursor-grabbing touch-pan-y",
          isDragging && "shadow-2xl",
          className
        )}
        style={{
          transform: `translateX(${dragOffset.x}px) translateY(${dragOffset.y}px) rotate(${rotation}deg) scale(${scale})`,
          transition: isDragging ? "none" : "all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)",
          opacity: Math.max(opacity, 0.3),
          willChange: isDragging ? "transform" : "auto",
          WebkitTapHighlightColor: "transparent",
        }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {children}

        {/* Swipe Direction Overlays with improved animations */}
        {showOverlay && swipeDirection && (
          <>
            {swipeDirection === "left" && (
              <div className="absolute inset-0 bg-destructive/25 backdrop-blur-sm flex items-center justify-center pointer-events-none animate-fade-in">
                <div className="bg-destructive text-destructive-foreground p-5 rounded-full shadow-lg animate-scale-in">
                  <X className="h-14 w-14" strokeWidth={3} />
                </div>
              </div>
            )}
            {swipeDirection === "right" && (
              <div className="absolute inset-0 bg-green-500/25 backdrop-blur-sm flex items-center justify-center pointer-events-none animate-fade-in">
                <div className="bg-green-500 text-white p-5 rounded-full shadow-lg animate-scale-in">
                  <Heart className="h-14 w-14 fill-current" strokeWidth={2} />
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    );
  }
);

SwipeCard.displayName = "SwipeCard";
