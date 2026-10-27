import { useEffect, useRef } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SettingsDomain {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface SettingsNavProps {
  domains: SettingsDomain[];
  active: string;
  onSelect: (id: string) => void;
}

/**
 * CDO audit canonical Settings navigation (L4: SettingsNav). Persistent,
 * categorized, with an active state -- desktop renders it as a sidebar
 * column, mobile as a wrapping row of the same buttons, so every section stays visible
 * without a hidden horizontal scroll (no separate mobile component to keep in sync).
 * The desktop column is sticky: the content pane beside it is much taller, and the sidebar used to scroll away with
 * the page, leaving only some of the sections in view and none once the person had scrolled.
 * Its look is the pill language every Kretopia switcher wears (Scout, Discover): a hairline surface, the active item
 * lifted onto the page background with a ring.
 */
export function SettingsNav({ domains, active, onSelect }: SettingsNavProps) {
  const activeRef = useRef<HTMLButtonElement>(null);
  // On a phone the sections are one row that scrolls sideways: keep the one in use in view.
  useEffect(() => {
    activeRef.current?.scrollIntoView?.({ block: "nearest", inline: "center" });
  }, [active]);

  return (
    <nav
      aria-label="Settings sections"
      className="flex flex-nowrap gap-1 overflow-x-auto rounded-2xl border border-border bg-card p-1 [scrollbar-width:none] md:sticky md:top-24 md:w-52 md:shrink-0 md:flex-col md:self-start md:overflow-visible [&::-webkit-scrollbar]:hidden"
    >
      {domains.map((d) => {
        const Icon = d.icon;
        const isActive = d.id === active;
        return (
          <button
            key={d.id}
            ref={isActive ? activeRef : undefined}
            type="button"
            onClick={() => onSelect(d.id)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/50 md:min-h-10 md:w-full md:shrink",
              isActive
                ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {d.label}
          </button>
        );
      })}
    </nav>
  );
}

export default SettingsNav;
