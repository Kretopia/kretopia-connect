import { Radio } from "lucide-react";
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
export function StudioPulse({ recentCollaborators, onVoice, onCommandPalette, onWrapWeek }: StudioPulseProps) {
  return (
    <section aria-labelledby="studio-pulse-title" className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-5">
      <div className="flex items-center gap-2">
        <Radio className="h-4 w-4 text-[hsl(var(--energy))]" aria-hidden />
        <h2 id="studio-pulse-title" className="text-[13px] font-semibold tracking-wide uppercase text-muted-foreground">
          Right now
        </h2>
      </div>

      <SpeedTonightCard />

      <div className="border-t border-border pt-2">
        <StudioActivitySummary recentCollaborators={recentCollaborators} />
      </div>

      {/* Recent activity */}
      <div className="space-y-3 border-t border-border pt-4">
        <MyPendingInvitations />
      </div>

      {/* Contextual action */}
      <div className="border-t border-border pt-4">
        <TodayStrip onVoice={onVoice} onCommandPalette={onCommandPalette} onWrapWeek={onWrapWeek} />
      </div>
    </section>
  );
}

export default StudioPulse;
