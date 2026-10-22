import { Sparkles } from "lucide-react";
import type { DraftOrigin, OriginRow } from "@/lib/projectDraft";

const GROUPS = [
  { key: "you", title: "From you" },
  { key: "kreto", title: "Suggested by Kreto" },
  { key: "missing", title: "Still missing" },
] as const;

const text = (row: OriginRow) => `${row.label}${row.value ? `: ${row.value}` : ""}`;

/**
 * Where each part of the draft comes from, so a suggested budget, date or task is never read as something the person
 * said. It updates as they edit: a value they type moves to "From you". Groups with nothing in them are left out.
 */
export function DraftOriginPanel({ origin }: { origin: DraftOrigin }) {
  const groups = GROUPS.filter((g) => origin[g.key].length > 0);
  return (
    <section aria-labelledby="draft-origin-title" className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
      <h3 id="draft-origin-title" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Where this draft comes from
      </h3>
      <dl className="space-y-2">
        {groups.map((g) => (
          <div key={g.key} className="space-y-1">
            <dt className="flex items-center gap-1 text-[11px] font-semibold text-foreground">
              {g.key === "kreto" && <Sparkles className="h-3 w-3 shrink-0" style={{ color: "hsl(var(--energy))" }} aria-hidden />}
              {g.title}
            </dt>
            <dd>
              <ul className="flex flex-wrap gap-1.5" aria-label={g.title}>
                {origin[g.key].map((row) => (
                  <li key={row.id} className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
                    {text(row)}
                    {row.required && <>{" "}<span className="font-semibold text-destructive">(required)</span></>}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default DraftOriginPanel;
