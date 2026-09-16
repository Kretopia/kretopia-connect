/**
 * Subscription tier limits and feature gating
 * Supports both individual and company account types
 * 
 * Strategy: Free users get limited monthly uses of all features.
 * Pro users get generous limits. Creator Pro users get maximum limits.
 */

import type { AccountType } from "./subscriptionConfig";

export type SubscriptionTier = "free" | "pro" | "creator_pro" | "founder" | "brand_pro" | "brand_enterprise";

export interface TierLimits {
  swipesPerDay: number; // -1 = unlimited
  maxPortfolioItems: number; // -1 = unlimited
  canUndoSwipe: boolean;
  undoSwipesPerDay: number;
  canVerifyProfile: boolean;
  hasAIMatchExplanations: boolean;
  hasAdvancedFilters: boolean;
  hasAdvancedProfile: boolean; // Press links, credits, awards
  // Company-specific limits
  maxOpportunityPostings: number; // -1 = unlimited, per month
  hasApplicantTracking: boolean;
  hasBrandedPage: boolean;
  hasOpportunityAnalytics: boolean;
  hasPriorityListing: boolean;
  hasAITalentScout: boolean;
  // Creator Pro-specific
  hasCampaignAnalytics: boolean;
  hasScheduledSends: boolean;
}

/**
 * Free-tier monthly usage caps for previously hard-gated features.
 * -1 = unlimited. These are per-calendar-month limits.
 */
export const FREE_TIER_MONTHLY_CAPS = {
  // Discovery
  browseProfiles: 10,       // Profile browse/views per day-equivalent (monthly pool)
  
  // Project workspace
  activeProjects: 1,        // Manually created projects (not from confirmed gigs)
  milestones: 1,            // Per project milestone payments
  contracts: 1,             // Contract generations per month
  invoices: 2,              // Invoice generations per month
  approvalRequests: 1,
  templateUses: 1,
  aiBriefs: 2,
  
  // Earnings (Accounting)
  expenses: 5,
  
  // Opportunities — posting is free but limited
  gigPosts: 3,              // Creator gig/event posts per month
  gigApplications: 2,       // Applications to gigs per month
  opportunityPostings: 5,   // Brand job postings per month
  aiApplicantRankings: 1,
  aiJobDescriptions: 1,

  // Work / Credits — claiming credits is FREE & UNLIMITED to drive network growth
  workCredits: -1,
} as const;

export const PRO_TIER_MONTHLY_CAPS: Record<keyof typeof FREE_TIER_MONTHLY_CAPS, number> = {
  browseProfiles: -1,
  activeProjects: -1,
  milestones: -1,
  contracts: -1,
  invoices: -1,
  approvalRequests: -1,
  templateUses: -1,
  aiBriefs: -1,
  expenses: -1,
  gigPosts: -1,
  gigApplications: -1,
  opportunityPostings: -1,
  aiApplicantRankings: -1,
  aiJobDescriptions: -1,
  workCredits: -1,
};

export const CREATOR_PRO_TIER_MONTHLY_CAPS: Record<keyof typeof FREE_TIER_MONTHLY_CAPS, number> = {
  browseProfiles: -1,
  activeProjects: -1,
  milestones: -1,
  contracts: -1,
  invoices: -1,
  approvalRequests: -1,
  templateUses: -1,
  aiBriefs: -1,
  expenses: -1,
  gigPosts: -1,
  gigApplications: -1,
  opportunityPostings: -1,
  aiApplicantRankings: -1,
  aiJobDescriptions: -1,
  workCredits: -1,
};

export type FreeTierFeature = keyof typeof FREE_TIER_MONTHLY_CAPS;

export function getMonthlyCapForFeature(
  feature: FreeTierFeature,
  tier: SubscriptionTier
): number {
  if (tier === "creator_pro" || tier === "founder" || tier === "brand_enterprise") return CREATOR_PRO_TIER_MONTHLY_CAPS[feature];
  if (tier === "pro" || tier === "brand_pro") return PRO_TIER_MONTHLY_CAPS[feature];
  return FREE_TIER_MONTHLY_CAPS[feature];
}

