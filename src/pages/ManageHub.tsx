import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Building2, Briefcase, CalendarDays, Rocket, ArrowRight } from "lucide-react";

const items = [
  {
    label: "Clients",
    description: "Your roster, contacts, and project links.",
    icon: Building2,
    path: "/clients",
  },
  {
    label: "My Gigs",
    description: "Gigs you've posted and applicant pipelines.",
    icon: Briefcase,
    path: "/manage-opportunities",
  },
  {
    label: "My Events",
    description: "Sessions, RSVPs, and the backstage check-in.",
    icon: CalendarDays,
    path: "/events/backstage",
  },
  {
    label: "My Campaigns",
    description: "ThriveFund campaigns — drafts, live, and past.",
    icon: Rocket,
    path: "/fund/manage",
  },
];

const ManageHub = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-24">
      <Helmet>
        <title>Manage · Kretopia</title>
        <meta name="description" content="One dashboard for your clients, gigs, events, and campaigns." />
      </Helmet>

      <div className="max-w-3xl mx-auto px-4 pt-8">
        <header className="mb-6 space-y-3">
          <p className="text-[10px] font-bold tracking-[0.22em] text-[hsl(var(--energy))] uppercase">
            Command center
          </p>
          <h1 className="text-3xl sm:text-4xl font-black tracking-[-0.03em] leading-[1.05]">Manage</h1>
          <p className="text-sm text-muted-foreground max-w-md">
            Everything you've put out — clients, gigs, events, and campaigns — in one place.
          </p>
          <div className="h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {items.map(({ label, description, icon: Icon, path }) => (
            <Card
              key={path}
              role="button"
              tabIndex={0}
              onClick={() => navigate(path)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && navigate(path)}
              className="group p-5 cursor-pointer rounded-2xl border-border/60 shadow-none hover:border-[hsl(var(--energy)/0.4)] transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-[hsl(var(--energy)/0.12)] text-[hsl(var(--energy))] shrink-0">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-bold tracking-tight">{label}</h2>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-[hsl(var(--energy))] group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{description}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ManageHub;
