import { AlertTriangle, ArrowRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DESTINATION_LABELS, SOURCE_LABELS, type ImportMapping } from "@/lib/studioImport";

interface Props {
  counts: Record<string, number>;
  warnings: string[];
  sourceName: string;
  mappings: ImportMapping[];
  onChange: (m: ImportMapping[]) => void;
}

const DESTINATIONS = [
  "project_tasks", "milestones", "project_notes", "project_messages",
  "project_files", "project_collaborators", "project_deliverables", "expenses", "skip",
];

export const MappingStep = ({ counts, warnings, sourceName, mappings, onChange }: Props) => {
  const objectMappings = mappings.filter((m) => m.source_field === "object");

  const update = (sourceType: string, destination: string) =>
    onChange(
      mappings.map((m) =>
        m.source_field === "object" && m.source_type === sourceType
          ? { ...m, destination_type: destination, enabled: destination !== "skip" }
          : m,
      ),
    );

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">We found in {sourceName}</p>
        <p className="mt-1 text-2xl font-black tracking-tight">{total.toLocaleString()} items</p>
        <ul className="mt-3 grid gap-1 sm:grid-cols-2">
          {Object.entries(counts).map(([k, v]) => (
            <li key={k} className="flex items-baseline gap-1.5 text-sm">
              <span className="font-semibold">{v.toLocaleString()}</span>
              <span className="text-muted-foreground">{(SOURCE_LABELS[k] ?? k).toLowerCase()}</span>
            </li>
          ))}
        </ul>
      </div>

      {warnings.length > 0 && (
        <div className="space-y-1.5 rounded-2xl border border-border bg-muted/40 p-4">
          {warnings.map((w, i) => (
            <p key={i} className="flex gap-2 text-xs text-muted-foreground">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {w}
            </p>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm font-semibold">Where should everything land?</p>
        <div className="space-y-2 rounded-2xl border border-border bg-card p-3">
          {objectMappings.map((m) => (
            <div key={m.source_type} className="flex items-center gap-2">
              <span className="w-28 shrink-0 truncate text-xs sm:w-40 sm:text-sm">
                {SOURCE_LABELS[m.source_type] ?? m.source_type}
                <span className="ml-1 text-muted-foreground">({counts[m.source_type] ?? 0})</span>
              </span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <Select value={m.destination_type ?? "skip"} onValueChange={(v) => update(m.source_type, v)}>
                <SelectTrigger className="h-9 flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DESTINATIONS.map((d) => (
                    <SelectItem key={d} value={d}>{DESTINATION_LABELS[d]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Change anything here before you confirm — this is the last stop before we bring it in.
        </p>
      </div>
    </div>
  );
};
