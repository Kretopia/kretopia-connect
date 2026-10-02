/**
 * InlineSignupBar — a single restrained conversion beat placed high on the
 * page, immediately after the first proof section.
 *
 * The landing page's only real signup moment used to be the ClosingCTASection
 * at the very bottom: measured, most visitors never scrolled far enough to
 * see any CTA at all. This gives a convinced-early visitor somewhere to go
 * without scrolling the full editorial spine, and it is instrumented so the
 * funnel view can tell whether it is doing any work.
 */
import { GlassCta } from "@/components/ui/glass-cta";
import { trackLandingCta } from "@/lib/landingFunnel";

export const InlineSignupBar = () => (
  <section
    id="inline-signup"
    className="relative"
    aria-labelledby="inline-signup-title"
  >
    <div className="mx-auto flex max-w-[1100px] flex-col items-center gap-5 px-5 py-14 text-center sm:flex-row sm:justify-between sm:gap-8 sm:px-8 sm:text-left lg:px-12">
      <div>
        <p
          id="inline-signup-title"
          className="text-lg font-semibold text-white sm:text-xl"
          style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}
        >
          Your work already exists. Claim the record.
        </p>
        <p
          className="mt-1.5 text-sm text-white/50"
          style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}
        >
          Free forever · No credit card · 2-minute setup
        </p>
      </div>

      <GlassCta
        to="/auth?tab=signup&intent=inline_bar"
        onClick={() => trackLandingCta("inline_bar_claim_passport", "inline_signup")}
        className="w-full shrink-0 sm:w-auto"
      >
        Claim your Passport
      </GlassCta>
    </div>
  </section>
);

export default InlineSignupBar;
