import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Briefcase, Star, Zap, DollarSign, Shield, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { CreditVerificationPanel } from "@/components/profile/CreditVerificationPanel";

import { ReviewsSection } from "@/components/profile/ReviewsSection";
import { CoSignsSection } from "@/components/profile/CoSignsSection";
import { SkillsSection } from "@/components/profile/SkillsSection";
import { ICDBTimeline } from "@/components/profile/ICDBTimeline";
import { WorkWithMeSection } from "@/components/profile/WorkWithMeSection";
import { RateCardSection } from "@/components/profile/RateCardSection";
import { AvailabilityCalendarSection } from "@/components/profile/AvailabilityCalendarSection";
import { BookingWindowsCard } from "@/components/profile/BookingWindowsCard";
import { CreditsSection } from "@/components/profile/CreditsSection";
import { HireMeTrustBar } from "@/components/passport/HireMeTrustBar";

import { SubscriptionTier } from "@/lib/subscriptionLimits";

interface ProfileContentSectionsProps {
  profile: any;
  portfolioItems: any[];
  reviews: any[];
  industryStats: any[];
  credits: any[];
  userTier: SubscriptionTier;
  hasAdvancedProfile: boolean;
  onRefresh: () => void;
}

// Stamps surfaced first — proof of work is the primary signal on Passport.
// "Co-signs" is evidence status on specific credits (classifyCreditEvidence);
// "Reviews" is the separate star-rating testimonial system — these used to
// share the "Co-signs" label on one tab pointing at the testimonial data,
// which is exactly why they're split here.
const PROFILE_TABS = [
  { id: "stamps", label: "Stamps", icon: Shield },
  { id: "hire", label: "Book Me", icon: DollarSign },
  { id: "skills", label: "Skills", icon: Zap },
  { id: "cosigns", label: "Co-signs", icon: ShieldCheck },
  { id: "reviews", label: "Reviews", icon: Star },
] as const;

type TabId = typeof PROFILE_TABS[number]["id"];

export const ProfileContentSections = ({
  profile,
  portfolioItems,
  reviews,
  industryStats,
  credits,
  userTier,
  hasAdvancedProfile,
  onRefresh,
}: ProfileContentSectionsProps) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>("stamps");
  const tabsRef = useRef<HTMLDivElement>(null);
  const [isTabBarSticky, setIsTabBarSticky] = useState(false);
  const tabBarSentinelRef = useRef<HTMLDivElement>(null);

  // Sticky detection
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

  // Auto-scroll active tab pill into view
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
      case "stamps":
        return (
          <CreditsSection
            userId={profile.user_id}
            isOwnProfile={true}
            onRefresh={onRefresh}
          />
        );

      case "hire":
        return (
          <>
            <div className="mb-4">
              <h3 className="text-sm font-bold">Book Me</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                How people book and hire you — availability, rates, and the services you offer.
              </p>
            </div>
            <HireMeTrustBar
              userId={profile.user_id}
              avgResponseHours={profile.avg_response_hours}
              hourlyRate={profile.hourly_rate}
              projectRate={profile.project_rate}
              rateCurrency={profile.rate_currency}
              collabIntent={profile.collab_intent}
              className="mb-4"
            />
            <AvailabilityCalendarSection userId={profile.user_id} isOwner={true} />
            <BookingWindowsCard
              userId={profile.user_id}
              username={profile.username ?? null}
              bookingsEnabled={!!profile.bookings_enabled}
            />
            <RateCardSection userId={profile.user_id} isOwner={true} />
            <WorkWithMeSection userId={profile.user_id} isOwner={true} creatorName={profile.full_name} />
          </>
        );


      case "skills":
        return (
          <SkillsSection
            professionalSkills={Array.isArray(profile.professional_skills) ? profile.professional_skills as any : []}
            passionSkills={Array.isArray(profile.passion_skills) ? profile.passion_skills as any : []}
            jobTitle={profile.job_title}
            industry={profile.industry}
            isOwnProfile={true}
            userId={profile.user_id}
            onRefresh={onRefresh}
          />
        );

      case "cosigns":
        return (
          <CoSignsSection
            credits={credits || []}
            userId={profile.user_id}
          />
        );

      case "reviews":
        return (
          <ReviewsSection
            reviews={reviews}
            isOwnProfile={true}
            profileUserId={profile.user_id}
            onRefresh={onRefresh}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div>
      {/* Pending verification requests */}
      <CreditVerificationPanel userId={profile.user_id} />

      {/* Auto-imported credits review now lives in DiscoveriesInbox at the top of /profile */}


      {/* Sentinel for sticky detection */}
      <div ref={tabBarSentinelRef} className="h-0" />

      {/* Tab Bar — mobile */}
      <div
        className={cn(
          "md:hidden z-40 -mx-3 px-3 transition-all duration-200",
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
          {PROFILE_TABS.map((tab) => {
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
      <div className="hidden md:flex gap-2 mb-6 flex-wrap">
        {PROFILE_TABS.map((tab) => {
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

      {/* Active tab content — renders in-place, no scrolling needed */}
      <div className="min-h-[200px]">
        {renderTabContent()}
      </div>
    </div>
  );
};
