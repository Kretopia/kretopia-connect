import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PresenceMeta {
  user_id: string;
  full_name: string;
  avatar_url?: string | null;
  online_at: string;
}

interface KnockPayload {
  from_user_id: string;
  from_name: string;
  to_user_id: string;
  message?: string;
}

/**
 * Live presence + "knock to ping" for a Studio Room.
 * - Tracks who is currently viewing the project room.
 * - Lets one collaborator "knock" another via realtime broadcast.
 *   Recipient sees a toast (and the sender gets a sent-confirmation).
 */
export const useStudioPresence = (
  projectId: string | undefined,
  currentUser: { id: string; full_name: string; avatar_url?: string | null } | null,
) => {
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!projectId || !currentUser?.id) return;

    const channel = supabase.channel(`studio-room:${projectId}`, {
      config: { presence: { key: currentUser.id } },
    });
    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresenceMeta>();
        setOnlineUserIds(new Set(Object.keys(state)));
      })
      .on("broadcast", { event: "knock" }, ({ payload }) => {
        const data = payload as KnockPayload;
        // Only show toast if it's directed at me
        if (data.to_user_id !== currentUser.id) return;
        toast({
          title: `👋 ${data.from_name} knocked`,
          description: data.message || "They want your attention in this project.",
        });
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: currentUser.id,
            full_name: currentUser.full_name,
            avatar_url: currentUser.avatar_url ?? null,
            online_at: new Date().toISOString(),
          } satisfies PresenceMeta);
        }
      });

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [projectId, currentUser?.id, currentUser?.full_name, currentUser?.avatar_url, toast]);

  const knock = useCallback(
    async (toUserId: string, toName: string) => {
      if (!channelRef.current || !currentUser) return;
      await channelRef.current.send({
        type: "broadcast",
        event: "knock",
        payload: {
          from_user_id: currentUser.id,
          from_name: currentUser.full_name,
          to_user_id: toUserId,
          message: `${currentUser.full_name} is in the room and wants to chat.`,
        } satisfies KnockPayload,
      });
      toast({ title: `Knocked ${toName.split(" ")[0]} 👋`, description: "They'll see it if they're online." });
    },
    [currentUser, toast],
  );

  return { onlineUserIds, knock };
};
