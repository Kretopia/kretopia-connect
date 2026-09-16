import { Button } from "@/components/ui/button";
import { Users, Calendar, MapPin, Building2, Bookmark } from "lucide-react";

export type AtlasFilter = 'all' | 'creators' | 'sessions' | 'spots' | 'bookmarked';

interface AtlasFilterTabsProps {
  active: AtlasFilter;
  onChange: (filter: AtlasFilter) => void;
  counts: {
    creators: number;
    sessions: number;
    spots: number;
    bookmarked: number;
  };
}

const TABS: { value: AtlasFilter; label: string; icon: any; countKey: keyof AtlasFilterTabsProps['counts'] | null }[] = [
  { value: 'all', label: 'All', icon: MapPin, countKey: null },
  { value: 'creators', label: 'Creators', icon: Users, countKey: 'creators' },
  { value: 'sessions', label: 'Events', icon: Calendar, countKey: 'sessions' },
  { value: 'spots', label: 'Spots', icon: Building2, countKey: 'spots' },
  { value: 'bookmarked', label: 'Saved', icon: Bookmark, countKey: 'bookmarked' },
];

export function AtlasFilterTabs({ active, onChange, counts }: AtlasFilterTabsProps) {
  const total = counts.creators + counts.sessions + counts.spots;

  return (
    <div className="flex gap-1.5 items-center whitespace-nowrap">
      {TABS.map(tab => {
        const Icon = tab.icon;
        const count = tab.countKey ? counts[tab.countKey] : total;
        const isActive = active === tab.value;
        
        return (
          <Button
            key={tab.value}
            size="sm"
            variant={isActive ? "default" : "outline"}
            className={`shrink-0 gap-1.5 text-xs h-8 ${isActive ? '' : 'text-muted-foreground'}`}
            onClick={() => onChange(tab.value)}
          >
            <Icon className="h-3.5 w-3.5" />
            {tab.label}
            {count > 0 && (
              <span className={`text-[10px] px-1 rounded-full ${isActive ? 'bg-primary-foreground/20' : 'bg-muted'}`}>
                {count}
              </span>
            )}
          </Button>
        );
      })}
    </div>
  );
}
