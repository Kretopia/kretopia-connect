import { Wallet, TrendingUp, ArrowDownRight, ArrowUpRight, EyeOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AgentRoleInfo } from "@/hooks/useAgentRole";

interface AgentFinanceSummaryProps {
  project: any;
  agentRole: AgentRoleInfo;
}

function formatMoney(amount: number | null | undefined, currency: string = "USD") {
  if (amount == null) return "—";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

export function AgentFinanceSummary({ project, agentRole }: AgentFinanceSummaryProps) {
  if (!agentRole.isAgentMode) return null;

  const currency = project?.currency ?? "USD";
  const clientPrice: number | null = project?.client_price ?? null;
  const creativePayout: number | null = project?.creative_payout ?? null;
  const margin =
    clientPrice != null && creativePayout != null ? clientPrice - creativePayout : null;
  const marginPct =
    margin != null && clientPrice ? Math.round((margin / clientPrice) * 100) : null;

  return (
    <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
      {/* Client Price */}
      <Card className={cn(!agentRole.canSeeClientPrice && "opacity-60")}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <ArrowDownRight className="h-3.5 w-3.5" />
            Client Pays
          </div>
          {agentRole.canSeeClientPrice ? (
            <div className="text-2xl font-bold">{formatMoney(clientPrice, currency)}</div>
          ) : (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <EyeOff className="h-3.5 w-3.5" /> Hidden
            </div>
          )}
        </CardContent>
      </Card>

      {/* Creative Payout */}
      <Card className={cn(!agentRole.canSeeCreativePayout && "opacity-60")}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <ArrowUpRight className="h-3.5 w-3.5" />
            Creative Earns
          </div>
          {agentRole.canSeeCreativePayout ? (
            <div className="text-2xl font-bold">{formatMoney(creativePayout, currency)}</div>
          ) : (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <EyeOff className="h-3.5 w-3.5" /> Hidden
            </div>
          )}
        </CardContent>
      </Card>

      {/* Margin (manager only) */}
      <Card className={cn(
        agentRole.canSeeMargin
          ? "border-primary/30 bg-primary/5"
          : "opacity-60"
      )}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <TrendingUp className="h-3.5 w-3.5" />
            Your Margin
          </div>
          {agentRole.canSeeMargin ? (
            <>
              <div className="text-2xl font-bold text-primary">{formatMoney(margin, currency)}</div>
              {marginPct != null && (
                <div className="text-[11px] text-muted-foreground mt-0.5">{marginPct}% of deal</div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <EyeOff className="h-3.5 w-3.5" /> Manager only
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
