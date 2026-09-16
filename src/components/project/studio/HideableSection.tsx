import { useEffect, useState, type ReactNode } from "react";
import { EyeOff, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const KEY = (projectId: string) => `thrivedesk:hidden-sections:${projectId}`;

function readHidden(projectId: string): Set<string> {
  try {
    const raw = localStorage.getItem(KEY(projectId));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeHidden(projectId: string, set: Set<string>) {
  try {
    localStorage.setItem(KEY(projectId), JSON.stringify([...set]));
  } catch {
    /* noop */
  }
}

/** Hook + helpers so the parent can render a "Bring back" tray. */
export function useHiddenSections(projectId: string) {
  const [hidden, setHidden] = useState<Set<string>>(() => readHidden(projectId));

  useEffect(() => {
    setHidden(readHidden(projectId));
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY(projectId)) setHidden(readHidden(projectId));
    };
    window.addEventListener("storage", onStorage);
    const onLocal = () => setHidden(readHidden(projectId));
    window.addEventListener("thrivedesk:hidden-sections-changed", onLocal as EventListener);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("thrivedesk:hidden-sections-changed", onLocal as EventListener);
    };
  }, [projectId]);

  const isHidden = (id: string) => hidden.has(id);
  const hide = (id: string) => {
    const next = new Set(hidden);
    next.add(id);
    writeHidden(projectId, next);
    setHidden(next);
    window.dispatchEvent(new Event("thrivedesk:hidden-sections-changed"));
  };
  const show = (id: string) => {
    const next = new Set(hidden);
    next.delete(id);
    writeHidden(projectId, next);
    setHidden(next);
    window.dispatchEvent(new Event("thrivedesk:hidden-sections-changed"));
  };

  return { hidden, isHidden, hide, show };
}

interface HideableSectionProps {
  projectId: string;
  sectionId: string;
  /** Allow the user to hide this section (defaults true). */
  canHide?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Wraps a Studio sub-section with a tiny "Hide" affordance in the top-right.
 * State persists per project in localStorage. Re-show via <SectionsBringBackTray />.
 */
export function HideableSection({
  projectId,
  sectionId,
  canHide = true,
  className,
  children,
}: HideableSectionProps) {
  const { isHidden, hide } = useHiddenSections(projectId);
  if (isHidden(sectionId)) return null;
  return (
    <div className={cn("relative group", className)}>
      {canHide && (
        <button
          type="button"
          onClick={() => hide(sectionId)}
          className="absolute top-2 right-2 z-10 h-7 w-7 rounded-full bg-background/85 border border-border text-muted-foreground hover:text-foreground hover:bg-background flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
          aria-label="Hide section"
          title="Hide section"
        >
          <EyeOff className="h-3.5 w-3.5" />
        </button>
      )}
      {children}
    </div>
  );
}

interface SectionsBringBackTrayProps {
  projectId: string;
  /** Map of sectionId -> human label, in display order */
  labels: Record<string, string>;
  className?: string;
}

/**
 * Renders a small "Hidden sections" tray with chips to restore each.
 * Renders nothing when no sections are hidden in the provided label map.
 */
export function SectionsBringBackTray({
  projectId,
  labels,
  className,
}: SectionsBringBackTrayProps) {
  const { hidden, show } = useHiddenSections(projectId);
  const items = Object.entries(labels).filter(([id]) => hidden.has(id));
  if (!items.length) return null;
  return (
    <div className={cn("mx-4 lg:mx-0 my-2 rounded-xl border border-dashed border-border/70 bg-muted/30 p-2.5", className)}>
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground mb-1.5 px-1">
        Hidden sections
      </p>
      <div className="flex flex-wrap gap-1.5">
        {items.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => show(id)}
            className="inline-flex items-center gap-1 rounded-full bg-background border border-border px-2.5 py-1 text-[11px] font-medium hover:bg-accent transition-colors"
          >
            <Plus className="h-3 w-3" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
