import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, MapPin, ChevronRight, Film } from "lucide-react";
import { NetworkVisualization } from "./NetworkVisualization";
import { InviteDialog } from "@/components/InviteDialog";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface Connection {
  user_id: string;
  full_name: string;
  role: string;
  bio: string | null;
  avatar_url: string | null;
  location: string | null;
  badge: string;
  level: number;
}

interface ConnectionListProps {
  connections: Connection[];
  loading: boolean;
  onMessage: (userId: string) => void;
}

interface RecentCredit {
  project_name: string;
  role: string;
}

const getBadgeColor = (badge: string) => {
  switch (badge) {
    case 'og': return 'bg-primary';
    case 'beta': return 'bg-primary';
    case 'vip': return 'bg-yellow-500';
    default: return 'bg-gray-500';
  }
};

export const ConnectionList = ({ connections, loading, onMessage }: ConnectionListProps) => {
  const [showInvite, setShowInvite] = useState(false);
  const [recentCredits, setRecentCredits] = useState<Record<string, RecentCredit>>({});
  const navigate = useNavigate();

  // Fetch most recent credit for each connection
  useEffect(() => {
    if (connections.length === 0) return;
    const userIds = connections.map(c => c.user_id);
    
    supabase
      .from("credits")
      .select("user_id, project_name, role")
      .in("user_id", userIds)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, RecentCredit> = {};
        for (const credit of data) {
          if (!map[credit.user_id]) {
            map[credit.user_id] = { project_name: credit.project_name, role: credit.role };
          }
        }
        setRecentCredits(map);
      });
  }, [connections]);

  const handleViewProfile = (userId: string) => {
    navigate(`/profile/${userId}`);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="p-4 animate-pulse">
            <div className="flex items-start gap-4">
              <div className="h-16 w-16 rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 bg-muted rounded" />
                <div className="h-3 w-48 bg-muted rounded" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (connections.length === 0) {
    return (
      <>
        <NetworkVisualization onInvite={() => setShowInvite(true)} />
        <InviteDialog open={showInvite} onOpenChange={setShowInvite} />
      </>
    );
  }

  return (
    <div className="space-y-3">
      {connections.map((connection) => {
        const credit = recentCredits[connection.user_id];
        return (
          <Card 
            key={connection.user_id} 
            className="p-4 hover:shadow-lg transition-all hover:border-primary/30 cursor-pointer group"
            onClick={() => handleViewProfile(connection.user_id)}
          >
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14 border-2 border-primary/50 group-hover:border-primary transition-colors">
                <AvatarImage src={connection.avatar_url || undefined} />
                <AvatarFallback>
                  {connection.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || '??'}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="font-semibold truncate group-hover:text-primary transition-colors">
                    {connection.full_name}
                  </h3>
                  {connection.badge && (
                    <Badge className={`${getBadgeColor(connection.badge)} text-white text-xs px-1.5 py-0`}>
                      {connection.badge.toUpperCase()}
                    </Badge>
                  )}
                </div>
                
                <p className="text-sm text-muted-foreground truncate">{connection.role}</p>
                
                {/* Recent Kretopia Credits Credit */}
                {credit && (
                  <div className="flex items-center gap-1.5 text-xs text-primary/70 mt-1">
                    <Film className="h-3 w-3 shrink-0" />
                    <span className="truncate">
                      {credit.role} on <span className="font-medium">{credit.project_name}</span>
                    </span>
                  </div>
                )}

                {!credit && connection.location && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                    <MapPin className="h-3 w-3" />
                    <span className="truncate">{connection.location}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onMessage(connection.user_id);
                  }} 
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                >
                  <MessageCircle className="h-4 w-4" />
                  <span className="hidden sm:inline">Message</span>
                </Button>
                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
};