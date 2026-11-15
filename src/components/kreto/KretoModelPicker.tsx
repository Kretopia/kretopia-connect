import { useState } from "react";
import { ChevronDown, Gauge, Layers, Sparkles, Zap } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SegmentToggle } from "@/components/features/SegmentToggle";
import {
  KRETO_EFFORTS,
  KRETO_MODELS,
  SHOW_PAID_TAGS,
  kretoEffortLabel,
  kretoModelName,
  sharePctLabel,
  type KretoChoice,
  type KretoEffort,
} from "@/lib/kretoProfiles";
import type { KretoRouteInfo } from "@/lib/thriveCopilot";
import { cn } from "@/lib/utils";

const EFFORT_ICON = { 1: Zap, 2: Gauge, 3: Layers, 4: Sparkles } as const;

interface KretoModelPickerProps {
  choice: KretoChoice;
  onChange: (choice: KretoChoice) => void;
  disabled?: boolean;
  /** Rough share of what is left today the next message will take (previewShare). */
  previewShare: number | null;
  /** What answered the last message, if the server said. */
  lastRoute: KretoRouteInfo | null;
}

/**
 * The Kreto model and effort for the next message, always visible above the composer with what it will roughly cost,
 * and one place to change either. Auto never picks a pricier model than the effort allows; a deeper pass is offered
 * (never taken) when the last answer could have used one.
 */
export function KretoModelPicker({ choice, onChange, disabled, previewShare, lastRoute }: KretoModelPickerProps) {
  const [open, setOpen] = useState(false);
  const effort = KRETO_EFFORTS.find((e) => e.level === choice.effort) ?? KRETO_EFFORTS[1];
  const suggest = lastRoute?.suggestEffort && lastRoute.suggestEffort > choice.effort ? (lastRoute.suggestEffort as KretoEffort) : null;

  return (
    <div className="space-y-1 px-3 pt-2" data-testid="kreto-model-picker">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              aria-label={`Kreto model and effort: ${kretoModelName(choice.profile)}, ${effort.label}. Change`}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              {kretoModelName(choice.profile)} · {effort.label}
              <ChevronDown className="h-3 w-3" aria-hidden />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 space-y-3 p-3">
            <div>
              <p className="text-xs font-semibold text-foreground">Kreto model</p>
              <p className="text-[11px] text-muted-foreground">Same Kreto, tuned for the job. Faster or deeper, your call.</p>
            </div>
            <div role="radiogroup" aria-label="Kreto model" className="max-h-64 space-y-1 overflow-y-auto pr-1">
              {KRETO_MODELS.map((m) => {
                const selected = m.id === choice.profile;
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={!m.available}
                    onClick={() => onChange({ ...choice, profile: m.id })}
                    className={cn(
                      "w-full rounded-lg border px-2.5 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                      selected ? "border-primary bg-primary/10" : "border-border hover:bg-muted",
                    )}
                  >
                    <span className="flex items-center justify-between gap-2 text-xs font-semibold text-foreground">
                      {m.name}
                      {!m.available ? (
                        <span className="text-[10px] font-normal text-muted-foreground">{m.unavailableReason}</span>
                      ) : SHOW_PAID_TAGS && m.paid ? (
                        <span className="text-[10px] font-normal text-muted-foreground">Paid plans</span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">{m.description}</span>
                  </button>
                );
              })}
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-foreground">Effort</p>
              <SegmentToggle
                value={String(choice.effort) as "1" | "2" | "3" | "4"}
                onChange={(v) => onChange({ ...choice, effort: Number(v) as KretoEffort })}
                label="Effort"
                options={KRETO_EFFORTS.map((e) => ({ value: String(e.level) as "1" | "2" | "3" | "4", label: e.label, icon: EFFORT_ICON[e.level] }))}
              />
              <p className="text-[11px] text-muted-foreground">{effort.description}</p>
            </div>
          </PopoverContent>
        </Popover>
        {previewShare !== null && (
          <span className="text-[11px] text-muted-foreground" data-testid="kreto-estimate">
            About {sharePctLabel(previewShare)} of what's left today
          </span>
        )}
      </div>
      {lastRoute?.notice && <p className="text-[11px] text-muted-foreground">{lastRoute.notice}</p>}
      {suggest && (
        <p className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          A {kretoEffortLabel(suggest)} pass would cover that fully.
          <button
            type="button"
            onClick={() => onChange({ ...choice, effort: suggest })}
            className="rounded-full border border-border px-2 py-0.5 font-semibold text-foreground hover:bg-muted"
          >
            Switch to {kretoEffortLabel(suggest)}
          </button>
        </p>
      )}
    </div>
  );
}

export default KretoModelPicker;
