import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useUserBlocks() {
  const { user } = useAuth();
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const fetchBlocks = useCallback(async () => {
    if (!user?.id) {
      setBlockedIds(new Set());
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('user_blocks')
      .select('blocked_user_id')
      .eq('blocker_id', user.id);

    setBlockedIds(new Set(data?.map(b => b.blocked_user_id) || []));
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    fetchBlocks();
  }, [fetchBlocks]);

  const blockUser = async (blockedUserId: string) => {
    if (!user?.id) return false;
    const { error } = await supabase
      .from('user_blocks')
      .insert({ blocker_id: user.id, blocked_user_id: blockedUserId });
    if (!error) {
      setBlockedIds(prev => new Set([...prev, blockedUserId]));
      return true;
    }
    return false;
  };

  const unblockUser = async (blockedUserId: string) => {
    if (!user?.id) return false;
    const { error } = await supabase
      .from('user_blocks')
      .delete()
      .eq('blocker_id', user.id)
      .eq('blocked_user_id', blockedUserId);
    if (!error) {
      setBlockedIds(prev => {
        const next = new Set(prev);
        next.delete(blockedUserId);
        return next;
      });
      return true;
    }
    return false;
  };

  const isBlocked = (userId: string) => blockedIds.has(userId);

  return { blockedIds, loading, blockUser, unblockUser, isBlocked, refetch: fetchBlocks };
}
