import { useEffect, useState } from "react";
import { Milestone, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

interface MilestoneRow {
  id: string;
  title: string;
  // undefined when the viewer isn't authorized to see this milestone's
  // amount (client/guest role) -- see get_project_milestone_financials.
  amount: number | undefined;
  status: string;
  due_date: string | null;
}

interface Props {
  projectId: string;
  currency?: string | null;
  onOpenFinance: () => void;
}

const STATUS_STYLE: Record<string, string> = {
  paid: "bg-[hsl(var(--signal-teal))]/15 text-[hsl(var(--signal-teal))] border-[hsl(var(--signal-teal))]/30",
  completed: "bg-[hsl(var(--signal-teal))]/15 text-[hsl(var(--signal-teal))] border-[hsl(var(--signal-teal))]/30",
  requested: "bg-energy/15 text-energy border-energy/30",
  pending: "bg-muted text-muted-foreground border-border",
};

const fmt = (n: number, ccy: string | null | undefined) => {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: (ccy || "USD").toUpperCase(),
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${ccy || "$"} ${n.toLocaleString()}`;
  }
};

/**
 * Compact milestone preview for the Studio Today view. Milestones already
 * have a full management surface (MilestoneBoard, inside the Finance tab)
 * -- this doesn't duplicate that, it's a read-only "what state is the
 * project's payment schedule in" glance with a link to the real thing.
 */
export const MilestoneStrip = ({ projectId, currency, onOpenFinance }: Props) => {
  const [rows, setRows] = useState<MilestoneRow[]>([]);
  const [loading, setLoading] = useState(true);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // amount is no longer selectable directly as of
      // 20260825100000_studio_role_based_money_rls.sql -- fetched
      // separately via get_project_milestone_financials (owner/creative/
      // collaborator only, not client/guest) and merged in below. A
      // milestone this viewer isn't authorized to see the amount for
      // keeps amount undefined, guarded at render time rather than faked.
      const [milestonesRes, financialsRes] = await Promise.all([
        supabase
          .from("milestones")
          .select("id, title, status, due_date")
          .eq("project_id", projectId)
          .order("created_at", { ascending: true }),
        supabase.rpc("get_project_milestone_financials" as any, { _project_id: projectId }),
      ]);
      const amountByMilestoneId = new Map(
        ((financialsRes.data as any[]) || []).map((f) => [f.milestone_id, f.amount])
      );
      const merged = (milestonesRes.data ?? []).map((m: any) => ({
        ...m,
        amount: amountByMilestoneId.get(m.id),
      }));
      if (!cancelled) {
        setRows(merged as MilestoneRow[]);
        setLoading(false);
      }
    })().catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId]);

  if (loading || rows.length === 0) return null;

  const paidCount = rows.filter((m) => m.status === "paid" || m.status === "completed").length;

  return (
    <section className="px-4 py-5 space-y-3">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[hsl(var(--energy))]">
            Payment schedule
          </p>
          <h2 className="text-lg font-black leading-none tracking-tight flex items-center gap-2">
            <Milestone className="h-4 w-4 text-muted-foreground" />
            Milestones
          </h2>
        </div>
        <button
          type="button"
          onClick={onOpenFinance}
          className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors tabular-nums"
        >
          {paidCount}/{rows.length} paid
          <ArrowRight className="h-3 w-3" />
        </button>
      </header>
      <Carousel opts={{ align: "start", dragFree: true, duration: reducedMotion ? 0 : 20 }} className="w-full" aria-label="Milestones">
        <CarouselContent className="-ml-2">
          {rows.map((m) => (
            <CarouselItem key={m.id} className="pl-2 basis-auto">
              <button
                type="button"
                onClick={onOpenFinance}
                className="btn-glass btn-glass-outline text-left rounded-lg px-3 py-2 w-44"
              >
                <p className="text-sm font-medium truncate">{m.title}</p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground tabular-nums">{m.amount === undefined ? "—" : fmt(m.amount, currency)}</span>
                  <Badge variant="outline" className={cn("h-4 text-[9px] px-1.5 capitalize shrink-0", STATUS_STYLE[m.status] || STATUS_STYLE.pending)}>
                    {m.status}
                  </Badge>
                </div>
              </button>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </section>
  );
};

export default MilestoneStrip;
