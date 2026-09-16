import { Sparkles, Users, Briefcase, DollarSign, Database, ShieldCheck, ArrowRight } from "lucide-react";

export const HowItWorksSection = () => {
  return (
    <section className="px-4 sm:px-6 py-16 sm:py-20 md:py-24 bg-muted/30">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-12 sm:mb-16">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-sm font-medium text-primary">
            <Sparkles className="h-4 w-4" />
            <span>How It Works</span>
          </div>
          <h2 className="mb-4 text-3xl sm:text-4xl md:text-5xl font-bold leading-tight tracking-tight">
            Make it.{" "}
            <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
              Own it.
            </span>{" "}
            Get paid.
          </h2>
          <p className="mx-auto max-w-2xl text-base sm:text-lg text-muted-foreground">
            Your creative history becomes your most powerful career asset — in three steps.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {/* Step 1 — Credits */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-2xl blur-xl group-hover:blur-2xl transition-all" />
            <div className="relative bg-card border border-border/50 rounded-2xl p-6 sm:p-8 hover:border-primary/30 transition-all h-full">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Database className="h-6 w-6" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full">Step 1</span>
              </div>
              <h3 className="mb-2 text-xl font-bold">Claim Your Credits</h3>
              <p className="text-muted-foreground">
                Add every project you've worked on — albums, films, events, campaigns, fashion shows. Search or paste a link and we'll auto-fill the details.
              </p>
              <div className="mt-4 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span className="text-sm text-primary font-medium">AI cross-checks IMDb, Spotify & more</span>
              </div>
            </div>
          </div>

          {/* Step 2 — Verify & Connect */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-secondary/10 to-accent/10 rounded-2xl blur-xl group-hover:blur-2xl transition-all" />
            <div className="relative bg-card border border-border/50 rounded-2xl p-6 sm:p-8 hover:border-secondary/30 transition-all h-full">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
                  <Users className="h-6 w-6" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-secondary bg-secondary/10 px-2 py-0.5 rounded-full">Step 2</span>
              </div>
              <h3 className="mb-2 text-xl font-bold">Get Verified & Discovered</h3>
              <p className="text-muted-foreground">
                Peers Co-sign your work. Brands verify you directly. Your Creative Passport becomes your verified creative résumé — searchable by anyone hiring.
              </p>
              <div className="mt-4 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-secondary" />
                <span className="text-sm text-secondary font-medium">Smart Match finds your next collab</span>
              </div>
            </div>
          </div>

          {/* Step 3 — Work & Get Paid */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-accent/10 to-primary/10 rounded-2xl blur-xl group-hover:blur-2xl transition-all" />
            <div className="relative bg-card border border-border/50 rounded-2xl p-6 sm:p-8 hover:border-accent/30 transition-all h-full">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <Briefcase className="h-6 w-6" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-accent bg-accent/10 px-2 py-0.5 rounded-full">Step 3</span>
              </div>
              <h3 className="mb-2 text-xl font-bold">Work & Get Paid</h3>
              <p className="text-muted-foreground">
                Land gigs, manage projects with milestones, send invoices — and every completed project auto-adds a new Stamp to your Creative Passport.
              </p>
              <div className="mt-4 flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-accent" />
                <span className="text-sm text-accent font-medium">Contracts • Invoices • Escrow</span>
              </div>
            </div>
          </div>
        </div>

        {/* Flywheel callout */}
        <div className="mt-10 text-center">
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 border border-border/50 rounded-full px-5 py-2.5">
            <ArrowRight className="h-3.5 w-3.5 text-primary rotate-[225deg]" />
            <span>Every project you complete <span className="font-semibold text-foreground">automatically builds your verified history</span></span>
            <ArrowRight className="h-3.5 w-3.5 text-primary rotate-45" />
          </div>
        </div>
      </div>
    </section>
  );
};
