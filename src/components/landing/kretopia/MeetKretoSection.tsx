/**
 * MeetKretoSection — the Kreto (Executive Producer) chapter.
 *
 * Restrained "liquid glass" command surface. Magenta (#FF2DA1) is the only
 * accent. Every capability listed here maps to something the product
 * actually does, and every generated output is described as editable and
 * user-confirmed — Kreto never writes to the record on its own.
 *
 * Nothing here auto-opens Kreto, requests permissions, or fakes a response.
 */
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  BadgeCheck,
  Sparkles,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { KretoMark } from "@/components/brand/KretoMark";
import { Button } from "@/components/ui/button";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { trackLandingCtaClick } from "@/lib/landingMetrics";
import { TutorialStepper } from "./TutorialStepper";
import { KRETO_TUTORIAL } from "./tutorialContent";
import { chapterRoman } from "./chapterRegistry";

const ACCENT = "#FF2DA1";
// Landing-only trim: the in-app /kreto tutorial (FeatureAITutorial) keeps
// all 3 KRETO_TUTORIAL steps — this section drops the opening "Get
// context-aware guidance" step, which read as a flat capability restate
// rather than an action, leaving the two steps that actually walk through
// the review → confirm loop.
const CHAPTER_TUTORIAL = KRETO_TUTORIAL.slice(1);

const LINES = [
  "I found three opportunities that match your Passport.",
  "Two credits are missing evidence — want me to draft the ask?",
  "I turned yesterday's call into six tasks. Review them?",
  "Here's a bio you can edit before it goes on your Passport.",
];

const CAPABILITIES: { icon: LucideIcon; label: string; body: string }[] = [
  { icon: BadgeCheck, label: "Understands your work", body: "Kreto learns from your Passport, credits, collaborators, projects and goals." },
  { icon: Sparkles, label: "Helps you act", body: "Discover opportunities, prepare briefs, organize projects and draft the next step." },
  { icon: ShieldCheck, label: "You stay in control", body: "Kreto suggests. You decide." },
];

const PROMPTS = [
  "What should I fix on my Passport first?",
  "Draft an intro for this brief.",
  "Who have I worked with on music videos?",
  "Turn this call into next steps.",
];

