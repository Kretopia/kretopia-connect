import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, TrendingDown, RefreshCw } from "lucide-react";

type FunnelRow = {
  scouted: number;
  opened: number;
  drafted: number;
  apply_clicked: number;
  applied: number;
  won: number;
  lost: number;
  ghosted: number;
};

type SourceRow = {
  source: string;
  scouted: number;
  opened: number;
  applied: number;
  won: number;
};

const RANGES = [
  { label: "7d", value: 7 },
  { label: "30d", value: 30 },
  { label: "90d", value: 90 },
  { label: "All", value: 3650 },
];

const pct = (n: number, d: number) =>
  d > 0 ? `${Math.round((n / d) * 100)}%` : "—";

export function ScoutFunnelTab() {
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<FunnelRow | null>(null);
  const [bySource, setBySource] = useState<SourceRow[]>([]);

  const load = async () => {
    setLoading(true);
    const [{ data: s }, { data: b }] = await Promise.all([
      supabase.rpc("get_scout_funnel_stats", { _days: days }),
      supabase.rpc("get_scout_funnel_by_source", { _days: days }),
    ]);
    const row = Array.isArray(s) ? s[0] : s;
    setStats((row as FunnelRow) || null);
    setBySource(((b as SourceRow[]) || []));
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  const steps = stats
    ? [
        { key: "scouted", label: "Scouted", value: stats.scouted, base: stats.scouted },
        { key: "opened", label: "Opened", value: stats.opened, base: stats.scouted },
        { key: "drafted", label: "Drafted", value: stats.drafted, base: stats.opened },
        { key: "apply_clicked", label: "Apply Clicked", value: stats.apply_clicked, base: stats.opened },
        { key: "applied", label: "Applied", value: stats.applied, base: stats.apply_clicked || stats.opened },
        { key: "won", label: "Won", value: stats.won, base: stats.applied },
      ]
    : [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" /> Scout → Apply → Win Funnel
            </CardTitle>
            <CardDescription>Drop-off across the gig discovery flow</CardDescription>
          </div>
          <div className="flex items-center gap-1">
            {RANGES.map((r) => (
              <Button
                key={r.value}
                size="sm"
                variant={days === r.value ? "default" : "outline"}
                onClick={() => setDays(r.value)}
              >
                {r.label}
              </Button>
            ))}
            <Button size="icon" variant="ghost" onClick={() => void load()} title="Refresh" aria-label="Refresh funnel data">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-xl" />
              ))}
            </div>
          ) : !stats ? (
            <p className="text-sm text-muted-foreground">No data (or you are not an admin).</p>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {steps.map((s, i) => {
                  const prev = i > 0 ? steps[i - 1].value : null;
                  const dropoff = prev !== null && prev > 0
                    ? Math.round((1 - s.value / prev) * 100)
                    : null;
                  return (
                    <div key={s.key} className="rounded-xl border bg-card p-3">
                      <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                        {s.label}
                      </div>
                      <div className="text-2xl font-black mt-1">{s.value.toLocaleString()}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {i === 0 ? "Total" : `${pct(s.value, s.base)} of prev`}
                      </div>
                      {dropoff !== null && dropoff > 0 && (
                        <div className="text-[11px] text-destructive mt-0.5 flex items-center gap-1">
                          <TrendingDown className="h-3 w-3" /> -{dropoff}%
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-3 gap-3 mt-4">
                <div className="rounded-lg border bg-muted/30 p-3 text-center">
                  <div className="text-xl font-bold">{stats.won}</div>
                  <div className="text-[10px] uppercase text-muted-foreground">Won</div>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3 text-center">
                  <div className="text-xl font-bold">{stats.lost}</div>
                  <div className="text-[10px] uppercase text-muted-foreground">Lost</div>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3 text-center">
                  <div className="text-xl font-bold">{stats.ghosted}</div>
                  <div className="text-[10px] uppercase text-muted-foreground">Ghosted</div>
                </div>
              </div>

              <div className="mt-4 text-sm text-muted-foreground">
                Open → Applied conversion:{" "}
                <span className="font-bold text-foreground">
                  {pct(stats.applied, stats.opened)}
                </span>{" "}
                · Applied → Won:{" "}
                <span className="font-bold text-foreground">
                  {pct(stats.won, stats.applied)}
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>By source</CardTitle>
          <CardDescription>Which platforms convert best</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : bySource.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase text-muted-foreground border-b">
                    <th className="py-2 pr-3">Source</th>
                    <th className="py-2 pr-3 text-right">Scouted</th>
                    <th className="py-2 pr-3 text-right">Opened</th>
                    <th className="py-2 pr-3 text-right">Applied</th>
                    <th className="py-2 pr-3 text-right">Won</th>
                    <th className="py-2 pr-3 text-right">Open Rate</th>
                    <th className="py-2 pr-3 text-right">Apply Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {bySource.map((r) => (
                    <tr key={r.source} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-medium capitalize">{r.source}</td>
                      <td className="py-2 pr-3 text-right">{r.scouted}</td>
                      <td className="py-2 pr-3 text-right">{r.opened}</td>
                      <td className="py-2 pr-3 text-right">{r.applied}</td>
                      <td className="py-2 pr-3 text-right">{r.won}</td>
                      <td className="py-2 pr-3 text-right text-muted-foreground">
                        {pct(r.opened, r.scouted)}
                      </td>
                      <td className="py-2 pr-3 text-right text-muted-foreground">
                        {pct(r.applied, r.opened)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
