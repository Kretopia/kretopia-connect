import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Bell, MessageSquare, Users, Calendar, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface DigestItem {
  circleId: string;
  circleName: string;
  circleEmoji: string;
  newMessages: number;
  newMembers: number;
  upcomingEvents: number;
  lastActivity: string;
}

export const CircleActivityDigest = ({ className }: { className?: string }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [digest, setDigest] = useState<DigestItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchDigest();
  }, [user]);

  const fetchDigest = async () => {
    try {
      // Get user's circles
      const { data: memberships } = await supabase
        .from("spark_room_members")
        .select("room_id")
        .eq("user_id", user!.id);

      if (!memberships?.length) { setLoading(false); return; }

      const roomIds = memberships.map(m => m.room_id);
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const [roomsRes, membersRes, eventsRes] = await Promise.all([
        supabase.from("spark_rooms").select("id, title, icon_emoji").in("id", roomIds),
        supabase.from("spark_room_members").select("room_id, joined_at").in("room_id", roomIds).gte("joined_at", since),
        supabase.from("creative_jams").select("id, circle_id, start_time").in("circle_id", roomIds).gte("start_time", new Date().toISOString()),
      ]);

      const roomMap = new Map(roomsRes.data?.map(r => [r.id, r]) || []);

      // Aggregate per circle
      const circleStats = new Map<string, DigestItem>();
      roomIds.forEach(rid => {
        const room = roomMap.get(rid);
        if (!room) return;
        circleStats.set(rid, {
          circleId: rid,
          circleName: room.title,
          circleEmoji: room.icon_emoji || "",
          newMessages: 0,
          newMembers: 0,
          upcomingEvents: 0,
          lastActivity: new Date().toISOString(),
        });
      });

      // Note: message counting skipped since circle_messages isn't in typed schema
      // Activity is tracked via new members and events instead

      membersRes.data?.forEach(m => {
        if (circleStats.has(m.room_id)) circleStats.get(m.room_id)!.newMembers++;
      });

      eventsRes.data?.forEach((e: any) => {
        if (e.circle_id && circleStats.has(e.circle_id)) circleStats.get(e.circle_id)!.upcomingEvents++;
      });

      // Only show circles with activity
      const active = Array.from(circleStats.values())
        .filter(d => d.newMessages > 0 || d.newMembers > 0 || d.upcomingEvents > 0)
        .sort((a, b) => b.newMessages - a.newMessages);

      setDigest(active);
    } catch (err) {
      console.error("Error fetching digest:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || digest.length === 0) return null;

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center gap-2 mb-2">
        <Bell className="h-3.5 w-3.5 text-primary" />
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Activity Today</p>
        <Badge variant="secondary" className="text-[9px] px-1.5 py-0 ml-auto">{digest.length} active</Badge>
      </div>
      {digest.slice(0, 5).map(item => (
        <button
          key={item.circleId}
          onClick={() => navigate(`/circle/${item.circleId}`)}
          className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-border/50 bg-card hover:bg-accent/5 transition-all text-left group"
        >
          <span className="text-lg shrink-0">{item.circleEmoji}</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate">{item.circleName}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {item.newMessages > 0 && (
                <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                  <MessageSquare className="h-2.5 w-2.5" />{item.newMessages}
                </span>
              )}
              {item.newMembers > 0 && (
                <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                  <Users className="h-2.5 w-2.5" />+{item.newMembers}
                </span>
              )}
              {item.upcomingEvents > 0 && (
                <span className="flex items-center gap-0.5 text-[10px] text-primary">
                  <Calendar className="h-2.5 w-2.5" />{item.upcomingEvents} event{item.upcomingEvents > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
        </button>
      ))}
    </div>
  );
};
