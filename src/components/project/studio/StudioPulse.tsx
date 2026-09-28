import { Radio, FolderOpen, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { SpeedTonightCard } from "@/components/home/SpeedTonightCard";
import { TodayStrip } from "@/components/desk/TodayStrip";
import { MyPendingInvitations } from "@/components/project/MyPendingInvitations";
import { StudioActivitySummary } from "@/components/project/studio/StudioActivitySummary";

interface Collaborator {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: string | null;
}

interface StudioPulseProps {
  recentCollaborators: Collaborator[];
  folderCount?: number;
  projectCount?: number;
  folderControls?: ReactNode;
  onVoice: () => void;
  onCommandPalette: () => void;
  onWrapWeek: () => void;
}

/**
 * StudioPulse — "Right now", immediately below the Studio header. CEO
 * hotfix (24/09/2026): Sound Stage/Crew/Casting/Recordings used to each
 * render fully expanded (rail, carousel, or a multi-line empty state) even
 * when most had nothing to show -- StudioActivitySummary condenses those
 * four to one status line each, collapsed by default. SpeedTonightCard,
 * pending invitations and the contextual quick-actions strip are unrelated
 * to that verbosity report and are unchanged below.
 */
export function StudioPulse({ recentCollaborators, folderCount = 0, projectCount = 0, folderControls, onVoice, onCommandPalette, onWrapWeek }: StudioPulseProps) {
  return (
    <section aria-labelledby="studio-pulse-title" className="overflow-hidden rounded-lg border border-border bg-card px-4 py-3 sm:px-5">
      <div className="flex items-center gap-2">
        <Radio className="h-4 w-4 text-[hsl(var(--energy))]" aria-hidden />
        <h2 id="studio-pulse-title" className="text-[13px] font-semibold tracking-wide uppercase text-muted-foreground">
          Right now
        </h2>
      </div>

      <div className="mt-2"><SpeedTonightCard compact /></div>

      <div className="mt-2 border-t border-border/70">
        <StudioActivitySummary recentCollaborators={recentCollaborators} />
      </div>

      <div className="border-t border-border/70">
        <MyPendingInvitations compact />
      </div>

      <div className="flex min-w-0 items-center gap-2 border-t border-border/70 py-2 text-sm">
          <FolderOpen className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span className="font-semibold">Folders</span>
          <span className="min-w-0 flex-1 truncate text-muted-foreground">{folderCount} · {projectCount} projects</span>
          {folderControls}
      </div>

      <details className="group border-t border-border/70">
        <summary className="flex cursor-pointer list-none items-center gap-2 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <Radio className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span className="min-w-0 flex-1 font-semibold">Quick actions</span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden />
        </summary>
        <div className="pb-2"><TodayStrip onVoice={onVoice} onCommandPalette={onCommandPalette} onWrapWeek={onWrapWeek} /></div>
      </details>
    </section>
  );
}

export default StudioPulse;
