import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Eye, MousePointerClick, Monitor, Smartphone, Tablet, TrendingUp } from "lucide-react";

interface AnalyticsData {
  totalViews: number;
  totalClicks: number;
  uniqueVisitors: number;
  deviceBreakdown: { desktop: number; tablet: number; mobile: number };
  topReferrers: { referrer: string; count: number }[];
  last7DaysViews: { date: string; count: number }[];
}

export const SiteAnalyticsDashboard = () => {
  const { user } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchAnalytics = async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: events } = await supabase
        .from('site_analytics')
        .select('event_type, visitor_id, device_type, referrer, created_at')
        .eq('user_id', user.id)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false });

      if (!events) { setLoading(false); return; }

      const views = events.filter(e => e.event_type === 'view');
      const clicks = events.filter(e => e.event_type === 'click');
      const uniqueIds = new Set(events.map(e => e.visitor_id).filter(Boolean));

      // Device breakdown
      const deviceBreakdown = { desktop: 0, tablet: 0, mobile: 0 };
      views.forEach(v => {
        const d = v.device_type as keyof typeof deviceBreakdown;
        if (d in deviceBreakdown) deviceBreakdown[d]++;
      });

      // Top referrers
      const refMap = new Map<string, number>();
      views.forEach(v => {
        const r = v.referrer || 'Direct';
        try {
          const host = r === 'Direct' ? r : new URL(r).hostname;
          refMap.set(host, (refMap.get(host) || 0) + 1);
        } catch {
          refMap.set(r, (refMap.get(r) || 0) + 1);
        }
      });
      const topReferrers = Array.from(refMap.entries())
        .map(([referrer, count]) => ({ referrer, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Last 7 days
      const last7 = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return d.toISOString().split('T')[0];
      });
      const dayMap = new Map<string, number>();
      views.forEach(v => {
        const day = v.created_at.split('T')[0];
        dayMap.set(day, (dayMap.get(day) || 0) + 1);
      });
      const last7DaysViews = last7.map(date => ({
        date,
        count: dayMap.get(date) || 0,
      }));

      setData({
        totalViews: views.length,
        totalClicks: clicks.length,
        uniqueVisitors: uniqueIds.size,
        deviceBreakdown,
        topReferrers,
        last7DaysViews,
      });
      setLoading(false);
    };

    fetchAnalytics();
  }, [user?.id]);

  if (loading) return null;
  if (!data) return null;

  const maxDayViews = Math.max(...data.last7DaysViews.map(d => d.count), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Site Analytics
          <Badge variant="secondary" className="text-[10px]">Last 30 days</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <Eye className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-lg font-bold">{data.totalViews}</p>
            <p className="text-[10px] text-muted-foreground">Views</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <MousePointerClick className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-lg font-bold">{data.totalClicks}</p>
            <p className="text-[10px] text-muted-foreground">Clicks</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <TrendingUp className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-lg font-bold">{data.uniqueVisitors}</p>
            <p className="text-[10px] text-muted-foreground">Unique</p>
          </div>
        </div>

        {/* Mini bar chart - last 7 days */}
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground font-medium">Last 7 days</p>
          <div className="flex items-end gap-1 h-16">
            {data.last7DaysViews.map((day) => (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-0.5">
                <div
                  className="w-full bg-primary/70 rounded-sm transition-all min-h-[2px]"
                  style={{ height: `${(day.count / maxDayViews) * 100}%` }}
                />
                <span className="text-[8px] text-muted-foreground">
                  {new Date(day.date + 'T00:00:00').toLocaleDateString('en', { weekday: 'narrow' })}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Devices */}
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground font-medium">Devices</p>
          <div className="flex gap-3 text-xs">
            <span className="flex items-center gap-1"><Monitor className="h-3 w-3" /> {data.deviceBreakdown.desktop}</span>
            <span className="flex items-center gap-1"><Tablet className="h-3 w-3" /> {data.deviceBreakdown.tablet}</span>
            <span className="flex items-center gap-1"><Smartphone className="h-3 w-3" /> {data.deviceBreakdown.mobile}</span>
          </div>
        </div>

        {/* Referrers */}
        {data.topReferrers.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground font-medium">Top Referrers</p>
            <div className="space-y-1">
              {data.topReferrers.map((r) => (
                <div key={r.referrer} className="flex items-center justify-between text-xs">
                  <span className="truncate">{r.referrer}</span>
                  <span className="text-muted-foreground shrink-0 ml-2">{r.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.totalViews === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">
            No visits yet. Share your site link to start tracking!
          </p>
        )}
      </CardContent>
    </Card>
  );
};
