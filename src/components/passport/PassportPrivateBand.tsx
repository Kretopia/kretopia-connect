import type { ReactNode } from "react";

/**
 * What only the owner sees on their Passport (Kreto's entry, the Passport intelligence, the press to confirm, the reach), as a band of
 * its own under the shared document: its blocks sit side by side instead of stacked in the narrow card, and the dashed rule and the
 * label say it is private. The page that owns the data passes the blocks; this only lays them out.
 */
export function PassportPrivateBand({ children }: { children: ReactNode }) {
  return (
    <section aria-label="Only you see this" className="border-t border-dashed border-border pt-6">
      <p className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Only you see this</p>
      {/* min-w-0: a grid item will not shrink below its content by itself, and the frame clips what overflows it (a phone showed blocks 42px wider than the page). */}
      <div className="grid items-start gap-6 md:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">{children}</div>
    </section>
  );
}

export default PassportPrivateBand;
