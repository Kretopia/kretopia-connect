import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Sparkles, ArrowRight, Users, Calendar } from "lucide-react";

/**
 * Home nudge inviting proven creators to start their own Circle.
 * Eligibility (any of):
 *   - 10+ accepted connections, OR
 *   - has hosted at least one event that received RSVPs
 * Hidden if the user already runs/owns a circle.
 */
interface Props {
  className?: string;
}

export function StartCircleNudgeCard({ className }: Props) {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [reason, setReason] = useState<"network" | "host">("network");

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    (async () => {
      // Skip if they already own/admin a circle
      const { count: ownedCount } = await supabase
        .from("spark_rooms")
        .select("id", { count: "exact", head: true })
        .eq("created_by", user.id);
      if (cancelled || (ownedCount ?? 0) > 0) return;

      const [connRes, hostedRes] = await Promise.all([
        supabase
          .from("connections")
          .select("id", { count: "exact", head: true })
          .or(`user_id.eq.${user.id},connected_user_id.eq.${user.id}`)
          .eq("status", "accepted"),
        supabase
          .from("creative_jams")
          .select("id")
          .eq("created_by", user.id)
          .limit(20),
      ]);

      const connCount = connRes.count ?? 0;
      const hostedIds = (hostedRes.data || []).map((e: any) => e.id);

      let hasHostedWithRsvps = false;
      if (hostedIds.length > 0) {
        const { count: rsvpCount } = await supabase
          .from("jam_participants")
          .select("id", { count: "exact", head: true })
          .in("jam_id", hostedIds);
        hasHostedWithRsvps = (rsvpCount ?? 0) > 0;
      }

      if (cancelled) return;
      if (connCount >= 10) {
        setReason("network");
        setShow(true);
      } else if (hasHostedWithRsvps) {
        setReason("host");
        setShow(true);
      }
    })();

    return () => { cancelled = true; };
  }, [user?.id]);

  if (!show) return null;

  const Icon = reason === "host" ? Calendar : Users;
  const headline = reason === "host"
    ? "Turn your event into a Crew"
    : "You've built a network. Build your Crew.";
  const sub = reason === "host"
    ? "Your attendees want to stay connected — give them a private home."
    : "Bring your collaborators together in an invite-only space.";

  return (
    <Link
      to="/crews"
      className={`group block relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-accent/5 p-4 hover:border-primary/60 transition-all ${className || ""}`}
    >
      <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-primary/15 blur-2xl pointer-events-none" />
      <div className="relative flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Sparkles className="h-3 w-3 text-accent" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-accent">
              You qualify
            </span>
          </div>
          <p className="font-bold text-sm leading-tight">{headline}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{sub}</p>
        </div>
        <ArrowRight className="h-4 w-4 text-primary mt-1 shrink-0 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </Link>
  );
}
