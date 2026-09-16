import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useConnectedUsers() {
  const { user } = useAuth();
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user?.id) {
      setConnectedIds(new Set());
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('connections')
      .select('user_id, connected_user_id')
      .or(`user_id.eq.${user.id},connected_user_id.eq.${user.id}`)
      .eq('status', 'accepted');

    const ids = new Set<string>();
    data?.forEach(c => {
      if (c.user_id === user.id) ids.add(c.connected_user_id);
      else ids.add(c.user_id);
    });
    setConnectedIds(ids);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { fetch(); }, [fetch]);

  const isConnected = (userId: string) => connectedIds.has(userId);

  return { connectedIds, isConnected, loading, refetch: fetch };
}
