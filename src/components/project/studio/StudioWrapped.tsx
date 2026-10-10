import type { ReactNode } from "react";

import { KretoScene } from "@/components/brand/KretoScene";
import { WrappedShell } from "@/components/wrapped/WrappedShell";
import { WrappedStatus } from "@/components/wrapped/WrappedStatus";

interface StudioWrappedProps {
  /** Real count of the person's Projects. */
  projectCount: number;
  /** How many of them are not delivered yet. */
  activeCount: number;
  /** "Right now": the live strip (StudioPulse in its "wrapped" variant). */
  rightNow: ReactNode;
  /** "Projects": the shelf (StudioProjectsDashboard). */
  projects: ReactNode;
}

/**
 * Studio's two working blocks, "Right now" and "Projects", on one Wrapped
 * surface: the same frame as Today's Radar and Scout's top section (grid,
 * soft light, HUD corners, eyebrow, gradient title, one status line), with
 * the two blocks as its two sections.
 *
 * It owns only the frame and the counts it states; what each block shows,
 * and where that comes from, is unchanged.
 */
export function StudioWrapped({ projectCount, activeCount, rightNow, projects }: StudioWrappedProps) {
  const status =
    projectCount === 0
      ? "No Projects yet"
      : `${projectCount} Project${projectCount === 1 ? "" : "s"} · ${activeCount} in progress`;

  return (
    <WrappedShell
      titleId="studio-wrapped-title"
      eyebrow="Kretopia · Studio"
      title={
        <>
          Everything in your <span className="k-gradient-text">Studio</span>
        </>
      }
      status={<WrappedStatus active={projectCount > 0} label={status} />}
      aside={<KretoScene scene="workspace" size="thumb" className="hidden h-16 w-32 shrink-0 rounded-xl border border-border sm:block" />}
    >
      {rightNow}

      <section aria-labelledby="studio-projects-title" className="border-t border-border pt-5 sm:pt-6">
        <h3 id="studio-projects-title" className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
          Projects
        </h3>
        {projects}
      </section>
    </WrappedShell>
  );
}

export default StudioWrapped;
