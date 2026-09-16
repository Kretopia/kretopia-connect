import { INTENTS, INTENT_MAX, type PrimaryIntent } from "@/lib/intents";
import { Check } from "lucide-react";

interface IntentPickerProps {
  /** Selected intents (max 2). */
  value?: PrimaryIntent[] | null;
  /** Called with full updated array on every toggle. */
  onChange: (intents: PrimaryIntent[]) => void;
  /** Compact = smaller cards (for home weekly card). */
  compact?: boolean;
}

/**
 * Multi-select intent picker (max 2). Tapping toggles selection.
 * Visual: purple gradient border on selected, lime check pill, brand-aligned.
 */
export const IntentPicker = ({ value, onChange, compact = false }: IntentPickerProps) => {
  const selected = value ?? [];

  const toggle = (id: PrimaryIntent) => {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
      return;
    }
    if (selected.length >= INTENT_MAX) {
      // Replace oldest (first) to keep at most 2 — feels less punitive than blocking
      onChange([...selected.slice(1), id]);
      return;
    }
    onChange([...selected, id]);
  };

  return (
    <div className="space-y-2">
      <div className={`grid grid-cols-2 gap-2.5 ${compact ? "" : "sm:gap-3"}`}>
        {INTENTS.map((intent) => {
          const isOn = selected.includes(intent.id);
          return (
            <button
              key={intent.id}
              type="button"
              onClick={() => toggle(intent.id)}
              aria-pressed={isOn}
              className={`
                group relative text-left rounded-2xl border-2 transition-all
                ${compact ? "p-3" : "p-4"}
                ${
                  isOn
                    ? "border-primary bg-gradient-to-br from-primary/15 via-primary/5 to-energy/10 shadow-md shadow-primary/20"
                    : "border-border bg-card hover:border-primary/40 hover:bg-primary/5"
                }
              `}
            >
              <div className="flex items-start gap-2.5">
                <div
                  className={`
                    flex items-center justify-center rounded-xl shrink-0 transition-colors
                    ${compact ? "h-8 w-8 text-base" : "h-10 w-10 text-lg"}
                    ${isOn ? "bg-primary/20" : "bg-muted group-hover:bg-primary/10"}
                  `}
                >
                  <span aria-hidden>{intent.emoji}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`font-bold leading-tight ${compact ? "text-[13px]" : "text-sm"}`}>
                    {intent.label}
                  </p>
                  {!compact && (
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                      {intent.blurb}
                    </p>
                  )}
                </div>
              </div>
              {isOn && (
                <span className="absolute top-2 right-2 h-4 w-4 rounded-full bg-energy flex items-center justify-center" aria-hidden>
                  <Check className="h-2.5 w-2.5 text-energy-foreground" strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="text-[10px] text-muted-foreground text-center">
        Pick up to {INTENT_MAX} • {selected.length}/{INTENT_MAX} selected
      </p>
    </div>
  );
};
