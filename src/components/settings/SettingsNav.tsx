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
 */
export function SettingsNav({ domains, active, onSelect }: SettingsNavProps) {
  return (
    <nav
      aria-label="Settings sections"
      className="flex flex-wrap gap-1 pb-2 md:w-48 md:shrink-0 md:flex-col md:flex-nowrap md:pb-0"
    >
      {domains.map((d) => {
        const Icon = d.icon;
        const isActive = d.id === active;
        return (
          <button
            key={d.id}
            type="button"
            onClick={() => onSelect(d.id)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors md:w-full md:shrink",
              isActive
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
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
