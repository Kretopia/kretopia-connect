import { useState } from "react";
import { EVENT_ARCHETYPES, type EventArchetypeId } from "@/lib/eventArchetypes";
import { cn } from "@/lib/utils";
import { Calendar, Check } from "lucide-react";

interface Props {
  value: EventArchetypeId | null;
  onChange: (id: EventArchetypeId) => void;
  /** Compact mode for use inside dense forms */
  compact?: boolean;
}

/**
 * Cinematic 12-tile picker for event archetypes (networking dinner, festival, etc.).
 * Drives default Studio modules + producer agent prompt seeding.
 */
export function EventArchetypePicker({ value, onChange, compact }: Props) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[hsl(var(--energy))]">
        <Calendar className="h-3 w-3" />
        What kind of event?
      </div>
      <div
        className={cn(
          "grid gap-2",
          compact ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-3",
        )}
      >
        {EVENT_ARCHETYPES.map((a) => {
          const Icon = a.icon;
          const selected = value === a.id;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => onChange(a.id)}
              className={cn(
                "relative rounded-xl border p-2.5 text-left transition-all",
                "hover:border-primary/60 hover:bg-primary/5",
                selected
                  ? "border-[hsl(var(--energy))] bg-[hsl(var(--energy)/0.08)] ring-1 ring-[hsl(var(--energy)/0.4)]"
                  : "border-border/60 bg-card/40",
              )}
            >
              {selected && (
                <span className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-[hsl(var(--energy))] flex items-center justify-center">
                  <Check className="h-2.5 w-2.5 text-[hsl(var(--background))]" />
                </span>
              )}
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "h-7 w-7 rounded-lg flex items-center justify-center",
                    selected
                      ? "bg-[hsl(var(--energy)/0.2)] text-[hsl(var(--energy))]"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <p className="text-[11px] font-bold leading-tight">{a.label}</p>
              </div>
              {!compact && (
                <p className="mt-1 text-[10px] text-muted-foreground leading-snug line-clamp-2">
                  {a.blurb}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
