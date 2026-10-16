import type { ReactNode } from "react";
import { BookOpen, Headphones } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type SpotlightTab = "magazine" | "podcast";

const TABS: { value: SpotlightTab; label: string; icon: typeof BookOpen }[] = [
  { value: "magazine", label: "Magazine", icon: BookOpen },
  { value: "podcast", label: "Podcast", icon: Headphones },
];

/**
 * Spotlight's Magazine / Podcast switch: two equal-width segments so neither
 * side reads as the "main" one, the active segment is a solid foreground fill
 * (readable in both themes, unlike a faint tint), and the content sits right
 * under it with no intro copy in between.
 */
export function SpotlightBoard({
  value,
  onValueChange,
  magazine,
  podcast,
  className,
}: {
  value: SpotlightTab;
  onValueChange: (tab: SpotlightTab) => void;
  magazine: ReactNode;
  podcast: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("w-full space-y-3", className)}>
      <Tabs value={value} onValueChange={(v) => onValueChange(v as SpotlightTab)}>
        <TabsList
          aria-label="Spotlight sections"
          className="grid h-auto w-full grid-cols-2 gap-1 rounded-full border border-border bg-muted/40 p-1"
        >
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className={cn(
                  "h-11 gap-2 rounded-full px-4 text-sm font-semibold text-muted-foreground transition-colors",
                  "hover:text-foreground",
                  "data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-sm",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {t.label}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* The Magazine panel already draws its own framed surface; the Podcast
          panel is bare content, so only it gets one -- no card inside a card. */}
      {value === "magazine" ? (
        magazine
      ) : (
        <div className="rounded-2xl border border-border bg-card p-3 sm:p-5">{podcast}</div>
      )}
    </div>
  );
}

export default SpotlightBoard;
