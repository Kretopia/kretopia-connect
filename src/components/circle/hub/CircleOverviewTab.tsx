import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, FolderKanban, Sparkles, ArrowRight, MapPin, Plus, Megaphone, Users } from "lucide-react";
import { CircleMessageBubble, type CircleMessage } from "@/components/circle/CircleMessageBubble";

interface OverviewProps {
  circle: any;
  members: any[];
  events: any[];
  isMember: boolean;
  onSwitchTab: (tab: string) => void;
  onCreateEvent: () => void;
}

export function CircleOverviewTab({ circle, members, events, isMember, onSwitchTab, onCreateEvent }: OverviewProps) {
  const navigate = useNavigate();
  const [recentMessages, setRecentMessages] = useState<CircleMessage[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!circle?.id) return;
    const load = async () => {
      const [msgRes, projRes] = await Promise.all([
        supabase.from("spark_room_messages")
          .select("*")
          .eq("room_id", circle.id)
          .neq("message_type", "system")
          .order("created_at", { ascending: false })
          .limit(5)
          .then(r => r, () => ({ data: [] as any[] })),
        supabase.from("projects")
          .select("id, title, status, budget")
          .eq("spark_room_id", circle.id)
          .order("created_at", { ascending: false })
          .limit(3)
          .then(r => r, () => ({ data: [] as any[] })),
      ]);

      if (msgRes.data?.length) {
        const userIds = [...new Set(msgRes.data.map(m => m.user_id))];
        const { data: profiles } = await supabase.from("profiles")
          .select("user_id, full_name, avatar_url")
          .in("user_id", userIds);
        const pMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
        setRecentMessages(msgRes.data.map((m: any) => ({
          ...m,
          message_type: m.message_type || "text",
          reply_to_id: m.reply_to_id || null,
          poll_data: m.poll_data || null,
          media_type: m.media_type || null,
          is_pinned: m.is_pinned || false,
          sender_name: pMap.get(m.user_id)?.full_name || "Unknown",
          sender_avatar: pMap.get(m.user_id)?.avatar_url,
          sender_role: "member",
          reactions: {},
          reply_preview: null,
        })).reverse());
      }
      setProjects(projRes.data || []);
      setLoading(false);
    };
    load().catch(err => { console.error("Overview load failed:", err); setLoading(false); });
  }, [circle?.id]);

  const upcoming = events
    .filter(e => new Date(e.start_time) > new Date())
    .slice(0, 3);

  const featuredMembers = members.slice(0, 6);

  return (
    <div className="space-y-6 pb-8">
      {/* Welcome / About snippet */}
      {circle.description && (
        <section className="px-4">
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
            {circle.description}
          </p>
        </section>
      )}

      {/* ── Activity Feed ── */}
      <section className="px-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-primary" /> Recent Activity
          </h2>
          <button onClick={() => onSwitchTab("chat")} className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
            Open chat <ArrowRight className="h-3 w-3" />
          </button>
        </div>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="h-12 rounded-lg bg-muted/50 animate-pulse" />)}
          </div>
        ) : recentMessages.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/50 p-6 text-center bg-card/30">
            <p className="text-sm text-muted-foreground mb-3">No conversations yet — be the first to say hi.</p>
            {isMember && (
              <Button size="sm" variant="gradient" onClick={() => onSwitchTab("chat")}>
                Start the conversation
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-1 rounded-xl border border-border/50 bg-card/30 p-2">
            {recentMessages.map(msg => (
              <CircleMessageBubble
                key={msg.id} msg={msg} isOwn={false}
                onReply={() => {}} onReact={() => {}} onToggleReaction={() => {}}
                showReactions={null} isAdmin={false}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Upcoming Events ── */}
      <section className="px-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" /> Upcoming Events
          </h2>
          <button onClick={() => onSwitchTab("events")} className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
            View all <ArrowRight className="h-3 w-3" />
          </button>
        </div>
        {upcoming.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/50 p-6 text-center bg-card/30">
            <Calendar className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground mb-3">No events yet.</p>
            {isMember && (
              <Button size="sm" variant="gradient" onClick={onCreateEvent}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Host your first event
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {upcoming.map(ev => (
              <button
                key={ev.id}
                onClick={() => navigate(`/event/${ev.id}`)}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-card hover:border-primary/30 hover:shadow-sm transition-all text-left"
              >
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex flex-col items-center justify-center shrink-0">
                  <span className="text-[9px] font-bold text-primary uppercase">
                    {new Date(ev.start_time).toLocaleDateString(undefined, { month: "short" })}
                  </span>
                  <span className="text-base font-black text-primary leading-none">
                    {new Date(ev.start_time).getDate()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{ev.title}</p>
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                    {ev.venue_name && (
                      <><MapPin className="h-3 w-3" /><span className="truncate">{ev.venue_name}</span></>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ── Active Projects ── */}
      <section className="px-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <FolderKanban className="h-4 w-4 text-primary" /> Active Collaborations
          </h2>
          <button onClick={() => onSwitchTab("projects")} className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
            View all <ArrowRight className="h-3 w-3" />
          </button>
        </div>
        {projects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/50 p-6 text-center bg-card/30">
            <FolderKanban className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground mb-3">No active projects.</p>
            {isMember && (
              <Button size="sm" variant="gradient" onClick={() => navigate("/projects/new")}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Start a project
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {projects.map(p => (
              <button
                key={p.id}
                onClick={() => navigate(`/project/${p.id}`)}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-card hover:border-primary/30 transition-all text-left"
              >
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                  <FolderKanban className="h-5 w-5 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{p.title}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Badge variant="secondary" className="text-[9px] h-4 px-1.5 capitalize">{p.status || "active"}</Badge>
                    {p.budget && <span className="text-[10px] text-muted-foreground">{p.budget}</span>}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ── Featured Members ── */}
      <section className="px-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Featured Members
          </h2>
          <button onClick={() => onSwitchTab("members")} className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
            See all <ArrowRight className="h-3 w-3" />
          </button>
        </div>
        {featuredMembers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/50 p-6 text-center bg-card/30">
            <Users className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No members yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {featuredMembers.map(m => (
              <button
                key={m.user_id}
                onClick={() => navigate(`/profile/${m.user_id}`)}
                className="flex flex-col items-center p-3 rounded-xl border border-border/50 bg-card hover:border-primary/30 transition-all"
              >
                <Avatar className="h-12 w-12 mb-2 border border-primary/20">
                  <AvatarImage src={m.avatar_url || ""} />
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
                    {(m.full_name || "?")[0]}
                  </AvatarFallback>
                </Avatar>
                <p className="text-[11px] font-semibold text-center truncate w-full">{m.full_name}</p>
                {m.role && m.role !== "member" && (
                  <Badge variant="secondary" className="text-[9px] h-4 px-1.5 mt-1 capitalize">{m.role}</Badge>
                )}
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
