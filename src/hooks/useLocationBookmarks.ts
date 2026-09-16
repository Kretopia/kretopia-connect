import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export function useLocationBookmarks() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const fetchBookmarks = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('location_bookmarks')
        .select('location_id')
        .eq('user_id', user.id);
      
      if (error) throw error;
      setBookmarkedIds(new Set((data || []).map(b => b.location_id)));
    } catch (err) {
      console.error('Error fetching bookmarks:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchBookmarks();
  }, [fetchBookmarks]);

  const toggleBookmark = useCallback(async (locationId: string) => {
    if (!user) {
      toast({ title: "Sign in to save spots", variant: "destructive" });
      return;
    }

    const isBookmarked = bookmarkedIds.has(locationId);
    
    // Optimistic update
    setBookmarkedIds(prev => {
      const next = new Set(prev);
      if (isBookmarked) next.delete(locationId);
      else next.add(locationId);
      return next;
    });

    try {
      if (isBookmarked) {
        const { error } = await supabase
          .from('location_bookmarks')
          .delete()
          .eq('user_id', user.id)
          .eq('location_id', locationId);
        if (error) throw error;
        toast({ title: "Bookmark removed" });
      } else {
        const { error } = await supabase
          .from('location_bookmarks')
          .insert({ user_id: user.id, location_id: locationId });
        if (error) throw error;
        toast({ title: "Spot saved! 🔖" });
      }
    } catch (err: any) {
      // Revert on error
      setBookmarkedIds(prev => {
        const next = new Set(prev);
        if (isBookmarked) next.add(locationId);
        else next.delete(locationId);
        return next;
      });
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }, [user, bookmarkedIds, toast]);

  return { bookmarkedIds, toggleBookmark, loading, refetch: fetchBookmarks };
}
