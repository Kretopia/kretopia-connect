import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Mail, CheckCircle2, AlertCircle, Loader2, ExternalLink, Unplug, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export function GmailSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [testing, setTesting] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["user_email_settings", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_email_settings" as any)
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!user,
  });

  const isConnected = settings?.is_configured;

  const handleTestAndConnect = async () => {
    if (!email || !password) {
      toast.error("Please enter both email and app password");
      return;
    }
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-outreach-email", {
        body: {
          action: "test_gmail",
          gmail_email: email,
          gmail_app_password: password,
        },
      });
      if (error) throw error;
      if (data.error) {
        toast.error(data.error);
        return;
      }
      toast.success(data.message || "Gmail connected successfully!");
      setEmail("");
      setPassword("");
      queryClient.invalidateQueries({ queryKey: ["user_email_settings"] });
    } catch (e: any) {
      console.error(e);
      toast.error("Failed to connect Gmail. Check your credentials.");
    } finally {
      setTesting(false);
    }
  };

  const disconnect = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("send-outreach-email", {
        body: { action: "disconnect_email" },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_email_settings"] });
      toast.success("Gmail disconnected");
    },
    onError: () => toast.error("Failed to disconnect"),
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-muted-foreground text-sm">
          Loading email settings...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email Sender
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Connect your Gmail to send outreach from your own address
            </CardDescription>
          </div>
          {isConnected && (
            <Badge variant="secondary" className="bg-green-500/10 text-green-600 dark:text-green-400 gap-1 text-[10px]">
              <CheckCircle2 className="h-3 w-3" />
              Connected
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isConnected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/5 border border-green-500/20">
              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{settings?.gmail_email}</p>
                <p className="text-[10px] text-muted-foreground">Outreach emails will be sent from this address</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5 text-xs text-destructive hover:text-destructive"
              onClick={() => disconnect.mutate()}
              disabled={disconnect.isPending}
            >
              <Unplug className="h-3.5 w-3.5" />
              {disconnect.isPending ? "Disconnecting..." : "Disconnect Gmail"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="p-3 rounded-lg border border-dashed bg-muted/30 space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">How to get a Gmail App Password:</p>
                  <ol className="list-decimal pl-4 space-y-0.5">
                    <li>Go to <a href="https://myaccount.google.com/security" target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-0.5">Google Account Security <ExternalLink className="h-2.5 w-2.5" /></a></li>
                    <li>Enable 2-Factor Authentication (if not already)</li>
                    <li>Search "App passwords" in the search bar</li>
                    <li>Create a new app password for "Kretopia"</li>
                    <li>Copy the 16-character password</li>
                  </ol>
                </div>
              </div>
            </div>

            <div>
              <Label className="text-xs">Gmail Address</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@gmail.com"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">App Password</Label>
              <div className="relative mt-1">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="xxxx xxxx xxxx xxxx"
                  className="pr-10"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full w-10"
                  onClick={() => setShowPassword(!showPassword)}
                  type="button"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <Button
              className="w-full gap-1.5"
              onClick={handleTestAndConnect}
              disabled={testing || !email || !password}
            >
              {testing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Testing connection...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4" />
                  Test & Connect Gmail
                </>
              )}
            </Button>
            <p className="text-[10px] text-center text-muted-foreground">
              A test email will be sent to your inbox to verify the connection
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
