import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sparkles, Loader2, Users, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  project: any;
  currentUserId: string;
}

interface MatchRow {
  id: string;
  user_a: string;
  user_b: string;
  score: number;
  reasons: any;
  shared_interests: any;
  created_at: string;
}

interface ProfileLite {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
}

export const EventGuestMatchesSection = ({ project, currentUserId }: Props) => {
  const eventId = project?.event_id as string | undefined;
  const isHost = project?.created_by === currentUserId;
  const { toast } = useToast();
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const load = async () => {
    if (!eventId) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from("event_guest_matches")
      .select("id, user_a, user_b, score, reasons, shared_interests, created_at")
      .eq("event_id", eventId)
      .order("score", { ascending: false });
    const rows = (data || []) as MatchRow[];
    setMatches(rows);

    const ids = Array.from(new Set(rows.flatMap(r => [r.user_a, r.user_b])));
    if (ids.length > 0) {
      const { data: ps } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url, role")
        .in("user_id", ids);
      const map: Record<string, ProfileLite> = {};
      (ps || []).forEach((p: any) => { map[p.user_id] = p; });
      setProfiles(map);
    }
    setLoading(false);
  };

  useEffect(() => { load().catch(() => setLoading(false)); }, [eventId]);

  // Realtime: refresh when matches change (e.g. auto-refresh after a guest RSVP)
  useEffect(() => {
    if (!eventId) return;
    const ch = supabase
      .channel(`event-matches:${eventId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_guest_matches", filter: `event_id=eq.${eventId}` }, () => {
        load().catch(() => {});
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [eventId]);

  const generate = async () => {
    if (!eventId) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("match-event-guests", {
        body: { event_id: eventId },
      });
      if (error) throw error;
      if ((data as any)?.note) {
        toast({ title: "Need more guests", description: (data as any).note });
      } else {
        toast({ title: "Smart Matches ready", description: `Generated ${(data as any)?.count ?? 0} suggestions.` });
      }
      await load();
    } catch (err: any) {
      toast({ title: "Couldn't generate matches", description: err?.message || "Try again", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  if (!eventId || !isHost) return null;

  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 p-4 sm:p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Smart Guest Matches</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            AI-suggested intros across your RSVP'd guests — share with attendees to spark conversations.
          </p>
        </div>
        <Button size="sm" onClick={generate} disabled={generating} variant="outline">
          {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
          {matches.length > 0 ? "Refresh" : "Generate"}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
        </div>
      ) : matches.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 p-5 text-center">
          <Users className="h-6 w-6 mx-auto text-muted-foreground/60 mb-2" />
          <p className="text-sm text-muted-foreground">
            No matches yet. Once at least 2 guests have RSVP'd, generate Smart Matches to surface the best intros.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {matches.map(m => {
            const a = profiles[m.user_a]; const b = profiles[m.user_b];
            const reasons: string[] = Array.isArray(m.reasons) ? m.reasons : [];
            const shared: string[] = Array.isArray(m.shared_interests) ? m.shared_interests : [];
            return (
              <div key={m.id} className="rounded-xl border border-border/60 bg-background/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex -space-x-2">
                      <Avatar className="h-8 w-8 border-2 border-background">
                        <AvatarImage src={a?.avatar_url || undefined} />
                        <AvatarFallback>{(a?.full_name || "?").slice(0, 1)}</AvatarFallback>
                      </Avatar>
                      <Avatar className="h-8 w-8 border-2 border-background">
                        <AvatarImage src={b?.avatar_url || undefined} />
                        <AvatarFallback>{(b?.full_name || "?").slice(0, 1)}</AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {a?.full_name || "Guest"} <span className="text-muted-foreground">↔</span> {b?.full_name || "Guest"}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {a?.role || "creator"} · {b?.role || "creator"}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="shrink-0">{m.score}</Badge>
                </div>
                {reasons.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {reasons.slice(0, 3).map((r, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                        <span className="text-primary">•</span><span>{r}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {shared.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {shared.slice(0, 6).map((s, i) => (
                      <Badge key={i} variant="outline" className="text-[10px] py-0 px-1.5">{s}</Badge>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
