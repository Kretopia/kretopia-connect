import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LocationCategory {
  id: string;
  slug: string;
  name: string;
  emoji: string | null;
  description: string | null;
  parent_slug: string | null;
  location_type: string;
  display_order: number;
  is_active: boolean;
}

export function useLocationCategories(locationType?: string) {
  return useQuery({
    queryKey: ['location-categories', locationType],
    queryFn: async () => {
      let query = supabase
        .from('location_categories')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (locationType) {
        query = query.eq('location_type', locationType);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as LocationCategory[];
    },
    staleTime: 1000 * 60 * 30, // cache 30 min — reference data
  });
}
