import { ProfileProvider, useProfileContext } from "@/contexts/ProfileContext";
import { useProfileData } from "@/hooks/useProfileData";
import { ProfileContentSections } from "@/pages/profile/ProfileContentSections";
import { DashboardPanel, CreditsPanelSkeleton } from "./CreditsPrimitives";
import { TIER_LIMITS, type SubscriptionTier } from "@/lib/subscriptionLimits";

/**
 * CreditsFullRecord — everything that used to live under the Passport
 * (Stamps · Book Me · Skills · Co-signs · Reviews) now lives here, inside
 * Credits. It runs on its own ProfileProvider so the dashboard stays a
 * standalone surface.
 */
function FullRecordInner({ index }: { index?: number }) {
  const { profile, portfolioItems, reviews, industryStats, credits, isLoading } = useProfileContext();
  const { fetchData } = useProfileData();

  const tier: SubscriptionTier = ((profile as any)?.subscription_tier as SubscriptionTier) || "free";

  return (
    <DashboardPanel id="record" eyebrow="05" title="Your full record" index={index}>
      {isLoading || !profile ? (
        <CreditsPanelSkeleton rows={4} />
      ) : (
        <div className="-mx-1">
          <ProfileContentSections
            profile={profile}
            portfolioItems={portfolioItems}
            reviews={reviews}
            industryStats={industryStats}
            credits={credits}
            userTier={tier}
            hasAdvancedProfile={TIER_LIMITS[tier].hasAdvancedProfile}
            onRefresh={fetchData}
          />
        </div>
      )}
    </DashboardPanel>
  );
}

export function CreditsFullRecord({ index }: { index?: number }) {
  return (
    <ProfileProvider>
      <FullRecordInner index={index} />
    </ProfileProvider>
  );
}

export default CreditsFullRecord;
