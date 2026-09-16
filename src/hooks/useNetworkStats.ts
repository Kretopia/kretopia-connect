import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface NetworkStats {
  degree1: number;
  degree2: number;
  degree3: number;
  totalReach: number;
}

interface ConnectionPath {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  role: string | null;
}

export function useNetworkStats(userId: string | undefined) {
  const [stats, setStats] = useState<NetworkStats>({
    degree1: 0,
    degree2: 0,
    degree3: 0,
    totalReach: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: rpcError } = await supabase.rpc('get_network_stats', {
        p_user_id: userId
      });

      if (rpcError) {
        console.error('[useNetworkStats] RPC error:', rpcError);
        setError(rpcError.message);
        return;
      }

      const statsMap: NetworkStats = {
        degree1: 0,
        degree2: 0,
        degree3: 0,
        totalReach: 0
      };

      if (data && Array.isArray(data)) {
        data.forEach((row: { degree: number; connection_count: number }) => {
          if (row.degree === 1) statsMap.degree1 = Number(row.connection_count);
          if (row.degree === 2) statsMap.degree2 = Number(row.connection_count);
          if (row.degree === 3) statsMap.degree3 = Number(row.connection_count);
        });
        statsMap.totalReach = statsMap.degree1 + statsMap.degree2 + statsMap.degree3;
      }

      console.log('[useNetworkStats] Stats:', statsMap);
      setStats(statsMap);
    } catch (err) {
      console.error('[useNetworkStats] Error:', err);
      setError('Failed to fetch network stats');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
}

// Hook to get the degree of connection between current user and target user
export function useConnectionDegree(currentUserId: string | undefined, targetUserId: string | undefined) {
  const [degree, setDegree] = useState<number | null>(null);
  const [path, setPath] = useState<ConnectionPath[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDegree = async () => {
      if (!currentUserId || !targetUserId || currentUserId === targetUserId) {
        setDegree(0);
        setPath([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // Use the new get_connection_path RPC
        const { data, error } = await supabase.rpc('get_connection_path', {
          from_user_id: currentUserId,
          to_user_id: targetUserId
        });

        if (error) {
          console.error('[useConnectionDegree] RPC error:', error);
          // Fallback to simple check
          const { data: directConnection } = await supabase
            .from('connections')
            .select('id')
            .or(`and(user_id.eq.${currentUserId},connected_user_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},connected_user_id.eq.${currentUserId})`)
            .eq('status', 'accepted')
            .limit(1);

          if (directConnection && directConnection.length > 0) {
            setDegree(1);
          } else {
            setDegree(null);
          }
          setPath([]);
          setLoading(false);
          return;
        }

        if (data && data.length > 0) {
          const result = data[0];
          setDegree(result.degree);
          
          // Build path from the middle users (excluding self and target)
          if (result.path_user_ids && result.path_user_ids.length > 2) {
            const middleUserIds = result.path_user_ids.slice(1, -1);
            const middleNames = result.path_user_names.slice(1, -1);
            
            // Fetch avatars for path users
            const { data: profiles } = await supabase
              .from('profiles')
              .select('user_id, full_name, avatar_url, role')
              .in('user_id', middleUserIds);
            
            const pathConnections: ConnectionPath[] = middleUserIds.map((userId: string, idx: number) => {
              const profile = profiles?.find(p => p.user_id === userId);
              return {
                userId,
                fullName: profile?.full_name || middleNames[idx] || 'Unknown',
                avatarUrl: profile?.avatar_url || null,
                role: profile?.role || null
              };
            });
            
            setPath(pathConnections);
          } else {
            setPath([]);
          }
        } else {
          setDegree(null);
          setPath([]);
        }
      } catch (err) {
        console.error('[useConnectionDegree] Error:', err);
        setDegree(null);
        setPath([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDegree();
  }, [currentUserId, targetUserId]);

  return { degree, path, loading };
}