export function getFeatureDisplayName(feature: FreeTierFeature): string {
  const names: Record<FreeTierFeature, string> = {
    browseProfiles: "profile views",
    activeProjects: "active projects",
    milestones: "milestone payments",
    contracts: "contracts",
    invoices: "invoices",
    approvalRequests: "approval requests",
    templateUses: "template uses",
    aiBriefs: "Smart briefs",
    expenses: "expenses",
    gigPosts: "gig posts",
    gigApplications: "gig applications",
    opportunityPostings: "job postings",
    aiApplicantRankings: "Smart applicant rankings",
    aiJobDescriptions: "AI job descriptions",
    workCredits: "work credits",
  };
  return names[feature];
}

const INDIVIDUAL_LIMITS: Record<SubscriptionTier, TierLimits> = {
  free: {
    swipesPerDay: 20,
    maxPortfolioItems: 5,
    canUndoSwipe: false,
    undoSwipesPerDay: 0,
    canVerifyProfile: false,
    hasAIMatchExplanations: false,
    hasAdvancedFilters: false,
    hasAdvancedProfile: false,
    maxOpportunityPostings: 3,
    hasApplicantTracking: false,
    hasBrandedPage: false,
    hasOpportunityAnalytics: false,
    hasPriorityListing: false,
    hasAITalentScout: false,
    hasCampaignAnalytics: false,
    hasScheduledSends: false,
  },
  pro: {
    swipesPerDay: -1,
    maxPortfolioItems: -1,
    canUndoSwipe: true,
    undoSwipesPerDay: 3,
    canVerifyProfile: true,
    hasAIMatchExplanations: true,
    hasAdvancedFilters: true,
    hasAdvancedProfile: true,
    maxOpportunityPostings: -1,
    hasApplicantTracking: false,
    hasBrandedPage: false,
    hasOpportunityAnalytics: false,
    hasPriorityListing: false,
    hasAITalentScout: false,
    hasCampaignAnalytics: false,
    hasScheduledSends: false,
  },
  creator_pro: {
    swipesPerDay: -1,
    maxPortfolioItems: -1,
    canUndoSwipe: true,
    undoSwipesPerDay: -1,
    canVerifyProfile: true,
    hasAIMatchExplanations: true,
    hasAdvancedFilters: true,
    hasAdvancedProfile: true,
    maxOpportunityPostings: -1,
    hasApplicantTracking: true,
    hasBrandedPage: true,
    hasOpportunityAnalytics: true,
    hasPriorityListing: true,
    hasAITalentScout: true,
    hasCampaignAnalytics: true,
    hasScheduledSends: true,
  },
  founder: {
    swipesPerDay: -1,
    maxPortfolioItems: -1,
    canUndoSwipe: true,
    undoSwipesPerDay: -1,
    canVerifyProfile: true,
    hasAIMatchExplanations: true,
    hasAdvancedFilters: true,
    hasAdvancedProfile: true,
    maxOpportunityPostings: -1,
    hasApplicantTracking: true,
    hasBrandedPage: true,
    hasOpportunityAnalytics: true,
    hasPriorityListing: true,
    hasAITalentScout: true,
    hasCampaignAnalytics: true,
    hasScheduledSends: true,
  },
  brand_pro: {
    swipesPerDay: -1,
    maxPortfolioItems: -1,
    canUndoSwipe: true,
    undoSwipesPerDay: 3,
    canVerifyProfile: true,
    hasAIMatchExplanations: true,
    hasAdvancedFilters: true,
    hasAdvancedProfile: true,
    maxOpportunityPostings: -1,
    hasApplicantTracking: true,
    hasBrandedPage: true,
    hasOpportunityAnalytics: true,
    hasPriorityListing: true,
    hasAITalentScout: true,
    hasCampaignAnalytics: false,
    hasScheduledSends: false,
  },
  brand_enterprise: {
    swipesPerDay: -1,
    maxPortfolioItems: -1,
    canUndoSwipe: true,
    undoSwipesPerDay: -1,
    canVerifyProfile: true,
    hasAIMatchExplanations: true,
    hasAdvancedFilters: true,
    hasAdvancedProfile: true,
    maxOpportunityPostings: -1,
    hasApplicantTracking: true,
    hasBrandedPage: true,
    hasOpportunityAnalytics: true,
    hasPriorityListing: true,
    hasAITalentScout: true,
    hasCampaignAnalytics: true,
    hasScheduledSends: true,
  },
};

