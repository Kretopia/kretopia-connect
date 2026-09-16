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
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { trackLandingCta } from "@/lib/landingFunnel";

export const InlineSignupBar = () => (
  <section
    id="inline-signup"
    className="relative border-t border-white/[0.05]"
    style={{ backgroundColor: "#05070D" }}
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

      <Link
        to="/auth?tab=signup&intent=inline_bar"
        onClick={() => trackLandingCta("inline_bar_claim_passport", "inline_signup")}
        className="btn-landing-primary group flex h-auto w-full shrink-0 items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold sm:w-auto"
        style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}
      >
        Claim your Passport
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </Link>
    </div>
  </section>
);

export default InlineSignupBar;
