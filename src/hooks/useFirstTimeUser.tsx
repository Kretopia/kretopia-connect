import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const useFirstTimeUser = () => {
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    checkFirstTimeUser();
  }, [user]);

  const checkFirstTimeUser = async () => {
    try {
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("created_at, xp")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profile) {
        const accountAge = Date.now() - new Date(profile.created_at).getTime();
        const oneDayInMs = 24 * 60 * 60 * 1000;
        
        // Consider first-time if account is less than a day old or has less than 200 XP
        setIsFirstTime(accountAge < oneDayInMs || (profile.xp || 0) < 200);
      }
    } catch (error) {
      console.error("Error checking first-time user:", error);
    } finally {
      setLoading(false);
    }
  };

  return { isFirstTime, loading };
};
