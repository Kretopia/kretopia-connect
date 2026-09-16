import { useState } from "react";
import { Briefcase, Handshake, ArrowRightLeft, Sparkles, ChevronRight } from "lucide-react";
import { PostOpportunityDialog } from "@/components/PostOpportunityDialog";
import { Button } from "@/components/ui/button";
import { useNavigate, Link } from "react-router-dom";

interface PostOpportunitySectionProps {
  opportunitiesCount: number;
}

const OPPORTUNITY_TYPES = [
  {
    icon: Briefcase,
    title: "Paid Jobs",
    description: "Hire verified creatives for your next project — from video shoots to brand campaigns.",
    accent: "primary",
  },
  {
    icon: Handshake,
    title: "Collaborations",
    description: "Find creative partners who complement your skills. Build together, grow together.",
    accent: "primary",
  },
  {
    icon: ArrowRightLeft,
    title: "Barter & Trade",
    description: "Exchange skills and services — a music video for a logo, a photoshoot for a website.",
    accent: "accent",
  },
];

export const PostOpportunitySection = ({ opportunitiesCount }: PostOpportunitySectionProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <section className="px-4 sm:px-6 py-16 sm:py-20 bg-muted/30">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-10 sm:mb-12">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-sm font-medium text-primary">
            <Sparkles className="h-4 w-4" />
            <span>{opportunitiesCount > 0 ? `${opportunitiesCount} Active Gigs` : "Gig Board"}</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 leading-tight tracking-tight">
            Jobs, Collabs &{" "}
            <span className="text-primary">
              Barter
            </span>
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
            Post what you need or browse what's available. From paid gigs to creative trades — 
            every opportunity is Verified & Protected and connected to verified portfolios.
          </p>
        </div>

        {/* Opportunity Type Cards */}
        <div className="grid gap-4 sm:gap-6 md:grid-cols-3 mb-10">
          {OPPORTUNITY_TYPES.map((type) => {
            const Icon = type.icon;
            return (
              <div
                key={type.title}
                className="relative group cursor-pointer"
                onClick={() => navigate("/auth")}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/8 to-transparent rounded-2xl blur-xl group-hover:blur-2xl transition-all" />
                <div className="relative bg-card border border-border/50 rounded-2xl p-6 hover:border-primary/30 transition-all h-full">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-bold mb-1">{type.title}</h3>
                  <p className="text-sm text-muted-foreground">{type.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-4">
            Every opportunity is Verified & Protected and linked to verified portfolios
          </p>
          <Link to="/auth">
            <Button variant="gradient" size="lg" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Browse Gigs
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};
