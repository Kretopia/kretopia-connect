import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

interface Props {
  eventId: string;
  currentUserId: string;
}

interface Row {
  id: string;
  user_a: string;
  user_b: string;
  score: number;
  reasons: any;
  shared_interests: any;
}

export const MyEventMatches = ({ eventId, currentUserId }: Props) => {
  const [matches, setMatches] = useState<Row[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId || !currentUserId) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("event_guest_matches")
        .select("id, user_a, user_b, score, reasons, shared_interests")
        .eq("event_id", eventId)
        .or(`user_a.eq.${currentUserId},user_b.eq.${currentUserId}`)
        .order("score", { ascending: false });
      const rows = (data || []) as Row[];
      setMatches(rows);

      const ids = Array.from(new Set(rows.flatMap(r => [r.user_a, r.user_b]).filter(id => id !== currentUserId)));
      if (ids.length > 0) {
        const { data: ps } = await supabase
          .from("profiles")
          .select("user_id, full_name, avatar_url, role")
          .in("user_id", ids);
        const map: Record<string, any> = {};
        (ps || []).forEach((p: any) => { map[p.user_id] = p; });
        setProfiles(map);
      }
      setLoading(false);
    })().catch(() => setLoading(false));
  }, [eventId, currentUserId]);

  if (loading || matches.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm">People you should meet</h3>
      </div>
      <div className="space-y-2">
        {matches.slice(0, 6).map(m => {
          const otherId = m.user_a === currentUserId ? m.user_b : m.user_a;
          const p = profiles[otherId];
          const reasons: string[] = Array.isArray(m.reasons) ? m.reasons : [];
          return (
            <div key={m.id} className="rounded-xl border border-border/60 bg-background/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={p?.avatar_url || undefined} />
                    <AvatarFallback>{(p?.full_name || "?").slice(0, 1)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{p?.full_name || "Guest"}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{p?.role || "creator"}</p>
                  </div>
                </div>
                <Badge variant="secondary">{m.score}</Badge>
              </div>
              {reasons.length > 0 && (
                <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">{reasons[0]}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
