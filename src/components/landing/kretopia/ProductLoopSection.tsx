/**
 * ProductLoopSection — "Your Passport does more." Ties Passport, Scout,
 * Match, Studio and completed work together as one closed loop instead of
 * five unrelated chapters. Real <button> elements, keyboard-operable,
 * hover or click sets the active stage; explanation text is fixed (no
 * fake data, no per-stage metrics). Mobile falls back to a vertical step
 * list — the same six stages, same copy, no horizontal loop geometry to
 * fight on narrow screens.
 */
import { useState } from "react";
import { motion } from "framer-motion";
import { Fingerprint, Radar, Users, Clapperboard, CheckCircle2, Sparkles, RotateCw } from "lucide-react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { analytics } from "@/lib/analytics";

const ACCENT = "#FF2DA1";

const STAGES = [
  { key: "passport", icon: Fingerprint, label: "Passport", body: "Your record of what you've actually done." },
  { key: "scout", icon: Radar, label: "Scout", body: "Finds the gigs and briefs that fit your record." },
  { key: "match", icon: Users, label: "Match", body: "Connects you with the right collaborators." },
  { key: "studio", icon: Clapperboard, label: "Studio", body: "Where the work happens, start to finish." },
  { key: "completed", icon: CheckCircle2, label: "Completed Work", body: "Real outcomes — credits, payment, proof." },
  { key: "stronger", icon: Sparkles, label: "Stronger Passport", body: "Every finished project adds to your record." },
] as const;

export const ProductLoopSection = () => {
  const reducedMotion = useReducedMotion();
  const [active, setActive] = useState(0);

  const setStage = (i: number) => {
    setActive(i);
    analytics.featureUsed("landing_product_loop_stage", { stage: STAGES[i].key });
  };

  return (
    <section
      id="chapter-loop"
      className="landing-section relative border-t border-white/[0.05]"
      style={{ backgroundColor: "#05070D" }}
      aria-labelledby="product-loop-title"
    >
      <div className="relative mx-auto max-w-[1320px]">
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7 }}
          className="max-w-xl"
        >
          <p className="landing-eyebrow mb-4">Your Passport does more</p>
          <h2 id="product-loop-title" className="landing-h2 landing-glow">
            Your past work should help create <span className="landing-accent">your next opportunity.</span>
          </h2>
          <p className="landing-sub mt-5">
            As your Passport grows, Kretopia understands more about what you do, who you've worked with and where you want to go next. That powers everything around it.
          </p>
        </motion.div>

        {/* Desktop: horizontal chain with a loop-back cue */}
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="mt-12 hidden lg:flex items-center gap-1"
        >
          {STAGES.map(({ key, icon: Icon, label }, i) => {
            const isActive = i === active;
            return (
              <div key={key} className="flex items-center gap-1 flex-1">
                <button
                  type="button"
                  onMouseEnter={() => setStage(i)}
                  onFocus={() => setStage(i)}
                  onClick={() => setStage(i)}
                  aria-pressed={isActive}
                  className="flex w-full flex-col items-center gap-2 rounded-2xl border p-4 text-center transition-colors"
                  style={{
                    borderColor: isActive ? `${ACCENT}66` : "rgba(255,255,255,0.1)",
                    backgroundColor: isActive ? `${ACCENT}14` : "rgba(255,255,255,0.02)",
                  }}
                >
                  <Icon className="h-5 w-5" style={{ color: isActive ? ACCENT : "rgba(255,255,255,0.5)" }} aria-hidden />
                  <span
                    className="text-[10px] font-bold uppercase tracking-[0.14em]"
                    style={{ color: isActive ? ACCENT : "rgba(255,255,255,0.7)", fontFamily: "'Satoshi', 'Inter', sans-serif" }}
                  >
                    {label}
                  </span>
                </button>
                {i < STAGES.length - 1 ? (
                  <span className="text-white/25 text-lg shrink-0" aria-hidden>→</span>
                ) : (
                  <RotateCw className="h-4 w-4 shrink-0 text-white/25" aria-hidden />
                )}
              </div>
            );
          })}
        </motion.div>

        {/* Mobile: vertical step list */}
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="mt-10 flex lg:hidden flex-col gap-2"
        >
          {STAGES.map(({ key, icon: Icon, label, body }, i) => {
            const isActive = i === active;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setStage(isActive ? active : i)}
                aria-pressed={isActive}
                className="flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors"
                style={{
                  borderColor: isActive ? `${ACCENT}66` : "rgba(255,255,255,0.1)",
                  backgroundColor: isActive ? `${ACCENT}14` : "rgba(255,255,255,0.02)",
                }}
              >
                <Icon className="h-5 w-5 shrink-0 mt-0.5" style={{ color: isActive ? ACCENT : "rgba(255,255,255,0.5)" }} aria-hidden />
                <div>
                  <p
                    className="text-[10px] font-bold uppercase tracking-[0.14em] mb-1"
                    style={{ color: isActive ? ACCENT : "rgba(255,255,255,0.7)", fontFamily: "'Satoshi', 'Inter', sans-serif" }}
                  >
                    {label}
                  </p>
                  <p className="text-xs text-white/55" style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}>{body}</p>
                </div>
              </button>
            );
          })}
        </motion.div>

        {/* Active stage explanation — desktop only, mobile shows it inline per-card above */}
        <div className="hidden lg:block mt-6 min-h-[3.5rem]">
          <p className="text-sm text-white/70 max-w-lg" style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}>
            <span style={{ color: ACCENT, fontWeight: 700 }}>{STAGES[active].label}.</span>{" "}
            {STAGES[active].body}
          </p>
        </div>

        <motion.p
          initial={reducedMotion ? false : { opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-8 text-center text-sm font-semibold italic text-white/80"
        >
          Every project strengthens what comes next.
        </motion.p>
      </div>
    </section>
  );
};

export default ProductLoopSection;
