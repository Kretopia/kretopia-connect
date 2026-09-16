/**
 * ForOrganisationsSection — the business-facing wedge. Deliberately shorter
 * than the creator journey above it, and never allowed to compete visually
 * with the hero. Both CTAs route to real, existing flows:
 *   - "Hire Through Kretopia" -> /post-opportunity (same route the Navbar's
 *     "Hire Talent" button already uses)
 *   - "Partner With Us" -> /auth?tab=signup, where a real "company" account
 *     type already exists (src/pages/Auth.tsx) with its own onboarding
 *     (/company-onboarding) — not a fabricated partner flow.
 */
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Search, IdCard, Megaphone, Users2, CheckCircle2, Briefcase, Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { trackLandingCtaClick } from "@/lib/landingMetrics";

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
      className="relative border-t border-white/[0.05] py-16 sm:py-20"
      style={{ backgroundColor: "#05070D" }}
      aria-labelledby="for-orgs-title"
    >
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
              <Icon className="h-3 w-3" style={{ color: ACCENT }} aria-hidden />
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
          <Button asChild className="h-auto w-fit rounded-full px-5 py-2.5 text-sm font-semibold" style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}>
            <Link
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
              <Briefcase className="h-4 w-4" aria-hidden />
              Hire Through Kretopia
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-auto w-fit rounded-full px-5 py-2.5 text-sm font-semibold" style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}>
            <Link
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
              <Handshake className="h-4 w-4" aria-hidden />
              Partner With Us
            </Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
};

export default ForOrganisationsSection;
