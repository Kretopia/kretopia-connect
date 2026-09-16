import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Flame, Snowflake, Trophy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { TooltipHint } from "@/components/ui/tooltip-hint";

interface StreakCardProps {
  streakCount: number;
  longestStreak: number;
  freezeCount: number;
  onUpdate: () => void;
}

export function StreakCard({ streakCount, longestStreak, freezeCount, onUpdate }: StreakCardProps) {
  const { toast } = useToast();
  const [purchasing, setPurchasing] = useState(false);

  const purchaseFreeze = async () => {
    setPurchasing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Deduct XP and add freeze (500 XP = 1 freeze)
      const { data: profile } = await supabase
        .from('profiles')
        .select('xp')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!profile || profile.xp < 500) {
        toast({
          title: "Insufficient Thrive Points",
          description: "You need 500 TP to purchase a streak freeze.",
          variant: "destructive"
        });
        return;
      }

      const { error } = await supabase.rpc('spend_xp' as any, {
        p_amount: 500,
        p_purpose: 'streak_freeze',
      });

      if (error) throw error;

      toast({
        title: "Streak Freeze Purchased!",
        description: "Use it to protect your streak on busy days."
      });
      onUpdate();
    } catch (error) {
      console.error('Error purchasing freeze:', error);
      toast({
        title: "Purchase Failed",
        description: "Could not purchase streak freeze.",
        variant: "destructive"
      });
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-orange-500/10 to-yellow-500/10 border-orange-500/20">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-full bg-gradient-to-br from-orange-500 to-yellow-500">
            <Flame className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-2xl font-bold flex items-center gap-2">
              {streakCount} Day Streak
              <TooltipHint content="Log in daily to maintain your streak! Use a streak freeze to protect your progress if you miss a day. Earn freezes through achievements and milestones." />
            </h3>
            <p className="text-sm text-muted-foreground">
              Keep it going!             </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          <div>
            <p className="text-xs text-muted-foreground">Longest</p>
            <p className="font-bold">{longestStreak} days</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Snowflake className="w-5 h-5 text-primary" />
          <div>
            <p className="text-xs text-muted-foreground">Freezes</p>
            <p className="font-bold">{freezeCount} available</p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Stay active daily to build your streak! Freezes protect you when you miss a day.
        </p>
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full"
          onClick={purchaseFreeze}
          disabled={purchasing}
        >
          <Snowflake className="w-4 h-4 mr-2" />
          Buy Freeze (500 XP)
        </Button>
      </div>
    </Card>
  );
}
