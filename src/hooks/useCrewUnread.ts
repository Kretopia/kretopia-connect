import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Aggregate unread post count across all Crews the user belongs to.
 * Drives the hamburger "Crews" badge.
 */
export function useCrewUnread() {
  const { user } = useAuth();
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!user) {
      setTotal(0);
      return;
    }
    let cancelled = false;

    const load = async () => {
      try {
        const { data, error } = await supabase.rpc("get_my_crew_unread");
        if (cancelled) return;
        if (error) {
          console.warn("[useCrewUnread]", error);
          setTotal(0);
          return;
        }
        const sum = (data ?? []).reduce(
          (acc: number, row: any) => acc + Number(row.unread_count ?? 0),
          0,
        );
        setTotal(sum);
      } catch (err) {
        console.warn("[useCrewUnread]", err);
      }
    };

    load();

    // Re-poll when any community_posts row changes
    const channel = supabase
      .channel(`crew-unread-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "community_posts" },
        () => load(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return {
    total,
    badge: total > 0 ? (total > 99 ? "99+" : String(total)) : undefined,
  };
}
