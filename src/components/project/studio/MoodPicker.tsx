import { Palette, Flame, Music2, Camera, Leaf, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const MOODS: ReadonlyArray<{ id: string; label: string; Icon: LucideIcon }> = [
  { id: "creative", label: "Creative", Icon: Palette },
  { id: "urgent",   label: "Urgent",   Icon: Flame },
  { id: "musical",  label: "Musical",  Icon: Music2 },
  { id: "visual",   label: "Visual",   Icon: Camera },
  { id: "chill",    label: "Chill",    Icon: Leaf },
] as const;

export type MoodId = typeof MOODS[number]["id"];

interface MoodPickerProps {
  value: string | null;
  onChange: (mood: MoodId) => void;
  size?: "sm" | "md";
}

export const MoodPicker = ({ value, onChange, size = "md" }: MoodPickerProps) => {
  const dim = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const iconDim = size === "sm" ? "h-4 w-4" : "h-[18px] w-[18px]";
  return (
    <div className="flex items-center gap-1.5">
      {MOODS.map((m) => {
        const active = value === m.id;
        const { Icon } = m;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onChange(m.id)}
            aria-label={m.label}
            title={m.label}
            className={cn(
              "rounded-full flex items-center justify-center transition-all",
              dim,
              active
                ? "bg-primary/15 ring-2 ring-primary text-primary scale-110"
                : "bg-muted text-muted-foreground hover:bg-muted/70 opacity-80 hover:opacity-100"
            )}
          >
            <Icon className={iconDim} />
          </button>
        );
      })}
    </div>
  );
};

export const moodIcon = (id: string | null | undefined): LucideIcon | null =>
  MOODS.find((m) => m.id === id)?.Icon ?? null;

// Back-compat shim for any callers still importing moodEmoji — returns null now.
export const moodEmoji = (_id: string | null | undefined): string | null => null;
