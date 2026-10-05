import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TypingIndicatorProps {
  recipientId: string;
  currentUserId: string;
}

type RealtimeChannel = ReturnType<typeof supabase.channel>;
type Listener = (channel: RealtimeChannel) => void;

interface SharedTypingChannel {
  channel: RealtimeChannel;
  listeners: Set<Listener>;
  refs: number;
  subscribed: boolean;
  onSubscribed: Set<() => void>;
}

// One realtime channel per conversation, shared by the indicator and the
// sender hook. Supabase reuses channels by topic, so registering presence
// callbacks on a second instance after subscribe() throws and crashes Messages.
const sharedChannels = new Map<string, SharedTypingChannel>();

const acquireTypingChannel = (a: string, b: string): { name: string; entry: SharedTypingChannel } => {
  const name = `typing:${[a, b].sort().join("-")}`;
  let entry = sharedChannels.get(name);
  if (!entry) {
    const channel = supabase.channel(name);
    const created: SharedTypingChannel = {
      channel,
      listeners: new Set(),
      refs: 0,
      subscribed: false,
      onSubscribed: new Set(),
    };
    channel.on("presence", { event: "sync" }, () => {
      created.listeners.forEach((fn) => fn(channel));
    });
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        created.subscribed = true;
        created.onSubscribed.forEach((fn) => fn());
      }
    });
    entry = created;
    sharedChannels.set(name, entry);
  }
  entry.refs += 1;
  return { name, entry };
};

const releaseTypingChannel = (name: string) => {
  const entry = sharedChannels.get(name);
  if (!entry) return;
  entry.refs -= 1;
  if (entry.refs <= 0) {
    sharedChannels.delete(name);
    supabase.removeChannel(entry.channel);
  }
};

export const TypingIndicator = ({ recipientId, currentUserId }: TypingIndicatorProps) => {
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    if (!recipientId || !currentUserId) return;
    const { name, entry } = acquireTypingChannel(currentUserId, recipientId);
    const listener: Listener = (channel) => {
      const allPresences = Object.values(channel.presenceState()).flat();
      setIsTyping(
        allPresences.some((p: any) => p.userId === recipientId && p.typing)
      );
    };
    entry.listeners.add(listener);
    return () => {
      entry.listeners.delete(listener);
      releaseTypingChannel(name);
    };
  }, [recipientId, currentUserId]);

  if (!isTyping) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2">
      <div className="flex gap-1">
        <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:-0.3s]" />
        <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:-0.15s]" />
        <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" />
      </div>
      <span className="text-xs text-muted-foreground">typing...</span>
    </div>
  );
};

// Hook for sending typing status
export const useTypingStatus = (recipientId: string, currentUserId: string) => {
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!recipientId || !currentUserId) return;
    const { name, entry } = acquireTypingChannel(currentUserId, recipientId);
    const announce = () => {
      entry.channel.track({ userId: currentUserId, typing: false }).catch(() => {});
    };
    if (entry.subscribed) announce();
    else entry.onSubscribed.add(announce);
    setChannel(entry.channel);
    return () => {
      entry.onSubscribed.delete(announce);
      setChannel(null);
      releaseTypingChannel(name);
    };
  }, [recipientId, currentUserId]);

  const setTyping = async (typing: boolean) => {
    if (channel) {
      await channel.track({ userId: currentUserId, typing }).catch(() => {});
    }
  };

  return { setTyping };
};
