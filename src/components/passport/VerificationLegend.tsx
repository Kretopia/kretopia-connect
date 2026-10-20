import { VERIFICATION_LEGEND } from "@/lib/passport/creditEvidence";

/** What each word on a credit means, in one place, collapsed so it never crowds the list. */
export function VerificationLegend({ className }: { className?: string }) {
  return (
    <details className={className}>
      <summary className="cursor-pointer text-xs font-semibold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
        What do these statuses mean?
      </summary>
      <dl className="mt-2 space-y-2 rounded-xl border border-border bg-muted/30 p-3">
        {VERIFICATION_LEGEND.map((item) => (
          <div key={item.key}>
            <dt className="text-xs font-semibold text-foreground">{item.label}</dt>
            <dd className="text-xs leading-snug text-muted-foreground">{item.meaning}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
