import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Instagram, Youtube, Music, Award, FileText, BarChart3 } from "lucide-react";

export const ProfessionalProfileShowcase = () => {
  return (
    <section className="px-6 py-20 bg-gradient-to-br from-background to-muted/30">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-sm font-medium text-primary">
            <CheckCircle2 className="h-4 w-4" />
            <span>Your Complete Professional Identity</span>
          </div>
          <h2 className="mb-6 text-4xl font-bold leading-tight tracking-tight md:text-5xl lg:text-6xl">
            Like LinkedIn. Like Behance.{" "}
            <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
              But Built for Creators.
            </span>
          </h2>
          <p className="mx-auto max-w-3xl text-lg leading-relaxed text-muted-foreground">
            Stop sending 10 different links. Connect your verified social stats, awards, press features, and portfolio work in one professional profile that brands actually want to see.
          </p>
        </div>

        {/* Visual Profile Preview */}
        <div className="max-w-5xl mx-auto mb-16">
          <Card className="p-8 border-2 border-primary/20 shadow-glow">
            {/* Profile Header Mockup */}
            <div className="flex items-start gap-6 mb-8 pb-8 border-b">
              <div className="h-24 w-24 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-primary-foreground text-2xl font-bold">
                JD
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-2xl font-bold">Jane Designer</h3>
                  <CheckCircle2 className="h-6 w-6 text-primary" />
                  <Badge variant="secondary">Creator Pro</Badge>
                </div>
                <p className="text-muted-foreground mb-3">Brand Designer • Fashion & Lifestyle Content</p>
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Instagram className="h-4 w-4 text-primary" />
                    <span className="font-semibold">125K</span>
                    <span className="text-muted-foreground">verified</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Youtube className="h-4 w-4 text-primary" />
                    <span className="font-semibold">89K</span>
                    <span className="text-muted-foreground">verified</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    <span className="font-semibold">4.2%</span>
                    <span className="text-muted-foreground">avg engagement</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Profile Sections Grid */}
            <div className="grid md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <Award className="h-6 w-6 text-primary mb-2" />
                <p className="font-semibold mb-1">Awards & Recognition</p>
                <p className="text-sm text-muted-foreground">3 industry awards connected</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <FileText className="h-6 w-6 text-secondary mb-2" />
                <p className="font-semibold mb-1">Press Features</p>
                <p className="text-sm text-muted-foreground">Featured in Vogue, Forbes</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <Music className="h-6 w-6 text-accent mb-2" />
                <p className="font-semibold mb-1">Portfolio Work</p>
                <p className="text-sm text-muted-foreground">24 verified projects</p>
              </div>
            </div>
          </Card>
        </div>

        {/* What You Can Connect */}
        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-2xl font-bold mb-6">Connect Everything That Matters</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
                <div>
                  <p className="font-semibold">Verified Social Stats</p>
                  <p className="text-sm text-muted-foreground">Instagram, YouTube, TikTok, Spotify—display real follower counts & engagement metrics</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
                <div>
                  <p className="font-semibold">Industry Awards & Recognition</p>
                  <p className="text-sm text-muted-foreground">Link your IMDB credits, music awards, design accolades, and certifications</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
                <div>
                  <p className="font-semibold">Press Coverage</p>
                  <p className="text-sm text-muted-foreground">Showcase magazine features, interviews, and media appearances</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
                <div>
                  <p className="font-semibold">Portfolio & Case Studies</p>
                  <p className="text-sm text-muted-foreground">Rich media galleries with client testimonials and project outcomes</p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-2xl font-bold mb-6">Why This Changes Everything</h3>
            <div className="space-y-4">
              <Card className="p-4 bg-primary/5 border-primary/20">
                <p className="font-semibold mb-2">No More "Link in Bio" Chaos</p>
                <p className="text-sm text-muted-foreground">One professional URL. All your credentials. Actually looks legit when you send it to brands.</p>
              </Card>
              <Card className="p-4 bg-secondary/5 border-secondary/20">
                <p className="font-semibold mb-2">Verified = Trusted</p>
                <p className="text-sm text-muted-foreground">Stats pulled directly from platforms. No fake numbers. Brands know they're working with the real deal.</p>
              </Card>
              <Card className="p-4 bg-accent/5 border-accent/20">
                <p className="font-semibold mb-2">Built to Get You Discovered</p>
                <p className="text-sm text-muted-foreground">AI scans your profile and matches you with relevant brand opportunities automatically.</p>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
