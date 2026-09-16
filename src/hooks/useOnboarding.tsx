import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface OnboardingState {
  isComplete: boolean;
  currentStep: number;
  shouldShowTour: boolean;
}

export function useOnboarding() {
  const { user } = useAuth();
  const [state, setState] = useState<OnboardingState>({
    isComplete: true,
    currentStep: 0,
    shouldShowTour: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      checkOnboardingStatus();
    } else {
      setLoading(false);
    }
  }, [user]);

  const checkOnboardingStatus = async () => {
    if (!user) return;

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_completed, onboarding_step')
        .eq('user_id', user.id)
        .single();

      if (profile) {
        setState({
          isComplete: profile.onboarding_completed || false,
          currentStep: profile.onboarding_step || 0,
          shouldShowTour: !profile.onboarding_completed,
        });
      }
    } catch (error) {
      console.error('Error checking onboarding:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStep = useCallback(async (step: number) => {
    if (!user) return;

    try {
      await supabase
        .from('profiles')
        .update({ onboarding_step: step })
        .eq('user_id', user.id);

      setState(prev => ({ ...prev, currentStep: step }));
    } catch (error) {
      console.error('Error updating onboarding step:', error);
    }
  }, [user]);

  const completeOnboarding = useCallback(async () => {
    if (!user) return;

    try {
      await supabase
        .from('profiles')
        .update({ 
          onboarding_completed: true,
          onboarding_step: 6 // Final step
        })
        .eq('user_id', user.id);

      setState({
        isComplete: true,
        currentStep: 6,
        shouldShowTour: false,
      });

      // Send welcome email after onboarding completes
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', user.id)
          .single();

        await supabase.functions.invoke('send-notification-email', {
          body: { 
            to: user.email,
            type: 'welcome',
            data: { userName: profile?.full_name || 'there' }
          }
        });
        console.log('[Onboarding] Welcome email sent');
      } catch (emailErr) {
        console.error('[Onboarding] Failed to send welcome email:', emailErr);
      }
    } catch (error) {
      console.error('Error completing onboarding:', error);
    }
  }, [user]);

  const restartOnboarding = useCallback(async () => {
    if (!user) return;

    try {
      await supabase
        .from('profiles')
        .update({ 
          onboarding_completed: false,
          onboarding_step: 0
        })
        .eq('user_id', user.id);

      setState({
        isComplete: false,
        currentStep: 0,
        shouldShowTour: true,
      });
    } catch (error) {
      console.error('Error restarting onboarding:', error);
    }
  }, [user]);

  return {
    ...state,
    loading,
    updateStep,
    completeOnboarding,
    restartOnboarding,
    refetch: checkOnboardingStatus,
  };
}
