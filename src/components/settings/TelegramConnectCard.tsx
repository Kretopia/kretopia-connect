import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Send, Loader2, CheckCircle2, Unlink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ChannelRow {
  id: string;
  external_username: string | null;
  external_display_name: string | null;
  linked_at: string;
}

export const TelegramConnectCard = () => {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [linked, setLinked] = useState<ChannelRow | null>(null);
  const { toast } = useToast();

  const refresh = async () => {
    try {
      const { data } = await supabase
        .from("messaging_channels")
        .select("id, external_username, external_display_name, linked_at")
        .eq("channel", "telegram")
        .eq("is_active", true)
        .maybeSingle();
      setLinked(data ?? null);
    } catch {
      setLinked(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const handleConnect = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("telegram-link-start");
      if (error) throw error;
      const url = (data as any)?.deep_link;
      if (!url) throw new Error("No link returned");
      window.open(url, "_blank", "noopener,noreferrer");
      toast({
        title: "Open Telegram and tap Start",
        description: "Your chat will link automatically. Pop back here when done.",
      });
      // Soft-refresh after 8s in case they finished quickly
      setTimeout(refresh, 8000);
    } catch (e) {
      toast({
        title: "Couldn't generate link",
        description: e instanceof Error ? e.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    if (!linked) return;
    setBusy(true);
    const { error } = await supabase
      .from("messaging_channels")
      .delete()
      .eq("id", linked.id);
    setBusy(false);
    if (error) {
      toast({ title: "Couldn't disconnect", variant: "destructive" });
      return;
    }
    setLinked(null);
    toast({ title: "Disconnected from Telegram" });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5" />
          Telegram
          {linked && (
            <Badge variant="secondary" className="ml-1 gap-1">
              <CheckCircle2 className="h-3 w-3" /> Connected
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Talk to Thrive from Telegram. Send messages, get updates, run actions on the go.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : linked ? (
          <>
            <p className="text-sm">
              Linked as{" "}
              <span className="font-medium">
                {linked.external_display_name || linked.external_username || "your Telegram chat"}
              </span>
              {linked.external_username && (
                <span className="text-muted-foreground"> (@{linked.external_username})</span>
              )}
              .
            </p>
            <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={busy}>
              <Unlink className="h-4 w-4 mr-2" />
              Disconnect
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              One tap opens @Thrivecopilotbot and links it to your account. Link expires in 15 minutes.
            </p>
            <Button onClick={handleConnect} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Connect Telegram
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};
