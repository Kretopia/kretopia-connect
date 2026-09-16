import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { ShieldCheck, Users, MessageCircle, Sparkles, TrendingUp } from "lucide-react";

/**
 * Passport Momentum — the "last 30 days" pulse on a creator's Passport.
 * Shows real movement (stamps earned, co-signs, new connections, project
 * messages) so the creator sees the platform is *working* for them.
 *
 * Best-effort: every query is wrapped in .catch and missing tables/columns
 * fail silently.
 */

interface Momentum {
  stamps: number;     // verified credits earned in last 30d
  cosigns: number;    // approved reviews/vouches in last 30d
  connections: number; // new connections in last 30d
  messages: number;   // chat messages received in last 30d
}

const since30d = () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

interface PassportMomentumProps {
  userId?: string; // when provided, render public momentum for that user
}

export function PassportMomentum({ userId }: PassportMomentumProps = {}) {
  const { user } = useAuth();
  const targetId = userId || user?.id;
  const [m, setM] = useState<Momentum | null>(null);

  useEffect(() => {
    if (!targetId) return;
    let cancelled = false;
    const cutoff = since30d();

    const stampsP = (supabase as any)
      .from("credits")
      .select("id", { count: "exact", head: true })
      .eq("user_id", targetId)
      .eq("verification_status", "verified")
      .gte("created_at", cutoff)
      .then((r: any) => r.count || 0, () => 0);

    const cosignsP = (supabase as any)
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", targetId)
      .eq("status", "approved")
      .gte("created_at", cutoff)
      .then((r: any) => r.count || 0, () => 0);

    const connectionsP = (supabase as any)
      .from("connections")
      .select("id", { count: "exact", head: true })
      .or(`user_id.eq.${targetId},connected_user_id.eq.${targetId}`)
      .eq("status", "accepted")
      .gte("created_at", cutoff)
      .then((r: any) => r.count || 0, () => 0);

    const messagesP = (supabase as any)
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("receiver_id", targetId)
      .gte("created_at", cutoff)
      .then((r: any) => r.count || 0, () => 0);

    Promise.all([stampsP, cosignsP, connectionsP, messagesP])
      .then(([stamps, cosigns, connections, messages]) => {
        if (cancelled) return;
        setM({ stamps, cosigns, connections, messages });
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [targetId]);

  if (!m) return null;
  const total = m.stamps + m.cosigns + m.connections + m.messages;
  if (total === 0) return null; // stay calm when nothing happened

  const tiles: { label: string; value: number; Icon: typeof Sparkles; color: string }[] = [
    { label: "Stamps", value: m.stamps, Icon: ShieldCheck, color: "text-[hsl(var(--signal-teal))]" },
    { label: "Co-signs", value: m.cosigns, Icon: Sparkles, color: "text-[hsl(var(--signal-amber))]" },
    { label: "Connections", value: m.connections, Icon: Users, color: "text-[hsl(var(--signal-pink))]" },
    { label: "Messages", value: m.messages, Icon: MessageCircle, color: "text-foreground" },
  ];

  return (
    <Card className="p-4 bg-card/60 border-border/60">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="h-3.5 w-3.5 text-[hsl(var(--signal-teal))]" />
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Last 30 days
        </p>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {tiles.map(({ label, value, Icon, color }) => (
          <div key={label} className="text-center">
            <Icon className={`h-4 w-4 mx-auto mb-1 ${color}`} />
            <p className="text-lg font-black leading-none">{value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
