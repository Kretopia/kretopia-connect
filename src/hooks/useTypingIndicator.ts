import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TypingUser {
  user_id: string;
  full_name: string;
  ts: number;
}

interface BroadcastPayload {
  user_id: string;
  full_name: string;
}

/**
 * Lightweight typing indicator using Supabase Realtime broadcast.
 * Each "typing" event refreshes a TTL window. Users older than 4s expire.
 *
 * Channel name should be unique per surface (e.g. `chat-typing:<projectId>`).
 */
export const useTypingIndicator = (
  channelName: string | undefined,
  currentUser: { id: string; full_name: string } | null,
) => {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastSentRef = useRef(0);
  const sweepRef = useRef<number | null>(null);

  useEffect(() => {
    if (!channelName || !currentUser?.id) return;

    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const data = payload as BroadcastPayload;
        if (!data?.user_id || data.user_id === currentUser.id) return;
        setTypingUsers((prev) => {
          const next = prev.filter((t) => t.user_id !== data.user_id);
          next.push({ user_id: data.user_id, full_name: data.full_name, ts: Date.now() });
          return next;
        });
      })
      .subscribe();

    // Sweep expired typers every 1s
    sweepRef.current = window.setInterval(() => {
      const cutoff = Date.now() - 4000;
      setTypingUsers((prev) => prev.filter((t) => t.ts > cutoff));
    }, 1000);

    return () => {
      if (sweepRef.current) window.clearInterval(sweepRef.current);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [channelName, currentUser?.id, currentUser?.full_name]);

  /** Throttled — sends at most once per 1.5s while user keeps typing. */
  const notifyTyping = useCallback(() => {
    if (!channelRef.current || !currentUser) return;
    const now = Date.now();
    if (now - lastSentRef.current < 1500) return;
    lastSentRef.current = now;
    channelRef.current
      .send({
        type: "broadcast",
        event: "typing",
        payload: { user_id: currentUser.id, full_name: currentUser.full_name } satisfies BroadcastPayload,
      })
      .catch(() => {});
  }, [currentUser]);

  return { typingUsers, notifyTyping };
};
