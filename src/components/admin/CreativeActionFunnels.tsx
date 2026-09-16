import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Filter } from "lucide-react";

type Step = { label: string; count: number };
type Funnels = {
  scout?: Step[];
  connection?: Step[];
  workspace?: Step[];
  invoice?: Step[];
  window?: { start: string; end: string };
};

const FUNNEL_META: { key: keyof Funnels; title: string; sub: string; color: string }[] = [
  { key: "scout", title: "Scout", sub: "Scouted → Opened → Drafted → Applied", color: "hsl(var(--signal-yellow, 45 100% 58%))" },
  { key: "connection", title: "Connection", sub: "Request → Accept → First message", color: "hsl(var(--signal-magenta, 330 100% 52%))" },
  { key: "workspace", title: "Studio", sub: "Created → Task added → Deliverable", color: "hsl(var(--signal-teal, 178 71% 47%))" },
  { key: "invoice", title: "Invoice", sub: "Drafted → Sent → Paid", color: "hsl(142 71% 45%)" },
];

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

function FunnelStrip({ steps, color }: { steps: Step[]; color: string }) {
  if (!steps?.length) return <div className="text-xs text-muted-foreground">No data</div>;
  const top = Math.max(steps[0].count, 1);
  return (
    <div className="space-y-2">
      {steps.map((s, i) => {
        const width = Math.max((s.count / top) * 100, 4);
        const prev = i > 0 ? steps[i - 1].count : s.count;
        const conv = i > 0 ? pct(s.count, prev) : 100;
        const drop = i > 0 ? 100 - conv : 0;
        return (
          <div key={s.label} className="space-y-1">
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-medium">{s.label}</span>
              <div className="flex items-center gap-2 tabular-nums">
                <span className="font-semibold">{s.count}</span>
                {i > 0 && (
                  <span className="text-muted-foreground text-[10px]">
                    {conv}% · −{drop}%
                  </span>
                )}
              </div>
            </div>
            <div className="h-5 bg-muted rounded-md overflow-hidden">
              <div
                className="h-full rounded-md transition-all duration-500"
                style={{ width: `${width}%`, backgroundColor: color }}
              />
            </div>
          </div>
        );
      })}
      {steps.length > 1 && (
        <div className="pt-1 text-[11px] text-muted-foreground">
          End-to-end: <span className="font-semibold text-foreground">{pct(steps[steps.length - 1].count, steps[0].count)}%</span>
        </div>
      )}
    </div>
  );
}

export function CreativeActionFunnels() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Funnels | null>(null);
  const [days, setDays] = useState<7 | 30 | 90>(30);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const end = new Date();
      const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
      const { data } = await (supabase.rpc as any)("get_creative_action_funnels", {
        _start: start.toISOString(),
        _end: end.toISOString(),
      });
      if (cancelled) return;
      setData((data as Funnels) || {});
      setLoading(false);
    };
    load().catch(() => setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [days]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="h-4 w-4" /> Creative Action Funnels
            </CardTitle>
            <CardDescription>Where users drop off across the 4 core conversion paths.</CardDescription>
          </div>
          <div className="flex items-center gap-1 text-xs">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d as 7 | 30 | 90)}
                className={`px-2 py-1 rounded border transition-colors ${
                  days === d ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {FUNNEL_META.map((f) => (
              <div key={f.key} className="rounded-lg border p-4 space-y-3">
                <div>
                  <div className="text-sm font-semibold">{f.title}</div>
                  <div className="text-[11px] text-muted-foreground">{f.sub}</div>
                </div>
                <FunnelStrip steps={(data?.[f.key] as Step[]) || []} color={f.color} />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default CreativeActionFunnels;
