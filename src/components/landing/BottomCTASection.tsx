import { Link } from "react-router-dom";
import { CtaButton } from "@/components/ui/cta-button";
import { Sparkles, ArrowRight, Globe, MapPin } from "lucide-react";

const TRINIDAD_CONTENT = {
  badge: "Made for T&T Creatives",
  heading: "Make it. Own it. Get paid.",
  subheading:
    "Whether yuh in Carnival, Soca, Film, Fashion, or Design — find verified creatives right here in T&T. Manage projects, send invoices, and grow your ting — all in one spot.",
  tagline: "Free to start · Pro when you ready · No credit card needed",
  isTT: true,
};

const DEFAULT_CONTENT = {
  badge: "Free Forever · Creator from $29/mo",
  heading: "Make it. Own it. Get paid.",
  subheading:
    "Claim your credits. Match with collaborators. Send invoices. Get paid. One platform replaces nine apps — and Kreto does the busywork.",
  tagline: "Free forever · 60-second setup · No credit card",
  isTT: false,
};

export const BottomCTASection = () => {
  const isTrinidad = (() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return tz?.includes("Port_of_Spain") || tz?.includes("Trinidad");
    } catch {
      return false;
    }
  })();

  const content = isTrinidad ? TRINIDAD_CONTENT : DEFAULT_CONTENT;

  const handleCtaClick = async () => {
    const { analytics } = await import("@/lib/analytics");
    analytics.ctaClick("bottom_get_started", "landing_bottom_cta");
  };

  return (
    <section className="px-4 sm:px-6 py-16 sm:py-20 md:py-24">
      <div className="container mx-auto max-w-3xl">
        <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-card p-8 sm:p-12 text-center shadow-sm">
          {/* Soft ink wash — accent, not full bleed */}
          <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none" />
          <div className="absolute -bottom-20 -right-20 h-56 w-56 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

          <div className="relative">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-3.5 py-1.5 text-xs font-semibold text-primary">
              {isTrinidad ? <MapPin className="h-3.5 w-3.5" /> : <Globe className="h-3.5 w-3.5" />}
              <span>{content.badge}</span>
            </div>

            <h2 className="mb-4 text-3xl sm:text-4xl md:text-5xl font-black tracking-[-0.03em] text-foreground">
              {content.heading}
            </h2>

            <p className="mb-8 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
              {content.subheading}
            </p>

            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link to="/auth" onClick={handleCtaClick} className="w-full sm:w-auto">
                <CtaButton size="xl" className="w-full sm:w-auto">
                  <Sparkles className="mr-2 h-5 w-5" />
                  Get Started Free
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </CtaButton>

              </Link>
            </div>


            <p className="mt-6 text-xs text-muted-foreground/80">
              {content.tagline}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
