import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Plus, MessageCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export interface GroupRoom {
  id: string;
  title: string;
  icon_emoji: string | null;
  member_count: number;
  message_count: number;
  updated_at: string;
  created_by: string;
  circle_type: string | null;
  invite_code?: string | null;
}

interface GroupsListProps {
  currentUserId: string;
  selectedGroupId: string | null;
  onSelect: (group: GroupRoom) => void;
  onCreate: () => void;
  refreshKey?: number;
}

export const GroupsList = ({ currentUserId, selectedGroupId, onSelect, onCreate, refreshKey = 0 }: GroupsListProps) => {
  const [groups, setGroups] = useState<GroupRoom[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUserId) return;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("get_my_group_rooms");
      if (error) {
        console.error("[GroupsList] failed to load groups", error);
        setGroups([]);
      } else {
        setGroups((data as GroupRoom[]) || []);
      }
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel(`groups-list-${currentUserId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "spark_room_members", filter: `user_id=eq.${currentUserId}` }, load)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "spark_room_messages" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, refreshKey]);

  return (
    <div>
      <div className="p-3 sm:p-4 border-b border-border">
        <Button onClick={onCreate} variant="lime" size="sm" className="w-full gap-2">
          <Plus className="h-4 w-4" /> New Group Chat
        </Button>
      </div>
      {loading ? (
        <div className="p-6 text-center text-sm text-muted-foreground">Loading groups…</div>
      ) : groups.length === 0 ? (
        <div className="p-8 text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 border-2 border-primary/30 flex items-center justify-center mb-4">
            <Users className="h-8 w-8 text-primary" />
          </div>
          <p className="brand-eyebrow mb-2">No groups yet</p>
          <p className="text-base font-bold mb-2">Start a group chat</p>
          <p className="text-xs text-muted-foreground max-w-[240px] mx-auto">
            Bring a few creators together before turning the conversation into a project.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {groups.map((g) => (
            <button
              key={g.id}
              onClick={() => onSelect(g)}
              className={`w-full text-left flex items-start gap-3 p-3 sm:p-4 hover:bg-accent/50 transition-colors ${
                selectedGroupId === g.id ? "bg-accent" : ""
              }`}
            >
              <Avatar className="h-11 w-11 sm:h-14 sm:w-14 border-2 border-background">
                <AvatarFallback className="text-lg bg-primary/15 text-primary">
                  {g.icon_emoji || g.title.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5 gap-2">
                  <p className="font-semibold text-sm sm:text-base truncate">{g.title}</p>
                  <span className="text-[10px] sm:text-xs text-muted-foreground flex-shrink-0">
                    {formatDistanceToNow(new Date(g.updated_at), { addSuffix: true }).replace("about ", "")}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3 w-3" /> {g.member_count}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle className="h-3 w-3" /> {g.message_count}
                  </span>
                  {g.circle_type === "event" && (
                    <Badge variant="secondary" className="h-4 text-[10px] px-1.5">From event</Badge>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
