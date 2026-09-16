import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Rocket, ExternalLink } from "lucide-react";
import { useMyCampaigns } from "@/hooks/useThriveFund";
import { cn } from "@/lib/utils";

const FundManage = () => {
  const navigate = useNavigate();
  const { data: campaigns, isLoading } = useMyCampaigns();

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Manage Campaigns · ThriveFund</title>
      </Helmet>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between gap-3 mb-2">
          <p className="text-[10px] font-bold tracking-[0.22em] text-[hsl(var(--energy))] uppercase">
            ThriveFund
          </p>
          <Button size="sm" onClick={() => navigate("/fund/new")} className="gap-1.5 shrink-0">
            <Plus className="h-4 w-4" /> New campaign
          </Button>
        </div>
        <div className="mb-6">
          <h1 className="text-3xl sm:text-4xl font-black tracking-[-0.03em] leading-[1.05]">Your campaigns</h1>
          <p className="text-sm text-muted-foreground mt-1">Drafts, live, and past</p>
        </div>

        {isLoading ? (
          <Card className="p-8 rounded-2xl border-border/60 shadow-none animate-pulse h-40" />
        ) : !campaigns || campaigns.length === 0 ? (
          <Card className="p-12 text-center rounded-2xl border-border/60 border-dashed shadow-none">
            <Rocket className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <h3 className="font-semibold">No campaigns yet</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Launch your first campaign to start raising.
            </p>
            <Button className="mt-5 gap-2" onClick={() => navigate("/fund/new")}>
              <Plus className="h-4 w-4" /> Create campaign
            </Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {campaigns.map((c) => (
              <Card key={c.id} className="p-4 flex items-center gap-4 rounded-2xl border-border/60 shadow-none">
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-muted shrink-0">
                  {c.cover_image_url ? (
                    <img src={c.cover_image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold truncate">{c.title}</p>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border backdrop-blur-sm",
                        c.status === "active"
                          ? "bg-energy/15 text-energy border-energy/35"
                          : "bg-muted/60 text-muted-foreground border-border"
                      )}
                    >
                      {c.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    ${c.total_raised} raised of ${c.goal_amount} · {c.backer_count} backers
                  </p>
                </div>
                <Link
                  to={`/fund/${c.slug}`}
                  className="text-sm text-primary hover:underline flex items-center gap-1 shrink-0"
                >
                  View <ExternalLink className="h-3 w-3" />
                </Link>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FundManage;
