import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Circle, AlertCircle, ChevronRight, Zap } from "lucide-react";
import { Database } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

type Profile = Database['public']['Tables']['profiles']['Row'];

interface ProfileStrengthScoreProps {
  profile: Profile;
  portfolioCount?: number;
  creditsCount?: number;
  awardsCount?: number;
  pressCount?: number;
}

interface CompletionItem {
  label: string;
  completed: boolean;
  points: number;
}

export const calculateProfileStrength = (
  profile: Profile,
  portfolioCount: number = 0,
  creditsCount: number = 0,
  awardsCount: number = 0,
  pressCount: number = 0
): { score: number; items: CompletionItem[] } => {
  const items: CompletionItem[] = [
    { label: "Profile photo", completed: !!profile.avatar_url, points: 10 },
    { label: "Full name", completed: !!profile.full_name, points: 5 },
    { label: "Bio (50+ characters)", completed: (profile.bio?.length || 0) >= 50, points: 10 },
    { label: "Location", completed: !!profile.location, points: 5 },
    { label: "Role/Title", completed: !!profile.role, points: 5 },
    { label: "Professional skills (3+)", completed: Array.isArray(profile.professional_skills) && profile.professional_skills.length >= 3, points: 15 },
    { label: "Portfolio items (3+)", completed: portfolioCount >= 3, points: 15 },
    { label: "Project credits (2+)", completed: creditsCount >= 2, points: 10 },
    { label: "Social stats verified", completed: !!profile.verified_metrics, points: 10 },
    { label: "At least one social link", completed: !!(profile.instagram_url || profile.twitter_url || profile.linkedin_url || profile.website), points: 5 },
    { label: "Awards or recognition", completed: awardsCount > 0, points: 5 },
    { label: "Press/media coverage", completed: pressCount > 0, points: 5 },
  ];

  const totalPoints = items.reduce((sum, item) => sum + item.points, 0);
  const earnedPoints = items.filter(i => i.completed).reduce((sum, item) => sum + item.points, 0);
  const score = Math.round((earnedPoints / totalPoints) * 100);

  return { score, items };
};

export const ProfileStrengthScore = ({ 
  profile, 
  portfolioCount = 0, 
  creditsCount = 0,
  awardsCount = 0,
  pressCount = 0
}: ProfileStrengthScoreProps) => {
  const { score, items } = calculateProfileStrength(profile, portfolioCount, creditsCount, awardsCount, pressCount);
  const nextItem = items.find(i => !i.completed);
  const completedCount = items.filter(i => i.completed).length;

  const ringColor = score >= 80 ? "stroke-emerald-500" : score >= 50 ? "stroke-amber-500" : "stroke-primary";
  const circumference = 2 * Math.PI * 36;
  const offset = circumference - (score / 100) * circumference;

  return (
    <Card className="border border-border/50 overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {/* SVG Ring */}
          <div className="relative w-20 h-20 shrink-0">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="4" className="text-muted/30" />
              <circle
                cx="40" cy="40" r="36" fill="none" strokeWidth="4"
                strokeLinecap="round"
                className={cn(ringColor, "transition-all duration-700 ease-out")}
                strokeDasharray={circumference}
                strokeDashoffset={offset}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-bold">{score}%</span>
              <span className="text-[9px] text-muted-foreground">{completedCount}/{items.length}</span>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold mb-0.5">Profile Strength</h3>
            <p className="text-[11px] text-muted-foreground mb-2">
              {score >= 90 ? "Outstanding! You stand out." :
               score >= 70 ? "Almost there! A few more touches." :
               score >= 50 ? "Good start! Keep building." :
               "Let's make you discoverable!"}
            </p>

            {/* Next action nudge */}
            {nextItem && (
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-primary/5 border border-primary/10">
                <Zap className="h-3 w-3 text-primary shrink-0" />
                <span className="text-[11px] font-medium truncate">{nextItem.label}</span>
                <span className="text-[10px] text-primary ml-auto shrink-0">+{nextItem.points}pts</span>
                <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
              </div>
            )}
          </div>
        </div>

        {/* Compact checklist - only incomplete items */}
        {items.filter(i => !i.completed).length > 0 && (
          <div className="mt-3 pt-3 border-t border-border/30">
            <div className="grid grid-cols-2 gap-1.5">
              {items.map((item, index) => (
                <div key={index} className={cn(
                  "flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md",
                  item.completed ? "text-muted-foreground/50" : "text-foreground"
                )}>
                  {item.completed ? (
                    <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                  ) : (
                    <Circle className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                  )}
                  <span className={cn("truncate", item.completed && "line-through")}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
