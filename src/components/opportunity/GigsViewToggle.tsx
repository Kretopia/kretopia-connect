import { Radar, Store } from "lucide-react";
import { Button } from "@/components/ui/button";

export type GigsView = "scouted" | "marketplace";

const OPTIONS: Array<{ value: GigsView; label: string; Icon: typeof Radar }> = [
  { value: "scouted", label: "Scouted for you", Icon: Radar },
  { value: "marketplace", label: "Marketplace", Icon: Store },
];

/**
 * The Gigs feed switch. The active segment uses the glass system's own `default` variant instead of painting
 * `bg-primary` over a ghost button: `.btn-glass` forces its text to the glass ink with !important (white in dark
 * themes, near-black in light ones), and `--primary` is that same colour, so the label and icon of the active
 * segment disappeared into its own background.
 */
export function GigsViewToggle({ value, onChange }: { value: GigsView; onChange: (view: GigsView) => void }) {
  return (
    <div role="group" aria-label="Gigs feed" className="inline-flex items-center gap-1 p-1 rounded-full border border-foreground/[0.08] bg-foreground/[0.05] backdrop-blur-sm">
      {OPTIONS.map(({ value: option, label, Icon }) => (
        <Button
          key={option}
          type="button"
          size="sm"
          variant={value === option ? "default" : "ghost"}
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold"
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </Button>
      ))}
    </div>
  );
}
