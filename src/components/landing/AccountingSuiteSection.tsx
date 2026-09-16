import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PieChart, FileText, Bot, TrendingUp, Receipt, Wallet, Milestone, FolderKanban } from "lucide-react";

const FINANCE_FEATURES = [
  {
    icon: FileText,
    title: "Professional Invoicing",
    description: "Create invoices in 11 currencies. Creator+ adds your logo, brand colors & custom letterhead.",
  },
  {
    icon: Milestone,
    title: "Milestone Payments",
    description: "Split projects into payment stages. Funds release when deliverables are approved — no more trust issues.",
  },
  {
    icon: Receipt,
    title: "Expense Tracking",
    description: "13 creative-focused categories, tax-deductibility flags, and recurring cost management.",
  },
  {
    icon: PieChart,
    title: "P&L Dashboard",
    description: "Real-time KPIs, spending breakdowns, monthly revenue comparisons & exportable reports.",
  },
  {
    icon: FolderKanban,
    title: "Project Management",
    description: "Tasks, files, milestones & team chat in one workspace — your creative Slack + Trello.",
  },
  {
    icon: Bot,
    title: "Money Copilot",
    description: "Personalized insights on spending patterns, cash flow health & tax optimization tips.",
  },
];

export const AccountingSuiteSection = () => {
  return (
    <section className="px-4 sm:px-6 py-16 sm:py-20 md:py-24 bg-muted/30">
      <div className="container mx-auto max-w-5xl">
        <div className="text-center mb-12">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/5 px-4 py-2 text-sm font-medium text-accent-foreground">
            <Wallet className="h-4 w-4 text-accent" />
            <span>Creative Earnings</span>
          </div>
          <h2 className="mb-4 text-3xl sm:text-4xl md:text-5xl font-bold leading-tight tracking-tight">
            Get Paid.{" "}
            <span className="text-primary">
              Stay Paid.
            </span>
          </h2>
          <p className="mx-auto max-w-2xl text-base sm:text-lg text-muted-foreground">
            Invoicing, milestone payments, expense tracking & project management — built for how creatives actually work. No more chasing payments.
          </p>
        </div>

        <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
          {FINANCE_FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="flex flex-col p-5 sm:p-6 rounded-xl border border-border/50 bg-card hover:border-primary/30 hover:shadow-glow transition-all group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold text-foreground">{feature.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground ml-13">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <TrendingUp className="h-4 w-4 text-accent" />
            <span>Included with Creator membership</span>
          </div>
          <Link to="/auth">
            <Button variant="gradient" size="sm" className="gap-2">
              Get Started Free
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};
