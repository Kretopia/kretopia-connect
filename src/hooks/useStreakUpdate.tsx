import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

export function useStreakUpdate() {
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    const updateStreak = async () => {
      try {
        if (!user) return;

        const { data: profile, error: fetchError } = await supabase
          .from('profiles')
          .select('last_active_date, streak_count')
          .eq('user_id', user.id)
          .maybeSingle();

        if (fetchError) throw fetchError;
        if (!profile) return;

        const today = new Date().toISOString().split('T')[0];
        const lastActive = profile?.last_active_date;

        if (lastActive !== today) {
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ updated_at: new Date().toISOString() })
            .eq('user_id', user.id);

          if (updateError) throw updateError;

          const { data: updatedProfile } = await supabase
            .from('profiles')
            .select('streak_count')
            .eq('user_id', user.id)
            .maybeSingle();

          if (updatedProfile && updatedProfile.streak_count > (profile?.streak_count || 0)) {
            toast({
              title: "Streak Updated!",
              description: `${updatedProfile.streak_count} day streak!`,
            });
          }
        }
      } catch (error) {
        console.error('Error updating streak:', error);
      }
    };

    updateStreak();
  }, [user, toast]);
}
