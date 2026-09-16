import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Activity, Users, MessageSquare, Briefcase, FileText, Wallet, Trophy, Sparkles, TrendingUp } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { CreativeActionFunnels } from "./CreativeActionFunnels";
import { LandingFunnelPanel } from "./LandingFunnelPanel";

type KPIs = {
  growth?: { signups_7d: number; signups_30d: number; total_users: number };
  reputation?: { credits_added_7d: number; credits_added_30d: number; total_credits: number; vouches_30d: number };
  network?: { connections_7d: number; messages_7d: number; messages_30d: number };
  opportunities?: { applications_7d: number; applications_30d: number; scout_actions_7d: number; open_gigs: number };
  studios?: { workspaces_7d: number; workspaces_30d: number; total_workspaces: number; invoices_30d: number };
  executive_producer?: { documents_7d: number; documents_30d: number; total_documents: number; by_intent?: Record<string, number> };
  creative_actions_total_7d?: number;
  creative_actions_total_30d?: number;
};

type ActiveRollup = { dau: number; wau: number; mau: number; dau_wau_ratio: number };
type DailyRow = { day: string; action_type: string; action_count: number; unique_users: number };
type CohortRow = { cohort_week: string; week_offset: number; cohort_size: number; retained: number; retention_pct: number };

const ACTION_LABEL: Record<string, string> = {
  credit_added: "Credit added",
  connection_accepted: "Connection accepted",
  message_sent: "Message sent",
  workspace_created: "Workspace created",
  job_application: "Job application",
  proposal_generated: "Proposal generated",
  invoice_generated: "Invoice generated",
  scout_action: "Scout action",
};

