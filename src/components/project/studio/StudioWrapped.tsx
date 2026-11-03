import type { ReactNode } from "react";

import { KretoScene } from "@/components/brand/KretoScene";
import { WrappedShell } from "@/components/wrapped/WrappedShell";
import { WrappedStatus } from "@/components/wrapped/WrappedStatus";

interface StudioWrappedProps {
  /** Real count of the person's Projects. */
  projectCount: number;
  /** How many of them are not delivered yet. */
  activeCount: number;
  /** Above the shelf, inside the frame: the person's pending invitations (and a company's workspace actions). */
  aboveProjects?: ReactNode;
  /** Beside the Projects heading: the folder filter. */
  projectControls?: ReactNode;
  /** "Projects": the shelf (StudioProjectsDashboard). */
  projects: ReactNode;
}

/**
 * Studio's Projects on one Wrapped surface: the same frame as Today's Radar
 * and Scout's top section (grid, soft light, HUD corners, eyebrow, gradient
 * title, one status line). "Right now" and its Sound Stage and Quick actions
 * entries are gone from Studio by decision; what stays above the shelf is
 * what the person has to act on (invitations) and the shelf's own filter.
 *
 * It owns only the frame and the counts it states.
 */
export function StudioWrapped({ projectCount, activeCount, aboveProjects, projectControls, projects }: StudioWrappedProps) {
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
      {aboveProjects}

      <section aria-labelledby="studio-projects-title" className="border-t border-border pt-5 first:border-t-0 first:pt-0 sm:pt-6 sm:first:pt-0">
        <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
          <h3 id="studio-projects-title" className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
            Projects
          </h3>
          {projectControls}
        </div>
        {projects}
      </section>
    </WrappedShell>
  );
}

export default StudioWrapped;
