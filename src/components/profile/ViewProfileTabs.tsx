import { useState, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Briefcase, Star, Award, Zap, Handshake, DollarSign } from "lucide-react";
import { ICDBTimeline } from "@/components/profile/ICDBTimeline";
import { ReviewsSection } from "@/components/profile/ReviewsSection";
import { SkillsSection } from "@/components/profile/SkillsSection";
import { PressLinksSection } from "@/components/profile/PressLinksSection";
import { AwardsSection } from "@/components/profile/AwardsSection";
import { CollaborationHistory } from "@/components/profile/CollaborationHistory";
import { WorkWithMeSection } from "@/components/profile/WorkWithMeSection";
import { RateCardSection } from "@/components/profile/RateCardSection";
import { AvailabilityCalendarSection } from "@/components/profile/AvailabilityCalendarSection";
import { SocialStatsSection } from "@/components/profile/SocialStatsSection";
import { TrustSignals } from "@/components/profile/TrustSignals";
import { AchievementBadges } from "@/components/profile/AchievementBadges";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

/** Wrapper that shows an empty state when the creator has no services */
const HireTabContent = ({ userId, creatorName }: { userId: string; creatorName?: string }) => {
  const [hasContent, setHasContent] = useState<boolean | null>(null);

  useEffect(() => {
    const check = async () => {
      const [servicesRes, productsRes] = await Promise.all([
        supabase.from('creator_services').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('is_active', true),
        supabase.from('digital_products').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('is_active', true),
      ]);
      setHasContent(((servicesRes.count ?? 0) + (productsRes.count ?? 0)) > 0);
    };
    check();
  }, [userId]);

  if (hasContent === null) return <div className="text-center py-8 text-muted-foreground text-sm">Loading...</div>;

  return (
    <>
      <AvailabilityCalendarSection userId={userId} isOwner={false} />
      <RateCardSection userId={userId} isOwner={false} />
      {hasContent ? (
        <WorkWithMeSection userId={userId} isOwner={false} creatorName={creatorName} />
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <DollarSign className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{creatorName?.split(' ')[0] || 'This creator'} hasn't listed any services yet</p>
        </div>
      )}
    </>
  );
};

const VIEW_TABS = [
  { id: "work", label: "Credits", icon: Briefcase },
  { id: "hire", label: "Work With Me", icon: DollarSign },
  { id: "skills", label: "Skills", icon: Zap },
  { id: "reviews", label: "Reviews", icon: Star },
  { id: "more", label: "More", icon: Award },
] as const;

type TabId = typeof VIEW_TABS[number]["id"];

interface ViewProfileTabsProps {
  profile: any;
  portfolioItems: any[];
  reviews: any[];
  credits: any[];
  awards: any[];
  userId: string;
  isMatched: boolean;
  connectionStatus: string;
  onRefresh: () => void;
}

export const ViewProfileTabs = ({
  profile,
  portfolioItems,
  reviews,
  credits,
  awards,
  userId,
  isMatched,
  connectionStatus,
  onRefresh,
}: ViewProfileTabsProps) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>("work");
  const tabsRef = useRef<HTMLDivElement>(null);
  const [isTabBarSticky, setIsTabBarSticky] = useState(false);
  const tabBarSentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = tabBarSentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsTabBarSticky(!entry.isIntersecting),
      { threshold: 0, rootMargin: "-1px 0px 0px 0px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const container = tabsRef.current;
    if (!container) return;
    const activeBtn = container.querySelector(`[data-tab="${activeTab}"]`) as HTMLElement;
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [activeTab]);

  const renderTabContent = () => {
    switch (activeTab) {
      case "work":
        return (
          <ICDBTimeline userId={userId} isOwnProfile={false} onRefresh={onRefresh} />
        );

      case "hire":
        return (
          <HireTabContent userId={userId} creatorName={profile?.full_name} />
        );

      case "skills": {
        const proSkills = Array.isArray(profile.professional_skills) ? profile.professional_skills : [];
        const pasSkills = Array.isArray(profile.passion_skills) ? profile.passion_skills : [];
        const hasSkills = proSkills.length > 0 || pasSkills.length > 0;
        
        if (!hasSkills) {
          return (
            <div className="text-center py-8 text-muted-foreground">
              <Zap className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No skills listed yet</p>
            </div>
          );
        }
        
        return (
          <div className="space-y-6">
            <SkillsSection
              professionalSkills={Array.isArray(profile.professional_skills) ? profile.professional_skills : []}
              passionSkills={Array.isArray(profile.passion_skills) ? profile.passion_skills : []}
              jobTitle={profile.job_title}
              industry={profile.industry}
              isOwnProfile={false}
              userId={userId}
              onRefresh={onRefresh}
            />
            <SocialStatsSection
              youtubeSubscribers={profile.youtube_subscribers}
              instagramFollowers={profile.instagram_followers}
              tiktokFollowers={profile.tiktok_followers}
              spotifyListeners={profile.spotify_listeners}
              twitterFollowers={profile.twitter_followers}
              linkedinConnections={profile.linkedin_connections}
              youtubeUrl={profile.youtube_url}
              instagramUrl={profile.instagram_url}
              tiktokUrl={profile.tiktok_url}
              spotifyUrl={profile.spotify_url}
              twitterUrl={profile.twitter_url}
              linkedinUrl={profile.linkedin_url}
              verifiedMetrics={profile.social_verified}
            />
          </div>
        );
      }

      case "reviews":
        return reviews.length > 0 ? (
          <ReviewsSection
            reviews={reviews}
            isOwnProfile={false}
            profileUserId={userId}
            onRefresh={onRefresh}
          />
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Star className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No reviews yet</p>
          </div>
        );

      case "more":
        return (
          <div className="space-y-8">
            {/* Collaboration History */}
            <div>
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Handshake className="h-5 w-5 text-primary" />
                Collaboration History
              </h2>
              <CollaborationHistory userId={userId} isOwnProfile={false} viewerUserId={user?.id} />
            </div>

            {/* Press & Awards */}
            <div className="space-y-6">
              {profile.achievement_badges?.length > 0 && (
                <AchievementBadges achievements={profile.achievement_badges} showAll />
              )}
              <div className="grid gap-6 grid-cols-1 sm:grid-cols-2">
                <div>
                  <h3 className="font-semibold mb-3">Press Coverage</h3>
                  <PressLinksSection userId={userId} isOwnProfile={false} onRefresh={onRefresh} />
                </div>
                <div>
                  <h3 className="font-semibold mb-3">Awards</h3>
                  <AwardsSection userId={userId} isOwnProfile={false} onRefresh={onRefresh} />
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      {/* Sentinel for sticky detection */}
      <div ref={tabBarSentinelRef} className="h-0" />

      {/* Tab Bar — mobile */}
      <div
        className={cn(
          "md:hidden z-40 -mx-4 px-4 transition-all duration-200",
          isTabBarSticky
            ? "sticky top-[56px] bg-background border-b border-border py-2 shadow-sm"
            : "py-2"
        )}
      >
        <div
          ref={tabsRef}
          className="flex gap-1.5 overflow-x-auto pb-1"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {VIEW_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                data-tab={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Bar — desktop */}
      <div className="hidden md:flex gap-2 mb-6 flex-wrap mt-4">
        {VIEW_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Active tab content */}
      <div className="min-h-[200px] rounded-xl border bg-card p-4 sm:p-6 shadow-sm mb-6">
        {renderTabContent()}
      </div>
    </>
  );
};
