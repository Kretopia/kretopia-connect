import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Database, Verified, Users, ArrowRight, Globe, Shield, Sparkles } from "lucide-react";

const SAMPLE_CREDITS = [
  { project: "Kendrick Lamar — GNX Tour", role: "Lead Videographer", type: "Music", verified: true },
  { project: "Nike — Air Max 2026 Campaign", role: "Art Director", type: "Fashion", verified: true },
  { project: "A24 — Untitled Feature", role: "Colorist", type: "Film", verified: false },
  { project: "Coachella 2026", role: "Stage Designer", type: "Events", verified: true },
];

export const ICDBSection = () => {
  return (
    <section className="px-4 sm:px-6 py-16 sm:py-20 md:py-24 bg-muted/30">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="text-center mb-10 sm:mb-14">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-xs sm:text-sm font-medium text-primary">
            <Database className="h-3.5 w-3.5" />
            <span>Kretopia Credits</span>
          </div>
          <h2 className="mb-4 text-3xl sm:text-4xl md:text-5xl font-bold leading-tight tracking-tight">
            Your Work.{" "}
            <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
              Verified Forever.
            </span>
          </h2>
          <p className="mx-auto max-w-2xl text-base sm:text-lg text-muted-foreground">
            Every project gets a permanent page. Claim your role, get verified by peers and AI, 
            and build a reputation that travels with you — not locked to any platform.
          </p>
        </div>

        {/* Main visual — credit timeline mockup */}
        <div className="max-w-3xl mx-auto mb-10 sm:mb-14">
          <Card className="overflow-hidden border-2 border-primary/20 shadow-glow">
            {/* Profile header */}
            <div className="bg-gradient-to-br from-primary/10 to-secondary/10 p-4 sm:p-6 border-b border-border/40">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-primary-foreground text-lg font-bold flex-shrink-0">
                  M
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg sm:text-xl font-bold">Marcus Rivera</h3>
                    <Badge variant="outline" className="border-primary/40 text-primary text-[10px]">
                      <Verified className="h-3 w-3 mr-1" />
                      Verified
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">Cinematographer • Los Angeles</p>
                  <p className="text-xs text-muted-foreground/70 font-mono mt-0.5">THRIVE-2026-4829</p>
                </div>
                <div className="text-right hidden sm:block">
                  <div className="text-2xl font-bold text-primary">87</div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Credit Score</div>
                </div>
              </div>
            </div>

            {/* Credit entries */}
            <div className="divide-y divide-border/40">
              {SAMPLE_CREDITS.map((credit, i) => (
                <div key={i} className="flex items-center gap-3 px-4 sm:px-6 py-3 sm:py-4 hover:bg-muted/30 transition-colors">
                  <div className="flex-shrink-0">
                    {credit.verified ? (
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Verified className="h-4 w-4 text-primary" />
                      </div>
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{credit.project}</p>
                    <p className="text-xs text-muted-foreground">{credit.role}</p>
                  </div>
                  <Badge variant="secondary" className="text-[10px] flex-shrink-0">
                    {credit.type}
                  </Badge>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="p-4 sm:p-6 bg-muted/20 border-t border-border/40">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  14 peer endorsements
                </span>
                <span className="flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5" />
                  Embeddable on any website
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Feature grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-10">
          <div className="p-5 rounded-xl border border-border/50 bg-card hover:border-primary/30 hover:shadow-glow transition-all group">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                <Verified className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-foreground">AI + Peer Verification</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Credits cross-checked against IMDb, Spotify, Discogs & peer endorsements. Your record is unbreakable.
            </p>
          </div>
          <div className="p-5 rounded-xl border border-border/50 bg-card hover:border-primary/30 hover:shadow-glow transition-all group">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                <Database className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-foreground">Canonical Project Pages</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Every project gets its own page. Claim your role, see who else worked on it, build your graph.
            </p>
          </div>
          <div className="p-5 rounded-xl border border-border/50 bg-card hover:border-primary/30 hover:shadow-glow transition-all group sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                <Globe className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-foreground">Portable Identity</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Your Creator ID works everywhere — embed badges on your site, share your verified timeline, own your reputation.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link to="/auth">
            <Button variant="hero" size="lg" className="gap-2 shadow-glow group">
              <Database className="h-4 w-4" />
              Claim Your Credits
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </Link>
          <p className="mt-3 text-xs text-muted-foreground/70">
            Free forever • No one else owns this space
          </p>
        </div>
      </div>
    </section>
  );
};
