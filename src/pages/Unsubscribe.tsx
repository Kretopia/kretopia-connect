import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Mail, CheckCircle, XCircle, Loader2 } from "lucide-react";

const Unsubscribe = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const token = searchParams.get("token");
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preferences, setPreferences] = useState({
    email_matches: true,
    email_messages: true,
    email_projects: true,
  });

  useEffect(() => {
    if (!token) {
      setError("Invalid unsubscribe link. Please use the link from your email.");
      setLoading(false);
      return;
    }
    fetchPreferences();
  }, [token]);

  const fetchPreferences = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("handle-unsubscribe", {
        body: { token, action: "get" },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Failed to fetch preferences");

      setPreferences({
        email_matches: data.preferences.email_matches ?? true,
        email_messages: data.preferences.email_messages ?? true,
        email_projects: data.preferences.email_projects ?? true,
      });
    } catch (err: any) {
      console.error("Error fetching preferences:", err);
      setError(err.message || "Invalid or expired unsubscribe link");
    } finally {
      setLoading(false);
    }
  };

  const handleUnsubscribeAll = async () => {
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("handle-unsubscribe", {
        body: {
          token,
          action: "update",
          preferences: {
            email_matches: false,
            email_messages: false,
            email_projects: false,
          },
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Failed to update preferences");

      setSuccess(true);
      toast({
        title: "Unsubscribed",
        description: "You have been unsubscribed from all emails",
      });
    } catch (err: any) {
      console.error("Error unsubscribing:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to unsubscribe",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSavePreferences = async () => {
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("handle-unsubscribe", {
        body: { token, action: "update", preferences },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Failed to update preferences");

      setSuccess(true);
      toast({
        title: "Preferences Updated",
        description: "Your email preferences have been saved",
      });
    } catch (err: any) {
      console.error("Error saving preferences:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to save preferences",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">Loading preferences...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <XCircle className="h-12 w-12 text-destructive" />
            <h2 className="mt-4 text-xl font-semibold">Invalid Link</h2>
            <p className="mt-2 text-center text-muted-foreground">{error}</p>
            <Button onClick={() => navigate("/")} className="mt-6">
              Go to Homepage
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle className="h-12 w-12 text-green-500" />
            <h2 className="mt-4 text-xl font-semibold">Preferences Updated</h2>
            <p className="mt-2 text-center text-muted-foreground">
              Your email preferences have been saved successfully.
            </p>
            <Button onClick={() => navigate("/")} className="mt-6">
              Go to Homepage
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Email Preferences</CardTitle>
          <CardDescription>
            Manage what emails you receive from Kretopia
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <Checkbox
                id="email_matches"
                checked={preferences.email_matches}
                onCheckedChange={(checked) =>
                  setPreferences((prev) => ({ ...prev, email_matches: !!checked }))
                }
              />
              <Label htmlFor="email_matches" className="flex flex-col">
                <span>Match Notifications</span>
                <span className="text-sm text-muted-foreground">
                  When you match with someone
                </span>
              </Label>
            </div>

            <div className="flex items-center space-x-3">
              <Checkbox
                id="email_messages"
                checked={preferences.email_messages}
                onCheckedChange={(checked) =>
                  setPreferences((prev) => ({ ...prev, email_messages: !!checked }))
                }
              />
              <Label htmlFor="email_messages" className="flex flex-col">
                <span>Message Notifications</span>
                <span className="text-sm text-muted-foreground">
                  When you receive new messages
                </span>
              </Label>
            </div>

            <div className="flex items-center space-x-3">
              <Checkbox
                id="email_projects"
                checked={preferences.email_projects}
                onCheckedChange={(checked) =>
                  setPreferences((prev) => ({ ...prev, email_projects: !!checked }))
                }
              />
              <Label htmlFor="email_projects" className="flex flex-col">
                <span>Project Updates</span>
                <span className="text-sm text-muted-foreground">
                  Updates on your active projects
                </span>
              </Label>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Button onClick={handleSavePreferences} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Preferences"
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleUnsubscribeAll}
              disabled={saving}
            >
              Unsubscribe from All Emails
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Unsubscribe;
