import { useSearchParams } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export interface StudioSectionTab {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  content: React.ReactNode;
}

interface StudioSectionTabsProps {
  tabs: StudioSectionTab[];
  defaultTabId?: string;
  /** When set, the active tab is read from and written to this query param
   * (e.g. "tab") so it survives a refresh or a shared link, instead of only
   * living in component state. */
  queryParam?: string;
  /** Fires on every tab switch — for parents that need to lazy-fetch a
   * tab's data only once it's actually activated. */
  onTabChange?: (id: string) => void;
  /** Drive the active tab from outside (e.g. a sibling "jump to Match" CTA).
   * Omit to keep the default uncontrolled behavior. */
  activeId?: string;
  className?: string;
}

/**
 * Studio-grammar in-place tabs. A thin, Studio-styled wrapper over the
 * existing Radix-based Tabs primitive (role="tablist"/"tab"/"tabpanel",
 * arrow-key navigation and focus management all come from Radix, not
 * reimplemented here) — content swaps in place under the active trigger,
 * never scrolls the page, never opens a Sheet/Dialog.
 */
export function StudioSectionTabs({ tabs, defaultTabId, queryParam, onTabChange, activeId, className }: StudioSectionTabsProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const fromQuery = queryParam ? searchParams.get(queryParam) : null;
  const initial = (fromQuery && tabs.some((t) => t.id === fromQuery)) ? fromQuery : (defaultTabId ?? tabs[0]?.id);

  const handleChange = (id: string) => {
    if (queryParam) {
      const next = new URLSearchParams(searchParams);
      next.set(queryParam, id);
      setSearchParams(next, { replace: true });
    }
    onTabChange?.(id);
  };

  return (
    <Tabs
      {...(activeId !== undefined ? { value: activeId } : { defaultValue: initial })}
      onValueChange={handleChange}
      className={cn("w-full", className)}
    >
      <TabsList className="h-auto w-full justify-start gap-1 rounded-full border border-border bg-card p-1">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <TabsTrigger
              key={t.id}
              value={t.id}
              className="gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold data-[state=active]:bg-[hsl(var(--energy))] data-[state=active]:text-white"
            >
              {Icon && <Icon className="h-3.5 w-3.5" />}
              {t.label}
            </TabsTrigger>
          );
        })}
      </TabsList>
      {tabs.map((t) => (
        <TabsContent key={t.id} value={t.id} className="mt-4 focus-visible:outline-none">
          {t.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
