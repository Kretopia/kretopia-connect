import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Briefcase,
  Receipt,
  Mic,
  Search,
  ArrowRight,
  Check,
  Quote,
  Handshake,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * CreatorDashboardSection
 * Bridges Discovery → Daily Work on the landing page.
 * On-brand cinematic dark canvas with lime "energy" accents to match
 * WhyCreatorsChooseSection + ThriveFundShowcase. Real social proof only.
 */
export const CreatorDashboardSection = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2) return;
    navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <section className="relative my-10 sm:my-14 overflow-hidden rounded-3xl border border-primary/25 bg-card p-6 sm:p-10">
      {/* Ambient glows — same recipe as ThriveFundShowcase for cohesion */}
      <div className="pointer-events-none absolute -top-32 -left-20 h-[420px] w-[420px] rounded-full bg-primary/25 blur-[140px]" />
      <div className="pointer-events-none absolute -bottom-32 -right-20 h-[380px] w-[380px] rounded-full bg-energy/15 blur-[120px]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-energy/40 to-transparent" />

      <div className="relative z-10 max-w-5xl mx-auto">
        {/* Header — matches WhyCreatorsChooseSection typography */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12 sm:mb-14"
        >
          <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] text-energy mb-4 px-3 py-1 rounded-full border border-energy/30 bg-energy/[0.04]">
            <span className="h-1.5 w-1.5 rounded-full bg-energy animate-pulse" />
            The Creator Dashboard
          </p>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-[-0.035em] leading-[0.95] text-foreground mb-5">
            Less admin.<br />
            <span className="text-energy-glow">More creating.</span>
          </h2>
          <p className="mx-auto max-w-2xl text-base sm:text-lg text-muted-foreground leading-relaxed">
            The business side of being a creative — planned, priced, and paid for you. Three connected layers, one workspace.
          </p>
        </motion.div>

        {/* Bento grid — 6-col on md+ */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-6 md:auto-rows-[1fr]">
          {/* Module 1 — ThriveDesk (large hero tile) */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-6 md:col-span-3 md:row-span-2 hover:border-energy/40 transition-colors"
          >
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-energy/15 blur-3xl" />
            <div className="relative flex h-full flex-col">
              <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-energy/10 ring-1 ring-energy/40">
                <Briefcase className="h-5 w-5 text-energy" />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-energy/90">
                ThriveDesk · The Work Layer
              </p>
              <h3 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                A workspace that fits your craft
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Photo shoot, music release, fashion drop or film. Your Desk shows the right
                tasks, files, deliverables and contracts — none of the noise from tools built for someone else.
              </p>

              {/* Mini visual */}
              <div className="mt-auto pt-6">
                <div className="grid grid-cols-3 gap-2">
                  {["Photo", "Music", "Film"].map((label) => (
                    <div
                      key={label}
                      className="rounded-lg border border-border/60 bg-background/40 px-2 py-2 text-center text-[11px] font-semibold text-foreground/80"
                    >
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Module 2 — ThriveQuote Copilot */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-6 md:col-span-3 hover:border-primary/40 transition-colors"
          >
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/20 blur-3xl" />
            <div className="relative">
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/40">
                <Receipt className="h-5 w-5 text-primary" />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
                Quote Copilot · The Money Layer
              </p>
              <h3 className="mt-2 text-xl sm:text-2xl font-black tracking-tight text-foreground">
                Quote like a studio. Send in a minute.
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Tell it the brief. Your copilot writes the line items, applies your markup, and converts
                USD ↔ TTD so the client sees the number that matters to them.
              </p>
              <div className="mt-4 flex items-center gap-2 text-[11px] font-mono text-muted-foreground">
                <span className="rounded-md bg-background/60 px-2 py-1 ring-1 ring-border">USD $1,250</span>
                <ArrowRight className="h-3 w-3 text-energy" />
                <span className="rounded-md bg-energy/10 px-2 py-1 ring-1 ring-energy/30 text-energy">TTD 8,475</span>
              </div>
            </div>
          </motion.div>

          {/* Module 3 — Smart Briefs */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-6 md:col-span-3 hover:border-energy/40 transition-colors"
          >
            <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-energy/15 blur-3xl" />
            <div className="relative">
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-energy/10 ring-1 ring-energy/40">
                <Mic className="h-5 w-5 text-energy" />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-energy/90">
                Smart Briefs · The Planning Layer
              </p>
              <h3 className="mt-2 text-xl sm:text-2xl font-black tracking-tight text-foreground">
                Voice note in. Project plan out.
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Talk for 30 seconds about a shoot or release. Get back a clean brief with deliverables,
                deadlines and a contract draft — ready to share with your team.
              </p>
              <div className="mt-4 flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-energy/10 px-2.5 py-1 text-[11px] font-semibold text-energy ring-1 ring-energy/30">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-energy opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-energy" />
                  </span>
                  Recording → Roadmap
                </span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Real social proof — verified live numbers + Dee's testimonial */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="mt-10 grid gap-4 md:grid-cols-5"
        >
          {/* Live proof tiles — pulled from public-stats numbers we already track */}
          <div className="md:col-span-2 grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-border/60 bg-card/40 p-4 text-center">
              <Handshake className="w-4 h-4 mx-auto mb-1.5 text-energy" />
              <p className="text-2xl font-black tracking-tight text-foreground">190+</p>
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5 font-semibold">Real connections</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card/40 p-4 text-center">
              <Sparkles className="w-4 h-4 mx-auto mb-1.5 text-energy" />
              <p className="text-2xl font-black tracking-tight text-foreground">340+</p>
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5 font-semibold">Credits logged</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card/40 p-4 text-center">
              <Briefcase className="w-4 h-4 mx-auto mb-1.5 text-energy" />
              <p className="text-2xl font-black tracking-tight text-foreground">14</p>
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5 font-semibold">Live gigs</p>
            </div>
          </div>

          {/* Dee's testimonial — kept honest to the actual quote we collected */}
          <div className="md:col-span-3 relative rounded-2xl border border-energy/30 bg-gradient-to-br from-energy/[0.06] via-card/40 to-primary/[0.06] p-5 sm:p-6">
            <Quote className="absolute top-4 right-4 h-5 w-5 text-energy/50" />
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-energy/15 ring-1 ring-energy/40 text-energy font-black">
                D
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Dee</p>
                <p className="text-[11px] text-muted-foreground">Creative · Early member</p>
              </div>
            </div>
            <p className="text-sm sm:text-base text-foreground/90 leading-relaxed">
              "I like the overall concept — I think it would help a lot of creatives."
            </p>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Joined the network, built a profile, started discovering gigs and collaborators on the platform.
            </p>
          </div>
        </motion.div>

        {/* Free Tier hook */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="mt-8 rounded-2xl border border-energy/30 bg-gradient-to-r from-energy/10 via-energy/5 to-primary/10 p-5 sm:p-6"
        >
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-energy/20 ring-1 ring-energy/40">
                <Check className="h-4 w-4 text-energy" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground sm:text-base">Free to start. No card needed.</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  2 Smart Tool runs every month, on us. <span className="text-energy font-semibold">Unlimited on Creator plans.</span>
                </p>
              </div>
            </div>
            <Button
              variant="hero"
              onClick={() => navigate("/auth")}
              className="w-full sm:w-auto"
            >
              Start Free
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </div>
        </motion.div>

        {/* Search hook — ties back to Smart Profile Discovery */}
        <div className="mx-auto mt-8 max-w-2xl text-center">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
            Already credited on a project? Claim your work.
          </p>
          <form onSubmit={handleSearch} className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your name…"
              className="h-12 w-full rounded-full border-border bg-background/60 pl-11 pr-32 text-base text-foreground placeholder:text-muted-foreground/70 focus-visible:ring-energy"
            />
            <Button
              type="submit"
              size="sm"
              className="absolute right-1.5 top-1/2 h-9 -translate-y-1/2 rounded-full bg-energy text-energy-foreground hover:bg-energy/90 font-bold"
            >
              Search
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
};
