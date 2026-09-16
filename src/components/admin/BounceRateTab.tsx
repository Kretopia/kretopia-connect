import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Activity, Eye, Users, Clock, TrendingDown, TrendingUp } from "lucide-react";

interface PageStat {
  path: string;
  views: number;
  avgDurationSec: number;
}

interface Stats {
  sessions: number;
  pageviews: number;
  uniqueVisitors: number;
  bounces: number;
  avgSessionSec: number;
  topPages: PageStat[];
  topEntryPages: PageStat[];
  byDay: { date: string; sessions: number; bounces: number }[];
}

const BOUNCE_DURATION_THRESHOLD_MS = 10_000;

export const BounceRateTab = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<7 | 14 | 30>(14);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const since = new Date();
      since.setDate(since.getDate() - days);

      const { data, error } = await supabase
        .from("site_analytics")
        .select("event_type,visitor_id,session_id,page_path,duration_ms,created_at")
        .eq("scope", "platform")
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: true })
        .limit(50000);

      if (!alive) return;
      if (error || !data) {
        setLoading(false);
        return;
      }

      // Group by session
      const sessions = new Map<
        string,
        { views: number; durationMs: number; entry: string | null; firstTs: number }
      >();
      const visitors = new Set<string>();
      const pageViewCounts = new Map<string, number>();
      const pageDurationSum = new Map<string, { sum: number; n: number }>();
      const entryCounts = new Map<string, number>();
      const entryDurationSum = new Map<string, { sum: number; n: number }>();
      const dayMap = new Map<string, { sessions: Set<string>; bounceSessions: Set<string> }>();

      for (const row of data) {
        const sid = row.session_id;
        const vid = row.visitor_id;
        if (vid) visitors.add(vid);
        if (!sid) continue;

        let s = sessions.get(sid);
        if (!s) {
          s = { views: 0, durationMs: 0, entry: null, firstTs: new Date(row.created_at).getTime() };
          sessions.set(sid, s);
        }

        if (row.event_type === "view") {
          s.views += 1;
          if (!s.entry) s.entry = row.page_path;
          if (row.page_path) {
            pageViewCounts.set(row.page_path, (pageViewCounts.get(row.page_path) || 0) + 1);
          }
        } else if (row.event_type === "duration" && row.duration_ms) {
          s.durationMs += row.duration_ms;
          if (row.page_path) {
            const cur = pageDurationSum.get(row.page_path) || { sum: 0, n: 0 };
            cur.sum += row.duration_ms;
            cur.n += 1;
            pageDurationSum.set(row.page_path, cur);
          }
        }
      }

      let bounces = 0;
      let totalSessionMs = 0;
      for (const [sid, s] of sessions) {
        totalSessionMs += s.durationMs;
        const isBounce = s.views <= 1 && s.durationMs < BOUNCE_DURATION_THRESHOLD_MS;
        if (isBounce) bounces += 1;
        if (s.entry) {
          entryCounts.set(s.entry, (entryCounts.get(s.entry) || 0) + 1);
          const cur = entryDurationSum.get(s.entry) || { sum: 0, n: 0 };
          cur.sum += s.durationMs;
          cur.n += 1;
          entryDurationSum.set(s.entry, cur);
        }
        const day = new Date(s.firstTs).toISOString().split("T")[0];
        let bucket = dayMap.get(day);
        if (!bucket) {
          bucket = { sessions: new Set(), bounceSessions: new Set() };
          dayMap.set(day, bucket);
        }
        bucket.sessions.add(sid);
        if (isBounce) bucket.bounceSessions.add(sid);
      }

      const sessionCount = sessions.size;
      const pageviewCount = Array.from(sessions.values()).reduce((acc, s) => acc + s.views, 0);

      const topPages: PageStat[] = Array.from(pageViewCounts.entries())
        .map(([path, views]) => {
          const dur = pageDurationSum.get(path);
          return {
            path,
            views,
            avgDurationSec: dur && dur.n > 0 ? Math.round(dur.sum / dur.n / 1000) : 0,
          };
        })
        .sort((a, b) => b.views - a.views)
        .slice(0, 10);

      const topEntryPages: PageStat[] = Array.from(entryCounts.entries())
        .map(([path, views]) => {
          const dur = entryDurationSum.get(path);
          return {
            path,
            views,
            avgDurationSec: dur && dur.n > 0 ? Math.round(dur.sum / dur.n / 1000) : 0,
          };
        })
        .sort((a, b) => b.views - a.views)
        .slice(0, 10);

      const byDay = Array.from({ length: days }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (days - 1 - i));
        const key = d.toISOString().split("T")[0];
        const bucket = dayMap.get(key);
        return {
          date: key,
          sessions: bucket?.sessions.size || 0,
          bounces: bucket?.bounceSessions.size || 0,
        };
      });

      setStats({
        sessions: sessionCount,
        pageviews: pageviewCount,
        uniqueVisitors: visitors.size,
        bounces,
        avgSessionSec: sessionCount > 0 ? Math.round(totalSessionMs / sessionCount / 1000) : 0,
        topPages,
        topEntryPages,
        byDay,
      });
      setLoading(false);
    })().catch(() => setLoading(false));

    return () => {
      alive = false;
    };
  }, [days]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground text-sm">
          Loading platform analytics…
        </CardContent>
      </Card>
    );
  }

  if (!stats || stats.sessions === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" /> Platform Analytics</CardTitle>
          <CardDescription>
            No platform pageviews recorded yet in the last {days} days. Tracking starts on the next page load.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const bounceRate = stats.sessions > 0 ? (stats.bounces / stats.sessions) * 100 : 0;
  const pagesPerSession = stats.sessions > 0 ? stats.pageviews / stats.sessions : 0;
  const maxDay = Math.max(...stats.byDay.map((d) => d.sessions), 1);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" /> Platform Analytics
            </CardTitle>
            <CardDescription>Sessions, pageviews, time-on-page & bounce rate</CardDescription>
          </div>
          <div className="flex gap-1">
            {([7, 14, 30] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  days === d
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <KPI icon={<Users className="h-4 w-4" />} label="Sessions" value={stats.sessions.toLocaleString()} />
            <KPI icon={<Eye className="h-4 w-4" />} label="Pageviews" value={stats.pageviews.toLocaleString()} />
            <KPI icon={<Users className="h-4 w-4" />} label="Unique visitors" value={stats.uniqueVisitors.toLocaleString()} />
            <KPI
              icon={bounceRate > 60 ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
              label="Bounce rate"
              value={`${bounceRate.toFixed(1)}%`}
              tone={bounceRate > 60 ? "warn" : bounceRate < 40 ? "good" : "neutral"}
            />
            <KPI icon={<Clock className="h-4 w-4" />} label="Avg session" value={formatSec(stats.avgSessionSec)} />
          </div>

          <div className="text-xs text-muted-foreground">
            Pages / session: <span className="font-semibold text-foreground">{pagesPerSession.toFixed(2)}</span>
            <span className="mx-2">•</span>
            Bounce = single-pageview session under {Math.round(BOUNCE_DURATION_THRESHOLD_MS / 1000)}s
          </div>

          {/* Sessions / bounces by day */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Sessions per day</p>
            <div className="flex items-end gap-1 h-24">
              {stats.byDay.map((d) => {
                const sessionsH = (d.sessions / maxDay) * 100;
                const bouncesH = (d.bounces / maxDay) * 100;
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex flex-col justify-end h-full relative">
                      <div
                        className="w-full bg-primary/80 rounded-t-sm"
                        style={{ height: `${sessionsH}%` }}
                        title={`${d.date}: ${d.sessions} sessions`}
                      />
                      <div
                        className="w-full bg-destructive/70 absolute bottom-0 rounded-t-sm"
                        style={{ height: `${bouncesH}%` }}
                        title={`${d.date}: ${d.bounces} bounces`}
                      />
                    </div>
                    <span className="text-[8px] text-muted-foreground">
                      {new Date(d.date + "T00:00:00").toLocaleDateString("en", { day: "numeric" })}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-primary/80" /> Sessions</span>
              <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-destructive/70" /> Bounces</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <PageList title="Top pages" subtitle="By total pageviews" rows={stats.topPages} />
        <PageList title="Top entry pages" subtitle="Where sessions start" rows={stats.topEntryPages} />
      </div>
    </div>
  );
};

const KPI = ({
  icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "good" | "warn" | "neutral";
}) => (
  <div
    className={`rounded-lg border p-3 ${
      tone === "warn"
        ? "border-destructive/40 bg-destructive/5"
        : tone === "good"
        ? "border-primary/30 bg-primary/5"
        : "border-border bg-muted/30"
    }`}
  >
    <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] mb-1">
      {icon}
      <span>{label}</span>
    </div>
    <div className="text-xl font-bold">{value}</div>
  </div>
);

const PageList = ({
  title,
  subtitle,
  rows,
}: {
  title: string;
  subtitle: string;
  rows: PageStat[];
}) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-base">{title}</CardTitle>
      <CardDescription className="text-xs">{subtitle}</CardDescription>
    </CardHeader>
    <CardContent className="space-y-1.5">
      {rows.length === 0 && <p className="text-xs text-muted-foreground">No data yet.</p>}
      {rows.map((r) => (
        <div key={r.path} className="flex items-center justify-between gap-2 text-xs py-1 border-b border-border/50 last:border-0">
          <span className="truncate font-mono text-[11px]">{r.path || "/"}</span>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="secondary" className="text-[10px]">{r.views}</Badge>
            <span className="text-muted-foreground text-[10px]">{formatSec(r.avgDurationSec)}</span>
          </div>
        </div>
      ))}
    </CardContent>
  </Card>
);

const formatSec = (s: number): string => {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${r}s`;
};
