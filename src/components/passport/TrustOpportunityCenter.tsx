import { PassportMomentum } from "./PassportMomentum";
import { ThriveRemembersChip } from "./ThriveRemembersChip";
import { RecentlyWorkedWith } from "./RecentlyWorkedWith";
import { SectionCard } from "@/components/ui/section-card";

interface TrustOpportunityCenterProps {
  userId: string;
  className?: string;
}

/**
 * Trust & Opportunity Center — the SECOND (and last) post-Passport block.
 * One shared card shell around what used to be three separate top-level
 * mounts (PassportMomentum, RecentlyWorkedWith, ThriveRemembersChip). Each
 * inner piece keeps its own real data-fetching and already-correct
 * self-hiding-when-empty behavior — only the outer shell changed, so no
 * data or capability is touched here.
 */
export function TrustOpportunityCenter({ userId, className }: TrustOpportunityCenterProps) {
  return (
    <SectionCard
      title="Trust & Opportunity"
      subtitle="Recent momentum, who you've worked with, and what Kreto remembers — fills in as it happens."
      gap="3"
      className={className}
    >
      <PassportMomentum />
      <RecentlyWorkedWith userId={userId} />
      <ThriveRemembersChip />
    </SectionCard>
  );
}

export default TrustOpportunityCenter;
