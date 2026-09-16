// Centralized subscription configuration
// Keep this in sync with Stripe products

export type AccountType = 'individual' | 'company';
export type BillingInterval = 'monthly' | 'yearly';

// Creator/Individual subscription products — 3 tiers: Spark (free), Creator ($29), Creator+ ($59)
export const SUBSCRIPTION_PRODUCTS = {
  pro: {
    name: "Creator",
    tier: "pro" as const,
    price: 29,
    yearlyPrice: 278, // ~$23.17/mo effective — save $70/yr
    trialDays: 7,
    // These are the Stripe products formerly labeled "Creator Pro" at $29
    priceId: "price_1TLWQjJvOS7zG18h7aQBNmo8",
    yearlyPriceId: "price_1TLWQ6JvOS7zG18hjaiygUxE",
    productId: "prod_UKAmxFRvNL3ez3",
    yearlyProductId: "prod_UKAlBEJxMen4Xr",
    legacyProductIds: [
      "prod_UKARjeRiOcTS46",  // old creator_pro legacy
      "prod_UKAmTywyqyLhMk",  // old $15 pro monthly
      "prod_UKAlwpY8dS3Doc",  // old $15 pro yearly
      "prod_TWc5tpvPKjy8hG",  // very old pro
    ],
  },
  creator_pro: {
    name: "Creator +",
    tier: "creator_pro" as const,
    price: 59,
    yearlyPrice: 566, // ~$47.17/mo effective — save $142/yr
    trialDays: 7,
    // These are the Stripe products formerly labeled "Enterprise" at $59
    priceId: "price_1TLWQkJvOS7zG18hSN9qmxyW",
    yearlyPriceId: "price_1TLWQRJvOS7zG18hLQJW4YIB",
    productId: "prod_UKAmUMW9FUQLZD",
    yearlyProductId: "prod_UKAl8dxTE4ZidO",
    legacyProductIds: ["prod_U5VmCaKx7g2lbw"],
  },
  founder: {
    name: "Founder Circle ⭕",
    tier: "founder" as const,
    price: 499,
    oneTime: true,
    priceId: "price_1T1O6yJvOS7zG18hgCeJU1cF",
    productId: "prod_TzMqfksF7u6WBH",
    maxSpots: 1000,
  },
} as const;

// Brand/Company subscription products
export const BRAND_SUBSCRIPTION_PRODUCTS = {
  pro: {
    name: "Brand Pro",
    tier: "brand_pro" as const,
    price: 59,
    yearlyPrice: 566, // ~$47.17/mo effective — save $142/yr
    trialDays: 7,
    priceId: "price_1TLWQlJvOS7zG18hb5QeNh8k",
    yearlyPriceId: "price_1TLWQbJvOS7zG18hgPTf5C0g",
    productId: "prod_UKAmkngXKhLPdB",
    yearlyProductId: "prod_UKAmubvs5yP0o2",
    legacyProductIds: ["prod_UDoSA9g7yHRm3X"],
  },
  enterprise: {
    name: "Brand Enterprise",
    tier: "brand_enterprise" as const,
    price: 129,
    yearlyPrice: 1238, // ~$103.17/mo effective — save $310/yr
    trialDays: 7,
    priceId: "price_1TLWQmJvOS7zG18h4AVxAVKx",
    yearlyPriceId: "price_1TLWQcJvOS7zG18hD1oVzrrJ",
    productId: "prod_UKAmQMESnSKqwB",
    yearlyProductId: "prod_UKAmq7dJi4lkBd",
    legacyProductIds: ["prod_UDoT2jPlIxVnLp"],
  },
} as const;

/** Features shown on subscription page, split by account type */
export const FREE_FEATURES: Record<AccountType, string[]> = {
  individual: [
    "Kreto Talk — 15 min/day (chat + voice combined)",
    "🛰️ Smart Gig Scout — preview (1 surfaced gig/week)",
    "Unlimited credit claiming",
    "20 swipes/day",
    "10 profile views/month",
    "2 gig applications/month",
    "Direct messaging",
    "Unlimited paid gig posts",
    "3 barter/collab posts/month",
    "📊 2 invoices/month · 5 expenses/month",
    "🔓 1 active project/month",
    "🔓 1 milestone payment / contract / approval / template per month",
    "💸 Kretopia Fund — launch your first campaign on us (1/year)",
    "Higher commission on transactions",
  ],
  company: [
    "Kreto Talk — 15 min/day (chat + voice combined)",
    "🛰️ Smart Talent Scout — preview (1 ranked shortlist/week)",
    "Unlimited credit claiming",
    "Unlimited paid job posts",
    "5 barter/collab posts/month",
    "Basic company page",
    "Direct messaging",
    "10 talent views/month",
    "📊 2 invoices/month · 5 expenses/month",
    "20% platform service fee",
  ],
};

