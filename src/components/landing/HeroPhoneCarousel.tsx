import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Verified, Sparkles, CheckCircle, MessageSquare, DollarSign, MapPin, Briefcase, Search } from "lucide-react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * HeroPhoneCarousel — single phone frame whose screen rotates between the
 * four Kretopia product surfaces. Replaces the broken photo-overlay hero.
 * Each "screen" is a self-contained mini product mockup so the user immediately
 * understands: this is not a job board — it Matches, Runs, Pays, and Drafts for you.
 */
const SCREENS = ["match", "desk", "pay", "thrive"] as const;
type Screen = typeof SCREENS[number];

const LABELS: Record<Screen, { eyebrow: string; tag: string }> = {
  match: { eyebrow: "Smart Match", tag: "Matchmaker" },
  desk: { eyebrow: "Studios", tag: "Project OS" },
  pay: { eyebrow: "KrePay", tag: "Get paid" },
  thrive: { eyebrow: "Thrive", tag: "Does the work" },
};

export const HeroPhoneCarousel = () => {
  const [idx, setIdx] = useState(0);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    // Reduced motion: leave the carousel on its first screen instead of
    // auto-rotating — the dots below still let a user step through manually.
    if (reducedMotion) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % SCREENS.length), 3800);
    return () => clearInterval(t);
  }, [reducedMotion]);

  const screen = SCREENS[idx];
  const label = LABELS[screen];

  return (
    <div className="relative mx-auto w-full max-w-[260px] sm:max-w-[320px] md:max-w-[360px]">
      {/* Glow */}
      <div className="absolute -inset-6 -z-10 rounded-[3rem] bg-gradient-to-br from-primary/30 via-transparent to-energy/20 blur-3xl" />

      {/* Eyebrow chip above the phone */}
      <div className="flex items-center justify-center gap-2 mb-3">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-energy animate-pulse" />
          <span className="text-[9px] font-black uppercase tracking-[0.22em] text-foreground">
            {label.eyebrow}
          </span>
          <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">· {label.tag}</span>
        </span>
      </div>

      {/* Phone frame */}
      <div className="relative aspect-[9/16] rounded-[2rem] border-[8px] border-foreground/90 bg-background shadow-[0_30px_80px_-20px_hsl(var(--primary)/0.5)] overflow-hidden">
        {/* notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-5 w-28 rounded-b-2xl bg-foreground/90 z-30" />

        <AnimatePresence mode="wait">
          <motion.div
            key={screen}
            initial={reducedMotion ? false : { opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reducedMotion ? undefined : { opacity: 0, y: -20, scale: 0.98 }}
            transition={{ duration: reducedMotion ? 0 : 0.45, ease: "easeOut" }}
            className="absolute inset-0 bg-gradient-to-b from-background to-card"
          >
            {screen === "match" && <MatchScreen />}
            {screen === "desk" && <DeskScreen />}
            {screen === "pay" && <PayScreen />}
            {screen === "thrive" && <ThriveScreen />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dots */}
      <div className="flex items-center justify-center gap-1.5 mt-4">
        {SCREENS.map((s, i) => (
          <button
            key={s}
            type="button"
            aria-label={`Show ${LABELS[s].eyebrow}`}
            onClick={() => setIdx(i)}
            className={`h-1.5 rounded-full transition-all ${
              i === idx ? "w-6 bg-energy" : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"
            }`}
          />
        ))}
      </div>
    </div>
  );
};

