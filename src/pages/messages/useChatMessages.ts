import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Message, OtherUser } from "./types";
import type { ReactionRow } from "@/components/messages/MessageReactions";

interface Args {
  currentUserId: string;
  selectedConversation: string | null;
  onConversationsRefresh: () => void;
  onClearUnread: (userId: string) => void;
}

export const useChatMessages = ({ currentUserId, selectedConversation, onConversationsRefresh, onClearUnread }: Args) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [reactionsByMsg, setReactionsByMsg] = useState<Map<string, ReactionRow[]>>(new Map());

  const markMessagesAsRead = useCallback(async (userId: string) => {
    const { error } = await supabase
      .from("messages")
      .update({ read: true })
      .eq("receiver_id", currentUserId)
      .eq("sender_id", userId)
      .eq("read", false);
    if (!error) onClearUnread(userId);
  }, [currentUserId, onClearUnread]);

  const fetchMessages = useCallback(async (userId: string) => {
    try {
      const [messagesResult, profileResult] = await Promise.all([
        supabase
          .from("messages")
          .select("*")
          .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${currentUserId})`)
          .order("created_at", { ascending: true }),
        supabase.from("profiles").select("full_name, avatar_url, role").eq("user_id", userId).maybeSingle(),
      ]);
      if (messagesResult.error) {
        console.error("msg fetch error", messagesResult.error);
        return;
      }
      const msgs = (messagesResult.data || []) as Message[];
      setMessages(msgs);

      if (msgs.length > 0) {
        const ids = msgs.map((m) => m.id);
        const { data: reactRows } = await supabase.from("message_reactions").select("*").in("message_id", ids);
        const map = new Map<string, ReactionRow[]>();
        (reactRows || []).forEach((r) => {
          const arr = map.get(r.message_id) || [];
          arr.push(r as ReactionRow);
          map.set(r.message_id, arr);
        });
        setReactionsByMsg(map);
      } else {
        setReactionsByMsg(new Map());
      }

      if (profileResult.data) {
        setOtherUser({
          id: userId,
          name: profileResult.data.full_name,
          avatar: profileResult.data.avatar_url,
          role: profileResult.data.role,
        });
      }
    } catch (e) {
      console.error('[useChatMessages] fetch error', e);
      setMessages([]);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (selectedConversation && currentUserId) {
      fetchMessages(selectedConversation);
      markMessagesAsRead(selectedConversation);
    }
  }, [selectedConversation, currentUserId, fetchMessages, markMessagesAsRead]);

  // Realtime subscriptions
  useEffect(() => {
    if (!currentUserId) return;
    const channel = supabase
      .channel("messages-changes")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "messages",
        filter: `or(sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId})`,
      }, (payload) => {
        if (payload.eventType === "INSERT") {
          const newMsg = payload.new as Message;
          if (selectedConversation && (newMsg.sender_id === selectedConversation || newMsg.receiver_id === selectedConversation)) {
            setMessages((prev) => [...prev, newMsg]);
            markMessagesAsRead(selectedConversation);
          }
          onConversationsRefresh();
        } else if (payload.eventType === "UPDATE") {
          setMessages((prev) => prev.map((m) => (m.id === payload.new.id ? (payload.new as Message) : m)));
          onConversationsRefresh();
        }
      })
      .subscribe();

    const reactionsChannel = supabase
      .channel("message-reactions-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const r = payload.new as ReactionRow;
          setReactionsByMsg((prev) => {
            const next = new Map(prev);
            next.set(r.message_id, [...(next.get(r.message_id) || []), r]);
            return next;
          });
        } else if (payload.eventType === "DELETE") {
          const r = payload.old as ReactionRow;
          setReactionsByMsg((prev) => {
            const next = new Map(prev);
            const arr = (next.get(r.message_id) || []).filter((x) => x.id !== r.id);
            next.set(r.message_id, arr);
            return next;
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(reactionsChannel);
    };
  }, [currentUserId, selectedConversation, markMessagesAsRead, onConversationsRefresh]);

  return { messages, otherUser, reactionsByMsg, markMessagesAsRead };
};
