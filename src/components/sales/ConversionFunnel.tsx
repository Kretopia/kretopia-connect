import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ConversionFunnelProps {
  leads: any[];
}

const FUNNEL_STAGES = [
  { key: "total", label: "Total Leads", color: "hsl(var(--primary))" },
  { key: "contacted", label: "Contacted", color: "hsl(38 92% 50%)" },
  { key: "hot", label: "Hot / Interested", color: "hsl(25 95% 53%)" },
  { key: "negotiating", label: "Negotiating", color: "hsl(262 83% 58%)" },
  { key: "converted", label: "Won / Converted", color: "hsl(142 76% 36%)" },
];

export function ConversionFunnel({ leads }: ConversionFunnelProps) {
  const funnelData = useMemo(() => {
    const total = leads.length;
    const contacted = leads.filter(l => ["contacted", "hot", "negotiating", "converted"].includes(l.stage)).length;
    const hot = leads.filter(l => ["hot", "negotiating", "converted"].includes(l.stage)).length;
    const negotiating = leads.filter(l => ["negotiating", "converted"].includes(l.stage)).length;
    const converted = leads.filter(l => l.stage === "converted").length;

    return [
      { ...FUNNEL_STAGES[0], count: total },
      { ...FUNNEL_STAGES[1], count: contacted },
      { ...FUNNEL_STAGES[2], count: hot },
      { ...FUNNEL_STAGES[3], count: negotiating },
      { ...FUNNEL_STAGES[4], count: converted },
    ];
  }, [leads]);

  const maxCount = Math.max(funnelData[0]?.count || 1, 1);
  const overallRate = funnelData[0].count > 0
    ? ((funnelData[4].count / funnelData[0].count) * 100).toFixed(1)
    : "0";

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Conversion Funnel</CardTitle>
          <span className="text-xs text-muted-foreground">{overallRate}% conversion</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {funnelData.map((stage, i) => {
          const width = Math.max((stage.count / maxCount) * 100, 8);
          const prevCount = i > 0 ? funnelData[i - 1].count : stage.count;
          const dropoff = prevCount > 0 && i > 0 ? ((1 - stage.count / prevCount) * 100).toFixed(0) : null;

          return (
            <div key={stage.key} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">{stage.label}</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{stage.count}</span>
                  {dropoff && Number(dropoff) > 0 && (
                    <span className="text-muted-foreground text-[10px]">-{dropoff}%</span>
                  )}
                </div>
              </div>
              <div className="h-6 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${width}%`, backgroundColor: stage.color }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
