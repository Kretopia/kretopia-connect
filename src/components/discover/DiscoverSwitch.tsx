import { ArrowUpRight, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The pill switcher every Wrapped surface uses (Scout's section switcher is the reference): a hairline pill on the
 * card surface, the active item lifted onto the page background with a ring. Exported as class strings so the lane
 * Tabs and the sub-mode switches below are the same pill by construction.
 */
// On a phone the pills share the row equally so none is cut off; from `sm` up they hug their labels.
export const PILL_GROUP =
  "grid w-full grid-flow-col auto-cols-fr items-center gap-1 overflow-x-auto rounded-full border border-border bg-card p-1 [scrollbar-width:none] sm:inline-flex sm:w-fit sm:max-w-full sm:justify-start [&::-webkit-scrollbar]:hidden";
export const PILL_ITEM =
  "inline-flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-2 py-1.5 text-xs font-semibold sm:px-3.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/50 sm:min-h-9";
export const PILL_ITEM_ACTIVE = "bg-background text-foreground shadow-sm ring-1 ring-border";

export interface DiscoverSwitchItem<T extends string> {
  id: T;
  label: string;
  icon: LucideIcon;
  /** Leaves this surface (a page of its own) instead of switching a mode: it gets the arrow. */
  leaves?: boolean;
}

interface DiscoverSwitchProps<T extends string> {
  items: readonly DiscoverSwitchItem<T>[];
  value: T;
  onChange: (id: T) => void;
  /** Accessible name of the group. */
  label: string;
  className?: string;
}

/** A row of modes inside a lane (Swipe, Browse, Nearby). One is on; the rest are a tap away. */
export function DiscoverSwitch<T extends string>({ items, value, onChange, label, className }: DiscoverSwitchProps<T>) {
  return (
    <div role="group" aria-label={label} className={cn(PILL_GROUP, className)}>
      {items.map((item) => {
        const Icon = item.icon;
        const active = value === item.id;
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={item.leaves ? undefined : active}
            onClick={() => onChange(item.id)}
            className={cn(PILL_ITEM, active && PILL_ITEM_ACTIVE)}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {item.label}
            {item.leaves && <ArrowUpRight className="hidden h-3 w-3 opacity-60 sm:block" aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}

export default DiscoverSwitch;
