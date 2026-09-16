import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, TrendingUp, Crown, Medal, Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link, useNavigate } from "react-router-dom";

interface LeaderboardUser {
  id: string;
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  xp: number;
  level: number;
}

export function LeaderboardWidget() {
  const navigate = useNavigate();
  const [topUsers, setTopUsers] = useState<LeaderboardUser[]>([]);
  const [currentUserRank, setCurrentUserRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTopUsers();
  }, []);

  const fetchTopUsers = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const OWNER_EMAIL = 'thriveuae@gmail.com';
      let ownerUserId: string | null = null;
      
      if (user?.email === OWNER_EMAIL) {
        ownerUserId = user.id;
      }
      
      const { data: users, error } = await supabase
        .from("profiles")
        .select("id, user_id, full_name, avatar_url, xp, level")
        .order("xp", { ascending: false })
        .limit(10);

      if (error) throw error;

      const filteredUsers = (users || [])
        .filter(u => !ownerUserId || u.user_id !== ownerUserId)
        .slice(0, 5);
      setTopUsers(filteredUsers as LeaderboardUser[]);

      if (user && user.email !== OWNER_EMAIL) {
        const { data: allUsers } = await supabase
          .from("profiles")
          .select("user_id, xp")
          .order("xp", { ascending: false });

        if (allUsers) {
          const filtered = ownerUserId 
            ? allUsers.filter(u => u.user_id !== ownerUserId)
            : allUsers;
          const rank = filtered.findIndex(u => u.user_id === user.id) + 1;
          setCurrentUserRank(rank > 0 ? rank : null);
        }
      }
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Crown className="h-5 w-5 text-yellow-500" />;
      case 2: return <Medal className="h-5 w-5 text-gray-400" />;
      case 3: return <Award className="h-5 w-5 text-amber-600" />;
      default: return null;
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-muted rounded w-1/2"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-bold">Top Creators</h3>
        </div>
        {currentUserRank && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            <span>You're #{currentUserRank}</span>
          </div>
        )}
      </div>

      <div className="space-y-3 mb-4">
        {topUsers.slice(0, 3).map((user, index) => (
          <div
            key={user.id}
            onClick={() => navigate(`/profile/${user.user_id}`)}
            className="flex items-center gap-3 p-3 rounded-lg bg-background/50 backdrop-blur-sm border border-border/50 hover:border-primary/50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="flex-shrink-0">
                {getRankIcon(index + 1)}
              </div>
              <Avatar className="h-8 w-8 flex-shrink-0">
                {user.avatar_url ? (
                  <AvatarImage src={user.avatar_url} alt={user.full_name} />
                ) : null}
                <AvatarFallback className="text-xs">
                  {user.full_name?.charAt(0) || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.full_name}</p>
                <p className="text-xs text-muted-foreground">
                  {user.xp || 0} reputation
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Link to="/leaderboard">
        <Button variant="outline" className="w-full" size="sm">
          View Full Leaderboard
        </Button>
      </Link>
    </Card>
  );
}
