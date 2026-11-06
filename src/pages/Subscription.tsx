import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, ListChecks, ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import {
  SUBSCRIPTION_PRODUCTS,
  type AccountType, type BillingInterval,
} from "@/lib/subscriptionConfig";
import { getCreatorPlans, type PlanCard } from "@/lib/subscriptionPlans";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { FeaturePageHeader } from "@/components/features/FeaturePageHeader";
import { StudioFeatureShell } from "@/components/studio-reference/StudioFeatureShell";
import { HoloCard } from "@/components/passport/HoloCard";
import { cn } from "@/lib/utils";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { Accordion, AccordionItem, AccordionContent } from "@/components/ui/accordion";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GlassCta, GlassCtaButton, OutlineCtaButton } from "@/components/ui/glass-cta";
import { EditorialFooter } from "@/components/landing/kretopia/EditorialFooter";
import { KretopiaIcon } from "@/components/pricing/KretopiaIcon";
import { CREATIVE_COPY, COMPANY_OPTIONS, CREATIVE_GUIDANCE, COMPANY_BENEFITS, CREATIVE_FAQS, COMPANY_FAQS } from "@/components/pricing/pricingContent";
import "./Subscription.css";

const money = (value: number, decimals = 0) => new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", minimumFractionDigits: decimals, maximumFractionDigits: decimals,
}).format(value);
const externalIcon = <KretopiaIcon name="external-link" size={16} />;
const PRICING_SIGNUP = "/auth?tab=signup&src=pricing";

const CREATIVE_PRICING_STEPS = [
  { icon: Users, title: "Choose your path", body: "Select For Creatives or For Companies to see the right options." },
  { icon: ListChecks, title: "Compare the plans", body: "Review included features and switch between monthly and yearly billing where available." },
  { icon: ArrowUpRight, title: "Start or upgrade", body: "Start with Spark or sign in to review and manage your subscription." },
];

const COMPANY_PRICING_STEPS = [
  { icon: Users, title: "Explore company options", body: "Select For Companies to see ways to work with Kretopia." },
  { icon: ListChecks, title: "Review the fit", body: "Compare the workflows and choose the most relevant starting point." },
  { icon: ArrowUpRight, title: "Discuss your requirements", body: "Use the existing contact flow to discuss next steps with the team." },
];

