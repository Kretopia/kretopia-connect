import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook to track which users are currently online via Supabase Presence.
 * Subscribe once at the Messages page level and pass the set down.
 */
export const useOnlinePresence = (currentUserId: string) => {
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase.channel("online-users", {
      config: { presence: { key: currentUserId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const ids = new Set(Object.keys(state));
        setOnlineUsers(ids);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  return onlineUsers;
};

/** Small green dot for online status */
export const OnlineDot = ({ isOnline }: { isOnline: boolean }) => {
  if (!isOnline) return null;
  return (
    <span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full bg-green-500 ring-2 ring-background" />
  );
};
