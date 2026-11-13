import { Button } from "@/components/ui/button";

export interface SegmentToggleOption<T extends string> {
  value: T;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

/**
 * A pill-shaped two-or-more-way switch for two views that share one tab (Match's Browse: deck or grid; Connected:
 * accepted connections or who is interested). Same visual convention as the Gigs feed switch
 * (GigsViewToggle): the active segment uses the glass system's `default` Button variant, never `bg-primary`
 * painted over ghost, because `.btn-glass` already resolves the right ink colour for both themes.
 */
export function SegmentToggle<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<SegmentToggleOption<T>>;
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex items-center gap-1 rounded-full border border-foreground/[0.08] bg-foreground/[0.05] p-1 backdrop-blur-sm"
    >
      {options.map(({ value: option, label: text, icon: Icon }) => (
        <Button
          key={option}
          type="button"
          size="sm"
          variant={value === option ? "default" : "ghost"}
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold"
        >
          <Icon className="h-3.5 w-3.5" />
          {text}
        </Button>
      ))}
    </div>
  );
}

export default SegmentToggle;
