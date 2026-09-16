import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { Users } from "lucide-react";

interface ProjectPresenceProps {
  projectId: string;
}

interface PresenceUser {
  user_id: string;
  full_name: string;
  avatar_url?: string;
  online_at: string;
}

export function ProjectPresence({ projectId }: ProjectPresenceProps) {
  const [activeUsers, setActiveUsers] = useState<PresenceUser[]>([]);

  useEffect(() => {
    const channel = supabase.channel(`project-presence-${projectId}`);

    // Subscribe to presence
    channel
      .on('presence', { event: 'sync' }, () => {
        const presenceState = channel.presenceState();
        const users: PresenceUser[] = [];
        
        Object.values(presenceState).forEach((presences: any) => {
          presences.forEach((presence: any) => {
            users.push(presence);
          });
        });
        
        setActiveUsers(users);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, avatar_url')
            .eq('user_id', user.id)
            .single();

          if (profile) {
            await channel.track({
              user_id: user.id,
              full_name: profile.full_name,
              avatar_url: profile.avatar_url,
              online_at: new Date().toISOString(),
            });
          }
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  if (activeUsers.length === 0) return null;

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        <div className="flex -space-x-2">
          {activeUsers.slice(0, 3).map((user) => (
            <Tooltip key={user.user_id}>
              <TooltipTrigger asChild>
                <Avatar className="h-8 w-8 border-2 border-background ring-2 ring-primary/20">
                  <AvatarImage src={user.avatar_url} />
                  <AvatarFallback className="text-xs bg-gradient-to-br from-primary to-secondary text-primary-foreground">
                    {user.full_name[0]}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-sm font-medium">{user.full_name}</p>
                <p className="text-xs text-muted-foreground">Active now</p>
              </TooltipContent>
            </Tooltip>
          ))}
          {activeUsers.length > 3 && (
            <Badge variant="secondary" className="h-8 w-8 rounded-full flex items-center justify-center text-xs">
              +{activeUsers.length - 3}
            </Badge>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