export const MeetKretoSection = () => {
  const reducedMotion = useReducedMotion();
  const [activeStep, setActiveStep] = useState(0);
  // Once the command surface scrolls into view, its embedded tutorial
  // starts auto-advancing on its own.
  const [inView, setInView] = useState(false);
  // The rotating message reflects whichever tutorial step is active, rather
  // than cycling on its own independent timer.
  const i = activeStep % LINES.length;

  return (
    <section
      id="chapter-kreto"
      className="landing-section relative overflow-hidden border-t border-white/[0.06]"
      style={{ backgroundColor: "#05070D" }}
      aria-labelledby="kreto-title"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(45% 55% at 25% 45%, rgba(255,45,161,0.13), transparent 62%)",
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
            className="lg:col-span-7"
          >
            <p className="landing-eyebrow mb-4">{chapterRoman("chapter-kreto")} · Kreto</p>

            <h2 id="kreto-title" className="landing-h2 landing-glow">
              The Executive Producer for your{" "}
              <span className="italic pink-glow-breathe" style={{ color: ACCENT }}>creative career</span>.
            </h2>

            <p className="landing-sub mt-6 max-w-xl">
              Kreto understands your Passport, organizes your work, explains opportunities
              and helps turn creative conversations into action.
            </p>

            <p
              className="mt-4 max-w-xl text-sm text-white/45"
              style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}
            >
              Your Executive Producer — not a script you talk to.
            </p>

            {/* Capabilities — exactly three, per the charter's positioning */}
            <ul className="mt-9 grid gap-4">
              {CAPABILITIES.map(({ icon: Icon, label, body }) => (
                <li key={label} className="flex gap-3">
                  <span
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: "rgba(255,45,161,0.10)", border: "1px solid rgba(255,45,161,0.22)" }}
                  >
                    <Icon className="h-3.5 w-3.5" style={{ color: ACCENT }} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p
                      className="text-sm font-semibold text-white"
                      style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}
                    >
                      {label}
                    </p>
                    <p
                      className="text-[13px] leading-snug text-white/48"
                      style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}
                    >
                      {body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            <p className="mt-7 max-w-xl text-sm font-semibold italic text-white/80">
              AI that works around your creative career, not instead of it.
            </p>

            <p
              className="mt-4 max-w-xl text-xs leading-relaxed text-white/40"
              style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}
            >
              Everything Kreto produces is labelled AI-assisted, stays editable, can be
              removed, and only becomes part of your official record once you confirm it.
            </p>

            <Button
              asChild
              className="group mt-9 h-auto w-fit rounded-full px-6 py-3 text-sm font-semibold"
              style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}
            >
              <Link
                to="/auth?next=/circle&tab=signup&src=meet_kreto"
                onClick={() =>
                  trackLandingCtaClick({
                    ctaId: "meet_kreto",
                    section: "meet_kreto",
                    label: "Meet Kreto",
                    destinationType: "auth",
                  })
                }
              >
                Meet Kreto
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
              </Link>
            </Button>
          </motion.div>

          {/* Command surface */}
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            onViewportEnter={() => setInView(true)}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.8 }}
            className="lg:col-span-5 w-full"
          >
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                background: "linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.015))",
                border: "1px solid rgba(255,255,255,0.10)",
                boxShadow: "0 30px 80px -40px rgba(255,45,161,0.35)",
              }}
            >
              <div
                className="flex items-center gap-3 px-4 py-3"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
              >
                <KretoMark size="md" />
                <div className="min-w-0">
                  <p
                    className="text-sm font-semibold text-white"
                    style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}
                  >
                    Kreto
                  </p>
                  <p
                    className="text-[10px] uppercase tracking-[0.22em] text-white/35"
                    style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}
                  >
                    Executive Producer
                  </p>
                </div>
                <span
                  className="ml-auto rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em]"
                  style={{ color: ACCENT, backgroundColor: "rgba(255,45,161,0.12)" }}
                >
                  AI-assisted
                </span>
              </div>

              <div className="px-4 py-5 min-h-[92px] flex items-center">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={i}
                    initial={reducedMotion ? false : { opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reducedMotion ? undefined : { opacity: 0, y: -4 }}
                    transition={{ duration: 0.45 }}
                    className="text-[15px] leading-relaxed text-white/85"
                    style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}
                  >
                    {LINES[i]}
                  </motion.p>
                </AnimatePresence>
              </div>

              <div
                className="px-4 py-4"
                style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
              >
                <p
                  className="text-[10px] uppercase tracking-[0.24em] text-white/30 mb-3"
                  style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}
                >
                  Try asking
                </p>
                <div className="flex flex-wrap gap-2">
                  {PROMPTS.map((p) => (
                    <Link
                      key={p}
                      to={`/auth?next=${encodeURIComponent("/circle")}`}
                      onClick={() =>
                        trackLandingCtaClick({
                          ctaId: "meet_kreto_try_asking",
                          section: "meet_kreto",
                          label: p,
                          destinationType: "auth",
                        })
                      }
                      className="rounded-full border border-white/12 px-3 py-1.5 text-xs text-white/60 transition-colors hover:border-white/30 hover:text-white/90"
                      style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}
                    >
                      {p}
                    </Link>
                  ))}
                </div>
              </div>

              {/* Tutorial, folded straight into the command surface — the
                  card that talks like Kreto also teaches how Kreto works. */}
              <div className="px-4 py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                <p
                  className="text-[10px] uppercase tracking-[0.24em] text-white/30 mb-1"
                  style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}
                >
                  How it works
                </p>
                <TutorialStepper
                  steps={CHAPTER_TUTORIAL}
                  label="Kreto tutorial"
                  activeStep={activeStep}
                  onStepChange={setActiveStep}
                  autoPlay={inView}
                />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default MeetKretoSection;
