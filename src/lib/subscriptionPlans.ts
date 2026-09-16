import { Zap, Sparkles, Crown, Building2, Globe, type LucideIcon } from "lucide-react";
import {
  SUBSCRIPTION_PRODUCTS, BRAND_SUBSCRIPTION_PRODUCTS,
  PRO_FEATURES, FREE_FEATURES, CREATOR_PRO_FEATURES,
  type BillingInterval,
  getYearlySavings, getEffectiveMonthlyPrice,
} from "@/lib/subscriptionConfig";

const FOUNDER_FEATURES = [
  "Lifetime Creator access — never pay again",
  "5,000 bonus XP on activation",
  "Only 10% platform fees (vs 20% free / 15% Creator)",
  "Free & discounted event access",
];

/** Card-facing plan shape — same fields drive the simplified card and the details modal. */
export interface PlanCard {
  name: string;
  tier: string;
  price: number;
  displayPrice: string;
  priceId: string | null;
  icon: LucideIcon;
  tagline: string;
  /** Short list for the card and the modal alike — kept intentionally brief. */
  features: string[];
  /** Max two words — enforced by convention, not by type. */
  ctaLabel: string;
  popular?: boolean;
  isFounder?: boolean;
  oneTime?: boolean;
  soldOut?: boolean;
}

export function getCreatorPlans(interval: BillingInterval, founderSpotsRemaining: number): PlanCard[] {
  const isYearly = interval === "yearly";
  const savings = isYearly ? getYearlySavings("pro") : 0;
  return [
    {
      name: "Spark",
      tier: "free",
      price: 0,
      displayPrice: "$0",
      priceId: null,
      icon: Zap,
      tagline: "Start creating, free forever.",
      features: FREE_FEATURES.individual.slice(0, 4),
      ctaLabel: "Start Free",
    },
    {
      name: SUBSCRIPTION_PRODUCTS.pro.name,
      tier: SUBSCRIPTION_PRODUCTS.pro.tier,
      price: isYearly ? SUBSCRIPTION_PRODUCTS.pro.yearlyPrice : SUBSCRIPTION_PRODUCTS.pro.price,
      displayPrice: isYearly ? `$${getEffectiveMonthlyPrice("pro")}` : `$${SUBSCRIPTION_PRODUCTS.pro.price}`,
      priceId: isYearly ? SUBSCRIPTION_PRODUCTS.pro.yearlyPriceId : SUBSCRIPTION_PRODUCTS.pro.priceId,
      icon: Sparkles,
      popular: true,
      tagline: savings > 0 ? `Unlock everything. Save $${savings}/yr.` : "Unlock the full toolkit.",
      features: PRO_FEATURES.individual.slice(0, 4),
      ctaLabel: "Upgrade Now",
    },
    {
      name: SUBSCRIPTION_PRODUCTS.creator_pro.name,
      tier: SUBSCRIPTION_PRODUCTS.creator_pro.tier,
      price: isYearly ? SUBSCRIPTION_PRODUCTS.creator_pro.yearlyPrice : SUBSCRIPTION_PRODUCTS.creator_pro.price,
      displayPrice: isYearly ? `$${getEffectiveMonthlyPrice("creator_pro")}` : `$${SUBSCRIPTION_PRODUCTS.creator_pro.price}`,
      priceId: isYearly ? SUBSCRIPTION_PRODUCTS.creator_pro.yearlyPriceId : SUBSCRIPTION_PRODUCTS.creator_pro.priceId,
      icon: Globe,
      tagline: "For power users & agencies.",
      features: CREATOR_PRO_FEATURES.individual.slice(1, 5),
      ctaLabel: "Go Unlimited",
    },
    {
      name: "Founder",
      tier: "founder",
      price: SUBSCRIPTION_PRODUCTS.founder.price,
      displayPrice: `$${SUBSCRIPTION_PRODUCTS.founder.price}`,
      priceId: SUBSCRIPTION_PRODUCTS.founder.priceId,
      icon: Crown,
      isFounder: true,
      oneTime: true,
      soldOut: founderSpotsRemaining <= 0,
      tagline: "Lifetime Creator access. Once.",
      features: FOUNDER_FEATURES,
      ctaLabel: "Claim Spot",
    },
  ];
}

export function getBrandPlans(interval: BillingInterval): PlanCard[] {
  const isYearly = interval === "yearly";
  const savings = isYearly ? getYearlySavings("brand_pro") : 0;
  return [
    {
      name: "Spark",
      tier: "free",
      price: 0,
      displayPrice: "$0",
      priceId: null,
      icon: Zap,
      tagline: "Start hiring, free forever.",
      features: FREE_FEATURES.company.slice(0, 4),
      ctaLabel: "Start Free",
    },
    {
      name: BRAND_SUBSCRIPTION_PRODUCTS.pro.name,
      tier: BRAND_SUBSCRIPTION_PRODUCTS.pro.tier,
      price: isYearly ? BRAND_SUBSCRIPTION_PRODUCTS.pro.yearlyPrice : BRAND_SUBSCRIPTION_PRODUCTS.pro.price,
      displayPrice: isYearly ? `$${getEffectiveMonthlyPrice("brand_pro")}` : `$${BRAND_SUBSCRIPTION_PRODUCTS.pro.price}`,
      priceId: isYearly ? BRAND_SUBSCRIPTION_PRODUCTS.pro.yearlyPriceId : BRAND_SUBSCRIPTION_PRODUCTS.pro.priceId,
      icon: Sparkles,
      popular: true,
      tagline: savings > 0 ? `Full hiring suite. Save $${savings}/yr.` : "Full hiring suite.",
      features: PRO_FEATURES.company.slice(0, 4),
      ctaLabel: "Upgrade Now",
    },
    {
      name: "Enterprise",
      tier: BRAND_SUBSCRIPTION_PRODUCTS.enterprise.tier,
      price: isYearly ? BRAND_SUBSCRIPTION_PRODUCTS.enterprise.yearlyPrice : BRAND_SUBSCRIPTION_PRODUCTS.enterprise.price,
      displayPrice: isYearly ? `$${getEffectiveMonthlyPrice("brand_enterprise")}` : `$${BRAND_SUBSCRIPTION_PRODUCTS.enterprise.price}`,
      priceId: isYearly ? BRAND_SUBSCRIPTION_PRODUCTS.enterprise.yearlyPriceId : BRAND_SUBSCRIPTION_PRODUCTS.enterprise.priceId,
      icon: Building2,
      tagline: "For agencies & large teams.",
      features: PRO_FEATURES.company.slice(0, 4).concat(["15% platform fee (vs 20%)"]),
      ctaLabel: "Go Enterprise",
    },
  ];
}
