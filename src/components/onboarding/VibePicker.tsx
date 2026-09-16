import { cn } from "@/lib/utils";
import { saveVibe, getStoredVibe, type Vibe } from "@/components/VibeThemeSync";
import { useState, useEffect } from "react";
import { useTheme } from "next-themes";

interface Tile {
  id: Vibe;
  label: string;
  blurb: string;
  bg: string;        // raw hex for the preview swatch
  fg: string;
  accent: string;
}

const TILES: Tile[] = [
  {
    id: "daylight",
    label: "Daylight",
    blurb: "Cream canvas, calm. Editorial.",
    bg: "#FAF8F5",
    fg: "#0F0F12",
    accent: "#FF2DA1",
  },
  {
    id: "midnight",
    label: "Midnight",
    blurb: "Dark canvas, pink accent. Focused.",
    bg: "#05070D",
    fg: "#FAF8F5",
    accent: "#FF2DA1",
  },
];

interface VibePickerProps {
  onPick?: (vibe: Vibe) => void;
  compact?: boolean;
}

export function VibePicker({ onPick, compact = false }: VibePickerProps) {
  const [selected, setSelected] = useState<Vibe>("daylight");
  const { setTheme } = useTheme();

  useEffect(() => {
    setSelected(getStoredVibe());
  }, []);

  const handlePick = async (v: Vibe) => {
    setSelected(v);
    await saveVibe(v, setTheme);
    onPick?.(v);
  };

  return (
    <div className={cn("grid gap-3", compact ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2")}>
      {TILES.map((t) => {
        const active = selected === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => handlePick(t.id)}
            aria-pressed={active}
            className={cn(
              "rounded-2xl border-2 p-3 text-left transition-all",
              active
                ? "border-primary shadow-md scale-[1.01]"
                : "border-border hover:border-primary/40",
            )}
          >
            {/* Mini preview tile */}
            <div
              className="rounded-xl p-3 mb-2 aspect-[4/3] flex flex-col justify-between"
              style={{ background: t.bg, color: t.fg }}
            >
              <div
                className="h-1 w-8 rounded-full"
                style={{ background: t.accent }}
              />
              <div>
                <div className="text-[10px] opacity-60 uppercase tracking-wider">Project</div>
                <div className="text-[11px] font-bold leading-tight">Cover Story</div>
                <div
                  className="mt-1 inline-block text-[9px] px-1.5 py-0.5 rounded font-bold"
                  style={{ background: t.accent, color: t.bg }}
                >
                  Match
                </div>
              </div>
            </div>
            <div className="text-sm font-bold">{t.label}</div>
            {!compact && (
              <div className="text-[11px] text-muted-foreground leading-snug">{t.blurb}</div>
            )}
          </button>
        );
      })}
    </div>
  );
}
