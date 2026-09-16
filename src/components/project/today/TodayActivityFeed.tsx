import { useMemo } from "react";
import { MessageSquare, FileUp, CheckCircle2, Flag, ArrowRight, Sparkles } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface ActivityItem {
  id: string;
  type: "message" | "file" | "task" | "milestone";
  actor_id: string | null;
  actor_name: string;
  actor_avatar: string | null;
  title: string;
  detail?: string;
  at: string;
}

interface TodayActivityFeedProps {
  messages: any[];
  files: any[];
  tasks: any[];
  milestones: any[];
  collaborators: { id: string; full_name: string; avatar_url: string | null }[];
  currentUserId: string;
  onOpenChat: () => void;
}

export const TodayActivityFeed = ({
  messages,
  files,
  tasks,
  milestones,
  collaborators,
  currentUserId,
  onOpenChat,
}: TodayActivityFeedProps) => {
  const collabMap = useMemo(() => new Map(collaborators.map(c => [c.id, c])), [collaborators]);

  const items: ActivityItem[] = useMemo(() => {
    const out: ActivityItem[] = [];

    messages.slice(-15).forEach((m: any) => {
      out.push({
        id: `m-${m.id}`,
        type: "message",
        actor_id: m.user_id,
        actor_name: m.profiles?.full_name || "Someone",
        actor_avatar: m.profiles?.avatar_url || null,
        title: m.message,
        at: m.created_at,
      });
    });

    files.slice(0, 10).forEach((f: any) => {
      const c = collabMap.get(f.uploaded_by);
      out.push({
        id: `f-${f.id}`,
        type: "file",
        actor_id: f.uploaded_by,
        actor_name: c?.full_name || "Someone",
        actor_avatar: c?.avatar_url || null,
        title: `Uploaded ${f.file_name}`,
        at: f.created_at,
      });
    });

    tasks.slice(0, 10).forEach((t: any) => {
      if (t.status !== "done") return;
      const c = t.assigned_to ? collabMap.get(t.assigned_to) : null;
      out.push({
        id: `t-${t.id}`,
        type: "task",
        actor_id: t.assigned_to,
        actor_name: c?.full_name || "Someone",
        actor_avatar: c?.avatar_url || null,
        title: `Completed: ${t.title}`,
        at: t.updated_at || t.created_at,
      });
    });

    milestones.slice(0, 5).forEach((ms: any) => {
      out.push({
        id: `ms-${ms.id}`,
        type: "milestone",
        actor_id: null,
        actor_name: "Milestone",
        actor_avatar: null,
        title: ms.title,
        detail: ms.status,
        at: ms.updated_at || ms.created_at,
      });
    });

    return out.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 25);
  }, [messages, files, tasks, milestones, collabMap]);

  const iconFor = (type: ActivityItem["type"]) => {
    switch (type) {
      case "message": return MessageSquare;
      case "file": return FileUp;
      case "task": return CheckCircle2;
      case "milestone": return Flag;
    }
  };

  const colorFor = (type: ActivityItem["type"]) => {
    switch (type) {
      case "message": return "text-primary bg-primary/10";
      case "file": return "text-primary bg-primary/10";
      case "task": return "text-emerald-500 bg-emerald-500/10";
      case "milestone": return "text-amber-500 bg-amber-500/10";
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold leading-tight">Activity</h3>
            <p className="text-[10px] text-muted-foreground leading-tight">Latest across the desk</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onOpenChat}>
          Open chat <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 px-2 py-2">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <Sparkles className="h-10 w-10 mb-2 opacity-30" />
            <p className="text-sm font-medium">Quiet desk</p>
            <p className="text-xs mt-1">Activity will appear here.</p>
          </div>
        ) : (
          <ul className="space-y-0.5">
            {items.map((it) => {
              const Icon = iconFor(it.type);
              const isMe = it.actor_id === currentUserId;
              return (
                <li key={it.id} className="flex items-start gap-2.5 px-2 py-2 rounded-lg hover:bg-accent/40 transition-colors">
                  <div className="relative shrink-0">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={it.actor_avatar || undefined} />
                      <AvatarFallback className="text-[9px]">{it.actor_name?.[0]?.toUpperCase() || "?"}</AvatarFallback>
                    </Avatar>
                    <div className={cn("absolute -bottom-1 -right-1 h-4 w-4 rounded-full flex items-center justify-center ring-2 ring-background", colorFor(it.type))}>
                      <Icon className="h-2.5 w-2.5" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs leading-snug">
                      <span className="font-semibold">{isMe ? "You" : it.actor_name}</span>
                      {it.type === "message" && <span className="text-muted-foreground"> · sent</span>}
                    </p>
                    <p className="text-xs text-muted-foreground leading-snug line-clamp-2 mt-0.5">{it.title}</p>
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                      {formatDistanceToNow(new Date(it.at), { addSuffix: true })}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};
