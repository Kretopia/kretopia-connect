/**
 * ForOrganisationsSection — the business-facing wedge. Deliberately shorter
 * than the creator journey above it, and never allowed to compete visually
 * with the hero. Both CTAs route to real, existing flows:
 *   - "Hire Through Kretopia" -> /post-opportunity (same route the Navbar's
 *     "Hire Talent" button already uses)
 *   - "Partner With Us" -> /auth?tab=signup, where a real "company" account
 *     type already exists (src/pages/Auth.tsx) with its own onboarding
 *     (/company-onboarding) — not a fabricated partner flow.
 *
 * v2 (gap + branding + CTA power pass):
 * - Dropped the plain `border-t` hard-cut at the top — ClosingCTASection
 *   now carries its own soft accent-gradient seam into this section, so a
 *   second hairline here would double the transition instead of smoothing
 *   it. See the gap caveat in ClosingCTASection's own header: the real
 *   black-space culprit is most likely FixedProgressiveCard's scroll-pin
 *   height, which lives outside both of these files.
 * - Top padding tightened (py-16/20 -> pt-12/14, pb unchanged) specifically
 *   at the seam with ClosingCTASection, without touching the bottom
 *   spacing that leads into whatever section follows this one.
 * - Hover lift + explicit focus-visible ring added to both CTA buttons.
 * - One subtle, low-opacity Kreto silhouette (desktop only, aria-hidden)
 *   added as the "very subtle Kreto element" the brief allowed for —
 *   kept small and faint enough not to compete with the copy or CTAs.
 */
import { color, motion } from "framer-motion";
import { Search, IdCard, Megaphone, Users2, CheckCircle2 } from "lucide-react";
import { GlassCta } from "@/components/ui/glass-cta";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { trackLandingCtaClick } from "@/lib/landingMetrics";
import { KretoCharacter } from "@/components/brand/KretoCharacter";

const ACCENT = "#FF2DA1";

const CAPABILITIES = [
  { icon: Search, label: "Find creatives" },
  { icon: IdCard, label: "Review Creative Passports" },
  { icon: Megaphone, label: "Post opportunities" },
  { icon: Users2, label: "Build teams" },
  { icon: CheckCircle2, label: "Confirm completed work" },
];

export const ForOrganisationsSection = () => {
  const reducedMotion = useReducedMotion();

  return (
    <section
      id="chapter-organisations"
      className="relative pt-12 sm:pt-14 pb-16 sm:pb-20"
      style={{ backgroundColor: "#05070D" }}
      aria-labelledby="for-orgs-title"
    >
      {/* Very subtle brand silhouette — desktop only, purely decorative,
          low opacity so it never competes with the copy or CTAs. */}
      <KretoCharacter
        variant="producer"
        size={220}
        floatAmplitude={0}
        aria-hidden
        className="pointer-events-none absolute -right-6 bottom-0 hidden opacity-[0.05] lg:block"
      />

      <div className="relative mx-auto max-w-[1320px] px-5 sm:px-8 lg:px-12">
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7 }}
          className="max-w-2xl"
        >
          <p className="landing-eyebrow mb-4">Hiring creative talent?</p>
          <h2 id="for-orgs-title" className="landing-h2 landing-glow">
            Find people through the work <span className="landing-accent">they've actually done.</span>
          </h2>
          <p className="landing-sub mt-4 max-w-xl">
            Kretopia helps hotels, agencies, festivals, production companies, brands and creative teams discover talent through verified creative context, not just profiles and follower counts.
          </p>
        </motion.div>

        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mt-8 flex flex-wrap gap-2"
        >
          {CAPABILITIES.map(({ icon: Icon, label }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.02] px-3 py-1.5 text-xs text-white/65"
              style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}
            >
              <Icon className="k-gradient-icon h-3 w-3" aria-hidden />
              {label}
            </span>
          ))}
        </motion.div>

        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-8 flex flex-wrap items-center gap-3"
        >
          <GlassCta
            to="/post-opportunity"
            onClick={() =>
              trackLandingCtaClick({
                ctaId: "hire_through_kretopia",
                section: "for_organisations",
                label: "Hire Through Kretopia",
                destinationType: "internal",
              })
            }
          >
            Hire Through Kretopia
          </GlassCta>
          <GlassCta
            to="/auth?tab=signup&src=for_organisations"
            onClick={() =>
              trackLandingCtaClick({
                ctaId: "partner_with_us",
                section: "for_organisations",
                label: "Partner With Us",
                destinationType: "auth",
              })
            }
          >
            Partner With Us
          </GlassCta>
        </motion.div>
      </div>
    </section>
  );
};

export default ForOrganisationsSection;