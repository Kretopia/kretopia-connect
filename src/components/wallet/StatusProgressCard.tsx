import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { calculateStatus, type StatusResult } from "@/lib/statusEngine";
import { ThriveStatusCard } from "@/components/ThriveStatusCard";

export function StatusProgressCard() {
  const { user } = useAuth();
  const [status, setStatus] = useState<StatusResult | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const [
        creditsRes,
        connectionsRes,
        endorsementsRes,
        reviewsRes,
        awardsRes,
        pressRes,
      ] = await Promise.all([
        supabase
          .from("credits")
          .select("verification_status")
          .eq("user_id", user.id),
        supabase
          .from("connections")
          .select("id", { count: "exact", head: true })
          .or(`user_id.eq.${user.id},connected_user_id.eq.${user.id}`)
          .eq("status", "accepted"),
        supabase
          .from("credit_endorsements")
          .select("id", { count: "exact", head: true })
          .eq("requested_by", user.id)
          .eq("status", "accepted"),
        supabase
          .from("reviews")
          .select("rating")
          .eq("profile_id", user.id)
          .eq("status", "published"),
        supabase
          .from("awards")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
        supabase
          .from("press_links")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
      ]);

      const credits = creditsRes.data || [];
      let verifiedCredits = 0;
      for (const c of credits) {
        const s = (c.verification_status || "manual").toLowerCase();
        if (["enterprise", "peer", "verified", "ai", "identity"].includes(s)) {
          verifiedCredits++;
        }
      }

      const reviews = reviewsRes.data || [];
      const avgRating = reviews.length > 0
        ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length
        : 0;

      setStatus(calculateStatus({
        verifiedCredits,
        totalCredits: credits.length,
        completedProjects: 0,
        connections: connectionsRes.count || 0,
        acceptedInvites: endorsementsRes.count || 0,
        collaborations: 0,
        averageRating: avgRating,
        reviewCount: reviews.length,
        endorsementCount: endorsementsRes.count || 0,
        awardCount: awardsRes.count || 0,
        pressCount: pressRes.count || 0,
      }));
    };
    fetchData();
  }, [user]);

  if (!status) return null;

  return <ThriveStatusCard status={status} />;
}
