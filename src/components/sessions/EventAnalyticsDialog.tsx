import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Eye,
  Users,
  TrendingUp,
  ScanLine,
  DollarSign,
  Share2,
  Loader2,
  MousePointerClick,
} from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  eventTitle: string;
  capacity?: number | null;
  currency?: string | null;
}

interface Stats {
  views: number;
  shareClicks: number;
  rsvps: number;
  going: number;
  waitlist: number;
  checkedIn: number;
  ticketRevenue: number;
  ticketOrders: number;
  channels: { channel: string; clicks: number; rsvps: number }[];
  referrers: { name: string; rsvps: number }[];
}

export function EventAnalyticsDialog({
  open,
  onOpenChange,
  eventId,
  eventTitle,
  capacity,
  currency = "USD",
}: Props) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const [
          analyticsRes,
          shareClicksRes,
          participantsRes,
          waitlistRes,
          ordersRes,
        ] = await Promise.all([
          supabase
            .from("event_analytics_events")
            .select("event_type")
            .eq("event_id", eventId),
          supabase
            .from("event_share_clicks")
            .select("channel, converted_to_rsvp, referrer_user_id")
            .eq("event_id", eventId),
          supabase
            .from("jam_participants")
            .select("status, checked_in_at, referred_by, referral_channel")
            .eq("jam_id", eventId),
          supabase
            .from("event_waitlist")
            .select("id")
            .eq("event_id", eventId)
            .then((r) => r, () => ({ data: [] as any[], error: null })),
          supabase
            .from("event_orders")
            .select("total_amount, status, currency")
            .eq("event_id", eventId)
            .then((r) => r, () => ({ data: [] as any[], error: null })),
        ]);

        const analyticsRows = analyticsRes.data || [];
        const shareRows = shareClicksRes.data || [];
        const partRows = participantsRes.data || [];
        const waitlistRows = (waitlistRes as any).data || [];
        const orderRows = (ordersRes as any).data || [];

        const views = analyticsRows.filter(
          (r: any) => r.event_type === "view" || r.event_type === "page_view"
        ).length;

        const channelMap = new Map<
          string,
          { clicks: number; rsvps: number }
        >();
        shareRows.forEach((r: any) => {
          const c = r.channel || "unknown";
          const cur = channelMap.get(c) || { clicks: 0, rsvps: 0 };
          cur.clicks += 1;
          if (r.converted_to_rsvp) cur.rsvps += 1;
          channelMap.set(c, cur);
        });

        // Referrers via participants
        const refIds = Array.from(
          new Set(partRows.map((p: any) => p.referred_by).filter(Boolean))
        );
        let referrers: { name: string; rsvps: number }[] = [];
        if (refIds.length) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("user_id, full_name, username")
            .in("user_id", refIds as string[]);
          const counts = new Map<string, number>();
          partRows.forEach((p: any) => {
            if (p.referred_by) {
              counts.set(p.referred_by, (counts.get(p.referred_by) || 0) + 1);
            }
          });
          referrers = (profs || [])
            .map((p: any) => ({
              name: p.full_name || p.username || "Someone",
              rsvps: counts.get(p.user_id) || 0,
            }))
            .sort((a, b) => b.rsvps - a.rsvps)
            .slice(0, 5);
        }

        const going = partRows.filter(
          (p: any) => p.status === "going" || p.status === "interested"
        ).length;
        const checkedIn = partRows.filter((p: any) => p.checked_in_at).length;

        const paidOrders = orderRows.filter(
          (o: any) => o.status === "paid" || o.status === "completed"
        );
        const ticketRevenue = paidOrders.reduce(
          (sum: number, o: any) => sum + Number(o.total_amount || 0),
          0
        );

        if (!cancelled) {
          setStats({
            views,
            shareClicks: shareRows.length,
            rsvps: partRows.length,
            going,
            waitlist: waitlistRows.length,
            checkedIn,
            ticketRevenue,
            ticketOrders: paidOrders.length,
            channels: Array.from(channelMap.entries())
              .map(([channel, v]) => ({ channel, ...v }))
              .sort((a, b) => b.clicks - a.clicks),
            referrers,
          });
        }
      } catch (err) {
        console.error("Failed to load event analytics", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, eventId]);

  const conversionPct =
    stats && stats.shareClicks > 0
      ? Math.round((stats.rsvps / stats.shareClicks) * 100)
      : 0;
  const checkinPct =
    stats && stats.going > 0
      ? Math.round((stats.checkedIn / stats.going) * 100)
      : 0;
  const fillPct =
    stats && capacity && capacity > 0
      ? Math.min(100, Math.round((stats.going / capacity) * 100))
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Event analytics
          </DialogTitle>
          <DialogDescription className="line-clamp-1">
            {eventTitle}
          </DialogDescription>
        </DialogHeader>

        {loading || !stats ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Top KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KpiCard
                icon={<Eye className="h-4 w-4" />}
                label="Views"
                value={stats.views.toLocaleString()}
              />
              <KpiCard
                icon={<Users className="h-4 w-4" />}
                label="RSVPs"
                value={stats.rsvps.toLocaleString()}
                sub={
                  fillPct !== null
                    ? `${fillPct}% of ${capacity} cap`
                    : undefined
                }
              />
              <KpiCard
                icon={<MousePointerClick className="h-4 w-4" />}
                label="Conversion"
                value={`${conversionPct}%`}
                sub={`${stats.shareClicks} clicks`}
              />
              <KpiCard
                icon={<ScanLine className="h-4 w-4" />}
                label="Checked in"
                value={`${stats.checkedIn}`}
                sub={`${checkinPct}% of going`}
              />
            </div>

            {/* Revenue + waitlist */}
            <div className="grid grid-cols-2 gap-3">
              <KpiCard
                icon={<DollarSign className="h-4 w-4" />}
                label="Ticket revenue"
                value={`${currency} ${stats.ticketRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                sub={`${stats.ticketOrders} paid orders`}
              />
              <KpiCard
                icon={<Users className="h-4 w-4" />}
                label="Waitlist"
                value={stats.waitlist.toLocaleString()}
              />
            </div>

            {/* Channels */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Share2 className="h-4 w-4" />
                  Share channels
                </div>
                {stats.channels.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No share clicks yet. Share your event to start tracking.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {stats.channels.map((c) => {
                      const conv =
                        c.clicks > 0
                          ? Math.round((c.rsvps / c.clicks) * 100)
                          : 0;
                      return (
                        <div
                          key={c.channel}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="capitalize font-medium">
                            {c.channel}
                          </span>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{c.clicks} clicks</span>
                            <Badge variant="secondary" className="text-[10px]">
                              {c.rsvps} RSVP · {conv}%
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top referrers */}
            {stats.referrers.length > 0 && (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <TrendingUp className="h-4 w-4" />
                    Top promoters
                  </div>
                  <div className="space-y-2">
                    {stats.referrers.map((r, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="font-medium truncate">{r.name}</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {r.rsvps} RSVP{r.rsvps === 1 ? "" : "s"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function KpiCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="p-3 space-y-1">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
        <div className="text-xl font-bold leading-tight">{value}</div>
        {sub && (
          <div className="text-[10px] text-muted-foreground">{sub}</div>
        )}
      </CardContent>
    </Card>
  );
}
