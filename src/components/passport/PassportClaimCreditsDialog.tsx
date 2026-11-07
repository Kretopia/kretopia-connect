import { BadgeCheck, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ClaimableProject } from "@/lib/passport/claimableProjects";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  firstName: string;
  /** The projects this Passport lists (see claimableProjects): the contributions a collaborator could have a role on. */
  projects: ClaimableProject[];
  /** Opens the project's own page, where its roles are listed and the claim itself is made and confirmed. */
  onChoose: (project: ClaimableProject) => void;
}

/**
 * Claim Credits, on somebody else's Passport. It never claims anything about this Passport: it asks which of its projects the visitor
 * worked on, then opens that project, where the roll call lists its roles and a claim is made, left pending, and confirmed by the person
 * or company concerned. Nothing here writes to a record.
 */
export function PassportClaimCreditsDialog({ open, onOpenChange, firstName, projects, onChoose }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Claim a credit</DialogTitle>
          <DialogDescription>
            Worked on one of {firstName}'s projects? Choose it to see who is credited and claim your own role. A claim stays pending until the
            person or company concerned confirms it.
          </DialogDescription>
        </DialogHeader>

        {projects.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
            {firstName} has no projects listed yet, so there is nothing to claim a role on from here.
          </p>
        ) : (
          <ul className="max-h-[50dvh] space-y-1.5 overflow-y-auto pr-1" aria-label={`${firstName}'s projects`}>
            {projects.map((project) => (
              <li key={project.id}>
                <button
                  type="button"
                  onClick={() => onChoose(project)}
                  className="flex w-full items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <BadgeCheck className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{project.name}</span>
                    {(project.role || project.year) && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {[project.role, project.year].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default PassportClaimCreditsDialog;