export const PRO_FEATURES: Record<AccountType, string[]> = {
  individual: [
    "Kreto Talk — 2 hours/day (chat + voice, with memory)",
    "🛰️ Smart Gig Scout — daily, full feed (web, LinkedIn, IG, ATS)",
    "✍️ Auto-drafted cover letters for scouted gigs",
    "🤝 Project Copilot proposals — accept on-tap to run real actions",
    "Unlimited swipes & matches",
    "Unlimited work credits & portfolio",
    "🧠 Unlimited Smart Briefs, Templates & Pricing Co-Pilot",
    "📊 Unlimited Invoicing & Milestone Payments + full P&L",
    "🔓 Unlimited Workspace & Project Tools",
    "🌐 Creator Site — yourname.kretopia.com subdomain",
    "🎨 3 premium site templates",
    "📄 EPK-to-PDF deck export",
    "Smart Match explanations · Verified badge · Advanced filters",
    "💸 Kretopia Fund — 3 campaigns/year",
    "Priority support",
  ],
  company: [
    "Kreto Talk — 2 hours/day (chat + voice, with memory)",
    "🛰️ Smart Talent Scout — daily ranked shortlists",
    "🤝 Outreach Copilot — drafts first-touch messages on-tap",
    "Unlimited opportunity postings",
    "🧠 Unlimited Smart Job Descriptions & Applicant Ranking",
    "📊 Unlimited Expense Tracking & Invoicing + full P&L",
    "🔓 Applicant tracking dashboard · Branded company page",
    "Advanced search & talent filters · Verified badge",
    "Opportunity performance analytics · Priority listing",
    "15% platform service fee (vs 20%)",
    "Priority support",
  ],
};

export const CREATOR_PRO_FEATURES: Record<AccountType, string[]> = {
  individual: [
    "Everything in Creator, plus:",
    "Kreto Talk — 10 hours/day (chat + voice + long-term memory)",
    "⚙️ Autonomous Project Agent — runs your studio in the background (proposals + auto-actions)",
    "🛰️ Priority Scout queue + auto-saved shortlists",
    "🎨 All 9 premium site templates",
    "🔗 Custom domain (yourdomain.com)",
    "✏️ Advanced site section editor & customization",
    "🎨 Custom invoice & EPK branding (logo, colors, letterhead)",
    "📊 Site visitor + campaign analytics (open/click)",
    "⏰ Scheduled email sends",
    "🔓 Advanced reporting & exports",
    "💸 Kretopia Fund — unlimited campaigns",
    "White-glove onboarding · Dedicated account manager",
  ],
  company: [
    "Everything in Brand Pro, plus:",
    "Kreto Talk — 10 hours/day (chat + voice + long-term memory)",
    "⚙️ Autonomous Outreach Agent — sources & messages talent in the background",
    "🛰️ Priority Talent Scout + auto-saved shortlists",
    "🔗 Custom domain (yourdomain.com)",
    "📊 Campaign analytics (open/click tracking)",
    "⏰ Scheduled email sends",
    "🔓 Advanced applicant pipeline · Multi-seat team access",
    "White-glove onboarding · Dedicated account manager",
    "10% platform service fee",
  ],
};


export const LEGACY_PRODUCT_MAPPING: Record<string, string> = {
  // Old $15 Pro products → now map to "pro" (grandfathered with full Pro access)
  'prod_TWc5tpvPKjy8hG': 'pro',
  'prod_TA5c8GtL6ioS2h': 'pro',
  'prod_TA5ihoppNqeijE': 'pro',
  'prod_TAoY7TiQaFLU00': 'pro',
  'prod_TAoZwx40t99jYc': 'pro',
  'prod_UKAmTywyqyLhMk': 'pro', // old $15 pro monthly
  'prod_UKAlwpY8dS3Doc': 'pro', // old $15 pro yearly
  // Old Creator Pro ($29) → now "pro"
  'prod_UKARjeRiOcTS46': 'pro',
  // Old Enterprise ($59) → now "creator_pro"
  'prod_U5VmCaKx7g2lbw': 'creator_pro',
  // Old Brand tiers
  'prod_UDoSA9g7yHRm3X': 'brand_pro',
  'prod_UDoT2jPlIxVnLp': 'brand_enterprise',
  // Old price-based IDs
  'price_1SZYrBJvOS7zG18hDW2eE4NG': 'pro',
  'price_1TLW6iJvOS7zG18hyl8LpXqw': 'pro',
  'price_1T7KklJvOS7zG18hwEl7vYNw': 'creator_pro',
  'price_1TFMpuJvOS7zG18hJm3HyPIv': 'brand_pro',
  'price_1TFMqeJvOS7zG18h09O4TJId': 'brand_enterprise',
};

export type SubscriptionTier = 'free' | 'pro' | 'creator_pro' | 'founder' | 'brand_pro' | 'brand_enterprise';

