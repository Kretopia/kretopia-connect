import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

interface SortableSectionProps {
  id: string;
  children: React.ReactNode;
  className?: string;
  /** When false, drag handle hides and reordering is disabled (e.g. on mobile) */
  enabled?: boolean;
}

/**
 * Wrap a Studio section so it can be reordered via drag-and-drop on desktop.
 * The grip handle appears on hover, top-right of the section.
 */
export const SortableSection = ({ id, children, className, enabled = true }: SortableSectionProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !enabled,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 30 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("relative group/widget", className)}
    >
      {enabled && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          title="Drag to reorder"
          className="absolute top-2 right-2 z-20 h-7 w-7 rounded-md bg-card/80 border border-border/60 text-muted-foreground hover:text-foreground hover:bg-card opacity-0 group-hover/widget:opacity-100 transition-opacity flex items-center justify-center cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      )}
      {children}
    </div>
  );
};
