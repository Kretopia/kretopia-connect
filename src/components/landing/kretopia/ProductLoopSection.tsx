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
import { KretopiaIcon } from "@/components/pricing/KretopiaIcon";
import { analytics } from "@/lib/analytics";
import { cn } from "@/lib/utils";

const STAGES = [
  { key: "passport", icon: "passport", label: "Passport", body: "Your record of what you've actually done." },
  { key: "scout", icon: "scout", label: "Scout", body: "Finds the gigs and briefs that fit your record." },
  { key: "match", icon: "match", label: "Match", body: "Connects you with the right collaborators." },
  { key: "studio", icon: "studio", label: "Studio", body: "Where the work happens, start to finish." },
  { key: "completed", icon: "success", label: "Completed Work", body: "Real outcomes — credits, payment, proof." },
  { key: "stronger", icon: "passport", label: "Stronger Passport", body: "Every finished project adds to your record." },
] as const;

const stageAppearance = (active: boolean) => active
  ? "border-foreground/20 bg-foreground/10 text-foreground"
  : "border-foreground/10 bg-foreground/[0.025] text-muted-foreground";

export const ProductLoopSection = () => {
  const [active, setActive] = useState(0);

  const setStage = (i: number) => {
    setActive(i);
    analytics.featureUsed("landing_product_loop_stage", { stage: STAGES[i].key });
  };

  return (
    <section
      id="chapter-loop"
      className="landing-section relative"
      aria-labelledby="product-loop-title"
    >
      <div className="relative mx-auto max-w-[1320px]">
        <motion.div
          initial={false}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7 }}
          className="max-w-xl"
        >
          <p className="landing-eyebrow mb-4">Your Passport does more</p>
          <h2 id="product-loop-title" data-kreto-backflip className="landing-h2 landing-glow">
            {/* Two-line title contract: plain line + gradient line, no
                trailing period (landing-wide rule). */}
            Your past work should help create<br />
            <span className="landing-accent">your next opportunity</span>
          </h2>
          <p className="landing-sub mt-5">
            As your Passport grows, Kretopia understands more about what you do, who you've worked with and where you
            want to go next. That powers everything around it.
          </p>
        </motion.div>

        {/* Desktop: horizontal chain with a loop-back cue */}
        <motion.div
          initial={false}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="mt-12 hidden lg:flex items-center gap-1"
        >
          {STAGES.map(({ key, icon, label }, i) => {
            const isActive = i === active;
            return (
              <div key={key} className="flex items-center gap-1 flex-1">
                <button
                  type="button"
                  onMouseEnter={() => setStage(i)}
                  onFocus={() => setStage(i)}
                  onClick={() => setStage(i)}
                  aria-pressed={isActive}
                  className={cn(
                    "flex w-full flex-col items-center gap-2 rounded-2xl border p-4 text-center transition-colors",
                    stageAppearance(isActive),
                  )}
                >
                  <KretopiaIcon name={icon} size={20} className="h-5 w-5" />
                  <span
                    className="text-[10px] font-bold uppercase tracking-[0.14em]"
                    style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}
                  >
                    {label}
                  </span>
                </button>
                {i < STAGES.length - 1 ? (
                  <KretopiaIcon name="arrow-right" size={16} className="shrink-0 text-muted-foreground" />
                ) : (
                  <KretopiaIcon name="refresh" size={16} className="shrink-0 text-muted-foreground" />
                )}
              </div>
            );
          })}
        </motion.div>

        {/* Mobile: vertical step list */}
        <motion.div
          initial={false}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="mt-10 flex lg:hidden flex-col gap-2"
        >
          {STAGES.map(({ key, icon, label, body }, i) => {
            const isActive = i === active;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setStage(isActive ? active : i)}
                aria-pressed={isActive}
                className={cn(
                  "flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors",
                  stageAppearance(isActive),
                )}
              >
                <KretopiaIcon name={icon} size={20} className="h-5 w-5 shrink-0 mt-0.5" />
                <div>
                  <p
                    className="w-fit text-[10px] font-bold uppercase tracking-[0.14em] mb-1"
                    style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}
                  >
                    {label}
                  </p>
                  <p className="text-xs text-muted-foreground" style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}>
                    {body}
                  </p>
                </div>
              </button>
            );
          })}
        </motion.div>

        {/* Active stage explanation — desktop only, mobile shows it inline per-card above */}
        <div className="hidden lg:block mt-6 min-h-[3.5rem]">
          <p className="text-sm text-muted-foreground max-w-lg" style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}>
            <span className="k-gradient-text" style={{ fontWeight: 700 }}>
              {STAGES[active].label}.
            </span>{" "}
            {STAGES[active].body}
          </p>
        </div>
      </div>
    </section>
  );
};

export default ProductLoopSection;
