import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export interface EventOptionRowData {
  id: string;
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  action: ReactNode;
}

interface EventOptionsListProps {
  rows: EventOptionRowData[];
}

export function EventOptionsList({ rows }: EventOptionsListProps) {
  return (
    <section aria-label="Event options">
      <h2 className="sr-only">Event options</h2>
      <dl className="divide-y divide-border border-y border-border">
        {rows.map(({ id, label, value, icon: Icon, action }) => (
          <div
            key={id}
            data-option-row={id}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 py-3"
          >
            <dt className="flex min-w-0 items-center gap-2 font-medium">
              <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span className="truncate">{label}</span>
            </dt>
            <dd className="min-w-0 break-words text-sm text-muted-foreground">{value}</dd>
            <div className="flex items-center justify-end gap-1.5 whitespace-nowrap text-right">{action}</div>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default EventOptionsList;