/* ────────────── MATCH SCREEN ────────────── */
export const MatchScreen = () => (
  <div className="h-full w-full px-3 pt-8 pb-3 flex flex-col gap-2">
    <div className="flex items-center gap-2 px-1">
      <Search className="h-3 w-3 text-muted-foreground" />
      <p className="text-[10px] text-muted-foreground font-medium">"DP for SS26 lookbook · Lagos"</p>
    </div>
    {/* Top match card */}
    <div className="rounded-2xl border-2 border-energy/60 bg-card p-3 shadow-[0_0_24px_-8px_hsl(var(--energy)/0.6)]">
      <div className="flex items-center gap-2 mb-2">
        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-energy flex items-center justify-center text-[11px] font-black text-primary-foreground">AO</div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-bold text-foreground truncate">Adaeze O.</p>
          <p className="text-[9px] text-muted-foreground truncate flex items-center gap-1">
            <MapPin className="h-2.5 w-2.5" /> 2.3 km · DP · Fashion
          </p>
        </div>
        <div className="text-right">
          <p className="text-[18px] font-black text-energy-glow leading-none">94<span className="text-[10px]">%</span></p>
          <p className="text-[8px] font-black uppercase tracking-wider text-energy">Match</p>
        </div>
      </div>
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/15 text-primary">Editorial</span>
        <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/15 text-primary">Sony FX3</span>
        <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-energy/15 text-energy">Verified</span>
      </div>
    </div>
    {/* Result 2 */}
    <div className="rounded-xl border border-border bg-card/60 p-2.5 flex items-center gap-2">
      <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-black text-primary">JM</div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold text-foreground truncate">Jordan M. · Cinematographer</p>
        <p className="text-[9px] text-muted-foreground">5.1 km · 18 verified credits</p>
      </div>
      <p className="text-[12px] font-black text-primary">87%</p>
    </div>
    {/* Result 3 */}
    <div className="rounded-xl border border-border bg-card/60 p-2.5 flex items-center gap-2">
      <div className="h-8 w-8 rounded-full bg-accent/30 flex items-center justify-center text-[10px] font-black text-accent">SK</div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold text-foreground truncate">Sade K. · Director / DP</p>
        <p className="text-[9px] text-muted-foreground">8.4 km · Films + Music videos</p>
      </div>
      <p className="text-[12px] font-black text-primary">81%</p>
    </div>
    {/* Talent Copilot tease */}
    <div className="mt-auto rounded-xl bg-gradient-to-r from-primary/15 to-energy/15 border border-primary/30 p-2.5">
      <div className="flex items-center gap-1.5 mb-0.5">
        <Sparkles className="h-3 w-3 text-energy" />
        <p className="text-[9px] font-black uppercase tracking-wider text-foreground">Kreto scouted these</p>
      </div>
      <p className="text-[10px] text-muted-foreground leading-snug">"Top 3 of 28 — sorted by past credits + your shoot date."</p>
    </div>
  </div>
);

/* ────────────── DESK SCREEN ────────────── */
export const DeskScreen = () => (
  <div className="h-full w-full px-3 pt-8 pb-3 flex flex-col gap-2">
    <div className="flex items-center justify-between px-1">
      <p className="text-[11px] font-black text-foreground">Aurora SS26 Shoot</p>
      <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/15 text-primary">Pre-prod</span>
    </div>
    {/* Brief card */}
    <div className="rounded-xl border border-primary/30 bg-card p-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        <div className="h-4 w-4 rounded bg-primary/20 flex items-center justify-center"><Sparkles className="h-2.5 w-2.5 text-primary" /></div>
        <p className="text-[9px] font-black uppercase tracking-wider text-foreground">Brief · auto-built</p>
      </div>
      <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2">3-day editorial shoot · 4 looks · DP + 2 stylists + MUA · delivery Mar 14</p>
    </div>
    {/* Tasks */}
    <div className="rounded-xl border border-border bg-card/60 p-2.5">
      <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground mb-1.5">Today · 3 tasks</p>
      <ul className="space-y-1.5">
        <li className="flex items-center gap-2"><CheckCircle className="h-3 w-3 text-energy" /><span className="text-[10px] text-foreground line-through opacity-60">Lock location</span></li>
        <li className="flex items-center gap-2"><div className="h-3 w-3 rounded-full border border-primary" /><span className="text-[10px] text-foreground font-medium">Confirm DP rate</span></li>
        <li className="flex items-center gap-2"><div className="h-3 w-3 rounded-full border border-border" /><span className="text-[10px] text-muted-foreground">Send call sheet</span></li>
      </ul>
    </div>
    {/* Vault */}
    <div className="rounded-xl border border-border bg-card/60 p-2.5">
      <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground mb-1.5">Vault · 12 files</p>
      <div className="grid grid-cols-4 gap-1">
        {["from-primary/40 to-primary/10", "from-energy/40 to-energy/10", "from-accent/40 to-accent/10", "from-primary/30 to-primary/5"].map((g, i) => (
          <div key={i} className={`aspect-square rounded-md bg-gradient-to-br ${g}`} />
        ))}
      </div>
    </div>
    {/* Thrive nudge */}
    <div className="mt-auto rounded-xl bg-gradient-to-r from-energy/15 to-primary/15 border border-energy/30 p-2.5">
      <div className="flex items-center gap-1.5 mb-0.5">
        <Sparkles className="h-3 w-3 text-energy" />
        <p className="text-[9px] font-black uppercase tracking-wider text-foreground">Thrive built this workspace</p>
      </div>
      <p className="text-[10px] text-muted-foreground leading-snug">Brief, tasks &amp; vault generated from your voice note.</p>
    </div>
  </div>
);