const COMPANY_LIMITS: Record<SubscriptionTier, TierLimits> = {
  free: {
    swipesPerDay: 20,
    maxPortfolioItems: 5,
    canUndoSwipe: false,
    undoSwipesPerDay: 0,
    canVerifyProfile: false,
    hasAIMatchExplanations: false,
    hasAdvancedFilters: false,
    hasAdvancedProfile: false,
    maxOpportunityPostings: 5,
    hasApplicantTracking: false,
    hasBrandedPage: false,
    hasOpportunityAnalytics: false,
    hasPriorityListing: false,
    hasAITalentScout: false,
    hasCampaignAnalytics: false,
    hasScheduledSends: false,
  },
  pro: {
    swipesPerDay: -1,
    maxPortfolioItems: -1,
    canUndoSwipe: true,
    undoSwipesPerDay: 3,
    canVerifyProfile: true,
    hasAIMatchExplanations: true,
    hasAdvancedFilters: true,
    hasAdvancedProfile: true,
    maxOpportunityPostings: -1,
    hasApplicantTracking: true,
    hasBrandedPage: true,
    hasOpportunityAnalytics: true,
    hasPriorityListing: true,
    hasAITalentScout: true,
    hasCampaignAnalytics: false,
    hasScheduledSends: false,
  },
  creator_pro: {
    swipesPerDay: -1,
    maxPortfolioItems: -1,
    canUndoSwipe: true,
    undoSwipesPerDay: -1,
    canVerifyProfile: true,
    hasAIMatchExplanations: true,
    hasAdvancedFilters: true,
    hasAdvancedProfile: true,
    maxOpportunityPostings: -1,
    hasApplicantTracking: true,
    hasBrandedPage: true,
    hasOpportunityAnalytics: true,
    hasPriorityListing: true,
    hasAITalentScout: true,
    hasCampaignAnalytics: true,
    hasScheduledSends: true,
  },
  founder: {
    swipesPerDay: -1,
    maxPortfolioItems: -1,
    canUndoSwipe: true,
    undoSwipesPerDay: -1,
    canVerifyProfile: true,
    hasAIMatchExplanations: true,
    hasAdvancedFilters: true,
    hasAdvancedProfile: true,
    maxOpportunityPostings: -1,
    hasApplicantTracking: true,
    hasBrandedPage: true,
    hasOpportunityAnalytics: true,
    hasPriorityListing: true,
    hasAITalentScout: true,
    hasCampaignAnalytics: true,
    hasScheduledSends: true,
  },
  brand_pro: {
    swipesPerDay: -1,
    maxPortfolioItems: -1,
    canUndoSwipe: true,
    undoSwipesPerDay: 3,
    canVerifyProfile: true,
    hasAIMatchExplanations: true,
    hasAdvancedFilters: true,
    hasAdvancedProfile: true,
    maxOpportunityPostings: -1,
    hasApplicantTracking: true,
    hasBrandedPage: true,
    hasOpportunityAnalytics: true,
    hasPriorityListing: true,
    hasAITalentScout: true,
    hasCampaignAnalytics: false,
    hasScheduledSends: false,
  },
  brand_enterprise: {
    swipesPerDay: -1,
    maxPortfolioItems: -1,
    canUndoSwipe: true,
    undoSwipesPerDay: -1,
    canVerifyProfile: true,
    hasAIMatchExplanations: true,
    hasAdvancedFilters: true,
    hasAdvancedProfile: true,
    maxOpportunityPostings: -1,
    hasApplicantTracking: true,
    hasBrandedPage: true,
    hasOpportunityAnalytics: true,
    hasPriorityListing: true,
    hasAITalentScout: true,
    hasCampaignAnalytics: true,
    hasScheduledSends: true,
  },
};

/** Legacy flat export for backward compatibility (defaults to individual) */
export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  ...INDIVIDUAL_LIMITS,
  founder: INDIVIDUAL_LIMITS.creator_pro, // Founder gets all Creator Pro perks
};

