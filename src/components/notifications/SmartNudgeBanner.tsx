import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Eye, Briefcase, Users, Sparkles, X, ArrowRight, 
  Bell, Flame, Target 
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface Nudge {
  id: string;
  icon: typeof Eye;
  title: string;
  subtitle: string;
  action: () => void;
  actionLabel: string;
  color: string;
  priority: number;
}

export function SmartNudgeBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dismissedNudges, setDismissedNudges] = useState<string[]>([]);
  const [profileViews, setProfileViews] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [pendingConnections, setPendingConnections] = useState(0);
  const [newOpportunities, setNewOpportunities] = useState(0);

  useEffect(() => {
    if (!user) return;

    // Load dismissed nudges
    const stored = localStorage.getItem(`nudges_dismissed_${user.id}`);
    if (stored) setDismissedNudges(JSON.parse(stored));

    const fetchNudgeData = async () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const [viewsRes, notifRes, connRes, oppsRes] = await Promise.all([
        supabase.from("analytics_events")
          .select("id", { count: "exact", head: true })
          .eq("event_name", "profile_viewed")
          .gte("created_at", sevenDaysAgo.toISOString()),
        (supabase.from("notifications" as any)
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("is_read", false)) as any,
        supabase.from("connections")
          .select("id", { count: "exact", head: true })
          .eq("connected_user_id", user.id)
          .eq("status", "pending"),
        supabase.from("opportunities")
          .select("id", { count: "exact", head: true })
          .in("status", ["active", "open"])
          .gte("created_at", sevenDaysAgo.toISOString()),
      ]);

      setProfileViews(viewsRes.count || 0);
      setUnreadNotifications(notifRes.count || 0);
      setPendingConnections(connRes.count || 0);
      setNewOpportunities(oppsRes.count || 0);
    };

    fetchNudgeData();
  }, [user]);

  const nudges: Nudge[] = useMemo(() => {
    const all: Nudge[] = [];

    if (pendingConnections > 0) {
      all.push({
        id: "pending_connections",
        icon: Users,
        title: `${pendingConnections} connection ${pendingConnections === 1 ? "request" : "requests"}`,
        subtitle: "Someone wants to connect with you",
        action: () => navigate("/circle?tab=network"),
        actionLabel: "View",
        color: "text-primary",
        priority: 1,
      });
    }

    if (profileViews > 0) {
      all.push({
        id: "profile_views",
        icon: Eye,
        title: `${profileViews} profile ${profileViews === 1 ? "view" : "views"} this week`,
        subtitle: "Creators are checking out your work",
        action: () => navigate("/profile"),
        actionLabel: "See who",
        color: "text-green-500",
        priority: 2,
      });
    }

    if (newOpportunities >= 3) {
      all.push({
        id: "new_gigs",
        icon: Briefcase,
        title: `${newOpportunities} new gigs this week`,
        subtitle: "Fresh opportunities matching your skills",
        action: () => navigate("/opportunities"),
        actionLabel: "Browse",
        color: "text-primary",
        priority: 3,
      });
    }

    return all
      .filter(n => !dismissedNudges.includes(n.id))
      .sort((a, b) => a.priority - b.priority);
  }, [profileViews, pendingConnections, newOpportunities, dismissedNudges, navigate]);

  const dismissNudge = (id: string) => {
    const updated = [...dismissedNudges, id];
    setDismissedNudges(updated);
    if (user) localStorage.setItem(`nudges_dismissed_${user.id}`, JSON.stringify(updated));
  };

  // Reset dismissed nudges daily
  useEffect(() => {
    if (!user) return;
    const lastReset = localStorage.getItem(`nudges_reset_${user.id}`);
    const today = new Date().toDateString();
    if (lastReset !== today) {
      localStorage.setItem(`nudges_reset_${user.id}`, today);
      localStorage.removeItem(`nudges_dismissed_${user.id}`);
      setDismissedNudges([]);
    }
  }, [user]);

  const currentNudge = nudges[0];
  if (!currentNudge) return null;

  const Icon = currentNudge.icon;

  return (
    <Card className="overflow-hidden border-primary/10 mb-4">
      <div className="flex items-center gap-3 p-3">
        <div className={cn("h-9 w-9 rounded-full flex items-center justify-center shrink-0 bg-primary/10")}>
          <Icon className={cn("h-4 w-4", currentNudge.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{currentNudge.title}</p>
          <p className="text-[11px] text-muted-foreground truncate">{currentNudge.subtitle}</p>
        </div>
        <Button size="sm" variant="ghost" className="shrink-0 text-xs gap-1 text-primary" onClick={currentNudge.action}>
          {currentNudge.actionLabel}
          <ArrowRight className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => dismissNudge(currentNudge.id)}>
          <X className="h-3 w-3 text-muted-foreground" />
        </Button>
      </div>
    </Card>
  );
}
