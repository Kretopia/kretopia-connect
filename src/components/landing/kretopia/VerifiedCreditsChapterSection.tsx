/**
 * VerifiedCreditsChapterSection — Chapter IV. Bridges the landing tutorial
 * to the real /credits page. Follows MeetKretoSection's precedent: a
 * stylized command-surface mockup rather than a stock photo (there's no
 * logged-in user's real data to show pre-login), with clearly illustrative
 * example content — the same pattern MeetKretoSection uses for its
 * rotating "Try asking" prompts.
 *
 * Terminology matches the product exactly: "Verified Credit" is the
 * official term, "Passport Stamp" is the visual metaphor for the same
 * thing once fully confirmed. The tier progression shown here is real
 * (EVIDENCE_STATE_ORDER, backed by actual credits.verification_status /
 * verification_url / endorsement_count fields) — only the example credit
 * itself ("Documentary · Sound Design") is illustrative.
 */
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Fingerprint, Link2, ShieldCheck, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { EvidenceStateBadge } from "@/components/credits/EvidenceStateBadge";
import { EVIDENCE_STATE_ORDER, type EvidenceState } from "@/lib/creditEvidence";
import { trackLandingCtaClick } from "@/lib/landingMetrics";
import { TutorialStepper } from "./TutorialStepper";
import { VERIFIED_CREDITS_TUTORIAL } from "./tutorialContent";
import { chapterRoman } from "./chapterRegistry";

const ACCENT = "#FF2DA1";
// Landing-only trim: the in-app /credits tutorial (FeatureAITutorial) keeps
// all 3 VERIFIED_CREDITS_TUTORIAL steps — this section drops the opening
// "Add or confirm a credit" step (already covered by the chapter's own
// copy above), leaving Co-Sign → Passport Stamp as the two-step demo.
const CHAPTER_TUTORIAL = VERIFIED_CREDITS_TUTORIAL.slice(1);
// The final tutorial step ("Earn a Passport Stamp") always shows the Stamp
// reveal, not an evidence badge — so the demo only needs states for the
// steps before it, derived from the tutorial's own length rather than a
// hardcoded count that can drift out of sync when steps are added/removed.
const DEMO_SEQUENCE: EvidenceState[] = EVIDENCE_STATE_ORDER.slice(0, CHAPTER_TUTORIAL.length - 1);

const WHY_IT_MATTERS = [
  { icon: UserCheck, label: "Anyone can claim", body: "Claiming a credit is the start, not the proof." },
  { icon: Link2, label: "Evidence makes it real", body: "A link to the original listing moves it forward." },
  { icon: ShieldCheck, label: "Confirmation makes it trusted", body: "A co-sign or organization confirms it — that's what becomes a Passport Stamp." },
];

