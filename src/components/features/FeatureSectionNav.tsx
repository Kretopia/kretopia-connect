import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface FeatureSectionItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
}

/** One compact, keyboard-accessible section switcher for Scout and Match. */
export function FeatureSectionNav({ items, value, onChange, label }: {
  items: FeatureSectionItem[]; value: string; onChange: (id: string) => void; label: string;
}) {
  return <Tabs value={value} onValueChange={onChange} className="min-w-0 max-w-full">
    <TabsList aria-label={label} className="h-auto max-w-full justify-start gap-1 overflow-x-auto rounded-full border border-border bg-card p-1 [scrollbar-width:none]">
      {items.map(({ id, label: text, icon: Icon, hint }) => <TabsTrigger key={id} value={id} title={hint}
        className="min-h-10 shrink-0 gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-border">
        <Icon className="h-3.5 w-3.5" />{text}
      </TabsTrigger>)}
    </TabsList>
  </Tabs>;
}