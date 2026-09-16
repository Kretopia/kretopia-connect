import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { Json } from "@/integrations/supabase/types";

interface MatchedProfile {
  user_id: string;
  full_name: string;
  role: string;
  bio: string | null;
  avatar_url: string | null;
  location: string | null;
  imported_from_url: string | null;
  imported_data: Json | null;
  professional_skills: Json | null;
  claim_token: string;
  similarity_score: number;
}

export const useUnclaimedProfileMatch = () => {
  const { user } = useAuth();

  // First fetch the user's profile to get their name
  const { data: profile } = useQuery({
    queryKey: ['my-profile-for-match', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('profiles')
        .select('full_name, onboarding_completed')
        .eq('user_id', user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Then check for matching unclaimed profiles
  return useQuery({
    queryKey: ['unclaimed-profile-match', user?.id, profile?.full_name],
    queryFn: async (): Promise<MatchedProfile[]> => {
      if (!profile?.full_name) return [];

      // Check localStorage for dismissed matches
      const dismissed = JSON.parse(localStorage.getItem('dismissed_profile_matches') || '[]');

      const { data, error } = await supabase
        .rpc('find_matching_unclaimed_profiles', {
          p_full_name: profile.full_name,
          p_limit: 5
        });

      if (error) {
        console.error('Error finding matching profiles:', error);
        return [];
      }

      // Filter out previously dismissed profiles
      return ((data || []) as MatchedProfile[]).filter(
        m => !dismissed.includes(m.user_id)
      );
    },
    enabled: !!user && !!profile?.full_name && profile?.onboarding_completed === true,
    staleTime: 1000 * 60 * 60, // 1 hour - don't check too often
  });
};
