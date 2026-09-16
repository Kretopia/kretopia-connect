import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles,
  Receipt,
  Target,
  Users,
  UserCircle2,
  DollarSign,
  Check,
  X,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useSurfaceAgentWatch } from "@/hooks/useSurfaceAgentWatch";

type Surface = "home" | "scout" | "pay" | "passport";

interface AgentProposal {
  id: string;
  kind: string;
  title: string;
  body: string;
  action_intent: Record<string, any>;
  status: string;
}

interface Props {
  surface: Surface;
  className?: string;
  limit?: number;
}

const kindIcon: Record<string, React.ComponentType<{ className?: string }>> = {
  gig_match: Target,
  rate_optimize: DollarSign,
  frequent_collaborator: Users,
  passport_polish: UserCircle2,
  pay_cashflow: Receipt,
  home_focus: Sparkles,
};

/**
 * Cross-surface Thrive nudges (Home / Scout / Pay / Passport).
 * Subscribes to agent_proposals rows tagged with `surface`, auto-fires the
 * watcher edge function once per session, and renders the top N pending cards.
 */
export const SurfaceProactiveCards = ({ surface, className, limit = 2 }: Props) => {
  const navigate = useNavigate();
  const [proposals, setProposals] = useState<AgentProposal[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useSurfaceAgentWatch(surface);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: u } = await supabase.auth.getUser();
        if (cancelled) return;
        const uid = u.user?.id ?? null;
        setUserId(uid);
        if (!uid) return;
        const { data } = await supabase
          .from("agent_proposals")
          .select("id, kind, title, body, action_intent, status")
          .eq("owner_user_id", uid)
          .eq("surface", surface)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(limit);
        if (!cancelled) setProposals((data as AgentProposal[]) || []);
      } catch {
        /* silent */
      }
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [surface, limit]);

  // Realtime: pick up new proposals from the watcher
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`surface-proposals:${surface}:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "agent_proposals",
          filter: `owner_user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as AgentProposal & { surface?: string };
          if (row.surface === surface && row.status === "pending") {
            setProposals((prev) =>
              [row, ...prev.filter((p) => p.id !== row.id)].slice(0, limit),
            );
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, surface, limit]);

  const handleAccept = useCallback(
    async (p: AgentProposal) => {
      setBusyId(p.id);
      try {
        await supabase
          .from("agent_proposals")
          .update({ status: "accepted", accepted_at: new Date().toISOString() })
          .eq("id", p.id);
        setProposals((prev) => prev.filter((x) => x.id !== p.id));
        const href = typeof p.action_intent?.href === "string" ? p.action_intent.href : null;
        if (href) navigate(href);
      } catch {
        /* silent */
      } finally {
        setBusyId(null);
      }
    },
    [navigate],
  );

  const handleDismiss = useCallback(async (p: AgentProposal) => {
    setBusyId(p.id);
    try {
      await supabase
        .from("agent_proposals")
        .update({ status: "dismissed" })
        .eq("id", p.id);
      setProposals((prev) => prev.filter((x) => x.id !== p.id));
    } catch {
      /* silent */
    } finally {
      setBusyId(null);
    }
  }, []);

  if (proposals.length === 0) return null;

  return (
    <section className={cn("px-4 space-y-2.5", className)}>
      {proposals.map((p) => {
        const Icon = kindIcon[p.kind] ?? Sparkles;
        const cta = (p.action_intent?.cta as string) || "Open";
        return (
          <div
            key={p.id}
            className="relative overflow-hidden rounded-xl border border-primary/40 bg-gradient-to-br from-primary/12 via-primary/4 to-transparent p-3.5 flex items-start gap-3"
          >
            <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 bg-primary text-primary-foreground shadow-[var(--shadow-glow)]">
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.22em] mb-0.5 text-primary flex items-center gap-1">
                <Sparkles className="h-2.5 w-2.5" /> Kreto Suggests
              </p>
              <p className="text-sm font-bold leading-tight text-foreground">
                {p.title}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                {p.body}
              </p>
              <div className="flex items-center gap-1 mt-2 -ml-2">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busyId === p.id}
                  className="h-11 px-3 text-xs gap-1 text-foreground hover:bg-background/60 rounded-full font-semibold"
                  onClick={() => handleAccept(p)}
                >
                  <Check className="h-3 w-3" />
                  {cta}
                  <ArrowRight className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busyId === p.id}
                  className="h-11 px-3 text-xs gap-1 text-muted-foreground hover:bg-background/40 rounded-full"
                  onClick={() => handleDismiss(p)}
                  aria-label="Dismiss suggestion"
                >
                  <X className="h-3 w-3" />
                  Not now
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
};

export default SurfaceProactiveCards;
