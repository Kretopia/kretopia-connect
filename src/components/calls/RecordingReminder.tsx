import { useLayoutEffect, useState, type CSSProperties, type RefObject } from "react";
import { Save, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCallWindow } from "@/components/calls/PersistentCallWindow";
import { cn } from "@/lib/utils";

interface RecordingReminderProps {
  visible: boolean;
  onStop: () => void;
  onSave: () => void;
  /** "Not now": hides the reminder, the recording keeps running, and it asks again later. */
  onDismiss?: () => void;
  segment: "processing" | "saved" | "failed" | null;
  /** Clears a segment notice the user has read. */
  onClearSegment?: () => void;
}

const GAP = 8;
const MARGIN = 12;

/**
 * Where to put a card so it sits next to a call window without covering it: just above, or just below
 * when there is no room above. Follows the window when it is resized, dragged or the viewport changes.
 */
function useAnchor(root: RefObject<HTMLElement> | undefined, active: boolean) {
  const [box, setBox] = useState<{ left: number; width: number; bottom?: number; top?: number } | null>(null);
  useLayoutEffect(() => {
    const el = root?.current;
    if (!active || !el) { setBox(null); return; }
    const place = () => {
      const r = el.getBoundingClientRect();
      const width = Math.min(Math.max(r.width, 280), window.innerWidth - 2 * MARGIN);
      const left = Math.min(Math.max(MARGIN, r.left), window.innerWidth - width - MARGIN);
      const roomAbove = r.top >= 150;
      setBox(roomAbove ? { left, width, bottom: window.innerHeight - r.top + GAP } : { left, width, top: r.bottom + GAP });
    };
    place();
    const resize = new ResizeObserver(place);
    resize.observe(el);
    const moved = new MutationObserver(place); // dragging writes the window's inline style
    moved.observe(el, { attributes: true, attributeFilter: ["style", "class"] });
    window.addEventListener("resize", place);
    return () => { resize.disconnect(); moved.disconnect(); window.removeEventListener("resize", place); };
  }, [root, active]);
  return box;
}

export function RecordingReminder({ visible, onStop, onSave, onDismiss, segment, onClearSegment }: RecordingReminderProps) {
  const win = useCallWindow();
  const floating = !!win && win.mode !== "full";
  const shown = visible || !!segment;
  const box = useAnchor(win?.rootRef, floating && shown);
  if (!shown) return null;
  if (floating && !box) return null;
  const style: CSSProperties | undefined = floating && box
    ? { position: "fixed", left: box.left, width: box.width, top: box.top ?? "auto", bottom: box.bottom ?? "auto", visibility: "visible", zIndex: 70 }
    : undefined;
  return (
    <aside
      aria-label="Recording reminder"
      className={cn("pointer-events-none flex justify-center", !floating && "absolute bottom-3 inset-x-3 z-30")}
      style={style}
      onKeyDown={(event) => { if (event.key === "Escape") (visible ? onDismiss : onClearSegment)?.(); }}
    >
      <div className="pointer-events-auto w-full max-w-sm rounded-lg border border-border bg-background text-foreground p-3 shadow-lg">
        {visible && <>
          <div className="flex items-start justify-between gap-2 mb-3">
            <p role="status" className="text-sm font-medium">Do you want to stop or save this recording?</p>
            {onDismiss && (
              <Button variant="ghost" className="k-call-icon -mr-2 -mt-2" aria-label="Dismiss reminder" title="Not now" onClick={onDismiss}><X className="h-4 w-4" /></Button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="destructive" className="h-11 px-2" onClick={onStop}><Square />Stop recording</Button>
            <Button className="h-11 px-2" onClick={onSave}><Save />Save recording</Button>
          </div>
        </>}
        {segment && (
          <div className={cn("flex items-start justify-between gap-2", visible && "mt-2")}>
            <p role="status" className="text-xs mt-1">{segment === "processing" ? "Segment processing" : segment === "saved" ? "Segment saved · Replay available in Recordings" : "Segment save not confirmed · Retry sync in Recordings"}</p>
            {onClearSegment && segment !== "processing" && !visible && (
              <Button variant="ghost" className="k-call-icon -mr-2 -my-2" aria-label="Dismiss notice" onClick={onClearSegment}><X className="h-4 w-4" /></Button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
