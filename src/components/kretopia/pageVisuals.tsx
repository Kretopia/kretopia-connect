/**
 * Step-reactive visual previews for the standalone editorial pages
 * (Verified Credits, Spotlight, About). Built on the same VisualCardShell
 * as the landing chapters so the frame, spacing and motion are identical.
 * All content is illustrative — never presented as live account data.
 */
import { AnimatePresence, motion } from "framer-motion";
import {
  ListChecks, HandHeart, Stamp, ShieldCheck, Link2,
  BookOpen, TrendingUp, Play,
  Fingerprint, Compass, LayoutGrid,
} from "lucide-react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { VisualCardShell } from "@/components/landing/kretopia/visualShell";

const ACCENT = "#FF2DA1";

const fade = (reducedMotion: boolean) => ({
  initial: reducedMotion ? false : { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: reducedMotion ? undefined : { opacity: 0, y: -8 },
  transition: { duration: 0.32 },
});

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between rounded-xl bg-white/[0.04] px-3.5 py-3">
    <span className="text-[13px] text-white/55">{label}</span>
    <span className="text-[13px] font-medium text-white">{value}</span>
  </div>
);

/* ─── Verified Credits ─── */
export const CreditsVisual = ({ activeStep }: { activeStep: number }) => {
  const reducedMotion = useReducedMotion();
  return (
    <VisualCardShell icon={ListChecks} label="Example credit" tag="Illustrative — not live data">
      <p className="text-[15px] font-medium text-white/85">"Coastline" — Documentary · Sound Design</p>

      <AnimatePresence mode="wait">
        {activeStep === 0 && (
          <motion.div key="c0" {...fade(reducedMotion)} className="space-y-2.5">
            <Row label="Role" value="Sound Designer" />
            <Row label="Year" value="2026" />
            <div className="flex items-center gap-2 rounded-xl border border-white/10 px-3.5 py-3">
              <Link2 className="h-3.5 w-3.5 shrink-0" style={{ color: ACCENT }} aria-hidden />
              <span className="text-[13px] text-white/60 truncate">Evidence link attached</span>
            </div>
            <p className="text-xs text-white/35">Claimed — the start of the record, not the proof.</p>
          </motion.div>
        )}
        {activeStep === 1 && (
          <motion.div key="c1" {...fade(reducedMotion)} className="space-y-2.5">
            <div className="flex items-center gap-3 rounded-xl bg-white/[0.04] p-3.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white">AR</span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium text-white truncate">Ana Ruiz · Director</p>
                <p className="text-xs text-white/45">Co-sign requested — WhatsApp</p>
              </div>
              <HandHeart className="h-4 w-4 shrink-0" style={{ color: ACCENT }} aria-hidden />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {["Yes, we worked together", "I hired them", "I was there"].map((t) => (
                <span key={t} className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] text-white/50">{t}</span>
              ))}
            </div>
            <p className="text-xs text-white/35">One tap from them. No account required.</p>
          </motion.div>
        )}
        {activeStep === 2 && (
          <motion.div key="c2" {...fade(reducedMotion)} className="space-y-3">
            <motion.span
              initial={reducedMotion ? false : { opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.45, ease: [0.2, 0.65, 0.3, 0.95] }}
              className="inline-flex items-center gap-2 self-start rounded-full px-4 py-2"
              style={{ backgroundColor: ACCENT }}
            >
              <ShieldCheck className="h-4 w-4 text-white" aria-hidden />
              <span className="text-sm font-bold text-white">Passport Stamp</span>
            </motion.span>
            <Row label="Confirmed by" value="Ana Ruiz" />
            <Row label="Visible on" value="Creative Passport" />
            <p className="text-xs text-white/35">Proof anyone can check — no login needed.</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-1.5 pt-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1 rounded-full transition-all duration-500"
            style={{ width: i === activeStep ? 26 : 10, backgroundColor: i <= activeStep ? ACCENT : "rgba(255,255,255,0.14)" }}
          />
        ))}
      </div>
    </VisualCardShell>
  );
};

