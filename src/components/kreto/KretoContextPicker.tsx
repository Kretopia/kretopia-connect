import { useState } from "react";
import { ChevronDown, Eye } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  CONTEXT_SECTION_HINT,
  CONTEXT_SECTION_LABEL,
  KRETO_CONTEXT_SECTIONS,
  contextChoiceLabel,
  type KretoContextChoice,
  type KretoContextSection,
} from "@/lib/kretoContext";
import { cn } from "@/lib/utils";
import { COMPOSER_CHIP } from "@/components/kreto/composerStyles";

interface KretoContextPickerProps {
  choice: KretoContextChoice;
  onChange: (choice: KretoContextChoice) => void;
  disabled?: boolean;
}

/**
 * What Kreto can see for the next message. Auto sends what the message is about and a short summary of the rest; "only
 * what I choose" shares the ticked parts and nothing else. Memory can be switched off: then Kreto neither uses nor
 * learns from it. The server enforces all of it; this only asks.
 */
export function KretoContextPicker({ choice, onChange, disabled }: KretoContextPickerProps) {
  const [open, setOpen] = useState(false);
  const chosen = Array.isArray(choice.context) ? choice.context : null;
  const label = `${contextChoiceLabel(choice)}${choice.memory ? "" : " · no memory"}`;

  const toggle = (section: KretoContextSection, on: boolean) => {
    const current = chosen ?? [];
    const next = on ? [...current, section] : current.filter((s) => s !== section);
    onChange({ ...choice, context: KRETO_CONTEXT_SECTIONS.filter((s) => next.includes(s)) });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={`What Kreto can see: ${label}. Change`}
          className={COMPOSER_CHIP}
        >
          <Eye className="h-3 w-3" aria-hidden />
          {label}
          <ChevronDown className="h-3 w-3" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-3 p-3">
        <div>
          <p className="text-xs font-semibold text-foreground">What Kreto can see</p>
          <p className="text-[11px] text-muted-foreground">For your next messages. Your name and role are always included.</p>
        </div>
        <div role="radiogroup" aria-label="What Kreto can see" className="space-y-1">
          {[
            { auto: true, title: "Auto", body: "What your message is about, and a short summary of the rest." },
            { auto: false, title: "Only what I choose", body: "Nothing else is shared." },
          ].map((o) => {
            const selected = o.auto ? chosen === null : chosen !== null;
            return (
              <button
                key={o.title}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChange({ ...choice, context: o.auto ? "auto" : chosen ?? [] })}
                className={cn(
                  "w-full rounded-lg border px-2.5 py-2 text-left transition-colors",
                  selected ? "border-primary bg-primary/10" : "border-border hover:bg-muted",
                )}
              >
                <span className="block text-xs font-semibold text-foreground">{o.title}</span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">{o.body}</span>
              </button>
            );
          })}
        </div>
        {chosen !== null && (
          <fieldset className="space-y-1.5">
            <legend className="sr-only">Parts Kreto can see</legend>
            {KRETO_CONTEXT_SECTIONS.map((s) => (
              <label key={s} className="flex cursor-pointer items-start gap-2 rounded-md px-1 py-1 hover:bg-muted">
                <Checkbox checked={chosen.includes(s)} onCheckedChange={(v) => toggle(s, v === true)} aria-label={CONTEXT_SECTION_LABEL[s]} className="mt-0.5" />
                <span>
                  <span className="block text-xs font-semibold text-foreground">{CONTEXT_SECTION_LABEL[s]}</span>
                  <span className="block text-[11px] text-muted-foreground">{CONTEXT_SECTION_HINT[s]}</span>
                </span>
              </label>
            ))}
          </fieldset>
        )}
        <label className="flex cursor-pointer items-center justify-between gap-3 border-t border-border pt-3">
          <span>
            <span className="block text-xs font-semibold text-foreground">Use what I remember</span>
            <span className="block text-[11px] text-muted-foreground">Off: I don't use or learn from memory in these messages.</span>
          </span>
          <Switch checked={choice.memory} onCheckedChange={(v) => onChange({ ...choice, memory: v })} aria-label="Use what Kreto remembers" />
        </label>
      </PopoverContent>
    </Popover>
  );
}

export default KretoContextPicker;
