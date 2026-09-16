import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * useTaggedCredits — counts unclaimed `discovered_credits` rows for a user.
 * These are credits the system has surfaced where the user's name appears
 * (web scrapes, project roll-calls, etc.) but they haven't approved them yet.
 *
 * Used by <PassportClaimHero /> to fire the "Your name appears in N credits.
 * Claim your Passport." wedge.
 */
export function useTaggedCredits(userId: string | null | undefined) {
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!userId) {
      setCount(0);
      return;
    }
    let cancelled = false;
    setLoading(true);

    (async () => {
      const { count: c } = await supabase
        .from("discovered_credits")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("approved_at", null)
        .is("dismissed_at", null);
      if (!cancelled) {
        setCount(c ?? 0);
        setLoading(false);
      }
    })().catch(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { count, loading };
}
