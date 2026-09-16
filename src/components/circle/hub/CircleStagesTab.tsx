import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Mic, Video, Radio, Users, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Props {
  circleId: string;
  isMember: boolean;
}

type Stage = {
  id: string;
  host_user_id: string;
  title: string;
  vibe_tag: string | null;
  mode: "video" | "audio";
  format: string | null;
  participant_count: number;
  is_live: boolean;
  started_at: string;
  ended_at: string | null;
};

type HostProfile = { full_name: string | null; avatar_url: string | null };

export function CircleStagesTab({ circleId, isMember }: Props) {
  const navigate = useNavigate();
  const [stages, setStages] = useState<Stage[]>([]);
  const [hosts, setHosts] = useState<Record<string, HostProfile>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStages = async () => {
      const { data } = await supabase
        .from("sound_stages")
        .select("id, host_user_id, title, vibe_tag, mode, format, participant_count, is_live, started_at, ended_at")
        .eq("circle_id", circleId)
        .order("started_at", { ascending: false })
        .limit(30);
      const rows = (data ?? []) as Stage[];
      setStages(rows);
      const hostIds = [...new Set(rows.map(r => r.host_user_id))];
      if (hostIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, full_name, avatar_url")
          .in("user_id", hostIds);
        const map: Record<string, HostProfile> = {};
        (profs ?? []).forEach((p: any) => { map[p.user_id] = { full_name: p.full_name, avatar_url: p.avatar_url }; });
        setHosts(map);
      }
      setLoading(false);
    };
    fetchStages().catch(() => setLoading(false));

    const channel = supabase
      .channel(`crew-stages-${circleId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "sound_stages", filter: `circle_id=eq.${circleId}` }, () => {
        fetchStages().catch(() => null);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [circleId]);

  const live = stages.filter(s => s.is_live);
  const past = stages.filter(s => !s.is_live).slice(0, 12);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  if (stages.length === 0) {
    return (
      <div className="px-4">
        <EmptyState
          icon={Radio}
          title="No stages yet"
          description={isMember ? "Spin up a Sound Stage and your Crew gets pinged the moment you go live." : "Join this Crew to host or hop on stages."}
          action={isMember ? { label: "Start a Stage", icon: Radio, onClick: () => navigate("/discover?tab=live") } : undefined}
        />
      </div>
    );
  }

  return (
    <div className="px-4 space-y-6">
      {live.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-match opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-match" />
              </span>
              On air now <span className="text-muted-foreground font-normal">({live.length})</span>
            </h3>
          </div>
          <div className="space-y-2">
            {live.map(s => (
              <button
                key={s.id}
                onClick={() => navigate("/discover?tab=live")}
                className="w-full text-left rounded-xl border-2 border-match/40 bg-card p-3 hover:border-match transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-match/10 flex items-center justify-center shrink-0">
                    {s.mode === "video" ? <Video className="h-5 w-5 text-match" /> : <Mic className="h-5 w-5 text-match" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm truncate">{s.title}</p>
                      <Badge className="bg-match text-white text-[9px] px-1.5 py-0">LIVE</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {hosts[s.host_user_id]?.full_name || "Host"}
                      {s.vibe_tag && <> · {s.vibe_tag}</>}
                    </p>
                    <div className="flex items-center gap-1 mt-1 text-[11px] text-muted-foreground">
                      <Users className="h-3 w-3" /> {s.participant_count}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider text-xs">Recent stages</h3>
          <div className="space-y-2">
            {past.map(s => (
              <div key={s.id} className="rounded-xl border bg-card/50 p-3">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    {s.mode === "video" ? <Video className="h-4 w-4 text-muted-foreground" /> : <Mic className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{s.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {hosts[s.host_user_id]?.full_name || "Host"} · {formatDistanceToNow(new Date(s.started_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {isMember && (
        <Button variant="outline" className="w-full" onClick={() => navigate("/discover?tab=live")}>
          <Radio className="h-4 w-4 mr-2" /> Start a new Stage
        </Button>
      )}
    </div>
  );
}
