import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getPerFileLimit } from "@/lib/fileSizeLimits";

export type StorageQuota = {
  used: number;
  limit: number;
  tier: string;
  perFileLimit: number;
  pct: number;
  isNearLimit: boolean;   // ≥ 80%
  isCritical: boolean;    // ≥ 95%
  isFull: boolean;        // ≥ 100%
  remaining: number;
};

const QUERY_KEY = ["storage-quota"];

/**
 * Unified storage quota hook. Reads from `get_my_storage_quota` RPC which
 * reflects the live `profiles.storage_used_bytes` (kept in sync by the
 * `trg_sync_user_storage_usage` trigger on storage.objects).
 *
 * Subscribes to realtime updates on the user's own profile row so the meter
 * updates instantly after an upload/delete from anywhere in the app.
 */
export function useStorageQuota() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery<StorageQuota>({
    queryKey: [...QUERY_KEY, user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_storage_quota");
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      const used = Number(row?.used_bytes ?? 0);
      const limit = Number(row?.limit_bytes ?? 2 * 1024 ** 3);
      const tier = String(row?.tier ?? "free");
      const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
      return {
        used,
        limit,
        tier,
        perFileLimit: getPerFileLimit(tier),
        pct,
        isNearLimit: pct >= 80,
        isCritical: pct >= 95,
        isFull: used >= limit,
        remaining: Math.max(0, limit - used),
      };
    },
  });

  // Realtime: refetch when this user's profile row updates (storage_used_bytes changes)
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`storage-quota-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: [...QUERY_KEY, user.id] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, qc]);

  return query;
}

/** Manually invalidate the quota cache (call after explicit upload/delete). */
export function invalidateStorageQuota(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: QUERY_KEY });
}
