import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye, Users, TrendingUp, BarChart3, ArrowUpRight, ArrowDownRight, Clock, Lightbulb } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, ResponsiveContainer } from "recharts";
import { ProGate } from "@/components/project/ProGate";
import { FeatureLockedBanner } from "@/components/FeatureLockedBanner";
import { format, subDays, startOfDay } from "date-fns";

interface OpportunityStats {
  id: string;
  title: string;
  type: string;
  view_count: number;
  applications_count: number;
  conversion_rate: number;
  created_at: string;
  status: string;
}

interface ViewTrend {
  date: string;
  views: number;
  applications: number;
}

interface OpportunityAnalyticsProps {
  userId: string;
  isPro: boolean;
  opportunities: { id: string; title: string; type: string; status: string; created_at: string; applications_count: number }[];
  selectedOppId: string | null;
}

const chartConfig = {
  views: { label: "Views", color: "hsl(var(--primary))" },
  applications: { label: "Applications", color: "hsl(var(--accent))" },
};

export function OpportunityAnalytics({ userId, isPro, opportunities, selectedOppId }: OpportunityAnalyticsProps) {
  const [stats, setStats] = useState<OpportunityStats[]>([]);
  const [viewTrends, setViewTrends] = useState<ViewTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [topInsight, setTopInsight] = useState<string>("");

  useEffect(() => {
    if (isPro) fetchAnalytics();
  }, [userId, isPro, opportunities]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      // Fetch opportunities with view counts
      const { data: oppsData } = await supabase
        .from("opportunities")
        .select("id, title, type, view_count, status, created_at")
        .eq("created_by", userId)
        .order("created_at", { ascending: false });

      if (!oppsData?.length) {
        setLoading(false);
        return;
      }

      // Fetch application counts per opportunity
      const statsWithApps: OpportunityStats[] = await Promise.all(
        oppsData.map(async (opp) => {
          const { count } = await supabase
            .from("applications")
            .select("*", { count: "exact", head: true })
            .eq("opportunity_id", opp.id);

          const appCount = count || 0;
          return {
            id: opp.id,
            title: opp.title,
            type: opp.type,
            view_count: opp.view_count || 0,
            applications_count: appCount,
            conversion_rate: opp.view_count > 0 ? Math.round((appCount / opp.view_count) * 100) : 0,
            created_at: opp.created_at,
            status: opp.status,
          };
        })
      );

      setStats(statsWithApps);

      // Fetch view trends for selected or all opportunities (last 14 days)
      const targetOppIds = selectedOppId ? [selectedOppId] : oppsData.map((o) => o.id);
      const fourteenDaysAgo = subDays(new Date(), 14).toISOString();

      const { data: viewsData } = await supabase
        .from("opportunity_views")
        .select("viewed_at, opportunity_id")
        .in("opportunity_id", targetOppIds)
        .gte("viewed_at", fourteenDaysAgo)
        .order("viewed_at", { ascending: true });

      const { data: appsData } = await supabase
        .from("applications")
        .select("created_at, opportunity_id")
        .in("opportunity_id", targetOppIds)
        .gte("created_at", fourteenDaysAgo)
        .order("created_at", { ascending: true });

      // Group by date
      const trendMap: Record<string, { views: number; applications: number }> = {};
      for (let i = 13; i >= 0; i--) {
        const dateKey = format(subDays(new Date(), i), "MMM dd");
        trendMap[dateKey] = { views: 0, applications: 0 };
      }

      viewsData?.forEach((v) => {
        const key = format(new Date(v.viewed_at), "MMM dd");
        if (trendMap[key]) trendMap[key].views++;
      });

      appsData?.forEach((a) => {
        const key = format(new Date(a.created_at), "MMM dd");
        if (trendMap[key]) trendMap[key].applications++;
      });

      setViewTrends(Object.entries(trendMap).map(([date, data]) => ({ date, ...data })));

      // Generate insight
      generateInsight(statsWithApps);
    } catch (err) {
      console.error("Analytics fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const generateInsight = (data: OpportunityStats[]) => {
    if (!data.length) return;

    const bestConversion = data.reduce((best, curr) =>
      curr.conversion_rate > best.conversion_rate ? curr : best
    );

    const typeGroups: Record<string, { views: number; apps: number; count: number }> = {};
    data.forEach((s) => {
      if (!typeGroups[s.type]) typeGroups[s.type] = { views: 0, apps: 0, count: 0 };
      typeGroups[s.type].views += s.view_count;
      typeGroups[s.type].apps += s.applications_count;
      typeGroups[s.type].count++;
    });

    const bestType = Object.entries(typeGroups).reduce((best, [type, stats]) =>
      stats.apps / Math.max(stats.count, 1) > best[1].apps / Math.max(best[1].count, 1) ? [type, stats] as any : best
    );

    if (bestConversion.conversion_rate > 0) {
      setTopInsight(
        `Your best-converting opportunity is "${bestConversion.title}" at ${bestConversion.conversion_rate}% conversion. Your strongest category is ${bestType[0]}s.`
      );
    } else {
      setTopInsight("Post more opportunities and share them to start seeing performance data.");
    }
  };

  // Free tier - show basic counts + locked preview
  if (!isPro) {
    const totalViews = opportunities.reduce((sum, o) => sum + (o.applications_count || 0), 0);
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <Users className="h-8 w-8 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold">{totalViews}</p>
              <p className="text-sm text-muted-foreground">Total Applications</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <BarChart3 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-2xl font-bold">{opportunities.length}</p>
              <p className="text-sm text-muted-foreground">Opportunities Posted</p>
            </CardContent>
          </Card>
        </div>
        <FeatureLockedBanner
          feature="Full Analytics Dashboard"
          tier="pro"
          description="Unlock detailed views, conversion rates, trend charts, and performance insights for all your opportunities."
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const totalViews = stats.reduce((s, o) => s + o.view_count, 0);
  const totalApps = stats.reduce((s, o) => s + o.applications_count, 0);
  const avgConversion = totalViews > 0 ? Math.round((totalApps / totalViews) * 100) : 0;
  const activeCount = stats.filter((s) => s.status === "active").length;

  // Sort for comparison chart
  const comparisonData = stats
    .slice(0, 8)
    .map((s) => ({
      name: s.title.length > 20 ? s.title.slice(0, 20) + "…" : s.title,
      views: s.view_count,
      applications: s.applications_count,
    }));

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <Eye className="h-5 w-5 text-primary" />
              {totalViews > 0 && <ArrowUpRight className="h-4 w-4 text-accent" />}
            </div>
            <p className="text-2xl font-bold mt-2">{totalViews.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">Total Views</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <p className="text-2xl font-bold mt-2">{totalApps}</p>
            <p className="text-sm text-muted-foreground">Applications</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <p className="text-2xl font-bold mt-2">{avgConversion}%</p>
            <p className="text-sm text-muted-foreground">Conversion Rate</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <p className="text-2xl font-bold mt-2">{activeCount}</p>
            <p className="text-sm text-muted-foreground">Active Listings</p>
          </CardContent>
        </Card>
      </div>

      {/* AI Insight */}
      {topInsight && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-start gap-3 py-4">
            <Lightbulb className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-primary mb-1">Insight</p>
              <p className="text-sm text-muted-foreground">{topInsight}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Views & Applications (Last 14 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[250px] w-full">
            <LineChart data={viewTrends}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
              <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 11 }} />
              <YAxis className="text-xs" tick={{ fontSize: 11 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line type="monotone" dataKey="views" stroke="var(--color-views)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="applications" stroke="var(--color-applications)" strokeWidth={2} dot={false} />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Comparison Chart */}
      {comparisonData.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Opportunity Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <BarChart data={comparisonData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                <XAxis dataKey="name" className="text-xs" tick={{ fontSize: 10 }} />
                <YAxis className="text-xs" tick={{ fontSize: 11 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="views" fill="var(--color-views)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="applications" fill="var(--color-applications)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Per-Opportunity Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Per-Opportunity Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stats.map((s) => (
              <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{s.title}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                    <Badge variant="outline" className="text-[10px]">{s.type}</Badge>
                    <Badge variant={s.status === "active" ? "default" : "secondary"} className="text-[10px]">{s.status}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-6 text-sm shrink-0">
                  <div className="text-center">
                    <p className="font-bold">{s.view_count}</p>
                    <p className="text-[10px] text-muted-foreground">Views</p>
                  </div>
                  <div className="text-center">
                    <p className="font-bold">{s.applications_count}</p>
                    <p className="text-[10px] text-muted-foreground">Apps</p>
                  </div>
                  <div className="text-center">
                    <p className="font-bold">{s.conversion_rate}%</p>
                    <p className="text-[10px] text-muted-foreground">Conv.</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
