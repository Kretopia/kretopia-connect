import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Briefcase, Flame, UserPlus, Award } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface ActivityItem {
  id: string;
  type: "credit" | "opportunity" | "join" | "match";
  text: string;
  avatar?: string;
  initials: string;
  timeAgo: string;
}

const TYPE_CONFIG = {
  credit: { icon: Award, label: "New Credit", color: "text-primary" },
  opportunity: { icon: Briefcase, label: "Gig Posted", color: "text-accent-foreground" },
  join: { icon: UserPlus, label: "Joined", color: "text-success" },
  match: { icon: Flame, label: "Matched", color: "text-primary" },
};

export const LiveActivityTicker = () => {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const [creditsRes, oppsRes, profilesRes] = await Promise.all([
          supabase
            .from("credits")
            .select("id, project_name, role, created_at, user_id, profiles!inner(full_name, avatar_url)")
            .order("created_at", { ascending: false })
            .limit(5),
          supabase
            .from("opportunities")
            .select("id, title, type, created_at")
            .eq("status", "active")
            .order("created_at", { ascending: false })
            .limit(3),
          supabase
            .from("profiles")
            .select("user_id, full_name, avatar_url, role, created_at")
            .order("created_at", { ascending: false })
            .limit(3),
        ]);

        const all: ActivityItem[] = [];

        creditsRes.data?.forEach((c: any) => {
          const name = c.profiles?.full_name || "A creator";
          all.push({
            id: `c-${c.id}`,
            type: "credit",
            text: `${name.split(" ")[0]} added "${c.project_name}" as ${c.role}`,
            avatar: c.profiles?.avatar_url,
            initials: name.substring(0, 2).toUpperCase(),
            timeAgo: formatDistanceToNow(new Date(c.created_at), { addSuffix: true }),
          });
        });

        oppsRes.data?.forEach((o) => {
          all.push({
            id: `o-${o.id}`,
            type: "opportunity",
            text: `New ${o.type || "gig"}: ${o.title}`,
            initials: "GIG",
            timeAgo: formatDistanceToNow(new Date(o.created_at), { addSuffix: true }),
          });
        });

        profilesRes.data?.forEach((p) => {
          const name = p.full_name || "Someone";
          all.push({
            id: `p-${p.user_id}`,
            type: "join",
            text: `${name.split(" ")[0]} joined as ${p.role || "Creator"}`,
            avatar: p.avatar_url,
            initials: name.substring(0, 2).toUpperCase(),
            timeAgo: formatDistanceToNow(new Date(p.created_at), { addSuffix: true }),
          });
        });

        all.sort((a, b) => a.timeAgo.localeCompare(b.timeAgo));
        setItems(all.slice(0, 8));
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  if (loading || items.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
        <span className="text-xs font-medium text-muted-foreground">Live on Kretopia</span>
      </div>
      <div className="space-y-1.5">
        {items.slice(0, 4).map((item, i) => {
          const config = TYPE_CONFIG[item.type];
          const Icon = config.icon;
          return (
            <div
              key={item.id}
              className={cn(
                "flex items-center gap-2.5 py-1.5 px-2.5 rounded-lg bg-card/50 border border-border/50",
                "animate-in fade-in slide-in-from-left-2",
              )}
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <Avatar className="h-6 w-6 text-[10px]">
                {item.avatar && <AvatarImage src={item.avatar} />}
                <AvatarFallback className="text-[9px] bg-muted">{item.initials}</AvatarFallback>
              </Avatar>
              <p className="text-xs text-foreground/80 flex-1 truncate">{item.text}</p>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0 gap-0.5 border-border/50">
                <Icon className={cn("h-2.5 w-2.5", config.color)} />
                {item.timeAgo.replace("about ", "").replace(" ago", "")}
              </Badge>
            </div>
          );
        })}
      </div>
    </div>
  );
};