export default function Subscription({ publicPricing = false }: { publicPricing?: boolean }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [currentTier, setCurrentTier] = useState<string>("free");
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>("none");
  const [accountType, setAccountType] = useState<AccountType>("individual");
  const [viewMode, setViewMode] = useState<"creator" | "brand">("creator");
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("monthly");
  const [checkingSubscription, setCheckingSubscription] = useState(!publicPricing);
  const [founderSpotsTaken, setFounderSpotsTaken] = useState<number | null>(null);
  const [subscriptionVerified, setSubscriptionVerified] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [founderOpen, setFounderOpen] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, session } = useAuth();
  const publicPlanDestination = user && session ? "/subscription" : `${PRICING_SIGNUP}&next=%2Fsubscription`;

  useEffect(() => {
    if (publicPricing) return;
    checkSubscription();
    fetchFounderCount();
  }, [publicPricing]);

  useEffect(() => {
    if (!publicPricing && !checkingSubscription) {
      if (accountType === "company") setViewMode("brand");
      const trackPaywall = async () => {
        const { analytics } = await import("@/lib/analytics");
        analytics.paywallViewed('subscription_page', currentTier);
      };
      trackPaywall();
    }
  }, [publicPricing, checkingSubscription, currentTier, accountType]);

  const fetchFounderCount = async () => {
    try {
      const { data, error } = await supabase.rpc('get_founder_circle_count');
      if (!error && data !== null && Number.isFinite(Number(data)) && Number(data) >= 0) setFounderSpotsTaken(Number(data));
    } catch (e) {
      console.error("Error fetching founder count:", e);
    }
  };

  const checkSubscription = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("subscription_tier, subscription_product_id, subscription_status, account_type")
        .eq("user_id", session.user.id)
        .single();

      if (profile?.subscription_tier) {
        setCurrentTier(profile.subscription_tier);
        setSubscriptionVerified(true);
      }
      if (profile?.subscription_status) setSubscriptionStatus(profile.subscription_status);
      if (profile?.account_type) setAccountType(profile.account_type as AccountType);
    } catch (error: any) {
      console.error("Error checking subscription:", error);
    } finally {
      setCheckingSubscription(false);
    }
  };

  const handleSubscribe = async (priceId: string | null, tier: string) => {
    if (!priceId) {
      toast({ title: "Free Tier", description: "You're already on the free tier" });
      return;
    }

    const { analytics } = await import("@/lib/analytics");
    analytics.checkoutAttempt(tier, priceId);

    try {
      setLoading(priceId);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Authentication required", description: "Please sign in to subscribe", variant: "destructive" });
        navigate("/auth");
        return;
      }

      // The server resolves the actual (test- or live-mode) Stripe Price ID
      // from `tier` + `interval` — it never trusts a client-supplied Price
      // ID, since the frontend has no visibility into which Stripe mode the
      // backend is running in (see supabase/functions/_shared/subscriptionPrices.ts).
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { tier, interval: billingInterval },
      });
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to create checkout session", variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  const handleFounderCheckout = async () => {
    try {
      setLoading("founder");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Authentication required", description: "Please sign in first", variant: "destructive" });
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase.functions.invoke("create-founder-checkout");
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to start checkout", variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    try {
      setLoading("portal");
      const { analytics } = await import("@/lib/analytics");
      analytics.customerPortalOpened();
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to open customer portal", variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  const confirmPlan = (plan: PlanCard) => {
    if (plan.isFounder) {
      setFounderOpen(true);
    } else if (publicPricing) {
      navigate(publicPlanDestination);
    } else if (!plan.priceId) {
      navigate(PRICING_SIGNUP);
    } else {
      handleSubscribe(plan.priceId, plan.tier);
    }
  };

  if (!publicPricing && checkingSubscription) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="flex items-center justify-center">
          <KretopiaSpinner className="h-8 w-8" />
        </div>
      </div>
    );
  }

  const founderSpotsRemaining = founderSpotsTaken === null ? null : Math.max(0, SUBSCRIPTION_PRODUCTS.founder.maxSpots - founderSpotsTaken);
  const isFounder = currentTier === "founder";
  const hasPaidSub = !publicPricing && subscriptionVerified && currentTier !== "free" && (subscriptionStatus === "active" || subscriptionStatus === "trialing") && !isFounder;
  const plans = getCreatorPlans(billingInterval, founderSpotsRemaining ?? Infinity);
  const company = viewMode === "brand";
  const faqs = company ? COMPANY_FAQS : CREATIVE_FAQS;
  const annualSavingsPercent = Math.max(0, Math.round(100 * Math.max(
    1 - SUBSCRIPTION_PRODUCTS.pro.yearlyPrice / (12 * SUBSCRIPTION_PRODUCTS.pro.price),
    1 - SUBSCRIPTION_PRODUCTS.creator_pro.yearlyPrice / (12 * SUBSCRIPTION_PRODUCTS.creator_pro.price),
  )));
  const isCurrentPlan = (plan: PlanCard) => !publicPricing && subscriptionVerified && (plan.isFounder ? isFounder : plan.tier === "free" ? currentTier === "free" : hasPaidSub && plan.tier === currentTier);
  const isPlanLoading = (plan: PlanCard) => loading !== null && loading === (plan.isFounder ? "founder" : plan.priceId);

  function exploreAudience(value: "creator" | "brand") {
    setViewMode(value);
    requestAnimationFrame(() => {
      document.querySelector(".k-pricing__selectors")?.scrollIntoView({ behavior: "auto", block: "start" });
      document.querySelector<HTMLButtonElement>('.k-pricing [aria-label="Pricing audience"] button[aria-pressed="true"]')?.focus({ preventScroll: true });
    });
  }

  function showComparison() {
    setCompareOpen(true);
    requestAnimationFrame(() => {
      const heading = document.getElementById("pricing-comparison-title");
      heading?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
      heading?.focus({ preventScroll: true });
    });
  }

  return (
    <div className="k-pricing landing-theme min-h-screen">
      <FeaturePageHeader
        scene="krepay"
        bannerDescription={company
          ? "Discover creative talent, explore experience, and start the right conversation."
          : "One creative journey, room to grow. Find the tools that fit what you do next."}
        tutorial={{ featureKey: company ? "pricing-company" : "pricing-creative", label: "How Pricing works", steps: company ? COMPANY_PRICING_STEPS : CREATIVE_PRICING_STEPS }}

        eyebrow={company ? "PLANS FOR COMPANIES" : "PLANS FOR CREATIVES"}
        title={company ? "Find the right people." : "Choose"}
        accentTitle={company ? "Build better work." : "the right plan."}
        subtitle={company ? "Discover creative talent, explore relevant experience, and bring the right people together for your next project." : "Find the tools that fit the way you create. Start free, discover new opportunities, and grow at your own pace."}

      />

      <StudioFeatureShell>
        {hasPaidSub && <div className="flex justify-end"><OutlineCtaButton onClick={handleManageSubscription} disabled={loading !== null}>{loading === "portal" ? <KretopiaSpinner className="h-4 w-4" /> : "Manage Subscription"}</OutlineCtaButton></div>}

        <section className="k-pricing__section" aria-labelledby="pricing-options-title">
          <div className="mb-8 max-w-3xl">
            <h2 id="pricing-options-title" className="landing-h2 k-pricing__heading">{company ? "Great work begins with the right connections." : "More possibilities for your creative work."}</h2>
            <div className="k-pricing__body">{company ? <>
              <p>Finding creative talent is about more than matching a title to a role.</p>
              <p>It's about understanding experience, recognising contributions, and connecting with people who can bring something valuable to the work.</p>
              <p>Kretopia is designed to help companies approach creative discovery and collaboration with greater clarity.</p>
            </> : <p>From discovering your next opportunity to managing more ambitious projects, Kretopia gives you room to grow.</p>}</div>
          </div>
          <div className="k-pricing__selectors mb-8 flex justify-center scroll-mt-24">
            <div className="flex flex-col items-center gap-5">
          <div role="group" aria-label="Pricing audience" className="inline-flex max-w-full flex-wrap justify-center gap-1 rounded-full border border-border bg-card p-1">
            {([ ["creator", "For Creatives", "profile"], ["brand", "For Companies", "company"] ] as const).map(([value, label, icon]) => <button key={value} type="button" aria-pressed={viewMode === value} onClick={() => setViewMode(value)} className={cn("inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none", viewMode === value ? "bg-background text-foreground ring-1 ring-border" : "text-muted-foreground hover:text-foreground")}><KretopiaIcon name={icon} size={16} />{label}</button>)}
          </div>
          {!company && <div className="flex flex-wrap items-center justify-center gap-3">
            <Label htmlFor="billing-toggle" className={cn("text-sm", billingInterval === "monthly" ? "font-semibold" : "text-muted-foreground")}>Monthly</Label>
            <Switch id="billing-toggle" aria-label="Yearly billing" checked={billingInterval === "yearly"} onCheckedChange={checked => setBillingInterval(checked ? "yearly" : "monthly")} />
            <Label htmlFor="billing-toggle" className={cn("text-sm", billingInterval === "yearly" ? "font-semibold" : "text-muted-foreground")}>Yearly</Label>
            {annualSavingsPercent > 0 && <span className="k-pricing__saving-badge">Save up to {annualSavingsPercent}%</span>}
          </div>}
        </div>
          </div>


          {company ? <>
            <p className="mb-5 text-sm text-muted-foreground">Access options and workflows are confirmed through direct enquiry.</p>
            <div className="grid gap-6 md:grid-cols-2">
              {COMPANY_OPTIONS.map(option => <Card key={option.name} className="k-pricing__card">
                <div className="k-pricing__plan-header">
                  <div className="k-pricing__plan-name"><KretopiaIcon name={option.icon} size={26} /><h3 className="text-lg font-semibold">{option.name}</h3></div>
                </div>
                <p className="text-sm font-semibold">{option.tagline}</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{option.description}</p>
                <p className="k-pricing__enquiry-price">{option.price}</p>
                <h4 className="text-sm font-semibold">Designed around</h4>
                <ul className="k-pricing__features">{option.features.map(feature => <li key={feature}><KretopiaIcon name="check" size={16} /><span>{feature}</span></li>)}</ul>
                <div className="mt-auto space-y-3"><GlassCta to="/contact" icon={externalIcon} className="w-full whitespace-normal text-center min-h-11">{option.ctaLabel}</GlassCta><p className="text-xs leading-relaxed text-muted-foreground">{option.footnote}</p></div>
              </Card>)}
            </div>
          </> : <div className="grid grid-cols-1 items-stretch gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {plans.map(plan => {
              const copy = CREATIVE_COPY[plan.tier];
              const current = isCurrentPlan(plan);
              const recurring = !plan.oneTime && plan.price > 0;
              const yearly = recurring && billingInterval === "yearly";
              const product = plan.tier === "pro" ? SUBSCRIPTION_PRODUCTS.pro : plan.tier === "creator_pro" ? SUBSCRIPTION_PRODUCTS.creator_pro : null;
              const savings = product ? product.price * 12 - product.yearlyPrice : 0;
              return <HoloCard key={plan.tier} className="h-full">
                <Card className={cn("k-pricing__card", plan.popular && "k-pricing__card--featured", plan.isFounder && "k-pricing__card--founder", (plan.popular || current) && "border-foreground/40")}>
                  <div className="k-pricing__plan-header">
                    <div className="k-pricing__plan-name"><KretopiaIcon name={copy.icon} size={26} /><h3 className="text-lg font-semibold">{copy.name}</h3></div>
                    {current ? <Badge variant="secondary">Your Plan</Badge> : plan.popular ? <Badge variant="secondary" className="k-pricing__popular-badge">Most Popular</Badge> : null}
                  </div>
                  <div><p className="text-sm font-semibold">{copy.tagline}</p>{plan.isFounder && <p className="k-pricing__lifetime-label">One-time purchase · Lifetime Creator access</p>}</div>
                  <p className="text-sm leading-relaxed text-muted-foreground">{copy.description}</p>
                  <div className="k-pricing__price" aria-live="polite" aria-atomic="true">
                    <p key={plan.oneTime ? "founder" : `${plan.tier}-${billingInterval}`} className="k-pricing__price-change"><span className="text-3xl font-semibold">{money(yearly ? plan.price / 12 : plan.price, yearly ? 2 : 0)}</span><span className="ml-1 text-sm text-muted-foreground">{plan.oneTime ? "/ one-time" : recurring ? "/ month" : "/ Free"}</span></p>
                    {yearly && <><p className="mt-2 text-sm text-muted-foreground">{money(plan.price)} billed yearly · monthly equivalent</p><p className="mt-1 text-xs font-medium text-foreground">Save {money(savings)}/year compared with monthly billing</p></>}
                  </div>
                  {plan.isFounder && founderSpotsTaken !== null && <div className="space-y-2"><p className="text-xs text-muted-foreground">{founderSpotsTaken} claimed · {SUBSCRIPTION_PRODUCTS.founder.maxSpots} total</p><div role="progressbar" aria-label="Founder places claimed" aria-valuemin={0} aria-valuemax={SUBSCRIPTION_PRODUCTS.founder.maxSpots} aria-valuenow={Math.min(founderSpotsTaken, SUBSCRIPTION_PRODUCTS.founder.maxSpots)} className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-foreground transition-[width] motion-reduce:transition-none" style={{ width: `${Math.min(100, founderSpotsTaken / SUBSCRIPTION_PRODUCTS.founder.maxSpots * 100)}%` }} /></div></div>}
                  <h4 className="text-sm font-semibold">What's included</h4>
                  <ul className="k-pricing__features">{copy.features.map(feature => <li key={feature}><KretopiaIcon name="check" size={16} /><span>{feature}</span></li>)}</ul>
                  <div className="mt-auto space-y-3">
                    {current ? <span role="status" className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-border px-6 py-3 text-sm font-semibold text-muted-foreground">Current Plan</span> : plan.popular ? <GlassCtaButton className="w-full whitespace-normal text-center min-h-11" icon={externalIcon} onClick={() => confirmPlan(plan)} disabled={current || plan.soldOut || loading !== null} aria-busy={isPlanLoading(plan)}>{current ? "Current Plan" : isPlanLoading(plan) ? <KretopiaSpinner className="h-4 w-4" /> : copy.ctaLabel}</GlassCtaButton> : <OutlineCtaButton className="w-full whitespace-normal text-center min-h-11" icon={externalIcon} onClick={() => confirmPlan(plan)} disabled={current || plan.soldOut || loading !== null} aria-busy={isPlanLoading(plan)}>{current ? "Current Plan" : plan.soldOut ? "Sold Out" : isPlanLoading(plan) ? <KretopiaSpinner className="h-4 w-4" /> : copy.ctaLabel}</OutlineCtaButton>}
                    <p className="text-xs leading-relaxed text-muted-foreground">{copy.footnote}</p>
                  </div>
                </Card>
              </HoloCard>;
            })}
          </div>}
        </section>
        {!company && <section className="k-pricing__section k-pricing__comparison-section border-t border-border" aria-label="Compare creative plans">
          <div className="k-pricing__comparison-intro">
            <div><h2 className="text-xl font-semibold text-foreground">Compare plans at a glance.</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">See how the tools, allowances and billing differ.</p></div>
            <OutlineCtaButton className="mt-6 min-h-11" icon={<KretopiaIcon name="chevron-down" size={16} />} aria-expanded={compareOpen} aria-controls="pricing-comparison" onClick={showComparison}>Compare All Plans</OutlineCtaButton>
          </div>
          {compareOpen && <div id="pricing-comparison" className="k-pricing__comparison mt-8"><h3 id="pricing-comparison-title" tabIndex={-1} className="text-xl font-semibold">Compare All Plans</h3><div className="mt-4 overflow-x-auto rounded-[var(--radius-panel)] border border-border"><table><caption className="sr-only">Creative plan allowances and billing</caption><thead><tr><th scope="col">Included</th><th scope="col">Spark</th><th scope="col">Creator</th><th scope="col">Creator+</th><th scope="col">Founder</th></tr></thead><tbody>
            <tr><th scope="row">Kreto Talk</th><td>15 minutes/day</td><td>Up to 2 hours/day, with memory</td><td>Up to 10 hours/day, with long-term memory</td><td>Creator plan included</td></tr>
            <tr><th scope="row">Smart Gig Scout</th><td>Weekly preview</td><td>Daily discovery</td><td>Priority discovery and saved shortlists</td><td>Creator plan included</td></tr>
            <tr><th scope="row">Billing</th>{plans.map(plan => <td key={plan.tier}>{plan.oneTime ? `${money(plan.price)} one-time` : plan.price === 0 ? "Free" : billingInterval === "yearly" ? `${money(plan.price)} yearly` : `${money(plan.price)}/month`}</td>)}</tr>
          </tbody></table></div></div>}
        </section>}

        {company ? <section className="k-pricing__section border-t border-border" aria-labelledby="company-collaboration-title">
          <p className="landing-eyebrow mb-4">A clearer path to collaboration</p>
          <h2 id="company-collaboration-title" className="landing-h2 k-pricing__heading">From requirements to the right conversation.</h2>
          <div className="k-pricing__company-steps mt-8 grid gap-6 md:grid-cols-3">
            {COMPANY_BENEFITS.map(([title, body], index) => <div className="k-pricing__step" key={title}>
              <span className="k-pricing__step-number">0{index + 1}</span>
              <h3 className="text-lg font-semibold">{title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>)}
          </div>
        </section> : <section className="k-pricing__section border-t border-border" aria-labelledby="creative-guidance-title">
          <h2 id="creative-guidance-title" className="landing-h2 k-pricing__heading">Find what works for you.</h2>
          <p className="k-pricing__body">Every creative journey is different. Your tools should reflect that.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">{CREATIVE_GUIDANCE.map(([title, body]) => <div key={title} className="k-pricing__guidance-card"><h3 className="font-semibold">{title}</h3><p className="mt-3 text-sm leading-relaxed text-muted-foreground">{body}</p></div>)}</div>

        </section>}

        <section className="k-pricing__section border-t border-border" aria-labelledby="pricing-faq-title">
          {!company && <p className="landing-eyebrow mb-4">A little more clarity.</p>}
          <h2 id="pricing-faq-title" className="landing-h2 k-pricing__heading">Frequently asked questions</h2>
          <Accordion key={viewMode} type="single" collapsible className="mt-6">
            {faqs.map(([question, answer], index) => <AccordionItem key={question} value={`pricing-faq-${index}`} className="k-pricing__faq-item"><AccordionPrimitive.Header><AccordionPrimitive.Trigger className="k-pricing__faq-trigger">{question}<KretopiaIcon name="chevron-down" size={18} /></AccordionPrimitive.Trigger></AccordionPrimitive.Header><AccordionContent className="max-w-3xl leading-relaxed text-muted-foreground">{answer}{!company && index === 2 && <p className="mt-3">Creator: {money(SUBSCRIPTION_PRODUCTS.pro.yearlyPrice)}/year. Creator+: {money(SUBSCRIPTION_PRODUCTS.creator_pro.yearlyPrice)}/year. The yearly cards show the monthly equivalents and exact annual savings.</p>}</AccordionContent></AccordionItem>)}
          </Accordion>
          <OutlineCtaButton className="mt-6 min-h-11" icon={externalIcon} onClick={() => exploreAudience(company ? "creator" : "brand")}>{company ? "View Creator Plans" : "Explore Company Plans"}</OutlineCtaButton>
        </section>

        <section className="k-pricing__section k-pricing__closing border-t border-border" aria-labelledby="pricing-closing-title">
          <h2 id="pricing-closing-title" className="landing-h2 k-pricing__heading">{company ? "Every great project starts with people." : "Wherever your work takes you."}</h2>
          <div className="k-pricing__body">{company ? <p>Discover the perspectives, experience, and creative talent that can bring your ideas to life.</p> : <><p>The next opportunity, the next collaboration, the next idea.</p><p>Find the tools that help you move forward.</p></>}</div>
          <GlassCta className="mt-6 min-h-11" to={company ? "/contact" : publicPricing ? publicPlanDestination : PRICING_SIGNUP} icon={externalIcon}>{company ? "Discuss Team Requirements" : publicPricing && user && session ? "View Subscription" : "Get Started Free"}</GlassCta>
        </section>
      </StudioFeatureShell>
      <EditorialFooter />


      <Dialog open={founderOpen} onOpenChange={setFounderOpen}>
        <DialogContent aria-describedby="founder-offer-description">
          <DialogHeader>
            <DialogTitle>Explore Founder Access</DialogTitle>
            <DialogDescription id="founder-offer-description">
              {CREATIVE_COPY.founder.description}
            </DialogDescription>
          </DialogHeader>

          <p className="text-2xl font-semibold">
            {money(SUBSCRIPTION_PRODUCTS.founder.price)} · one-time
          </p>

          <ul className="k-pricing__features">
            {CREATIVE_COPY.founder.features.map(feature =>
              <li key={feature}>
                <KretopiaIcon name="check" size={16} />
                <span>{feature}</span>
              </li>
            )}
          </ul>

          <p className="text-xs text-muted-foreground">
            Offer benefits and availability are subject to applicable terms.
          </p>

          {publicPricing ? (
            <GlassCta to={publicPlanDestination}>{user && session ? "View Subscription" : "Join Kretopia"}</GlassCta>
          ) : <GlassCtaButton
            disabled={
              loading !== null ||
              founderSpotsRemaining === 0 ||
              isFounder
            }
            onClick={handleFounderCheckout}
          >
            {loading === "founder"
              ? <KretopiaSpinner className="h-4 w-4" />
              : "Continue to checkout"}
          </GlassCtaButton>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
