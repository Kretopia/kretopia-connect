import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Zap, Target, TrendingUp, Heart, X } from "lucide-react";
import { Link } from "react-router-dom";

export const AIMatchingShowcase = () => {
  return (
    <section className="px-4 py-12 sm:px-6 sm:py-16 md:py-20 bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="text-center mb-10 sm:mb-12 md:mb-16">
          <div className="mb-3 sm:mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-primary">
            <Sparkles className="h-3 w-3 sm:h-4 sm:w-4" />
            <span>Smart Collaboration Network</span>
          </div>
          <h2 className="mb-4 sm:mb-6 text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold leading-tight tracking-tight px-2">
            Swipe to Find{" "}
            <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
              Your Creative Partner
            </span>
          </h2>
          <p className="mx-auto max-w-3xl text-sm sm:text-base md:text-lg leading-relaxed text-muted-foreground px-4">
            Our AI analyzes your skills, location, and creative vision to match you with nearby creators for collaboration. Plus get matched with brand opportunities when they're the right fit.
          </p>
        </div>

        {/* Matching Interface Mockup */}
        <div className="max-w-4xl mx-auto mb-10 sm:mb-12 md:mb-16 px-2">
          <div className="relative">
            {/* Card Stack Effect - hidden on mobile for cleaner look */}
            <div className="hidden sm:block absolute top-4 left-1/2 -translate-x-1/2 w-[95%] h-[500px] bg-muted/30 rounded-3xl -z-10" />
            <div className="hidden sm:block absolute top-8 left-1/2 -translate-x-1/2 w-[90%] h-[500px] bg-muted/50 rounded-3xl -z-20" />
            
            {/* Main Card */}
            <Card className="relative overflow-hidden border-2 border-primary/30 shadow-glow bg-card">
              {/* Signature MATCH Badge — lime, glowing, brand asset */}
              <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10">
                <div className="flex items-center gap-1.5 sm:gap-2 rounded-full border-2 border-energy/60 bg-background/80 px-3 py-1.5 sm:px-4 sm:py-2 shadow-glow-lime">
                  <span className="text-xs sm:text-sm font-black text-energy-glow tracking-wider">98% MATCH</span>
                </div>
              </div>

              {/* Creator Header */}
              <div className="bg-gradient-to-br from-primary/10 to-secondary/10 p-4 sm:p-6 md:p-8 pb-4 sm:pb-5 md:pb-6">
                <div className="flex items-start gap-3 sm:gap-4 mb-3 sm:mb-4">
                  <div className="h-12 w-12 sm:h-14 sm:w-14 md:h-16 md:w-16 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-primary-foreground text-lg sm:text-xl font-bold flex-shrink-0">
                    S
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl sm:text-2xl font-bold mb-0.5 sm:mb-1 truncate">Sarah Chen</h3>
                    <p className="text-sm sm:text-base text-muted-foreground">Videographer • 2.3km away in Canggu</p>
                  </div>
                </div>
              </div>

              {/* Creator Details */}
              <div className="p-4 sm:p-6 md:p-8 pt-4 sm:pt-5 md:pt-6">
                <h4 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Looking for Music Producer to Collaborate</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
                  <div className="flex items-center gap-2 text-xs sm:text-sm">
                    <Target className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary flex-shrink-0" />
                    <span className="text-muted-foreground">Project:</span>
                    <span className="font-semibold">Music Video Series</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs sm:text-sm">
                    <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary flex-shrink-0" />
                    <span className="text-muted-foreground">Split:</span>
                    <span className="font-semibold">50/50 revenue</span>
                  </div>
                </div>
                
                <div className="p-3 sm:p-4 rounded-lg bg-primary/5 border border-primary/20 mb-6 sm:mb-8">
                  <p className="text-xs sm:text-sm font-semibold text-primary mb-2">Why You're a Perfect Match:</p>
                  <ul className="text-xs sm:text-sm text-muted-foreground space-y-1.5 sm:space-y-2">
                    <li>• Complementary skills: Your music production fills her need for original soundtracks</li>
                    <li>• Super close by: Only 2.3km away in Canggu—easy to meet and work together</li>
                    <li>• Shared vision: Both focused on creative storytelling and building a portfolio</li>
                    <li>• Timeline fits: She's flexible and looking to start within 2 weeks</li>
                  </ul>
                </div>

                {/* Swipe Actions */}
                <div className="flex items-center justify-center gap-4 sm:gap-6 mb-3 sm:mb-4">
                  <button className="h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-muted hover:bg-destructive/20 transition-colors flex items-center justify-center group border-2 border-transparent hover:border-destructive active:scale-95">
                    <X className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground group-hover:text-destructive transition-colors" />
                  </button>
                  <button className="btn-glass btn-glass-primary h-16 w-16 sm:h-20 sm:w-20 rounded-full flex items-center justify-center group scale-105 sm:scale-110 active:scale-100">
                    <Heart className="h-8 w-8 sm:h-10 sm:w-10 text-energy-foreground fill-energy-foreground" />
                  </button>
                  <button className="h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-muted hover:bg-accent/20 transition-colors flex items-center justify-center group border-2 border-transparent hover:border-accent active:scale-95">
                    <Sparkles className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground group-hover:text-accent transition-colors" />
                  </button>
                </div>
                
                <p className="text-center text-xs sm:text-sm text-muted-foreground">
                  Swipe right if interested • Swipe left to pass • Star to save for later
                </p>
              </div>
            </Card>
          </div>
        </div>

        {/* AI Features Grid */}
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-10 md:mb-12">
          <Card className="p-4 sm:p-6 hover:shadow-glow transition-smooth">
            <Zap className="h-6 w-6 sm:h-8 sm:w-8 text-primary mb-3 sm:mb-4" />
            <h3 className="font-semibold mb-2 text-base sm:text-lg">Smart Algorithm</h3>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Analyzes complementary skills, proximity, creative vision, and collaboration style to connect you with the right partners.
            </p>
          </Card>
          <Card className="p-4 sm:p-6 hover:shadow-glow transition-smooth">
            <Target className="h-6 w-6 sm:h-8 sm:w-8 text-secondary mb-3 sm:mb-4" />
            <h3 className="font-semibold mb-2 text-base sm:text-lg">Match Explanations</h3>
            <p className="text-xs sm:text-sm text-muted-foreground">
              See exactly why you're matched with each creator or opportunity so you can connect with confidence.
            </p>
          </Card>
          <Card className="p-4 sm:p-6 hover:shadow-glow transition-smooth sm:col-span-2 md:col-span-1">
            <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-accent mb-3 sm:mb-4" />
            <h3 className="font-semibold mb-2 text-base sm:text-lg">Learn & Improve</h3>
            <p className="text-xs sm:text-sm text-muted-foreground">
              The more you collaborate, the better matches you get. AI learns your style and improves recommendations over time.
            </p>
          </Card>
        </div>

        {/* CTA */}
        <div className="text-center px-4">
          <Link to="/auth" className="inline-block w-full sm:w-auto">
            <Button size="xl" className="btn-glass btn-glass-primary w-full sm:w-auto text-energy-foreground font-bold">
              <Sparkles className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
              Find Collaborators Near You
            </Button>
          </Link>
          <p className="mt-3 sm:mt-4 text-xs sm:text-sm text-muted-foreground">
            Free to start • Connect with creators in your area
          </p>
        </div>
      </div>
    </section>
  );
};
