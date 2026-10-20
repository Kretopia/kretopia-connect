import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { groupCosignRequests, type CosignRequestRow } from "@/lib/passport/cosignRequests";

/**
 * The co-sign requests the signed-in creator sent, whatever their state, grouped by credit. A read that fails
 * (or is blocked) simply yields no requests: the cards then fall back to "ask someone", never to a made-up state.
 */
export function useCosignRequests(userId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["credit-cosign-requests", userId];
  const { data = [] } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("credit_endorsements")
        .select("credit_id, token, endorser_name, status, requested_at, responded_at")
        .eq("requested_by", userId!)
        .order("requested_at", { ascending: false });
      return error ? ([] as CosignRequestRow[]) : ((rows || []) as CosignRequestRow[]);
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
  const byCredit = useMemo(() => groupCosignRequests(data), [data]);
  return { byCredit, refresh: () => queryClient.invalidateQueries({ queryKey }) };
}
