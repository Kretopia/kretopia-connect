import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Conversation } from "./types";

export const useConversations = (currentUserId: string) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [unreadCounts, setUnreadCounts] = useState<Map<string, number>>(new Map());
  const [connections, setConnections] = useState<Set<string>>(new Set());

  const fetchConnections = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const [outgoingResult, incomingResult, matchesResult] = await Promise.all([
        supabase.from("connections").select("connected_user_id").eq("user_id", currentUserId).eq("status", "accepted"),
        supabase.from("connections").select("user_id").eq("connected_user_id", currentUserId).eq("status", "accepted"),
        supabase.from("matches").select("user1_id, user2_id").or(`user1_id.eq.${currentUserId},user2_id.eq.${currentUserId}`).eq("status", "active"),
      ]);
      const ids = new Set<string>();
      outgoingResult.data?.forEach((c) => ids.add(c.connected_user_id));
      incomingResult.data?.forEach((c) => ids.add(c.user_id));
      matchesResult.data?.forEach((m) => ids.add(m.user1_id === currentUserId ? m.user2_id : m.user1_id));
      setConnections(ids);
    } catch (e) {
      console.error('[useConversations] connections error', e);
    }
  }, [currentUserId]);

  const fetchConversations = useCallback(async () => {
    if (!currentUserId) return;
    setConversationsLoading(true);
    try {
      const [convRes, unreadRes] = await Promise.all([
        supabase.from("conversation_list").select("*").or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`).order("created_at", { ascending: false }),
        supabase.from("messages").select("sender_id").eq("receiver_id", currentUserId).eq("read", false),
      ]);
      if (convRes.error) {
        console.error("conv error", convRes.error);
        return;
      }
      setConversations(convRes.data || []);
      if (unreadRes.data) {
        const counts = new Map<string, number>();
        unreadRes.data.forEach((m) => counts.set(m.sender_id, (counts.get(m.sender_id) || 0) + 1));
        setUnreadCounts(counts);
      }
    } catch (e) {
      console.error('[useConversations] error', e);
      setConversations([]);
    } finally {
      setConversationsLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (currentUserId) {
      fetchConnections();
      fetchConversations();
    }
  }, [currentUserId, fetchConnections, fetchConversations]);

  const clearUnread = useCallback((userId: string) => {
    setUnreadCounts((prev) => {
      const next = new Map(prev);
      next.delete(userId);
      return next;
    });
  }, []);

  return {
    conversations,
    conversationsLoading,
    unreadCounts,
    connections,
    fetchConnections,
    fetchConversations,
    clearUnread,
  };
};
