import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { getRemainingSwipes } from "@/lib/subscriptionLimits";
import { PROFILE_SELECT } from "@/lib/profile/profileColumns";
import { 
  Zap, 
  Users, 
  Briefcase, 
  Award,
  TrendingUp,
  MessageCircle 
} from "lucide-react";

interface NudgeData {
  type: "daily_login" | "complete_profile" | "new_match" | "trending_opportunity" | "message_waiting";
  title: string;
  description: string;
  action: string;
  route: string;
  icon: any;
}

export const EngagementNudge = () => {
  const [nudge, setNudge] = useState<NudgeData | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    analyzeUserBehavior();
  }, []);

  const analyzeUserBehavior = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select(PROFILE_SELECT)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!profile) return;

      // Check profile completion
      const professionalSkills = Array.isArray(profile.professional_skills) 
        ? profile.professional_skills 
        : [];
      const profileComplete = profile.bio && profile.role && professionalSkills.length > 0;

      if (!profileComplete) {
        setNudge({
          type: "complete_profile",
          title: "Complete your profile",
          description: "Unlock 50 XP and increase your visibility by 10x",
          action: "Complete Now",
          route: "/profile",
          icon: Award,
        });
        return;
      }

      // Check for unread messages
      const { data: unreadMessages } = await supabase
        .from("messages")
        .select("id")
        .eq("receiver_id", user.id)
        .eq("read", false)
        .limit(1);

      if (unreadMessages && unreadMessages.length > 0) {
        setNudge({
          type: "message_waiting",
          title: "You have new messages!",
          description: "Someone is trying to connect with you",
          action: "View Messages",
          route: "/messages",
          icon: MessageCircle,
        });
        return;
      }

      // Check daily swipes usage
      const today = new Date().toDateString();
      const lastReset = new Date(profile.last_swipe_reset).toDateString();
      const dailySwipesUsed = today === lastReset ? profile.daily_swipes : 0;
      const subscriptionTier = (profile.subscription_tier || 'free') as 'free' | 'pro';
      const swipesRemaining = getRemainingSwipes(subscriptionTier, dailySwipesUsed);

      // Only show swipes nudge if not unlimited and has swipes remaining
      if (swipesRemaining !== -1 && swipesRemaining > 5) {
        setNudge({
          type: "daily_login",
          title: `${swipesRemaining} swipes left today!`,
          description: "Don't miss out on discovering amazing opportunities",
          action: "Start Swiping",
          route: "/discover",
          icon: Zap,
        });
        return;
      } else if (swipesRemaining === -1) {
        // For unlimited users, show a different nudge
        setNudge({
          type: "daily_login",
          title: "Unlimited swipes active!",
          description: "Discover amazing creators and opportunities",
          action: "Start Swiping",
          route: "/discover",
          icon: Zap,
        });
        return;
      }

      // Check for new matches
      const { data: recentMatches } = await supabase
        .from("matches")
        .select("id")
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(1);

      if (recentMatches && recentMatches.length > 0) {
        setNudge({
          type: "new_match",
          title: "You have new connections!",
          description: "Start collaborating on your next project",
          action: "View Connections",
          route: "/messages",
          icon: Users,
        });
        return;
      }

      // Default: trending opportunities
      setNudge({
        type: "trending_opportunity",
        title: "Hot opportunities right now",
        description: "5 new projects match your skills",
        action: "Explore",
        route: "/discover",
        icon: TrendingUp,
      });
    } catch (error) {
      console.error("Error analyzing user behavior:", error);
    }
  };

  if (!nudge) return null;

  const Icon = nudge.icon;

  return (
    <Card className="p-6 bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-4">
          <div className="p-3 rounded-full bg-primary/20">
            <Icon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-lg mb-1">{nudge.title}</h3>
            <p className="text-muted-foreground">{nudge.description}</p>
          </div>
        </div>
        <Button onClick={() => navigate(nudge.route)}>
          {nudge.action}
        </Button>
      </div>
    </Card>
  );
};
