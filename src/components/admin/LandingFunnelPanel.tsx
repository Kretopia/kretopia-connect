/**
 * LandingFunnelPanel — guest landing conversion funnel for admins.
 *
 * Reads `get_landing_funnel`, which is admin-gated and derives everything
 * from `analytics_events` + `profiles`. Follows the CreativeActionFunnels
 * pattern: preset ranges, a proportional bar strip, step-to-step conversion.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingDown } from "lucide-react";

type Step = { label: string; count: number };
type SectionRow = { section: string; index: number; visitors: number };
type CtaRow = { cta: string; section: string; clicks: number; visitors: number };
type Funnel = { steps?: Step[]; sections?: SectionRow[]; ctas?: CtaRow[]; scroll_100?: number };

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

export function LandingFunnelPanel() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Funnel | null>(null);
  const [days, setDays] = useState<7 | 30 | 90>(7);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const end = new Date();
      const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
      const { data } = await (supabase.rpc as any)("get_landing_funnel", {
        _start: start.toISOString(),
        _end: end.toISOString(),
      });
      if (cancelled) return;
      setData((data as Funnel) || {});
      setLoading(false);
    };
    load().catch(() => setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [days]);

  const steps = data?.steps ?? [];
  const top = Math.max(steps[0]?.count ?? 1, 1);
  const sections = [...(data?.sections ?? [])].sort((a, b) => a.index - b.index);
  const ctas = data?.ctas ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingDown className="h-4 w-4" /> Landing Funnel
            </CardTitle>
            <CardDescription>
              Guest landing page → sign-up. Section reach and CTA clicks show where attention stops.
            </CardDescription>
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
      <CardContent className="space-y-6">
        {loading ? (
          <Skeleton className="h-64" />
        ) : (
          <>
            <div className="space-y-2">
              {steps.map((s, i) => {
                const prev = i > 0 ? steps[i - 1].count : s.count;
                return (
                  <div key={s.label} className="space-y-1">
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="font-medium">{s.label}</span>
                      <div className="flex items-center gap-2 tabular-nums">
                        <span className="font-semibold">{s.count}</span>
                        {i > 0 && (
                          <span className="text-muted-foreground text-[10px]">
                            {pct(s.count, prev)}% of previous
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="h-5 bg-muted rounded-md overflow-hidden">
                      <div
                        className="h-full rounded-md bg-primary transition-all duration-500"
                        style={{ width: `${Math.max((s.count / top) * 100, 3)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {steps.length > 1 && (
                <p className="pt-1 text-[11px] text-muted-foreground">
                  Landing → account:{" "}
                  <span className="font-semibold text-foreground">
                    {pct(steps[steps.length - 1].count, steps[0].count)}%
                  </span>
                </p>
              )}
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-lg border p-4">
                <div className="text-sm font-semibold mb-2">Section reach</div>
                {sections.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No section views yet — data starts collecting from the next landing visit.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {sections.map((s) => (
                      <li key={s.section} className="flex items-center justify-between text-xs">
                        <span className="truncate pr-2">{s.section}</span>
                        <span className="tabular-nums font-medium">
                          {s.visitors}
                          <span className="text-muted-foreground ml-1">({pct(s.visitors, top)}%)</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-lg border p-4">
                <div className="text-sm font-semibold mb-2">CTA clicks</div>
                {ctas.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No CTA clicks in this window.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {ctas.slice(0, 12).map((c) => (
                      <li key={`${c.cta}-${c.section}`} className="flex items-center justify-between text-xs">
                        <span className="truncate pr-2">
                          {c.cta}
                          <span className="text-muted-foreground"> · {c.section}</span>
                        </span>
                        <span className="tabular-nums font-medium">{c.visitors}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default LandingFunnelPanel;
