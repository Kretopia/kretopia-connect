import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Loader2, CheckCircle, XCircle, Clock, Mail, TrendingUp, AlertTriangle, RefreshCw, BarChart3
} from "lucide-react";

interface Analytics {
  totals: { sent: number; failed: number; pending: number; total: number };
  campaigns: any[];
  recentFails: any[];
  recentSent: any[];
  dailyStats: Record<string, { sent: number; failed: number }>;
}

export const DripAnalyticsPanel = () => {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke('process-drip-campaign', {
        body: { action: 'get_campaign_analytics' }
      });
      if (error) throw error;
      setData(res);
    } catch (err) {
      console.error("Analytics load failed:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!data) return <p className="text-center text-muted-foreground py-8">Failed to load analytics</p>;

  const { totals, campaigns, recentFails, recentSent, dailyStats } = data;
  const deliveryRate = totals.total > 0 ? ((totals.sent / (totals.sent + totals.failed)) * 100).toFixed(1) : "0";
  const dailyEntries = Object.entries(dailyStats).sort(([a], [b]) => a.localeCompare(b));

  // Simple bar chart using divs
  const maxDaily = Math.max(...dailyEntries.map(([, v]) => v.sent + v.failed), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" /> Campaign Analytics
        </h3>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <Mail className="h-4 w-4 text-primary" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Queued</span>
          </div>
          <p className="text-2xl font-bold">{totals.total.toLocaleString()}</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Delivered</span>
          </div>
          <p className="text-2xl font-bold text-green-500">{totals.sent.toLocaleString()}</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="h-4 w-4 text-red-500" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Failed</span>
          </div>
          <p className="text-2xl font-bold text-red-500">{totals.failed.toLocaleString()}</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-blue-500" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Delivery Rate</span>
          </div>
          <p className="text-2xl font-bold">{deliveryRate}%</p>
          <p className="text-[10px] text-muted-foreground">{totals.pending.toLocaleString()} pending</p>
        </Card>
      </div>

      {/* Daily Send Volume Chart */}
      {dailyEntries.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Daily Send Volume (Last 14 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1 h-32">
              {dailyEntries.map(([day, v]) => {
                const sentHeight = (v.sent / maxDaily) * 100;
                const failHeight = (v.failed / maxDaily) * 100;
                const shortDay = new Date(day + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                return (
                  <div key={day} className="flex-1 flex flex-col items-center gap-0.5 min-w-0">
                    <div className="w-full flex flex-col justify-end h-24">
                      {v.failed > 0 && (
                        <div
                          className="w-full bg-red-500/70 rounded-t-sm"
                          style={{ height: `${failHeight}%`, minHeight: v.failed > 0 ? 2 : 0 }}
                          title={`${v.failed} failed`}
                        />
                      )}
                      <div
                        className="w-full bg-green-500/70 rounded-t-sm"
                        style={{ height: `${sentHeight}%`, minHeight: v.sent > 0 ? 2 : 0 }}
                        title={`${v.sent} sent`}
                      />
                    </div>
                    <span className="text-[8px] text-muted-foreground truncate w-full text-center">{shortDay}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-4 mt-2 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><div className="w-2 h-2 bg-green-500/70 rounded-sm" /> Delivered</span>
              <span className="flex items-center gap-1"><div className="w-2 h-2 bg-red-500/70 rounded-sm" /> Failed</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs: Campaigns / Failed / Delivered */}
      <Tabs defaultValue="campaigns">
        <TabsList className="w-full">
          <TabsTrigger value="campaigns" className="flex-1 text-xs">Campaigns ({campaigns.length})</TabsTrigger>
          <TabsTrigger value="failed" className="flex-1 text-xs">Failed ({recentFails.length})</TabsTrigger>
          <TabsTrigger value="delivered" className="flex-1 text-xs">Delivered ({recentSent.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="mt-3">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Campaign</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs text-right">Sent</TableHead>
                  <TableHead className="text-xs text-right">Failed</TableHead>
                  <TableHead className="text-xs text-right">Pending</TableHead>
                  <TableHead className="text-xs text-right">Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c: any) => {
                  const pending = c.total_contacts - c.sent_count - c.failed_count;
                  const rate = (c.sent_count + c.failed_count) > 0
                    ? ((c.sent_count / (c.sent_count + c.failed_count)) * 100).toFixed(0)
                    : '-';
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="text-xs">
                        <div>
                          <p className="font-medium truncate max-w-[160px]">{c.subject}</p>
                          <p className="text-muted-foreground text-[10px]">{c.email_segments?.name}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={c.status === 'active' ? 'default' : c.status === 'completed' ? 'secondary' : 'outline'} className="text-[10px]">
                          {c.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs text-green-500">{c.sent_count}</TableCell>
                      <TableCell className="text-right text-xs text-red-500">{c.failed_count}</TableCell>
                      <TableCell className="text-right text-xs">{pending}</TableCell>
                      <TableCell className="text-right text-xs font-medium">{rate}%</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="failed" className="mt-3">
          {recentFails.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-6">🎉 No failed emails!</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {recentFails.map((f: any) => (
                <div key={f.id} className="border rounded-lg p-3 space-y-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium">{f.email_contacts?.email || 'Unknown'}</p>
                      <p className="text-[10px] text-muted-foreground">{f.email_contacts?.name}</p>
                    </div>
                    <Badge variant="destructive" className="text-[10px]">
                      <AlertTriangle className="h-2.5 w-2.5 mr-1" /> Failed
                    </Badge>
                  </div>
                  {f.error_message && (
                    <p className="text-[10px] text-red-400 bg-red-500/10 p-1.5 rounded">{f.error_message}</p>
                  )}
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Campaign: {f.drip_campaigns?.subject || '-'}</span>
                    <span>{f.sent_at ? new Date(f.sent_at).toLocaleString() : '-'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="delivered" className="mt-3">
          {recentSent.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-6">No delivered emails yet</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {recentSent.map((s: any) => (
                <div key={s.id} className="border rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium">{s.email_contacts?.email || 'Unknown'}</p>
                    <p className="text-[10px] text-muted-foreground">{s.email_contacts?.name} · {s.drip_campaigns?.subject}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant="secondary" className="text-[10px] bg-green-500/10 text-green-500">
                      <CheckCircle className="h-2.5 w-2.5 mr-1" /> Delivered
                    </Badge>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{s.sent_at ? new Date(s.sent_at).toLocaleString() : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