export function mapProductIdToTier(productId: string): SubscriptionTier {
  // Current products (monthly + yearly)
  if (productId === SUBSCRIPTION_PRODUCTS.founder.productId) return 'founder';
  if (productId === SUBSCRIPTION_PRODUCTS.creator_pro.productId || productId === SUBSCRIPTION_PRODUCTS.creator_pro.yearlyProductId) return 'creator_pro';
  if (productId === SUBSCRIPTION_PRODUCTS.pro.productId || productId === SUBSCRIPTION_PRODUCTS.pro.yearlyProductId) return 'pro';
  if (productId === BRAND_SUBSCRIPTION_PRODUCTS.pro.productId || productId === BRAND_SUBSCRIPTION_PRODUCTS.pro.yearlyProductId) return 'brand_pro';
  if (productId === BRAND_SUBSCRIPTION_PRODUCTS.enterprise.productId || productId === BRAND_SUBSCRIPTION_PRODUCTS.enterprise.yearlyProductId) return 'brand_enterprise';
  // Legacy
  const legacyTier = LEGACY_PRODUCT_MAPPING[productId];
  if (legacyTier) return legacyTier as SubscriptionTier;
  return 'free';
}

export function getTierDisplayName(tier: SubscriptionTier): string {
  switch (tier) {
    case 'founder': return 'Founder Circle ⭕';
    case 'brand_enterprise': return 'Brand Enterprise';
    case 'brand_pro': return 'Brand Pro';
    case 'creator_pro': return 'Creator +';
    case 'pro': return 'Creator';
    case 'free':
    default: return 'Spark';
  }
}

export function getTierPrice(tier: SubscriptionTier, interval: BillingInterval = 'monthly'): number {
  if (interval === 'yearly') {
    switch (tier) {
      case 'founder': return SUBSCRIPTION_PRODUCTS.founder.price;
      case 'creator_pro': return SUBSCRIPTION_PRODUCTS.creator_pro.yearlyPrice;
      case 'pro': return SUBSCRIPTION_PRODUCTS.pro.yearlyPrice;
      case 'brand_enterprise': return BRAND_SUBSCRIPTION_PRODUCTS.enterprise.yearlyPrice;
      case 'brand_pro': return BRAND_SUBSCRIPTION_PRODUCTS.pro.yearlyPrice;
      case 'free':
      default: return 0;
    }
  }
  switch (tier) {
    case 'founder': return SUBSCRIPTION_PRODUCTS.founder.price;
    case 'creator_pro': return SUBSCRIPTION_PRODUCTS.creator_pro.price;
    case 'pro': return SUBSCRIPTION_PRODUCTS.pro.price;
    case 'brand_enterprise': return BRAND_SUBSCRIPTION_PRODUCTS.enterprise.price;
    case 'brand_pro': return BRAND_SUBSCRIPTION_PRODUCTS.pro.price;
    case 'free':
    default: return 0;
  }
}

/** Check if tier has Pro-level access (pro, creator_pro, founder, or brand equivalents) */
export function hasProAccess(tier: SubscriptionTier): boolean {
  return tier === 'pro' || tier === 'creator_pro' || tier === 'founder' || tier === 'brand_pro' || tier === 'brand_enterprise';
}

/** Check if tier has Creator Pro-level access (creator_pro, founder) */
export function hasCreatorProAccess(tier: SubscriptionTier): boolean {
  return tier === 'creator_pro' || tier === 'founder';
}

/** Check if tier is a brand-specific subscription */
export function isBrandTier(tier: SubscriptionTier): boolean {
  return tier === 'brand_pro' || tier === 'brand_enterprise';
}

/** Get the yearly savings amount for a tier */
export function getYearlySavings(tier: SubscriptionTier): number {
  switch (tier) {
    case 'pro': return (SUBSCRIPTION_PRODUCTS.pro.price * 12) - SUBSCRIPTION_PRODUCTS.pro.yearlyPrice;
    case 'creator_pro': return (SUBSCRIPTION_PRODUCTS.creator_pro.price * 12) - SUBSCRIPTION_PRODUCTS.creator_pro.yearlyPrice;
    case 'brand_pro': return (BRAND_SUBSCRIPTION_PRODUCTS.pro.price * 12) - BRAND_SUBSCRIPTION_PRODUCTS.pro.yearlyPrice;
    case 'brand_enterprise': return (BRAND_SUBSCRIPTION_PRODUCTS.enterprise.price * 12) - BRAND_SUBSCRIPTION_PRODUCTS.enterprise.yearlyPrice;
    default: return 0;
  }
}

/** Get the effective monthly price when billed yearly */
export function getEffectiveMonthlyPrice(tier: SubscriptionTier): number {
  const yearlyPrice = getTierPrice(tier, 'yearly');
  return yearlyPrice > 0 ? Math.round((yearlyPrice / 12) * 100) / 100 : 0;
}