/* ─── Spotlight ─── */
export const SpotlightVisual = ({ activeStep }: { activeStep: number }) => {
  const reducedMotion = useReducedMotion();
  return (
    <VisualCardShell icon={BookOpen} label="Spotlight preview" tag="Illustrative — not live data">
      <AnimatePresence mode="wait">
        {activeStep === 0 && (
          <motion.div key="s0" {...fade(reducedMotion)} className="space-y-2.5">
            {[
              { t: "The producers rebuilding Caribbean sound", k: "Interview · 8 min read" },
              { t: "Inside a 12-day creative exchange", k: "Feature · 6 min read" },
              { t: "What a verified credit is really worth", k: "Essay · 4 min read" },
            ].map((a) => (
              <div key={a.t} className="rounded-xl bg-white/[0.04] p-3.5">
                <p className="text-[14px] font-medium text-white leading-snug">{a.t}</p>
                <p className="text-xs text-white/40 mt-1">{a.k}</p>
              </div>
            ))}
          </motion.div>
        )}
        {activeStep === 1 && (
          <motion.div key="s1" {...fade(reducedMotion)} className="space-y-3">
            <div className="flex items-center gap-3 rounded-xl bg-white/[0.04] p-3.5">
              <span className="flex h-11 w-11 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(255,45,161,0.16)" }}>
                <Play className="h-4 w-4" style={{ color: ACCENT }} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium text-white truncate">Ep. 12 — Making it as a freelance DP</p>
                <p className="text-xs text-white/45">42 min · Kretopia Podcast</p>
              </div>
            </div>
            <div className="flex items-end gap-[3px] h-10" aria-hidden>
              {Array.from({ length: 34 }).map((_, i) => (
                <span
                  key={i}
                  className="flex-1 rounded-full"
                  style={{
                    height: `${20 + Math.abs(Math.sin(i * 0.7)) * 80}%`,
                    backgroundColor: i < 14 ? ACCENT : "rgba(255,255,255,0.14)",
                  }}
                />
              ))}
            </div>
            <p className="text-xs text-white/35">Press play — episodes stream while you browse.</p>
          </motion.div>
        )}
        {activeStep === 2 && (
          <motion.div key="s2" {...fade(reducedMotion)} className="space-y-2.5">
            <div className="flex flex-wrap gap-1.5">
              {["Latest", "Most read", "Trending"].map((t, i) => (
                <span
                  key={t}
                  className="rounded-full px-3 py-1.5 text-[11px] font-semibold"
                  style={
                    i === 2
                      ? { backgroundColor: ACCENT, color: "#fff" }
                      : { border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.55)" }
                  }
                >
                  {t}
                </span>
              ))}
            </div>
            {[
              { t: "How co-signs changed hiring", v: "4.2k reads" },
              { t: "Bali sessions: the full recap", v: "3.1k reads" },
            ].map((r) => (
              <div key={r.t} className="flex items-center justify-between rounded-xl bg-white/[0.04] px-3.5 py-3">
                <span className="text-[13px] text-white/75 truncate pr-3">{r.t}</span>
                <span className="inline-flex items-center gap-1 text-[11px] shrink-0" style={{ color: ACCENT }}>
                  <TrendingUp className="h-3 w-3" aria-hidden />
                  {r.v}
                </span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-1.5 pt-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1 rounded-full transition-all duration-500"
            style={{ width: i === activeStep ? 26 : 10, backgroundColor: i <= activeStep ? ACCENT : "rgba(255,255,255,0.14)" }}
          />
        ))}
      </div>
    </VisualCardShell>
  );
};

/* ─── About / the loop ─── */
export const AboutVisual = ({ activeStep }: { activeStep: number }) => {
  const reducedMotion = useReducedMotion();
  const stages = [
    { icon: Fingerprint, label: "Passport", body: "Your work, collected in one living record." },
    { icon: ShieldCheck, label: "Trust", body: "Co-signs turn claims into verified credits." },
    { icon: Compass, label: "Opportunity", body: "Scout surfaces the gigs that fit the record." },
    { icon: LayoutGrid, label: "Studio", body: "Deliver, get paid — the Passport grows." },
  ];
  const Active = stages[Math.min(activeStep, stages.length - 1)];

  return (
    <VisualCardShell icon={Stamp} label="The Kretopia loop" tag="Illustrative — not live data">
      <div className="grid grid-cols-4 gap-1.5">
        {stages.map((s, i) => (
          <div
            key={s.label}
            className="rounded-xl px-2 py-3 text-center transition-all duration-500"
            style={{
              backgroundColor: i === activeStep ? "rgba(255,45,161,0.14)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${i === activeStep ? "rgba(255,45,161,0.4)" : "rgba(255,255,255,0.07)"}`,
            }}
          >
            <s.icon
              className="h-4 w-4 mx-auto mb-1.5"
              style={{ color: i === activeStep ? ACCENT : "rgba(255,255,255,0.35)" }}
              aria-hidden
            />
            <p className="text-[10px] font-semibold" style={{ color: i === activeStep ? "#fff" : "rgba(255,255,255,0.4)" }}>
              {s.label}
            </p>
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={Active.label} {...fade(reducedMotion)} className="rounded-xl bg-white/[0.04] p-4">
          <p className="text-[15px] font-semibold text-white">{Active.label}</p>
          <p className="text-[13px] leading-snug text-white/55 mt-1">{Active.body}</p>
        </motion.div>
      </AnimatePresence>

      <div className="flex items-center gap-2 text-xs text-white/35">
        <span className="h-1.5 w-1.5 rounded-full ai-ambient-breathe" style={{ backgroundColor: ACCENT }} />
        Every finished project makes the next one easier to win.
      </div>
    </VisualCardShell>
  );
};