const STAT = (label: string, value: number | string, sub?: string) => (
  <div className="flex flex-col gap-1">
    <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
    <div className="text-2xl font-semibold">{value}</div>
    {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
  </div>
);

export const ProductDashboardTab = () => {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KPIs>({});
  const [active, setActive] = useState<ActiveRollup | null>(null);
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [cohorts, setCohorts] = useState<CohortRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const [kpisRes, activeRes, dailyRes, cohortsRes] = await Promise.all([
        (supabase.rpc as any)("get_product_kpis").then((r: any) => r, () => ({ data: null })),
        (supabase.rpc as any)("get_active_users_rollup").then((r: any) => r, () => ({ data: null })),
        (supabase.rpc as any)("get_creative_actions_daily", { _days: 30 }).then((r: any) => r, () => ({ data: null })),
        (supabase.rpc as any)("get_retention_cohorts", { _weeks: 8 }).then((r: any) => r, () => ({ data: null })),
      ]);
      if (cancelled) return;
      setKpis((kpisRes.data as any) || {});
      const aRows = (activeRes.data as any) || [];
      setActive(Array.isArray(aRows) ? aRows[0] || null : aRows);
      setDaily(((dailyRes.data as any) || []) as DailyRow[]);
      setCohorts(((cohortsRes.data as any) || []) as CohortRow[]);
      setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // North Star: stacked area-ish line by action_type (last 30d)
  const dailyTotals = (() => {
    const map = new Map<string, Record<string, number>>();
    daily.forEach((r) => {
      const cur = map.get(r.day) || { day: r.day as any, total: 0 };
      cur[r.action_type] = Number(r.action_count);
      cur.total = (Number(cur.total) || 0) + Number(r.action_count);
      cur.day = r.day as any;
      map.set(r.day, cur);
    });
    return Array.from(map.values()).sort((a, b) =>
      String(a.day).localeCompare(String(b.day))
    );
  })();

  // Action-type 30d totals for bar chart
  const typeTotals = (() => {
    const m = new Map<string, number>();
    daily.forEach((r) => m.set(r.action_type, (m.get(r.action_type) || 0) + Number(r.action_count)));
    return Object.keys(ACTION_LABEL).map((k) => ({
      type: ACTION_LABEL[k],
      count: m.get(k) || 0,
    }));
  })();

  // Cohort table — pivot offsets 0..6
  const cohortGrid = (() => {
    const byWeek = new Map<string, CohortRow[]>();
    cohorts.forEach((c) => {
      const arr = byWeek.get(c.cohort_week) || [];
      arr.push(c);
      byWeek.set(c.cohort_week, arr);
    });
    return Array.from(byWeek.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([week, rows]) => {
        const size = rows[0]?.cohort_size || 0;
        const offsets: Record<number, number> = {};
        rows.forEach((r) => {
          offsets[r.week_offset] = Number(r.retention_pct);
        });
        return { week, size, offsets };
      });
  })();

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* North Star Hero */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                North Star · Creative Actions
              </CardTitle>
              <CardDescription>
                Career-progress events: credit added, connection accepted, message sent, workspace
                created, job application, proposal generated, invoice generated, scout action.
              </CardDescription>
            </div>
            <Badge variant="secondary" className="text-xs">
              Server-side tracked
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {STAT("7-day actions", kpis.creative_actions_total_7d ?? 0)}
            {STAT("30-day actions", kpis.creative_actions_total_30d ?? 0)}
            {STAT(
              "DAU",
              active?.dau ?? 0,
              active ? `WAU ${active.wau} · MAU ${active.mau}` : undefined
            )}
            {STAT(
              "DAU/WAU stickiness",
              active ? `${active.dau_wau_ratio}%` : "—",
              "Higher = more habitual use"
            )}
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyTotals}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Six section cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" />
              Growth
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-3">
            {STAT("7d signups", kpis.growth?.signups_7d ?? 0)}
            {STAT("30d signups", kpis.growth?.signups_30d ?? 0)}
            {STAT("Total users", kpis.growth?.total_users ?? 0)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-4 w-4" />
              Reputation
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-3">
            {STAT("Credits 7d", kpis.reputation?.credits_added_7d ?? 0)}
            {STAT("Credits 30d", kpis.reputation?.credits_added_30d ?? 0)}
            {STAT("Co-signs 30d", kpis.reputation?.vouches_30d ?? 0)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              Network
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-3">
            {STAT("Connections 7d", kpis.network?.connections_7d ?? 0)}
            {STAT("Msgs 7d", kpis.network?.messages_7d ?? 0)}
            {STAT("Msgs 30d", kpis.network?.messages_30d ?? 0)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Briefcase className="h-4 w-4" />
              Opportunities
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-3">
            {STAT("Applies 7d", kpis.opportunities?.applications_7d ?? 0)}
            {STAT("Scout 7d", kpis.opportunities?.scout_actions_7d ?? 0)}
            {STAT("Open gigs", kpis.opportunities?.open_gigs ?? 0)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" />
              Studios
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-3">
            {STAT("New 7d", kpis.studios?.workspaces_7d ?? 0)}
            {STAT("New 30d", kpis.studios?.workspaces_30d ?? 0)}
            {STAT("Invoices 30d", kpis.studios?.invoices_30d ?? 0)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              Executive Producer
            </CardTitle>
            <CardDescription className="text-xs">
              Decks, proposals, treatments, rate cards
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              {STAT("Docs 7d", kpis.executive_producer?.documents_7d ?? 0)}
              {STAT("Docs 30d", kpis.executive_producer?.documents_30d ?? 0)}
              {STAT("All-time", kpis.executive_producer?.total_documents ?? 0)}
            </div>
            {kpis.executive_producer?.by_intent && (
              <div className="flex flex-wrap gap-1.5 pt-2 border-t">
                {Object.entries(kpis.executive_producer.by_intent).map(([k, v]) => (
                  <Badge key={k} variant="outline" className="text-xs">
                    {k}: {v}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Action-type breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Creative Actions by Type · last 30 days</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={typeTotals} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="type" type="category" tick={{ fontSize: 11 }} width={140} />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Cohort retention */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Weekly cohort retention</CardTitle>
          <CardDescription>
            % of each signup-week cohort that returned and performed a Creative Action in that week.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {cohortGrid.length === 0 ? (
            <div className="text-sm text-muted-foreground">Not enough data yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-3">Cohort</th>
                    <th className="text-left py-2 pr-3">Size</th>
                    {[0, 1, 2, 3, 4, 5, 6, 7].map((w) => (
                      <th key={w} className="text-left py-2 pr-3">
                        W{w}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cohortGrid.map((row) => (
                    <tr key={row.week} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-mono">{row.week}</td>
                      <td className="py-2 pr-3">{row.size}</td>
                      {[0, 1, 2, 3, 4, 5, 6, 7].map((w) => {
                        const v = row.offsets[w];
                        return (
                          <td key={w} className="py-2 pr-3">
                            {v !== undefined ? (
                              <span
                                className="inline-block px-2 py-0.5 rounded"
                                style={{
                                  backgroundColor: `hsl(var(--primary) / ${Math.min(v / 100, 1) * 0.35 + 0.05})`,
                                }}
                              >
                                {v}%
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <LandingFunnelPanel />

      <CreativeActionFunnels />
      <LandingFunnelPanel />
    </div>
  );
};

export default ProductDashboardTab;
