import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useSavedOpportunity = (opportunityId: string, userId: string | undefined) => {
  const [isSaved, setIsSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!userId) return;
    
    const checkSaved = async () => {
      const { data } = await supabase
        .from('saved_opportunities')
        .select('id')
        .eq('user_id', userId)
        .eq('opportunity_id', opportunityId)
        .maybeSingle();
      
      setIsSaved(!!data);
    };
    
    checkSaved();
  }, [opportunityId, userId]);

  const toggleSave = async () => {
    if (!userId) return false;
    
    setLoading(true);
    
    if (isSaved) {
      const { error } = await supabase
        .from('saved_opportunities')
        .delete()
        .eq('user_id', userId)
        .eq('opportunity_id', opportunityId);
      
      if (!error) {
        setIsSaved(false);
        toast({
          title: "Removed from saved",
        });
      } else {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
    } else {
      const { error } = await supabase
        .from('saved_opportunities')
        .insert({
          user_id: userId,
          opportunity_id: opportunityId,
        });
      
      if (!error) {
        setIsSaved(true);
        toast({
          title: "Saved!",
          description: "Added to your bookmarks",
        });
      } else {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
    }
    
    setLoading(false);
    return true;
  };

  return { isSaved, loading, toggleSave };
};