/**
 * Get tier limits based on account type
 * Founder tier maps to Creator Pro limits
 */
export const getTierLimits = (
  tier: SubscriptionTier,
  accountType: AccountType = "individual"
): TierLimits => {
  const effectiveTier = tier === "founder" ? "creator_pro" : tier === "brand_pro" ? "pro" : tier === "brand_enterprise" ? "creator_pro" : tier;
  const limitsMap = accountType === "company" ? COMPANY_LIMITS : INDIVIDUAL_LIMITS;
  return limitsMap[effectiveTier];
};

/**
 * Check if user can perform an action based on their tier and account type
 */
export const canPerformAction = (
  userTier: SubscriptionTier,
  action: keyof TierLimits,
  accountType: AccountType = "individual"
): boolean => {
  const limits = getTierLimits(userTier, accountType);
  return Boolean(limits[action]);
};

/**
 * Get remaining swipes for today
 */
export const getRemainingSwipes = (
  userTier: SubscriptionTier,
  dailySwipes: number,
  accountType: AccountType = "individual"
): number => {
  const limit = getTierLimits(userTier, accountType).swipesPerDay;
  if (limit === -1) return -1;
  return Math.max(0, limit - dailySwipes);
};

/**
 * Check if user can add more portfolio items
 */
export const canAddPortfolioItem = (
  userTier: SubscriptionTier,
  currentItems: number,
  accountType: AccountType = "individual"
): boolean => {
  const limit = getTierLimits(userTier, accountType).maxPortfolioItems;
  if (limit === -1) return true;
  return currentItems < limit;
};

/**
 * Get tier display name
 */
export const getTierDisplayName = (tier: SubscriptionTier): string => {
  const names: Record<SubscriptionTier, string> = {
    free: "Spark",
    pro: "Pro",
    creator_pro: "Creator Pro",
    founder: "Founder Circle ⭕",
    brand_pro: "Brand Pro",
    brand_enterprise: "Brand Enterprise",
  };
  return names[tier];
};

/**
 * Get upgrade message for a feature
 */
export const getUpgradeMessage = (
  feature: keyof TierLimits,
  currentTier: SubscriptionTier
): string => {
  if (currentTier === "free") {
    const messages: Partial<Record<keyof TierLimits, string>> = {
      swipesPerDay: "Upgrade to Pro for unlimited daily swipes",
      maxPortfolioItems: "Upgrade to Pro for unlimited portfolio items",
      canUndoSwipe: "Upgrade to Pro to undo swipes (3/day)",
      undoSwipesPerDay: "Upgrade to Pro for 3 undo swipes per day",
      canVerifyProfile: "Upgrade to Pro to get verified",
      hasAIMatchExplanations: "Upgrade to Pro for Smart Match explanations",
      hasAdvancedFilters: "Upgrade to Pro for advanced search filters",
      hasAdvancedProfile: "Upgrade to Pro for press links, credits & awards",
      maxOpportunityPostings: "Upgrade to Pro for unlimited opportunity postings",
      hasApplicantTracking: "Upgrade to Pro for applicant tracking",
      hasBrandedPage: "Upgrade to Pro for a branded company page",
      hasOpportunityAnalytics: "Upgrade to Pro for opportunity analytics",
      hasPriorityListing: "Upgrade to Pro for priority listing in search",
      hasAITalentScout: "Upgrade to Pro for Smart Talent Scout",
      hasCampaignAnalytics: "Upgrade to Creator Pro for campaign analytics",
      hasScheduledSends: "Upgrade to Creator Pro for scheduled sends",
    };
    return messages[feature] || "Upgrade to Pro to unlock this feature";
  }
  if (currentTier === "pro") {
    const messages: Partial<Record<keyof TierLimits, string>> = {
      hasCampaignAnalytics: "Upgrade to Creator Pro for campaign analytics",
      hasScheduledSends: "Upgrade to Creator Pro for scheduled sends",
    };
    return messages[feature] || "Feature unlocked on your current tier";
  }
  return "Feature unlocked on your current tier";
};
