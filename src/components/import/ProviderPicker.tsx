import { Check, ChevronRight, Lock } from "lucide-react";
import { COMING_SOON, IMPORT_PROVIDERS, type ProviderId } from "@/lib/studioImport";
import { cn } from "@/lib/utils";

interface Props {
  value: ProviderId | null;
  connected: string[];
  onSelect: (id: ProviderId) => void;
}

export const ProviderPicker = ({ value, connected, onSelect }: Props) => (
  <div className="space-y-4">
    <div className="grid gap-2.5 sm:grid-cols-2">
      {IMPORT_PROVIDERS.map((p) => {
        const isConnected = connected.includes(p.id);
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p.id)}
            className={cn(
              "group flex items-center gap-3 rounded-2xl border bg-card p-4 text-left transition-colors",
              value === p.id ? "border-primary ring-1 ring-primary/40" : "border-border hover:border-primary/50",
            )}
          >
            <span
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-black text-background"
              style={{ backgroundColor: `hsl(var(${p.accentVar}))` }}
              aria-hidden
            >
              {p.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-sm font-semibold">{p.name}</span>
                {isConnected && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    <Check className="h-2.5 w-2.5" /> connected
                  </span>
                )}
              </span>
              <span className="block truncate text-xs text-muted-foreground">{p.tagline}</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </button>
        );
      })}
    </div>

    <div className="rounded-2xl border border-dashed border-border p-4">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Lock className="h-3 w-3" /> More integrations coming
      </p>
      <p className="mt-1.5 text-xs text-muted-foreground">{COMING_SOON.join(" · ")}</p>
    </div>
  </div>
);
