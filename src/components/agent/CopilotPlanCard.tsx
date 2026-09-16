import { useState, useEffect, useRef } from "react";
import { Check, X, Sparkles, Loader2, CircleDot, CircleCheck, CircleX, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { AgentResultCard } from "./AgentResultCard";
import { deriveResultCards } from "@/lib/agentResultCards";

export interface PlanStep {
  index: number;
  tool_name: string;
  label: string;
  rationale?: string;
  status: "pending" | "running" | "succeeded" | "failed" | "skipped";
  result?: unknown;
}

export interface CopilotPlan {
  id: string;
  goal: string;
  summary?: string | null;
  status: "proposed" | "approved" | "running" | "completed" | "failed" | "cancelled";
  steps: PlanStep[];
  /** When true, the card auto-approves and runs on mount (no user tap needed). */
  autoRun?: boolean;
}

interface Props {
  plan: CopilotPlan;
  onResolved?: (status: CopilotPlan["status"]) => void;
}

const statusIcon = (s: PlanStep["status"]) => {
  switch (s) {
    case "succeeded": return <CircleCheck className="h-3.5 w-3.5 text-primary" />;
    case "failed":    return <CircleX className="h-3.5 w-3.5 text-destructive" />;
    case "running":   return <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />;
    case "skipped":   return <Clock className="h-3.5 w-3.5 text-muted-foreground/50" />;
    default:          return <CircleDot className="h-3.5 w-3.5 text-muted-foreground" />;
  }
};

export const CopilotPlanCard = ({ plan: initial, onResolved }: Props) => {
  const [plan, setPlan] = useState<CopilotPlan>(initial);
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(initial.steps.map((s) => s.index))
  );
  const autoRanRef = useRef(false);
  const { toast } = useToast();

  // Auto-run on mount when caller marked the plan as autoRun (e.g. opened in
  // explicit "plan & execute" mode from the FAB). Skips the proposed-state UI
  // entirely so users see "Kreto is working" immediately.
  useEffect(() => {
    if (!autoRanRef.current && initial.autoRun && plan.status === "proposed") {
      autoRanRef.current = true;
      handle("approved");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll while running
  useEffect(() => {
    if (plan.status !== "running") return;
    const t = setInterval(async () => {
      try {
        const { data } = await supabase
          .from("copilot_plans")
          .select("id, goal, summary, status, steps")
          .eq("id", plan.id)
          .maybeSingle();
        if (data) {
          setPlan(data as unknown as CopilotPlan);
          if (data.status !== "running") {
            clearInterval(t);
            onResolved?.(data.status as CopilotPlan["status"]);
          }
        }
      } catch {
        /* swallow poll errors */
      }
    }, 1500);
    return () => clearInterval(t);
  }, [plan.status, plan.id, onResolved]);

  const handle = async (decision: "approved" | "rejected") => {
    setBusy(decision === "approved" ? "approve" : "reject");
    try {
      // Optimistic
      if (decision === "approved") {
        setPlan((p) => ({ ...p, status: "running" }));
      }
      const skipIndices = decision === "approved"
        ? plan.steps.filter((s) => !selected.has(s.index)).map((s) => s.index)
        : [];
      const { data, error } = await supabase.functions.invoke("copilot-executor", {
        body: { plan_id: plan.id, decision, skip_indices: skipIndices },
      });
      if (error) throw error;
      if (decision === "rejected") {
        setPlan((p) => ({ ...p, status: "cancelled" }));
        onResolved?.("cancelled");
      } else if (data) {
        setPlan((p) => ({ ...p, status: data.status, summary: data.summary, steps: data.steps ?? p.steps }));
        if (data.status === "completed") {
          toast({ title: "Plan completed", description: data.summary ?? "Done." });
        } else if (data.status === "failed") {
          toast({ title: "Plan stopped", description: data.summary ?? "A step failed.", variant: "destructive" });
        }
        onResolved?.(data.status);
      }
    } catch (e) {
      toast({
        title: "Couldn't run plan",
        description: e instanceof Error ? e.message : "Try again",
        variant: "destructive",
      });
      setPlan((p) => ({ ...p, status: "proposed" }));
    } finally {
      setBusy(null);
    }
  };

  const isProposed = plan.status === "proposed";
  const isRunning = plan.status === "running" || plan.status === "approved";
  const isTerminal = ["completed", "failed", "cancelled"].includes(plan.status);
  const resultCards = plan.status === "completed" ? deriveResultCards(plan.steps) : [];

  const headerLabel = isRunning
    ? "Kreto is working"
    : isProposed
      ? (plan.summary ?? "Multi-step plan")
      : (plan.summary ?? "Plan");

  return (
    <Card className="p-3 border-primary/30 bg-primary/5">
      <div className="flex items-start gap-3 mb-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15">
          {isRunning
            ? <Loader2 className="h-4 w-4 text-primary animate-spin" />
            : <Sparkles className="h-4 w-4 text-primary" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-sm font-semibold truncate text-primary">
              {headerLabel}
            </p>
            <Badge variant="outline" className="text-[10px] py-0 h-4 shrink-0">
              {plan.status === "proposed" ? `${plan.steps.length} steps` : plan.status}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">{plan.goal}</p>
        </div>
      </div>

      <ol className="space-y-1.5 ml-2 mb-3">
        {plan.steps.map((s) => {
          const checked = selected.has(s.index);
          const showCheckbox = isProposed;
          return (
            <li key={s.index} className="flex items-start gap-2 text-xs">
              {showCheckbox ? (
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) => {
                    setSelected((prev) => {
                      const next = new Set(prev);
                      if (v) next.add(s.index); else next.delete(s.index);
                      return next;
                    });
                  }}
                  className="mt-0.5 shrink-0"
                  aria-label={`Include step ${s.index}`}
                />
              ) : (
                <span className="mt-0.5 shrink-0">{statusIcon(s.status)}</span>
              )}
              <div className="min-w-0 flex-1">
                <p className={cn(
                  "leading-snug",
                  s.status === "skipped" && "text-muted-foreground/60 line-through",
                  s.status === "failed" && "text-destructive",
                  showCheckbox && !checked && "text-muted-foreground/60 line-through",
                )}>
                  <span className="font-medium">{s.index}.</span> {s.label}
                </p>
                {s.rationale && isProposed && (
                  <p className="text-muted-foreground/80 text-[11px] leading-snug">{s.rationale}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {isProposed && (
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            className="h-8"
            onClick={() => handle("approved")}
            disabled={busy !== null || selected.size === 0}
          >
            {busy === "approve" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Run {selected.size}/{plan.steps.length}
          </Button>
          <Button size="sm" variant="ghost" className="h-8" onClick={() => handle("rejected")} disabled={busy !== null}>
            {busy === "reject" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
            Cancel
          </Button>
          {selected.size < plan.steps.length && (
            <button
              type="button"
              className="text-[11px] text-muted-foreground hover:text-foreground underline"
              onClick={() => setSelected(new Set(plan.steps.map((s) => s.index)))}
            >
              Select all
            </button>
          )}
        </div>
      )}

      {isTerminal && plan.summary && (
        <p className={cn(
          "text-xs mt-1",
          plan.status === "completed" && "text-primary",
          plan.status === "failed" && "text-destructive",
          plan.status === "cancelled" && "text-muted-foreground",
        )}>
          {plan.summary}
        </p>
      )}

      {resultCards.length > 0 && (
        <div className="space-y-2 mt-3">
          {resultCards.map((c) => (
            <AgentResultCard key={c.id} card={c} compact />
          ))}
        </div>
      )}
    </Card>
  );
};
