import { Link } from "react-router-dom";
import { Sparkles, ArrowRight, Briefcase, MessageSquare, CheckCircle, Search } from "lucide-react";

/**
 * Thrive — the ambient operator. Three live actions waiting (scouted gig, drafted DM,
 * built workspace). Tap to approve. The wedge: you don't have to ask — it shows up
 * with the work already done.
 */
export const ProductSectionThrive = () => (
  <section className="px-4 sm:px-6 py-14 sm:py-20 border-t border-border/40 bg-gradient-to-b from-background via-energy/[0.04] to-background">
    <div className="container mx-auto max-w-6xl">
      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-10 items-center">
        {/* Mock first */}
        <div className="order-2 lg:order-1 relative">
          <div className="absolute -inset-6 -z-10 rounded-3xl bg-gradient-to-br from-energy/20 to-primary/15 blur-3xl" />
          <div className="rounded-3xl border border-energy/40 bg-card shadow-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border/60 bg-gradient-to-r from-primary/10 to-energy/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-md bg-gradient-to-br from-primary to-energy flex items-center justify-center">
                  <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
                </div>
                <p className="text-[11px] font-black text-foreground">Thrive · Inbox</p>
              </div>
              <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-energy/15 text-energy">3 new</span>
            </div>

            <ul className="divide-y divide-border/50">
              {/* Scouted gig */}
              <li className="px-4 py-3 flex items-start gap-3 hover:bg-accent/20 transition-colors">
                <div className="h-9 w-9 rounded-xl bg-energy/15 flex items-center justify-center shrink-0">
                  <Briefcase className="h-4 w-4 text-energy" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-wider text-energy mb-0.5">Scouted a gig · 1h ago</p>
                  <p className="text-sm font-bold text-foreground leading-tight">Editorial DP · Vogue Africa shoot</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Lagos · 4 days · matches your day rate. <span className="text-primary font-bold">Apply now?</span></p>
                </div>
              </li>

              {/* Drafted intro */}
              <li className="px-4 py-3 flex items-start gap-3 hover:bg-accent/20 transition-colors">
                <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                  <MessageSquare className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-wider text-primary mb-0.5">Drafted intro · ready</p>
                  <p className="text-sm font-bold text-foreground leading-tight">For Maya at Aurora Studios</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 italic">"Hi Maya — saw the SS26 brief. I shot the SS25 lookbook for Loza Maléombho — 3-day editorial, similar crew size. Free those dates…"</p>
                </div>
              </li>

              {/* Built workspace */}
              <li className="px-4 py-3 flex items-start gap-3 hover:bg-accent/20 transition-colors">
                <div className="h-9 w-9 rounded-xl bg-energy/15 flex items-center justify-center shrink-0">
                  <CheckCircle className="h-4 w-4 text-energy" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-wider text-foreground/80 mb-0.5">Built a workspace · just now</p>
                  <p className="text-sm font-bold text-foreground leading-tight">Aurora SS26 Shoot</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">3 deliverables, 8 tasks, 1 quote drafted, crew invited.</p>
                </div>
              </li>

              {/* Found candidates */}
              <li className="px-4 py-3 flex items-start gap-3 hover:bg-accent/20 transition-colors">
                <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                  <Search className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-wider text-primary mb-0.5">Top 3 candidates · for SS26</p>
                  <p className="text-sm font-bold text-foreground leading-tight">Adaeze, Jordan &amp; Sade — all in Lagos</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">All replied to similar briefs in &lt; 4h.</p>
                </div>
              </li>
            </ul>

            <div className="px-4 py-3 bg-gradient-to-r from-primary/10 to-energy/10 border-t border-primary/20 text-center">
              <p className="text-[11px] text-foreground/90 font-medium">Tap any card · Thrive sends, schedules &amp; updates everything.</p>
            </div>
          </div>
        </div>

        {/* Copy */}
        <div className="order-1 lg:order-2">
          <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] text-primary mb-4 px-3 py-1 rounded-full border border-primary/30 bg-primary/5">
            <Sparkles className="h-3 w-3" /> Thrive · The operator
          </p>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-[-0.03em] leading-[1.05] text-foreground mb-4">
            You don't ask.<br />
            <span className="text-energy-glow">It shows up done.</span>
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-5 max-w-md">
            Kreto is your always-on operator. It scouts gigs that fit your rate, drafts intros, builds workspaces, and proposes the next move — every morning, while you're shooting.
          </p>
          <ul className="space-y-2 mb-6">
            {[
              "Scouts real gigs across the web · LinkedIn, IG, ATS, agencies",
              "Drafts pitches, quotes, follow-ups in your voice",
              "Free for everyone · talk to Thrive 20× a day on Spark",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2 text-sm text-foreground/90">
                <CheckCircle className="h-4 w-4 text-energy mt-0.5 shrink-0" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
          <Link
            to="/auth?tab=signup"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:text-energy transition-colors"
          >
            Get Thrive working for you <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  </section>
);