/* ────────────── PAY SCREEN ────────────── */
export const PayScreen = () => (
  <div className="h-full w-full px-3 pt-8 pb-3 flex flex-col gap-2">
    <div className="flex items-center justify-between px-1">
      <p className="text-[11px] font-black text-foreground">Invoice #1042</p>
      <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-energy/15 text-energy">Draft</span>
    </div>
    {/* Invoice card */}
    <div className="rounded-xl border border-primary/30 bg-card p-2.5">
      <p className="text-[9px] text-muted-foreground">To · Aurora Studios</p>
      <p className="text-[18px] font-black text-foreground tracking-tight leading-none mt-1">$3,400<span className="text-[10px] text-muted-foreground font-bold ml-1">USD</span></p>
      <div className="mt-2 space-y-0.5 text-[9px] text-muted-foreground">
        <p>· DP day rate × 3</p>
        <p>· Pre-prod &amp; scouting</p>
        <p>· Color delivery</p>
      </div>
    </div>
    {/* Chat with Thrive */}
    <div className="rounded-xl border border-border bg-card/60 p-2.5 flex-1 flex flex-col gap-1.5">
      <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Chat · Thrive</p>
      <div className="rounded-lg bg-muted/40 px-2 py-1.5 self-start max-w-[85%]">
        <p className="text-[10px] text-foreground leading-snug">Add a 15% rush fee — turnaround is 5 days.</p>
      </div>
      <div className="rounded-lg bg-primary/15 border border-primary/30 px-2 py-1.5 self-end max-w-[85%]">
        <p className="text-[10px] text-foreground leading-snug">Done — added $510 rush. Updated total <span className="font-black">$3,910</span>.</p>
      </div>
    </div>
    {/* Status */}
    <div className="rounded-xl bg-gradient-to-r from-energy/15 to-primary/15 border border-energy/30 p-2.5 flex items-center gap-2">
      <DollarSign className="h-4 w-4 text-energy" />
      <div className="flex-1">
        <p className="text-[10px] font-black text-foreground">Send · get paid in 1 tap</p>
        <p className="text-[9px] text-muted-foreground">USD &amp; TTD · Stripe + bank transfer</p>
      </div>
    </div>
  </div>
);

/* ────────────── THRIVE SCREEN ────────────── */
export const ThriveScreen = () => (
  <div className="h-full w-full px-3 pt-8 pb-3 flex flex-col gap-2">
    <div className="flex items-center gap-2 px-1">
      <div className="h-5 w-5 rounded-md bg-gradient-to-br from-primary to-energy flex items-center justify-center"><Sparkles className="h-3 w-3 text-primary-foreground" /></div>
      <p className="text-[11px] font-black text-foreground">Thrive · doing the work</p>
    </div>
    {/* Action 1 — scouted gig */}
    <div className="rounded-xl border border-energy/40 bg-card p-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        <Briefcase className="h-3 w-3 text-energy" />
        <p className="text-[9px] font-black uppercase tracking-wider text-energy">Scouted · 1h ago</p>
      </div>
      <p className="text-[11px] font-bold text-foreground leading-tight">Editorial DP · Vogue Africa shoot</p>
      <p className="text-[9px] text-muted-foreground mt-0.5">Lagos · 4 days · matches your rate</p>
    </div>
    {/* Action 2 — drafted intro */}
    <div className="rounded-xl border border-primary/40 bg-card p-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        <MessageSquare className="h-3 w-3 text-primary" />
        <p className="text-[9px] font-black uppercase tracking-wider text-primary">Drafted intro · ready</p>
      </div>
      <p className="text-[10px] text-foreground leading-snug line-clamp-2">"Hi Maya — saw the Aurora brief. I shot the SS25 lookbook for Loza Maléombho..."</p>
    </div>
    {/* Action 3 — built workspace */}
    <div className="rounded-xl border border-primary/40 bg-card p-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        <CheckCircle className="h-3 w-3 text-energy" />
        <p className="text-[9px] font-black uppercase tracking-wider text-foreground">Workspace ready</p>
      </div>
      <p className="text-[10px] text-foreground leading-snug">SS26 Shoot · 3 deliverables, 8 tasks, 1 quote drafted</p>
    </div>
    {/* Tap to approve */}
    <div className="mt-auto rounded-xl bg-gradient-to-r from-primary/20 to-energy/20 border border-primary/40 p-2.5">
      <p className="text-[9px] font-black uppercase tracking-wider text-foreground/80 mb-0.5">3 actions waiting</p>
      <p className="text-[10px] text-foreground leading-snug font-medium">Tap to approve — Thrive sends, schedules &amp; updates everything.</p>
    </div>
  </div>
);
