import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, ArrowRight, Film, Briefcase, Users, MessageSquare, FolderOpen, Receipt, PieChart, Link2, MapPin } from "lucide-react";

const TOOLS_REPLACED = [
  { icon: Film, tool: "Verified Creative Credits", replaces: "IMDb / Muso.AI" },
  { icon: Briefcase, tool: "Find Work & Gigs", replaces: "Fiverr / Upwork" },
  { icon: Users, tool: "Smart Creator Matching", replaces: "Vampr / Bumble Bizz" },
  { icon: MessageSquare, tool: "Project Workspaces", replaces: "Slack + Trello" },
  { icon: FolderOpen, tool: "File Sharing & Assets", replaces: "Google Drive" },
  { icon: Receipt, tool: "Invoicing & Payments", replaces: "Wave / PayPal" },
  { icon: PieChart, tool: "P&L + Expense Tracking", replaces: "QuickBooks" },
  { icon: Link2, tool: "Verified Creator Profile", replaces: "LinkedIn + Behance" },
  { icon: MapPin, tool: "Nearby Creator Discovery", replaces: "Nothing like it" },
];

export const ComparisonTableSection = () => {
  return (
    <section className="px-4 sm:px-6 py-16 sm:py-20 md:py-24">
      <div className="container mx-auto max-w-3xl">
        <div className="text-center mb-10 sm:mb-12">
        <h2 className="mb-4 text-3xl sm:text-4xl md:text-5xl font-bold leading-tight tracking-tight">
            Make it. Own it.{" "}
            <span className="text-primary">
              Get paid.
            </span>
          </h2>
          <p className="mx-auto max-w-xl text-base sm:text-lg text-muted-foreground">
            Kretopia replaces nine apps with one creative operating system — credits, gigs, collabs, and payments in one place.
          </p>
        </div>

        {/* Comparison rows */}
        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-card">
          {/* Header */}
          <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 px-4 sm:px-6 py-3 bg-muted/50 border-b border-border/40 text-xs sm:text-sm font-semibold text-muted-foreground">
            <span>What you need</span>
            <span className="w-24 sm:w-32 text-center">Before</span>
            <span className="w-16 text-center text-primary font-bold">Kretopia</span>
          </div>

          {TOOLS_REPLACED.map((item, i) => {
            const Icon = item.icon;
            return (
              <div
                key={item.tool}
                className={`grid grid-cols-[1fr_auto_auto] items-center gap-2 px-4 sm:px-6 py-3.5 ${
                  i < TOOLS_REPLACED.length - 1 ? "border-b border-border/30" : ""
                } hover:bg-muted/20 transition-colors`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex-shrink-0 flex h-7 w-7 items-center justify-center rounded-md bg-primary/8 text-primary/70">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{item.tool}</p>
                    <p className="text-[11px] text-muted-foreground truncate sm:hidden">{item.replaces}</p>
                  </div>
                </div>
                <span className="w-24 sm:w-32 text-center text-xs text-muted-foreground truncate hidden sm:block">
                  {item.replaces}
                </span>
                <span className="w-16 text-center">
                  <Check className="h-4 w-4 text-primary mx-auto" />
                </span>
              </div>
            );
          })}

          {/* Kretopia summary row */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 bg-primary/5 border-t-2 border-primary/30">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary flex-shrink-0" />
              <span className="font-bold text-sm sm:text-base">All included — one platform</span>
            </div>
            <div className="text-right">
              <span className="font-bold text-primary text-base sm:text-lg">Free</span>
              <span className="block text-[10px] text-muted-foreground">Pro from $29/mo</span>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link to="/auth">
            <Button variant="hero" size="lg" className="gap-2 shadow-glow group">
              <Sparkles className="h-4 w-4" />
              Get Started Free
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </Link>
          <p className="mt-3 text-xs text-muted-foreground/70">No credit card · Free forever to start · Save 17% annually</p>
        </div>
      </div>
    </section>
  );
};