export const VerifiedCreditsChapterSection = () => {
  const reducedMotion = useReducedMotion();
  const [activeStep, setActiveStep] = useState(0);
  const isStamped = activeStep === CHAPTER_TUTORIAL.length - 1;
  const currentState = DEMO_SEQUENCE[Math.min(activeStep, DEMO_SEQUENCE.length - 1)];
  // Once the example-credit card scrolls into view, its embedded tutorial
  // starts auto-advancing on its own.
  const [inView, setInView] = useState(false);

  return (
    <section
      id="chapter-verified-credits"
      className="landing-section relative overflow-hidden border-t border-white/[0.06]"
      style={{ backgroundColor: "#05070D" }}
      aria-labelledby="verified-credits-title"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(45% 55% at 75% 45%, rgba(255,45,161,0.11), transparent 62%)",
        }}
      />

      <div className="relative mx-auto max-w-[1100px]">
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          {/* Copy */}
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7 }}
            className="lg:col-span-7 lg:order-2"
          >
            <p className="landing-eyebrow mb-4">{chapterRoman("chapter-verified-credits")} · Verified Credits</p>

            <h2 id="verified-credits-title" className="landing-h2 landing-glow">
              Confirm the work that{" "}
              <span className="italic pink-glow-breathe" style={{ color: ACCENT }}>proves your experience</span>.
            </h2>

            <p className="landing-sub mt-6 max-w-xl">
              A Verified Credit is a project on your record backed by real evidence — not just a
              claim. Once it's fully confirmed, it becomes a Passport Stamp: the visible proof on
              your Creative Passport.
            </p>

            <ul className="mt-9 space-y-4">
              {WHY_IT_MATTERS.map(({ icon: Icon, label, body }) => (
                <li key={label} className="flex gap-3">
                  <span
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: "rgba(255,45,161,0.10)", border: "1px solid rgba(255,45,161,0.22)" }}
                  >
                    <Icon className="h-3.5 w-3.5" style={{ color: ACCENT }} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white" style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}>
                      {label}
                    </p>
                    <p className="text-[13px] leading-snug text-white/48" style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}>
                      {body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            <Button
              asChild
              className="group mt-9 h-auto w-fit rounded-full px-6 py-3 text-sm font-semibold"
              style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}
            >
              <Link
                to="/credits"
                onClick={() =>
                  trackLandingCtaClick({
                    ctaId: "explore_verified_credits",
                    section: "verified_credits",
                    label: "Explore Verified Credits",
                    destinationType: "internal",
                  })
                }
              >
                Explore Verified Credits
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
              </Link>
            </Button>
          </motion.div>

          {/* Illustrative evidence-progression mockup */}
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            onViewportEnter={() => setInView(true)}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.8 }}
            className="lg:col-span-5 lg:order-1 w-full"
          >
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                background: "linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.015))",
                border: "1px solid rgba(255,255,255,0.10)",
                boxShadow: "0 30px 80px -40px rgba(255,45,161,0.35)",
              }}
            >
              <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full ai-ambient-breathe"
                  style={{ backgroundColor: "rgba(255,45,161,0.14)" }}
                >
                  <Fingerprint className="h-3.5 w-3.5" style={{ color: ACCENT }} aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white" style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}>
                    Example credit
                  </p>
                  <p className="text-[10px] uppercase tracking-[0.22em] text-white/35" style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}>
                    Illustrative — not live data
                  </p>
                </div>
              </div>

              <div className="px-4 py-6 min-h-[168px] flex flex-col justify-center gap-4">
                <p className="text-[15px] font-medium text-white/85" style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}>
                  "Coastline" — Documentary · Sound Design
                </p>

                <AnimatePresence mode="wait">
                  {!isStamped ? (
                    <motion.div
                      key={currentState}
                      initial={reducedMotion ? false : { opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reducedMotion ? undefined : { opacity: 0, y: -4 }}
                      transition={{ duration: 0.4 }}
                    >
                      <EvidenceStateBadge state={currentState} size="md" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="stamp"
                      initial={reducedMotion ? false : { opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={reducedMotion ? undefined : { opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.45, ease: [0.2, 0.65, 0.3, 0.95] }}
                      className="inline-flex items-center gap-2 self-start rounded-full px-4 py-2"
                      style={{ backgroundColor: ACCENT }}
                    >
                      <ShieldCheck className="h-4 w-4" style={{ color: "#05070D" }} aria-hidden />
                      <span className="text-sm font-bold" style={{ fontFamily: "'Satoshi', 'Inter', sans-serif", color: "#05070D" }}>
                        Passport Stamp
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Progress dots */}
                <div className="flex items-center gap-1.5 mt-1" aria-hidden>
                  {DEMO_SEQUENCE.map((s, i) => (
                    <span
                      key={s}
                      className="h-1 rounded-full transition-all duration-300"
                      style={{
                        width: i <= activeStep || isStamped ? "18px" : "6px",
                        backgroundColor: i <= activeStep || isStamped ? ACCENT : "rgba(255,255,255,0.15)",
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Tutorial, folded straight into the card — the same demo
                  driving the evidence badge above also drives this. */}
              <div className="px-4 py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                <p
                  className="text-[10px] uppercase tracking-[0.24em] text-white/30 mb-1"
                  style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}
                >
                  How it works
                </p>
                <TutorialStepper
                  steps={CHAPTER_TUTORIAL}
                  label="Verified Credits tutorial"
                  activeStep={activeStep}
                  onStepChange={setActiveStep}
                  autoPlay={inView}
                />
              </div>

              <div className="px-4 py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                <p className="text-[12px] leading-relaxed text-white/45" style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}>
                  Every real credit on Kretopia moves through these same, honestly-labeled stages —
                  nothing is called "Verified" without evidence behind it.
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Closing beat — carries the one line from the former, separate
            TrustSection, which otherwise just re-showed this same evidence
            progression a scroll later with no CTA and no click tracking. */}
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mt-14 text-center"
        >
          <p className="text-lg font-semibold italic text-white/85">
            Don't just claim the work.{" "}
            <span style={{ color: ACCENT }}>Prove it.</span>
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default VerifiedCreditsChapterSection;
