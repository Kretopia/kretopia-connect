import { useRef, useState, useCallback } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { ZoomIn, Move } from "lucide-react";

interface Props {
  src: string;
  positionX: number; // 0-100
  positionY: number; // 0-100
  zoom: number; // 1-3
  onChange: (next: { positionX: number; positionY: number; zoom: number }) => void;
  onReplace?: () => void;
}

/**
 * Drag-to-position + zoom-slider cover editor.
 * Image is rendered at `zoom * 100%` and offset via object-position.
 * Aspect ratio locked to 16:9 to match how the cover renders on the magazine wall and article page.
 */
export const CoverImageEditor = ({ src, positionX, positionY, zoom, onChange, onReplace }: Props) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    draggingRef.current = true;
    setIsDragging(true);
    lastRef.current = { x: e.clientX, y: e.clientY };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current || !lastRef.current || !frameRef.current) return;
    const rect = frameRef.current.getBoundingClientRect();
    const dx = e.clientX - lastRef.current.x;
    const dy = e.clientY - lastRef.current.y;
    lastRef.current = { x: e.clientX, y: e.clientY };
    // Convert pixel delta into % of the visible frame, scaled by zoom (more zoom = finer movement).
    // Drag direction is inverted because moving image right = decreasing position.
    const overflow = Math.max(0.0001, zoom - 1);
    const pctX = (dx / rect.width) * 100 / Math.max(1, overflow);
    const pctY = (dy / rect.height) * 100 / Math.max(1, overflow);
    onChange({
      positionX: clamp(positionX - pctX, 0, 100),
      positionY: clamp(positionY - pctY, 0, 100),
      zoom,
    });
  }, [positionX, positionY, zoom, onChange]);

  const onPointerUp = useCallback(() => {
    draggingRef.current = false;
    setIsDragging(false);
    lastRef.current = null;
  }, []);

  return (
    <div className="space-y-2">
      <div
        ref={frameRef}
        className="relative rounded-xl overflow-hidden aspect-[16/9] bg-muted touch-none select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ cursor: isDragging ? "grabbing" : "grab" }}
      >
        <img
          src={src}
          alt="Cover"
          draggable={false}
          className="w-full h-full object-cover pointer-events-none"
          style={{
            objectPosition: `${positionX}% ${positionY}%`,
            transform: `scale(${zoom})`,
            transformOrigin: `${positionX}% ${positionY}%`,
          }}
        />
        <div className="absolute top-2 left-2 px-2 py-1 rounded-md bg-background/80 backdrop-blur-sm text-[10px] flex items-center gap-1 pointer-events-none">
          <Move className="h-3 w-3" /> Drag to reposition
        </div>
        {onReplace && (
          <Button
            variant="secondary"
            size="sm"
            className="absolute bottom-2 right-2 text-xs h-7"
            onClick={(e) => {
              e.stopPropagation();
              onReplace();
            }}
          >
            Change
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2 px-1">
        <ZoomIn className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <Slider
          value={[zoom]}
          min={1}
          max={3}
          step={0.05}
          onValueChange={([v]) => onChange({ positionX, positionY, zoom: v })}
          className="flex-1"
        />
        <span className="text-[10px] text-muted-foreground w-10 text-right tabular-nums">
          {zoom.toFixed(2)}x
        </span>
      </div>
    </div>
  );
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Reusable image style for rendering a cover with saved crop position.
 * Use on the <img> element inside a 16:9 (or any aspect) container.
 */
export function coverImageStyle(positionX?: number | null, positionY?: number | null, zoom?: number | null): React.CSSProperties {
  const px = positionX ?? 50;
  const py = positionY ?? 50;
  const z = zoom ?? 1;
  return {
    objectPosition: `${px}% ${py}%`,
    transform: `scale(${z})`,
    transformOrigin: `${px}% ${py}%`,
  };
}
