import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

const MAX_DAILY_UNDOS: Record<string, number> = {
  free: 0,
  pro: 3,
};

interface SwipeRecord {
  id: string;
  target_id: string;
  target_type: string;
  direction: string;
  is_super_like: boolean;
  created_at: string;
}

export const useUndoSwipe = (userTier: string) => {
  const [undosRemaining, setUndosRemaining] = useState(0);
  const [lastSwipe, setLastSwipe] = useState<SwipeRecord | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      checkUndosRemaining();
    }
  }, [user, userTier]);

  const checkUndosRemaining = async () => {
    try {
      if (!user) return;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Count undo actions today
      const { count } = await supabase
        .from('swipes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_undo', true)
        .gte('created_at', today.toISOString());

      const undosUsed = count || 0;
      const maxUndos = MAX_DAILY_UNDOS[userTier] || 0;
      setUndosRemaining(Math.max(0, maxUndos - undosUsed));
    } catch (error) {
      console.error('Error checking undos:', error);
    }
  };

  const trackSwipe = (swipe: SwipeRecord) => {
    setLastSwipe(swipe);
  };

  const undoLastSwipe = async () => {
    if (!lastSwipe || undosRemaining <= 0) {
      toast({
        title: "Can't undo",
        description: "No swipes to undo or daily limit reached",
        variant: "destructive"
      });
      return null;
    }

    if (!user) return null;

    try {
      // Delete the last swipe
      const { error: deleteError } = await supabase
        .from('swipes')
        .delete()
        .eq('id', lastSwipe.id);

      if (deleteError) throw deleteError;

      // Track the undo action
      const { analytics } = await import("@/lib/analytics");
      analytics.undoSwipe(lastSwipe.target_id);
      await supabase.from('swipes').insert({
        user_id: user.id,
        target_id: lastSwipe.target_id,
        target_type: lastSwipe.target_type,
        direction: 'undo',
        is_undo: true
      });

      // Decrease daily swipes count
      const { data: profileData } = await supabase
        .from('profiles')
        .select('daily_swipes')
        .eq('user_id', user.id)
        .single();

      if (profileData) {
        await supabase
          .from('profiles')
          .update({ daily_swipes: Math.max(0, (profileData.daily_swipes || 0) - 1) })
          .eq('user_id', user.id);
      }

      setUndosRemaining(prev => prev - 1);
      
      toast({
        title: "Swipe undone! ↩",
        description: "The card has been restored"
      });

      const undoneCard = lastSwipe;
      setLastSwipe(null);
      
      return undoneCard;
    } catch (error: any) {
      toast({
        title: "Failed to undo",
        description: error.message,
        variant: "destructive"
      });
      return null;
    }
  };

  return {
    undosRemaining,
    trackSwipe,
    undoLastSwipe,
    checkUndosRemaining
  };
};
