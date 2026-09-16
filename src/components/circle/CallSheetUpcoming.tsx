import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Users, Mic, Video, Loader2, Check, Plus } from "lucide-react";
import { format as fmt } from "date-fns";
import { SpeedSessionCreateDialog } from "./SpeedSessionCreateDialog";

type Session = {
  id: string;
  title: string;
  theme: string | null;
  mode: "video" | "audio";
  starts_at: string;
  duration_min: number;
  rsvp_count?: number;
  my_rsvp?: boolean;
};

/**
 * Upcoming Speed Sessions — "Call Sheet". Tap a card to open the lobby.
 */
export function CallSheetUpcoming() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const fetchSessions = async () => {
    const { data } = await supabase
      .from("speed_sessions")
      .select("id, title, theme, mode, starts_at, duration_min, status")
      .in("status", ["scheduled", "live"])
      .gte("starts_at", new Date(Date.now() - 30 * 60 * 1000).toISOString())
      .order("starts_at", { ascending: true })
      .limit(5);
    const rows = (data ?? []) as any[];

    // Get RSVP counts + my RSVP
    const ids = rows.map((s) => s.id);
    if (ids.length === 0) { setSessions([]); setLoading(false); return; }

    const { data: rsvps } = await supabase
      .from("speed_session_rsvps")
      .select("session_id, user_id")
      .in("session_id", ids);

    const counts: Record<string, number> = {};
    const mine = new Set<string>();
    (rsvps ?? []).forEach((r: any) => {
      counts[r.session_id] = (counts[r.session_id] ?? 0) + 1;
      if (user?.id && r.user_id === user.id) mine.add(r.session_id);
    });

    setSessions(rows.map((s) => ({
      ...s, rsvp_count: counts[s.id] ?? 0, my_rsvp: mine.has(s.id),
    })));
    setLoading(false);
  };

  useEffect(() => {
    fetchSessions().catch(() => setLoading(false));
  }, [user?.id]);

  const toggleRsvp = async (s: Session) => {
    if (!user) {
      toast({ title: "Sign in to save your spot", variant: "destructive" });
      return;
    }
    setBusy(s.id);
    try {
      const { error } = await supabase.functions.invoke("rsvp-speed-session", {
        body: { session_id: s.id, action: s.my_rsvp ? "cancel" : "rsvp" },
      });
      if (error) throw error;
      toast({ title: s.my_rsvp ? "Removed from your call sheet" : "You're on the call sheet" });
      fetchSessions().catch(() => {});
    } catch (e: any) {
      toast({ title: "Couldn't save your spot", description: e?.message, variant: "destructive" });
    } finally { setBusy(null); }
  };

  if (loading) {
    return (
      <div className="text-xs text-muted-foreground flex items-center gap-2 py-3">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading the call sheet…
      </div>
    );
  }

  const adminCta = isAdmin ? (
    <Button
      size="sm"
      variant="outline"
      className="rounded-full gap-1.5"
      onClick={() => setCreateOpen(true)}
    >
      <Plus className="h-3.5 w-3.5" /> Schedule Speed Session
    </Button>
  ) : null;

  if (sessions.length === 0) {
    return (
      <>
        <Card className="border-dashed">
          <CardContent className="p-5 text-center space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold">No Speed Sessions scheduled</p>
              <p className="text-xs text-muted-foreground">
                We curate themed sessions weekly (Producers × Vocalists, Editors × Directors, etc).
                Check back soon — or open an Open Stage instead.
              </p>
            </div>
            {adminCta}
          </CardContent>
        </Card>
        <SpeedSessionCreateDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={(id) => navigate(`/circle/speed/${id}`)}
        />
      </>
    );
  }

  return (
    <div className="space-y-2">
      {adminCta && <div className="flex justify-end">{adminCta}</div>}
      {sessions.map((s) => {
        const ModeIcon = s.mode === "audio" ? Mic : Video;
        const date = new Date(s.starts_at);
        return (
          <Card key={s.id} className="overflow-hidden">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex flex-col items-center justify-center shrink-0">
                <span className="text-[10px] font-bold uppercase">{fmt(date, "MMM")}</span>
                <span className="text-base font-black leading-none">{fmt(date, "d")}</span>
              </div>
              <div className="flex-1 min-w-0">
                <Link to={`/circle/speed/${s.id}`} className="block">
                  <p className="font-bold text-sm leading-tight truncate">{s.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2">
                    <span>{fmt(date, "EEE p")}</span>
                    <span className="inline-flex items-center gap-0.5"><ModeIcon className="h-3 w-3" />{s.mode}</span>
                    <span className="inline-flex items-center gap-0.5"><Users className="h-3 w-3" />{s.rsvp_count}</span>
                  </p>
                  {s.theme && <p className="text-[11px] text-muted-foreground truncate mt-0.5">{s.theme}</p>}
                </Link>
              </div>
              <Button
                size="sm"
                variant={s.my_rsvp ? "secondary" : "default"}
                className="shrink-0 rounded-full"
                onClick={() => toggleRsvp(s)}
                disabled={busy === s.id}
              >
                {busy === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> :
                  s.my_rsvp ? <><Check className="h-3.5 w-3.5" /> Saved</> : "Save spot"}
              </Button>
            </CardContent>
          </Card>
        );
      })}
      <SpeedSessionCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => navigate(`/circle/speed/${id}`)}
      />
    </div>
  );
}
