import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TypingIndicatorProps {
  recipientId: string;
  currentUserId: string;
}

export const TypingIndicator = ({ recipientId, currentUserId }: TypingIndicatorProps) => {
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    // Subscribe to presence channel for typing indicators
    const channel = supabase.channel(`typing:${[currentUserId, recipientId].sort().join('-')}`)
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const allPresences = Object.values(state).flat();
        const recipientTyping = allPresences.some(
          (presence: any) => presence.userId === recipientId && presence.typing
        );
        setIsTyping(recipientTyping);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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
  const [channel, setChannel] = useState<ReturnType<typeof supabase.channel> | null>(null);
  
  useEffect(() => {
    if (!recipientId || !currentUserId) return;
    
    const channelName = `typing:${[currentUserId, recipientId].sort().join('-')}`;
    const ch = supabase.channel(channelName);
    
    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await ch.track({ userId: currentUserId, typing: false });
      }
    });
    
    setChannel(ch);
    
    return () => {
      supabase.removeChannel(ch);
    };
  }, [recipientId, currentUserId]);
  
  const setTyping = async (typing: boolean) => {
    if (channel) {
      await channel.track({ userId: currentUserId, typing });
    }
  };
  
  return { setTyping };
};
