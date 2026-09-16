import { Link } from "react-router-dom";
import { ArrowRight, Award, Brain, MessageSquare, Verified, DollarSign, Crown, Globe, FileText, FolderKanban, FileSignature, Fingerprint, Rocket } from "lucide-react";

export const WhyCreatorsChooseSection = () => {
  const features = [
    { icon: <Award className="h-5 w-5" />, title: "Kretopia Credits", text: "Claim your work on any project — AI + peer verification builds a portable reputation that lasts" },
    { icon: <Globe className="h-5 w-5" />, title: "Creator Websites", text: "Launch your own landing page at yourname.kretopia.com — no coding, premium templates included" },
    { icon: <Brain className="h-5 w-5" />, title: "Smart Match", text: "Swipe through portfolios, get matched by style, skills & location" },
    { icon: <FolderKanban className="h-5 w-5" />, title: "Project Management", text: "Tasks, files, milestones & team chat in one workspace — your creative Slack + Trello" },
    { icon: <DollarSign className="h-5 w-5" />, title: "Invoicing & Payments", text: "Send invoices, set milestone payments, track expenses, P&L reports & get paid securely via escrow" },
    { icon: <FileText className="h-5 w-5" />, title: "EPK to PDF", text: "Generate a professional electronic press kit from your profile and export it as a polished PDF deck" },
    { icon: <Fingerprint className="h-5 w-5" />, title: "Creator Passport", text: "One verified identity across industries — embed it anywhere, carry your reputation with you" },
    { icon: <FileSignature className="h-5 w-5" />, title: "Contracts & Agreements", text: "Create contracts from templates, get e-signatures & protect your work — no lawyer needed" },
    { icon: <MessageSquare className="h-5 w-5" />, title: "Real Gigs & Collabs", text: "Post paid gigs, find collaborators, apply to opportunities — all in one place" },
    { icon: <Rocket className="h-5 w-5" />, title: "Kretopia Fund", text: "Crowdfund films, albums, fashion drops & creative projects — Verified & Protected, milestone payouts, verified creators only" },
  ];

  return (
    <section className="relative px-4 sm:px-6 py-20 sm:py-28 bg-card -mx-4 sm:-mx-6">
      {/* Top divider hairline */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

      <div className="relative container mx-auto max-w-6xl px-4 sm:px-6">
        <div className="text-center mb-14 sm:mb-16">
          <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] text-energy mb-4 px-3 py-1 rounded-full border border-energy/30 bg-energy/[0.04]">
            <span className="h-1.5 w-1.5 rounded-full bg-energy animate-pulse" />
            Your Full Creative Studio
          </p>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-[-0.035em] leading-[0.95] text-foreground mb-5">
            The verified creative record<br />
            <span className="text-energy-glow">the industry has been waiting for.</span>
          </h2>
          <p className="mx-auto max-w-2xl text-base sm:text-lg text-muted-foreground leading-relaxed">
            One Passport. Every credit. Co-signed by the people who were actually there. Plus everything you need to run your career — gigs, contracts, invoices, websites, project management & payments — in one place built for creatives.
          </p>

        </div>

        <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group relative flex flex-col p-5 sm:p-6 rounded-2xl border border-border/60 bg-card/60 hover:border-primary/50 hover:bg-card transition-all overflow-hidden"
            >
              {/* lime corner glow on hover */}
              <div className="absolute -top-12 -right-12 h-24 w-24 rounded-full bg-energy/10 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative flex items-center gap-3 mb-2">
                <div className="flex-shrink-0 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary border border-primary/25 group-hover:scale-110 group-hover:bg-primary/20 transition-all">
                  {feature.icon}
                </div>
                <h3 className="font-bold text-foreground text-base">{feature.title}</h3>
              </div>
              <p className="relative text-sm text-muted-foreground leading-relaxed">
                {feature.text}
              </p>
            </div>
          ))}
        </div>

        {/* Verification tiers */}
        <div className="mt-16 sm:mt-20">
          <div className="relative p-7 sm:p-10 rounded-3xl bg-card/50 border border-border/60 overflow-hidden">
            <div className="absolute -top-20 left-1/2 -translate-x-1/2 h-40 w-[60%] rounded-full bg-primary/15 blur-3xl" />
            <div className="relative">
              <h3 className="mb-2 text-2xl sm:text-3xl font-black tracking-tight text-center text-foreground">Creator Verification</h3>
              <p className="mb-7 text-center text-sm text-muted-foreground">Build trust with every verified credit</p>
              <div className="grid grid-cols-3 gap-3 sm:gap-5 text-center">
                <div className="p-4 sm:p-5 rounded-2xl bg-primary/5 border border-primary/20 hover:scale-105 transition-transform">
                  <Verified className="h-7 w-7 sm:h-8 sm:w-8 mx-auto text-primary mb-2" />
                  <div className="font-bold text-foreground text-sm sm:text-base">Verified</div>
                  <p className="text-xs text-muted-foreground mt-1">AI + peer endorsed</p>
                </div>
                <div className="p-4 sm:p-5 rounded-2xl bg-primary/10 border border-primary/30 hover:scale-105 transition-transform">
                  <Award className="h-7 w-7 sm:h-8 sm:w-8 mx-auto text-primary mb-2" />
                  <div className="font-bold text-foreground text-sm sm:text-base">Industry</div>
                  <p className="text-xs text-muted-foreground mt-1">IMDb · Spotify linked</p>
                </div>
                <div className="p-4 sm:p-5 rounded-2xl bg-energy/[0.06] border border-energy/40 hover:scale-105 transition-transform shadow-glow-lime">
                  <Crown className="h-7 w-7 sm:h-8 sm:w-8 mx-auto text-energy mb-2" />
                  <div className="font-bold text-energy-glow text-sm sm:text-base">Elite</div>
                  <p className="text-xs text-muted-foreground mt-1">Grammy · Oscar level</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CTA — lime signature */}
        <div className="mt-12 sm:mt-14 text-center">
          <Link
            to="/auth"
            className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-energy text-energy-foreground px-8 py-4 text-sm font-black uppercase tracking-wider shadow-glow-lime hover:scale-[1.03] transition-all"
          >
            Join Free — See It In Action
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </section>
  );
};
