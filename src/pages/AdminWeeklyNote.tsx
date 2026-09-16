import { useState, useEffect } from "react";
import { CreativeLoader } from "@/components/ui/creative-loader";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Calendar, Send, ArrowLeft } from "lucide-react";

// Returns the date (YYYY-MM-DD) of the upcoming Monday in UTC.
// If today IS Monday, returns today.
function getUpcomingMondayISO(): string {
  const now = new Date();
  const day = now.getUTCDay(); // 0 = Sun, 1 = Mon
  const daysUntilMonday = day === 1 ? 0 : (1 - day + 7) % 7 || 7;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilMonday));
  return monday.toISOString().slice(0, 10);
}

export default function AdminWeeklyNote() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingPreview, setSendingPreview] = useState(false);

  const [weekDate, setWeekDate] = useState(getUpcomingMondayISO());
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [existingId, setExistingId] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      if (!user) {
        navigate("/auth");
        return;
      }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!data) {
        toast({ title: "Access denied", description: "Admin only", variant: "destructive" });
        navigate("/");
        return;
      }
      setIsAdmin(true);
      setLoading(false);
    };
    init();
  }, [user, navigate, toast]);

  useEffect(() => {
    if (!isAdmin) return;
    const loadExisting = async () => {
      const { data } = await supabase
        .from("weekly_founder_notes")
        .select("id, title, body")
        .eq("week_start_date", weekDate)
        .maybeSingle();
      if (data) {
        setExistingId(data.id);
        setTitle(data.title || "");
        setBody(data.body || "");
      } else {
        setExistingId(null);
        setTitle("");
        setBody("");
      }
    };
    loadExisting();
  }, [weekDate, isAdmin]);

  const save = async () => {
    if (!body.trim()) {
      toast({ title: "Body is required", variant: "destructive" });
      return;
    }
    if (!user) return;
    setSaving(true);
    try {
      if (existingId) {
        const { error } = await supabase
          .from("weekly_founder_notes")
          .update({ title: title.trim() || null, body: body.trim(), is_published: true })
          .eq("id", existingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("weekly_founder_notes")
          .insert({
            week_start_date: weekDate,
            title: title.trim() || null,
            body: body.trim(),
            author_user_id: user.id,
            is_published: true,
          })
          .select("id")
          .single();
        if (error) throw error;
        if (data) setExistingId(data.id);
      }
      toast({ title: "Saved!", description: `Note locked in for week of ${weekDate}` });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const sendPreview = async () => {
    if (!user?.email) return;
    setSendingPreview(true);
    try {
      const { error } = await supabase.functions.invoke("send-weekly-digest", {
        body: { preview: true, recipient_email: user.email },
      });
      if (error) throw error;
      toast({ title: "Preview sent", description: `Check ${user.email}` });
    } catch (err: any) {
      toast({ title: "Preview failed", description: err.message, variant: "destructive" });
    } finally {
      setSendingPreview(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6"><CreativeLoader size="page" /></div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin")} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Admin
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Weekly Founder Note
            </CardTitle>
            <CardDescription>
              Write your personal message for the Monday digest. Save by Sunday 11 PM UTC — it will auto-include in Monday's 9 AM email.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="week">For week starting (Monday)</Label>
              <Input
                id="week"
                type="date"
                value={weekDate}
                onChange={(e) => setWeekDate(e.target.value)}
                className="mt-1.5"
              />
              {existingId && (
                <p className="text-xs text-muted-foreground mt-1">Editing existing note for this week.</p>
              )}
            </div>

            <div>
              <Label htmlFor="title">Title (optional)</Label>
              <Input
                id="title"
                placeholder="e.g. This week we're shipping…"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="body">Your message</Label>
              <Textarea
                id="body"
                placeholder="Hey Thrivers,&#10;&#10;Here's what's on my mind this week…"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={12}
                className="mt-1.5 font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {body.length} chars · Plain text · Line breaks become paragraphs.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <Button onClick={save} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {existingId ? "Update note" : "Save note"}
              </Button>
              <Button variant="outline" onClick={sendPreview} disabled={sendingPreview}>
                {sendingPreview ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                Email me a preview
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
