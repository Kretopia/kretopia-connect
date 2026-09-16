import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Users, Circle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CollaboratorPresence {
  user_id: string;
  full_name: string;
  avatar_url?: string;
  online_at: string;
  current_section?: string;
}

interface CollaborativeWorkspaceProps {
  projectId: string;
}

export const CollaborativeWorkspace = ({ projectId }: CollaborativeWorkspaceProps) => {
  const [onlineUsers, setOnlineUsers] = useState<CollaboratorPresence[]>([]);
  const [currentSection, setCurrentSection] = useState<string>("overview");
  const { toast } = useToast();

  useEffect(() => {
    const channel = supabase.channel(`project:${projectId}`);

    // Subscribe to presence
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const users: CollaboratorPresence[] = [];
        
        Object.keys(state).forEach((key) => {
          const presences = state[key] as any[];
          users.push(...(presences as CollaboratorPresence[]));
        });
        
        setOnlineUsers(users);
      })
      .on("presence", { event: "join" }, ({ key, newPresences }) => {
        const presence = (newPresences as any[])[0] as CollaboratorPresence;
        toast({
          title: "User Joined",
          description: `${presence.full_name} is now online`,
        });
      })
      .on("presence", { event: "leave" }, ({ key, leftPresences }) => {
        const presence = (leftPresences as any[])[0] as CollaboratorPresence;
        toast({
          title: "User Left",
          description: `${presence.full_name} went offline`,
        });
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, avatar_url")
            .eq("user_id", user.id)
            .single();

          await channel.track({
            user_id: user.id,
            full_name: profile?.full_name || "Unknown User",
            avatar_url: profile?.avatar_url,
            online_at: new Date().toISOString(),
            current_section: currentSection,
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, currentSection]);

  // Update current section when user navigates
  const updateCurrentSection = async (section: string) => {
    setCurrentSection(section);
    const channel = supabase.channel(`project:${projectId}`);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("user_id", user.id)
      .single();

    await channel.track({
      user_id: user.id,
      full_name: profile?.full_name || "Unknown User",
      avatar_url: profile?.avatar_url,
      online_at: new Date().toISOString(),
      current_section: section,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Active Collaborators
        </CardTitle>
      </CardHeader>
      <CardContent>
        {onlineUsers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No one else is online</p>
        ) : (
          <div className="space-y-3">
            {onlineUsers.map((user) => (
              <div key={user.user_id} className="flex items-center gap-3">
                <div className="relative">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.avatar_url} />
                    <AvatarFallback>
                      {user.full_name?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <Circle className="absolute -bottom-1 -right-1 h-3 w-3 fill-green-500 text-green-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user.full_name}</p>
                  {user.current_section && (
                    <p className="text-xs text-muted-foreground">
                      Viewing: {user.current_section}
                    </p>
                  )}
                </div>
                <Badge variant="outline" className="text-xs">
                  Online
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
