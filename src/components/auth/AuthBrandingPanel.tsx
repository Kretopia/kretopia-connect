import { Compass, ShieldCheck, Sparkles, Zap } from "lucide-react";

import { BrandLogo } from "@/components/BrandLogo";
import { KretoMark } from "@/components/brand/KretoMark";
import { KretoScene } from "@/components/brand/KretoScene";
import { HudCorners } from "@/components/wrapped/WrappedShell";
import { kGlow } from "@/lib/kGradient";

/**
 * What happens when you sign up, in the funnel's own three stages plus the outcome. Static on purpose: this panel
 * never scrolls and never moves under the form, so each step is one line the eye can take in at once.
 */
const STEPS = [
  { icon: Sparkles, title: "Sign up in 30 seconds", body: "Just your name. Kreto takes it from there." },
  { icon: Compass, title: "We find your work", body: "Credits, bylines and releases under your name, found for you." },
  { icon: ShieldCheck, title: "Claim your first Stamp", body: "One click makes it a verified fact people can trust." },
  { icon: Zap, title: "Get discovered", body: "Scouts, studios and brands find you through real work." },
] as const;

/*
 * Height tiers, measured on the real panel (the content needs about 270 px, plus 90 for the paragraph, 75 for the
 * step descriptions and 140 for the banner, against what the frame leaves). It is exactly one screen tall and never
 * scrolls, so what does not fit goes, in this order: the Kreto banner (under 900 px), the step descriptions (under
 * 720), the paragraph (under 680), the steps themselves (under 600). The lockup, the headline and the promise stay
 * at any height.
 */
const BELOW_900 = "[@media(max-height:899px)]:hidden";
const BELOW_720 = "[@media(max-height:719px)]:hidden";
const BELOW_680 = "[@media(max-height:679px)]:hidden";
const BELOW_600 = "[@media(max-height:599px)]:hidden";

/**
 * The left half of the sign-in and sign-up page: the Kretopia frame (the Wrapped panel's surface, grid, light and HUD
 * corners) around the lockup, the promise, Kreto, and the four steps from a name to a Passport that gets found.
 */
export const AuthBrandingPanel = () => {
  return (
    <aside
      aria-label="Welcome to Kretopia"
      className="auth-branding-panel relative hidden overflow-clip bg-background text-foreground lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-1/2"
    >
      {/* the sunset light behind the frame, as on the landing */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 -top-32 h-[560px] w-[560px] rounded-full opacity-40 blur-[140px]"
        style={{ background: "var(--k-text-gradient)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -right-20 h-[420px] w-[420px] rounded-full opacity-30 blur-[120px]"
        style={{ background: "hsl(var(--k-purple) / 0.15)" }}
      />
      <div aria-hidden className="absolute inset-y-0 right-0 w-px bg-border" />

      <div className="relative z-10 m-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-[hsl(var(--energy)/0.22)] bg-card/70 p-7 backdrop-blur-sm xl:m-6 xl:p-10">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid-quadrille opacity-40" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(60% 45% at 0% 0%, hsl(var(--energy) / 0.10), transparent 70%)" }}
        />
        <HudCorners />

        {/* the lockup */}
        <div className="relative shrink-0">
          <div className="w-fit rounded-lg transition-opacity hover:opacity-80">
            <BrandLogo size="lg" showBeta linkToHome />
          </div>
        </div>

        {/* the promise */}
        <div className="relative flex min-h-0 flex-1 flex-col justify-center gap-[clamp(0.75rem,2.2vh,1.5rem)] py-4">
          <p
            className="inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1"
            style={{ borderColor: kGlow(30), backgroundColor: kGlow(6) }}
          >
            <span className="ai-ambient-breathe h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "hsl(var(--energy))" }} />
            <span className="landing-eyebrow">The Creative Economy OS</span>
          </p>

          <h2
            className="font-semibold leading-[1.08] tracking-[-0.025em] text-foreground"
            style={{ fontFamily: "var(--font-family-brand)", fontSize: "clamp(1.875rem, 2.4vw + 1.2vh, 3rem)" }}
          >
            Where creativity{" "}
            <br />
            <span className="k-gradient-text italic">lives.</span>
          </h2>

          <p className={`max-w-md text-[15px] leading-relaxed text-muted-foreground ${BELOW_680}`}>
            One Passport. Every credit. Every opportunity. Kretopia is the professional home for creators, and Kreto, your
            Executive Producer, runs point.
          </p>

          {/* Kreto, with his promise: one banner instead of a picture and a quote card */}
          <figure className={`relative h-[clamp(104px,13.5vh,140px)] max-w-lg shrink-0 overflow-hidden rounded-2xl border border-border ${BELOW_900}`}>
            <KretoScene scene="passport" lazy={false} className="h-full w-full" />
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/30 to-transparent" />
            <figcaption className="absolute inset-x-0 bottom-0 flex items-center gap-3 p-3.5">
              <KretoMark size="md" />
              <div className="min-w-0">
                <p className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/70">Kreto</p>
                <p className="text-sm font-medium leading-snug text-foreground">
                  “I’ll line up your first three opportunities the moment you sign in.”
                </p>
              </div>
            </figcaption>
          </figure>

          <div className={`max-w-lg ${BELOW_600}`}>
            <p className="landing-eyebrow mb-3 text-muted-foreground">What happens when you sign up</p>
            <ol className="space-y-2.5">
              {STEPS.map(({ icon: Icon, title, body }, i) => (
                <li key={title} className="flex items-start gap-3">
                  <span className="relative mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40">
                    <Icon className="h-4 w-4 text-foreground" aria-hidden />
                    <span className="sr-only">Step {i + 1}: </span>
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-tight text-foreground">{title}</p>
                    <p className={`mt-0.5 text-xs leading-snug text-muted-foreground ${BELOW_720}`}>{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* the promise to keep */}
        <div className="relative shrink-0 border-t border-border/60 pt-4">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Zap className="h-3 w-3 text-[hsl(var(--energy))]" aria-hidden />
            60-second setup · No credit card · Free forever to start
          </p>
          <p className="mt-1.5 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Kretopia · by Thrive Collective</p>
        </div>
      </div>
    </aside>
  );
};
