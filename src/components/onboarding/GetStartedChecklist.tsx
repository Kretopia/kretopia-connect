import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle2, Circle, Camera, FileText, Briefcase, 
  Users, Sparkles, ArrowRight, X, Rocket, ChevronDown, ChevronUp
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { PROFILE_SELECT } from "@/lib/profile/profileColumns";

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  icon: typeof Camera;
  completed: boolean;
  action: () => void;
  xp: number;
}

export function GetStartedChecklist() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [portfolioCount, setPortfolioCount] = useState(0);
  const [connectionCount, setConnectionCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    
    const fetchData = async () => {
      const [profileRes, creditsRes, portfolioRes, connectionRes] = await Promise.all([
        supabase.from("profiles").select(PROFILE_SELECT).eq("user_id", user.id).single(),
        supabase.from("credits").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("credits").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("connections").select("id", { count: "exact", head: true })
          .or(`user_id.eq.${user.id},connected_user_id.eq.${user.id}`)
          .eq("status", "accepted"),
      ]);
      
      setProfile(profileRes.data);
      setPortfolioCount((creditsRes.count || 0) + (portfolioRes.count || 0));
      setConnectionCount(connectionRes.count || 0);
      setLoading(false);
    };
    
    fetchData();

    // Check if dismissed in localStorage
    const wasDismissed = localStorage.getItem(`checklist_dismissed_${user.id}`);
    if (wasDismissed) setDismissed(true);
  }, [user]);

  const items: ChecklistItem[] = useMemo(() => {
    if (!profile) return [];
    
    return [
      {
        id: "photo",
        title: "Add a profile photo",
        description: "Profiles with photos get 10× more views",
        icon: Camera,
        completed: !!profile.avatar_url,
        action: () => navigate("/profile"),
        xp: 10,
      },
      {
        id: "bio",
        title: "Write your bio",
        description: "Tell your story in 50+ characters",
        icon: FileText,
        completed: profile.bio && profile.bio.length >= 20,
        action: () => navigate("/profile"),
        xp: 10,
      },
      {
        id: "skills",
        title: "Add your skills",
        description: "Help others discover what you do",
        icon: Sparkles,
        completed: (() => {
          const pro = Array.isArray(profile.professional_skills) ? profile.professional_skills.length : 0;
          const pas = Array.isArray(profile.passion_skills) ? profile.passion_skills.length : 0;
          return (pro + pas) >= 3;
        })(),
        action: () => navigate("/profile"),
        xp: 10,
      },
      {
        id: "portfolio",
        title: "Claim your first production credit",
        description: "Search any film, song, or campaign you worked on",
        icon: Briefcase,
        completed: portfolioCount >= 1,
        action: () => navigate("/credits"),
        xp: 15,
      },
      {
        id: "connect",
        title: "Make your first connection",
        description: "Start building your creative network",
        icon: Users,
        completed: connectionCount >= 1,
        action: () => navigate("/circle"),
        xp: 5,
      },
    ];
  }, [profile, portfolioCount, connectionCount, navigate]);

  const completedCount = items.filter(i => i.completed).length;
  const totalCount = items.length;
  const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const totalXP = items.filter(i => i.completed).reduce((sum, i) => sum + i.xp, 0);
  const allComplete = completedCount === totalCount;

  const handleDismiss = () => {
    if (user) localStorage.setItem(`checklist_dismissed_${user.id}`, "true");
    setDismissed(true);
  };

  if (loading || dismissed || !profile || allComplete) return null;

  return (
    <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-background to-accent/5">
      {/* Header */}
      <div className="p-4 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Rocket className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Get Started</h3>
              <p className="text-[11px] text-muted-foreground">
                {completedCount}/{totalCount} complete · {totalXP} XP earned
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCollapsed(!collapsed)}>
              {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={handleDismiss}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <Progress value={percentage} className="h-1.5 mt-3" />
      </div>

      {/* Items */}
      {!collapsed && (
        <div className="px-4 pb-4 space-y-1.5">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={item.action}
                className={cn(
                  "w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-all",
                  item.completed
                    ? "opacity-60"
                    : "hover:bg-primary/5 active:scale-[0.98]"
                )}
                disabled={item.completed}
              >
                {item.completed ? (
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-medium", item.completed && "line-through text-muted-foreground")}>
                    {item.title}
                  </p>
                  {!item.completed && (
                    <p className="text-[11px] text-muted-foreground">{item.description}</p>
                  )}
                </div>
                {!item.completed && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      +{item.xp} XP
                    </Badge>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}
