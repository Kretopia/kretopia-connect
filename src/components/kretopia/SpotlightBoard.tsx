import type { ReactNode } from "react";
import { BookOpen, Headphones, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type SpotlightTab = "magazine" | "podcast";

const TABS: {
  value: SpotlightTab;
  label: string;
  icon: typeof BookOpen;
  hint: string;
}[] = [
  {
    value: "magazine",
    label: "Magazine",
    icon: BookOpen,
    hint: "Long reads, interviews and features — tap any story to open it, share it or save it for later.",
  },
  {
    value: "podcast",
    label: "Podcast",
    icon: Headphones,
    hint: "Discover A Thriver — press play on the featured episode, then pick any other from the list below it.",
  },
];

/**
 * The Spotlight desk — a control-plate header (same aurora + scan-line
 * signature as EditorialPageHero/HoloCard) instead of a plain bordered
 * card, so switching between Magazine and Podcast feels like operating a
 * real console rather than clicking a generic tab strip. Theme-aware, like
 * the rest of the plate — follows Dark/Light instead of a fixed #05070D.
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
  const active = TABS.find((t) => t.value === value) ?? TABS[0];

  return (
    <div className={cn("w-full overflow-hidden rounded-2xl border border-[hsl(var(--energy)/0.2)]", className)}>
      {/* Board header — control plate, ambient glow, top scan-line */}
      <div className="relative overflow-hidden px-4 pb-4 pt-5 sm:px-5" style={{ backgroundColor: "hsl(var(--background))" }}>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 ai-ambient-breathe"
          style={{ background: "radial-gradient(65% 90% at 15% 0%, hsl(var(--energy)/0.22), transparent 65%)" }}
        />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden">
          <div
            className="ai-scan-line h-full w-1/3"
            style={{ background: "linear-gradient(90deg, transparent, hsl(var(--energy)/0.9), transparent)" }}
          />
        </div>

        <div className="relative flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-semibold text-foreground">The Spotlight desk</h3>
          <span className="text-[11px] text-foreground/50">Read it or hear it</span>
        </div>

        <p className="relative mt-1.5 text-[11px] leading-relaxed text-foreground/55">
          Everything published by Kretopia lives here: written stories on one side, recorded
          conversations on the other. Pick a side — the content loads straight away, no sign-up needed.
        </p>

        <Tabs value={value} onValueChange={(v) => onValueChange(v as SpotlightTab)} className="relative mt-3.5">
          <TabsList className="h-auto gap-2 rounded-full bg-transparent p-0">
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <TabsTrigger
                  key={t.value}
                  value={t.value}
                  className={cn(
                    "gap-1.5 rounded-full border px-3.5 py-2 text-[11px] font-semibold transition-all",
                    "border-border text-foreground/60 hover:text-foreground/85",
                    "data-[state=active]:border-[hsl(var(--energy)/0.5)] data-[state=active]:bg-[hsl(var(--energy)/0.14)] data-[state=active]:text-foreground",
                    "data-[state=active]:shadow-[0_0_20px_-4px_hsl(var(--energy)/0.6)]",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>

        <p className="relative mt-3 flex items-start gap-1.5 text-[11px] text-foreground/50">
          <Info className="h-3 w-3 shrink-0 mt-[2px]" />
          {active.hint}
        </p>
      </div>

      {/* Board body */}
      <div className="bg-card p-3 sm:p-5">
        {value === "magazine" ? magazine : podcast}
      </div>
    </div>
  );
}

export default SpotlightBoard;
