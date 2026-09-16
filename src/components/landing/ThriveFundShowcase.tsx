import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Rocket, ShieldCheck, Users, ArrowRight, Sparkles, BadgeCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

const PILLARS = [
  {
    icon: ShieldCheck,
    titleKey: "landing.fundPillar1Title",
    descKey: "landing.fundPillar1Desc",
    fallbackTitle: "Verified & Protected",
    fallbackDesc: "Every campaign is reviewed for scams, prohibited content & feasibility before going live.",
  },
  {
    icon: BadgeCheck,
    titleKey: "landing.fundPillar2Title",
    descKey: "landing.fundPillar2Desc",
    fallbackTitle: "Verified Creators Only",
    fallbackDesc: "Age 18+ and identity verification required to launch — no anonymous fundraising.",
  },
  {
    icon: Users,
    titleKey: "landing.fundPillar3Title",
    descKey: "landing.fundPillar3Desc",
    fallbackTitle: "Milestone-Based Payouts",
    fallbackDesc: "Funds release as creators hit milestones — backers stay protected, projects stay accountable.",
  },
];

export const ThriveFundShowcase = () => {
  const { t } = useTranslation();

  const tt = (key: string, fallback: string) => {
    const v = t(key);
    return v === key ? fallback : v;
  };

  return (
    <section className="relative my-10 sm:my-14 overflow-hidden rounded-3xl border border-primary/25 bg-card p-6 sm:p-10">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute -top-32 -left-20 h-[420px] w-[420px] rounded-full bg-primary/25 blur-[140px]" />
      <div className="pointer-events-none absolute -bottom-32 -right-20 h-[380px] w-[380px] rounded-full bg-[hsl(282_95%_60%/0.18)] blur-[120px]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-energy/40 to-transparent" />

      <div className="relative z-10 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] text-energy mb-4 px-3 py-1 rounded-full border border-energy/30 bg-energy/[0.04]">
            <Sparkles className="h-3 w-3" />
            {tt("landing.fundEyebrow", "Now Live · ThriveFund")}
          </p>

          <h2 className="text-3xl sm:text-5xl font-black tracking-[-0.03em] text-foreground leading-[1.02] mb-3">
            {tt("landing.fundTitle1", "Fund the work.")}{" "}
            <span className="text-energy-glow">{tt("landing.fundTitle2", "Back the creator.")}</span>
          </h2>

          <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
            {tt(
              "landing.fundSubtitle",
              "Crowdfund films, albums, fashion drops, events & creator projects — built for creatives, protected by verified moderation, milestone-based payouts and verified identities."
            )}
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-3 gap-3 mb-8">
          {PILLARS.map((p, i) => {
            const Icon = p.icon;
            return (
              <motion.div
                key={p.titleKey}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 + i * 0.08 }}
                className="rounded-2xl border border-border/60 bg-card/60 p-4 hover:border-primary/40 transition-all"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/20 mb-3">
                  <Icon className="h-4 w-4" />
                </div>
                <p className="text-sm font-bold text-foreground mb-1">
                  {tt(p.titleKey, p.fallbackTitle)}
                </p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {tt(p.descKey, p.fallbackDesc)}
                </p>
              </motion.div>
            );
          })}
        </div>

        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link
            to="/fund"
            className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-energy text-energy-foreground px-6 py-3 text-sm font-black shadow-glow-lime hover:scale-[1.03] transition-all uppercase tracking-wider"
          >
            <Rocket className="h-4 w-4" />
            {tt("landing.fundCtaExplore", "Explore Campaigns")}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            to="/fund/new"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-card/60 px-5 py-3 text-sm font-semibold text-foreground hover:border-primary/50 transition-all"
          >
            {tt("landing.fundCtaLaunch", "Launch a Campaign")}
          </Link>
        </div>

        <p className="mt-4 text-center text-[10px] text-muted-foreground/70 uppercase tracking-[0.2em]">
          {tt("landing.fundFinePrint", "18+ · ID verified · Verified & Protected · Milestone payouts")}
        </p>
      </div>
    </section>
  );
};
