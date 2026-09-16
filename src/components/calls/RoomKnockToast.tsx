// Listens for incoming room knocks via Realtime and shows a one-tap toast.
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export const RoomKnockToast = () => {
  const { user } = useAuth();
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel(`knocks-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "room_knocks", filter: `owner_id=eq.${user.id}` },
        (payload) => {
          const k = payload.new as any;
          if (!k?.id || seen.current.has(k.id)) return;
          seen.current.add(k.id);
          toast(`${k.guest_name} is at your door`, {
            description: k.message || "Knocking on your room.",
            duration: 30_000,
            action: {
              label: "Let them in",
              onClick: async () => {
                try {
                  const { data, error } = await supabase.functions.invoke("accept-room-knock", {
                    body: { knock_id: k.id, action: "accept" },
                  });
                  if (error || data?.error) throw new Error(data?.error || error?.message);
                  if (data?.share_url) {
                    window.open(data.share_url, "_blank");
                  }
                } catch (e: any) {
                  toast.error("Couldn't open the room", { description: e?.message });
                }
              },
            },
            cancel: {
              label: "Decline",
              onClick: async () => {
                await supabase.functions.invoke("accept-room-knock", {
                  body: { knock_id: k.id, action: "decline" },
                }).catch(() => {});
              },
            },
          });
        },
      )
      .subscribe();

    return () => { void supabase.removeChannel(ch); };
  }, [user?.id]);

  return null;
};

export default RoomKnockToast;
