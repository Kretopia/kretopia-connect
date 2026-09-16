import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertTriangle, Loader2, RefreshCw, Bot, Webhook } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Status = {
  connector_linked: boolean;
  error?: string;
  expected_webhook_url?: string;
  bot?: {
    ok: boolean;
    username: string | null;
    first_name: string | null;
    latency_ms: number;
    error: string | null;
  };
  webhook?: {
    ok: boolean;
    url: string | null;
    expected_url: string;
    matches: boolean;
    pending_update_count: number | null;
    last_error_date: number | null;
    last_error_message: string | null;
    ip_address: string | null;
    max_connections: number | null;
    allowed_updates: string[] | null;
    latency_ms: number;
    error: string | null;
  };
};

const Row = ({
  label,
  value,
  mono = false,
}: { label: string; value: React.ReactNode; mono?: boolean }) => (
  <div className="flex items-start justify-between gap-4 text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className={mono ? "font-mono text-xs break-all text-right" : "text-right"}>{value ?? "—"}</span>
  </div>
);

export const TelegramStatusCard = () => {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<Status | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("telegram-status");
    if (error) {
      setStatus({ connector_linked: false, error: error.message });
    } else {
      setStatus(data as Status);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const botOk = status?.bot?.ok;
  const hookOk = status?.webhook?.ok && status?.webhook?.matches;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Telegram connection status
          {loading ? null : (botOk && hookOk) ? (
            <Badge variant="success" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Healthy</Badge>
          ) : (
            <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> Needs attention</Badge>
          )}
        </CardTitle>
        <CardDescription>Live check: bot identity + webhook registration.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking…
          </div>
        ) : !status?.connector_linked ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <div className="flex items-center gap-2 font-medium text-destructive">
              <XCircle className="h-4 w-4" /> Connector not linked
            </div>
            <p className="mt-1 text-muted-foreground">
              {status?.error ?? "Connect Telegram first, then refresh."}
            </p>
          </div>
        ) : (
          <>
            {/* Bot block */}
            <section className="space-y-2">
              <header className="flex items-center gap-2 text-sm font-medium">
                <Bot className="h-4 w-4" />
                Bot
                {botOk ? (
                  <Badge variant="success" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Found</Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Not reachable</Badge>
                )}
              </header>
              <div className="rounded-md border bg-muted/30 p-3 space-y-1.5">
                <Row label="Username" value={status.bot?.username ? `@${status.bot.username}` : "—"} />
                <Row label="Display name" value={status.bot?.first_name} />
                <Row label="Latency" value={`${status.bot?.latency_ms ?? 0} ms`} />
                {status.bot?.error && (
                  <Row label="Error" value={<span className="text-destructive">{status.bot.error}</span>} />
                )}
              </div>
            </section>

            {/* Webhook block */}
            <section className="space-y-2">
              <header className="flex items-center gap-2 text-sm font-medium">
                <Webhook className="h-4 w-4" />
                Webhook
                {hookOk ? (
                  <Badge variant="success" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Linked</Badge>
                ) : status.webhook?.url ? (
                  <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> Mismatch</Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Not set</Badge>
                )}
              </header>
              <div className="rounded-md border bg-muted/30 p-3 space-y-1.5">
                <Row label="Registered URL" value={status.webhook?.url || "(none)"} mono />
                <Row label="Expected URL" value={status.webhook?.expected_url} mono />
                <Row label="Pending updates" value={status.webhook?.pending_update_count} />
                <Row label="IP" value={status.webhook?.ip_address} />
                <Row label="Allowed updates" value={status.webhook?.allowed_updates?.join(", ") || "all"} />
                <Row label="Latency" value={`${status.webhook?.latency_ms ?? 0} ms`} />
                {status.webhook?.last_error_message && (
                  <Row
                    label="Last error"
                    value={<span className="text-destructive">{status.webhook.last_error_message}</span>}
                  />
                )}
              </div>
              {!hookOk && (
                <p className="text-xs text-muted-foreground">
                  If the registered URL is empty or doesn't match, run <code className="font-mono">setWebhook</code> against the
                  expected URL.
                </p>
              )}
            </section>
          </>
        )}

        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Re-check
        </Button>
      </CardContent>
    </Card>
  );
};
