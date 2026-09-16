import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Receipt,
  FileText,
  PartyPopper,
  ArrowRight,
  HandCoins,
  Sparkles,
  Clock,
  Flag,
  X,
  Check,
  MessageCircle,
  PackageCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AgentProposal {
  id: string;
  kind:
    | "draft_invoice"
    | "schedule_followup"
    | "next_milestone"
    | "wrap_project"
    | "collab_nudge"
    | "other";
  title: string;
  body: string;
  action_intent: Record<string, any>;
  status: string;
}

interface ProactiveCardsProps {
  project: any;
  tasks: any[];
  onAction: (tab: string, intent?: string) => void;
  className?: string;
}

interface NudgeCard {
  id: string;
  tone: "warn" | "money" | "info" | "celebrate";
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  ctaLabel: string;
  ctaTab: string;
  ctaIntent?: string;
}

/**
 * Proactive nudge cards injected near the top of the Studio feed.
 * Pure client-side derivation from existing project data — no edge fns.
 * Each card surfaces ONE concrete next action.
 */
export const ProactiveCards = ({
  project,
  tasks,
  onAction,
  className,
}: ProactiveCardsProps) => {
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [paymentRequests, setPaymentRequests] = useState<any[]>([]);
  const [aiProposals, setAiProposals] = useState<AgentProposal[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!project?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const [invRes, pmtRes, propRes] = await Promise.all([
          supabase.from("invoices").select("id, status").eq("project_id", project.id),
          supabase
            .from("milestones")
            .select("id, title, amount, status, requested_by")
            .eq("project_id", project.id)
            .eq("status", "requested"),
          supabase
            .from("agent_proposals")
            .select("id, kind, title, body, action_intent, status")
            .eq("project_id", project.id)
            .eq("status", "pending")
            .order("created_at", { ascending: false })
            .limit(2),
        ]);
        if (!cancelled) {
          setInvoices(invRes.data || []);
          setPaymentRequests(pmtRes.data || []);
          setAiProposals((propRes.data as AgentProposal[]) || []);
        }
      } catch {
        // silent — proactive cards are non-critical
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [project?.id]);

  // Realtime: pick up new AI proposals as the watcher inserts them
  useEffect(() => {
    if (!project?.id) return;
    const ch = supabase
      .channel(`proposals:${project.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "agent_proposals",
          filter: `project_id=eq.${project.id}`,
        },
        (payload) => {
          const row = payload.new as AgentProposal;
          if (row.status === "pending") {
            setAiProposals((prev) =>
              [row, ...prev.filter((p) => p.id !== row.id)].slice(0, 2),
            );
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [project?.id]);

  const handleAccept = useCallback(
    async (p: AgentProposal) => {
      setBusyId(p.id);
      try {
        const kindMap: Record<string, { tab: string; intent?: string }> = {
          draft_invoice: { tab: "finance", intent: "create-invoice" },
          schedule_followup: { tab: "tasks", intent: "create-task" },
          next_milestone: { tab: "tasks", intent: "create-task" },
          wrap_project: { tab: "wrap" },
          collab_nudge: { tab: "messages" },
          other: { tab: "brief" },
        };
        const target = kindMap[p.kind] ?? { tab: "brief" };
        await supabase
          .from("agent_proposals")
          .update({ status: "accepted", accepted_at: new Date().toISOString() })
          .eq("id", p.id);
        setAiProposals((prev) => prev.filter((x) => x.id !== p.id));
        onAction(target.tab, target.intent);
      } catch (e: any) {
        toast({
          title: "Couldn't accept",
          description: e?.message ?? "Try again",
          variant: "destructive",
        });
      } finally {
        setBusyId(null);
      }
    },
    [onAction, toast],
  );

  const handleDismiss = useCallback(async (p: AgentProposal) => {
    setBusyId(p.id);
    try {
      await supabase
        .from("agent_proposals")
        .update({ status: "dismissed" })
        .eq("id", p.id);
      setAiProposals((prev) => prev.filter((x) => x.id !== p.id));
    } catch {
      /* silent */
    } finally {
      setBusyId(null);
    }
  }, []);

  const cards = useMemo<NudgeCard[]>(() => {
    const out: NudgeCard[] = [];
    const open = (tasks || []).filter((t) => t.status !== "done");
    const done = (tasks || []).filter((t) => t.status === "done");
    const overdue = open.filter(
      (t) => t.due_date && new Date(t.due_date) < new Date(),
    );

    // 0. Collaborator payment request waiting for owner approval (highest priority)
    if (paymentRequests.length > 0) {
      const first = paymentRequests[0];
      out.push({
        id: "pay-request",
        tone: "money",
        icon: HandCoins,
        title:
          paymentRequests.length === 1
            ? `Payment request: ${first.title || "Untitled"}`
            : `${paymentRequests.length} payment requests waiting`,
        body:
          paymentRequests.length === 1
            ? `A collaborator submitted a request${first.amount ? ` for ${first.amount}` : ""}. Approve & invoice.`
            : "Collaborators submitted payment requests. Review and approve.",
        ctaLabel: "Review request",
        ctaTab: "finance",
        ctaIntent: "review-payment-requests",
      });
    }

    // 1. Overdue tasks
    if (overdue.length > 0) {
      out.push({
        id: "overdue",
        tone: "warn",
        icon: AlertTriangle,
        title: `${overdue.length} task${overdue.length > 1 ? "s" : ""} overdue`,
        body:
          overdue.length === 1
            ? `"${overdue[0].title}" is past due. Reschedule or mark done.`
            : "A few items slipped past their date. Tap to triage.",
        ctaLabel: "Triage now",
        ctaTab: "tasks",
      });
    }

    // 2. Missing brief
    const hasBrief =
      !!project?.description?.trim() ||
      !!project?.brief?.trim?.() ||
      !!project?.metadata?.brief;
    if (!hasBrief && open.length > 0) {
      out.push({
        id: "no-brief",
        tone: "info",
        icon: FileText,
        title: "No brief yet",
        body: "A 1-line brief helps everyone aim at the same target.",
        ctaLabel: "Write brief",
        ctaTab: "brief",
      });
    }

    // 3. Unsent invoice — project has client but no invoices
    const hasClient = !!project?.client_user_id || !!project?.client_name;
    const drafts = invoices.filter((i) => i.status === "draft");
    if (hasClient && invoices.length === 0 && done.length >= 1) {
      out.push({
        id: "no-invoice",
        tone: "money",
        icon: Receipt,
        title: "Time to bill?",
        body: "You've delivered work but no invoice exists for this project yet.",
        ctaLabel: "Send invoice",
        ctaTab: "finance",
        ctaIntent: "create-invoice",
      });
    } else if (drafts.length > 0) {
      out.push({
        id: "draft-invoice",
        tone: "money",
        icon: Receipt,
        title: `${drafts.length} draft invoice${drafts.length > 1 ? "s" : ""} waiting`,
        body: "You drafted but didn't send. One tap to review and send.",
        ctaLabel: "Review draft",
        ctaTab: "finance",
      });
    }

    // 4. Project almost complete
    const total = tasks.length;
    if (total >= 3 && open.length <= 1 && project?.status !== "completed") {
      out.push({
        id: "almost-done",
        tone: "celebrate",
        icon: PartyPopper,
        title: "You're nearly done",
        body:
          open.length === 0
            ? "All tasks complete. Wrap it up — log a credit and mark complete."
            : "Just one task left. Push through and close it out.",
        ctaLabel: "Wrap up",
        ctaTab: open.length === 0 ? "credits" : "tasks",
      });
    }

    return out.slice(0, 2); // never overwhelm — show top 2
  }, [project, tasks, invoices, paymentRequests]);

  const kindIcon: Record<string, React.ComponentType<{ className?: string }>> = {
    draft_invoice: Receipt,
    schedule_followup: Clock,
    next_milestone: Flag,
    wrap_project: PackageCheck,
    collab_nudge: MessageCircle,
    other: Sparkles,
  };
  const kindCta: Record<string, string> = {
    draft_invoice: "Draft invoice",
    schedule_followup: "Schedule it",
    next_milestone: "Add next step",
    wrap_project: "Wrap project",
    collab_nudge: "Open chat",
    other: "Take action",
  };

  if (cards.length === 0 && aiProposals.length === 0) return null;

  const toneClasses: Record<NudgeCard["tone"], string> = {
    warn: "border-destructive/40 bg-gradient-to-br from-destructive/10 to-transparent",
    money: "border-[hsl(var(--energy)/0.45)] bg-gradient-to-br from-[hsl(var(--energy)/0.08)] to-transparent",
    info: "border-primary/30 bg-gradient-to-br from-primary/8 to-transparent",
    celebrate: "border-primary/45 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent",
  };
  const iconBgClasses: Record<NudgeCard["tone"], string> = {
    warn: "bg-destructive text-destructive-foreground shadow-[0_0_14px_hsl(var(--destructive)/0.4)]",
    money: "bg-[hsl(var(--energy))] text-[hsl(var(--energy-foreground))] shadow-[0_0_14px_hsl(var(--energy)/0.5)]",
    info: "bg-primary/15 text-primary",
    celebrate: "bg-primary text-primary-foreground shadow-[var(--shadow-glow)]",
  };
  const eyebrowText: Record<NudgeCard["tone"], string> = {
    warn: "Heads Up",
    money: "Money Move",
    info: "Quick Tip",
    celebrate: "Almost There",
  };
  const eyebrowColor: Record<NudgeCard["tone"], string> = {
    warn: "text-destructive",
    money: "text-[hsl(var(--energy))]",
    info: "text-primary",
    celebrate: "text-primary",
  };

  return (
    <section className={cn("px-4 pt-3 pb-1 space-y-2.5", className)}>
      {/* Thrive proactive proposals (AI) */}
      {aiProposals.map((p) => {
        const Icon = kindIcon[p.kind] ?? Sparkles;
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
                  className="h-7 px-2 text-xs gap-1 text-foreground hover:bg-background/60 rounded-full font-semibold"
                  onClick={() => handleAccept(p)}
                >
                  <Check className="h-3 w-3" />
                  {kindCta[p.kind] ?? "Take action"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busyId === p.id}
                  className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:bg-background/40 rounded-full"
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

      {/* Heuristic cards */}
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div
            key={c.id}
            className={cn(
              "relative overflow-hidden rounded-xl border p-3.5 flex items-start gap-3 transition-all",
              toneClasses[c.tone],
            )}
          >
            <div
              className={cn(
                "h-9 w-9 rounded-xl flex items-center justify-center shrink-0",
                iconBgClasses[c.tone],
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p
                className={cn(
                  "text-[9px] font-bold uppercase tracking-[0.22em] mb-0.5",
                  eyebrowColor[c.tone],
                )}
              >
                {eyebrowText[c.tone]}
              </p>
              <p className="text-sm font-bold leading-tight text-foreground">
                {c.title}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                {c.body}
              </p>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 mt-2 -ml-2 text-xs gap-1 text-foreground hover:bg-background/60 rounded-full font-semibold"
                onClick={() => onAction(c.ctaTab, c.ctaIntent)}
              >
                {c.ctaLabel}
                <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        );
      })}
    </section>
  );
};
