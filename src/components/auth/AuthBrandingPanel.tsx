import { Sparkles, Compass, ShieldCheck, Zap } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { KretoMark } from "@/components/brand/KretoMark";
import { TutorialStepper } from "@/components/landing/kretopia/TutorialStepper";
import type { TutorialStep } from "@/components/landing/kretopia/FeatureTutorial";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { kGlow } from "@/lib/kGradient";

// Mirrors FunnelStepper's three funnel stages (Sign up / First Stamp / Launch
// Passport) one level deeper — narrating *why* each stage is worth the click,
// not just naming it. This replaces the old static "what Kretopia has"
// feature list with a live, auto-advancing "what happens when you sign up"
// walkthrough: the same TutorialStepper component already used for every
// other AI-guided tour in the product (How Scout/Studio/Match work), so this
// is the same interactive surface a returning user already recognizes, not a
// bespoke one-off.
const SIGNUP_TUTORIAL: TutorialStep[] = [
  {
    icon: Sparkles,
    title: "Sign up in 30 seconds",
    body: "No forms to fill in by hand — just your name. Kreto takes it from there.",
  },
  {
    icon: Compass,
    title: "We find your work",
    body: "Kreto scans the web for credits under your name — film credits, bylines, releases — so nothing gets left off your record.",
  },
  {
    icon: ShieldCheck,
    title: "Claim your first Stamp",
    body: "One click confirms it's really you. That's a verified Stamp on your Passport — not a claim, a fact people can trust.",
  },
  {
    icon: Zap,
    title: "Get discovered",
    body: "Your Passport goes live. Scouts, studios and brands find you — matched to real, verified work, not keywords.",
  },
];

export const AuthBrandingPanel = () => {
  const reducedMotion = useReducedMotion();

  return (
    <div className="auth-branding-panel hidden lg:flex lg:w-1/2 relative overflow-x-hidden overflow-y-auto bg-background text-foreground">
      {/* Sunset wash behind */}
      <div
        className="pointer-events-none absolute -top-32 -left-32 h-[560px] w-[560px] rounded-full opacity-50 blur-[140px]"
        style={{ background: "var(--k-text-gradient)" }}
      />
      <div className="pointer-events-none absolute -bottom-40 -right-20 h-[420px] w-[420px] rounded-full opacity-30 blur-[120px]"
           style={{ background: "hsl(var(--k-purple) / 0.15)" }} />
      <div className="absolute inset-y-0 right-0 w-px bg-border" />

      {/* pt-8 sm:pt-12 matches the right column's own py-8 sm:py-12 exactly —
          both columns are top-aligned (not vertically centered) so the logo
          here and "Welcome to Kretopia" there sit at the same distance from
          the top regardless of how much content either column holds. */}
      <div className="relative z-10 flex flex-col px-12 xl:px-16 pt-8 sm:pt-12 pb-10 w-full">
        <div className="mb-9 w-fit rounded-lg transition-opacity hover:opacity-80">
          <BrandLogo size="lg" showBeta linkToHome />
        </div>

      <p
        className="inline-flex items-center gap-2 mb-6 px-3 py-1 rounded-full border w-fit"
        style={{ borderColor: kGlow(30), backgroundColor: kGlow(6) }}
      >
        <span className="h-1.5 w-1.5 rounded-full ai-ambient-breathe" style={{ backgroundColor: "hsl(var(--energy))" }} />
        {/* No inline color here: .landing-eyebrow's own neutral default
            (index.css) would otherwise be overridden -- same override bug
            already fixed on the other eyebrow call sites. */}
        <span className="landing-eyebrow">The Creative Economy OS</span>
      </p>

      <h2 className="landing-h2 landing-glow mb-5">
        Where creativity<br />
        <span className="landing-accent">lives.</span>
      </h2>
        <p className="text-muted-foreground mb-6 max-w-md leading-relaxed">
          One Passport. Every credit. Every opportunity. Kretopia is the professional
          home for creators — and Kreto, your Executive Producer, runs point.
        </p>

        <div className="mb-7 flex items-center gap-3 rounded-lg border border-border bg-card/60 backdrop-blur-sm p-3.5 max-w-md">
          <KretoMark size="md" />
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[hsl(var(--energy))] mb-0.5">Kreto</p>
            <p className="text-sm text-foreground leading-snug">
              "I'll line up your first three opportunities the moment you sign in."
            </p>
          </div>
        </div>

        <p className="landing-eyebrow mb-3">
          What happens when you sign up
        </p>
        <div className="max-w-md">
          <TutorialStepper
            steps={SIGNUP_TUTORIAL}
            label="What happens when you sign up"
            autoPlay={!reducedMotion}
          />
        </div>

        <div className="mt-7">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Zap className="h-3 w-3 text-[hsl(var(--energy))]" />
            60-second setup · No credit card · Free forever to start
          </p>
          <p className="mt-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            Kretopia · by Thrive Collective
          </p>
        </div>
      </div>
    </div>
  );
};
