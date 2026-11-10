import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { HiringGlance } from "@/lib/passport/hiringGlance";

interface PassportHiringGlanceProps {
  glance: HiringGlance;
  firstName: string;
  className?: string;
  /**
   * What a visitor can do with this Passport (Message, Start a project, Claim Credits), drawn in place of the credits figures this block
   * used to repeat. Passed on somebody else's Passport only: the owner can take none of them on oneself.
   */
  actions?: ReactNode;
  /**
   * The owner's edit actions for what this block summarises, passed only on the private Passport (for example, manage the credits).
   * The roles a person is credited as are no longer a line of text here: each credit states its own role in its detail.
   */
  ownerActions?: ReactNode;
}

/**
 * "At a glance": how long this person has been working, and what you can do next. The credits themselves (how many, how many are
 * confirmed, the strongest ones and the legend for their proof) are not repeated here: the Kretopia credits section is the one place
 * the record is listed. Only facts the Passport holds -- a missing figure is left out, never estimated -- and a block with nothing to
 * say is not drawn.
 */
export function PassportHiringGlance({ glance, firstName, className, actions, ownerActions }: PassportHiringGlanceProps) {
  const since =
    glance.sinceYear !== null && glance.yearsActive !== null
      ? {
          value: String(glance.sinceYear),
          sub: glance.yearsActive === 0 ? "first credit this year" : `${glance.yearsActive} yr${glance.yearsActive === 1 ? "" : "s"} since first credit`,
        }
      : null;

  if (!since && !actions && !ownerActions) return null;

  return (
    <section className={cn("space-y-3", className)} aria-label={`${firstName} at a glance`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">At a glance</p>

      {since && (
        <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5">
          <div className="text-lg font-black leading-none">{since.value}</div>
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Since</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">{since.sub}</div>
        </div>
      )}

      {actions}
      {ownerActions}
    </section>
  );
}

export default PassportHiringGlance;
