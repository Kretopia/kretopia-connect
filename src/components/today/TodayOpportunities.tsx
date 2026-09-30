import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Bell, Calendar, Check, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { TodaySectionShell } from "@/components/home/TodaySectionShell";
import { ScoutedGigsSection } from "@/components/opportunity/ScoutedGigsSection";
import { UpcomingSessionsCard } from "@/components/home/UpcomingSessionsCard";
import { GetStartedChecklist } from "@/components/onboarding/GetStartedChecklist";
import { DuplicateAccountBanner } from "@/components/account/DuplicateAccountBanner";
import { completeTask, snoozeTaskToTomorrow } from "./today.actions";
import type { OpportunityTab, TodaySignals } from "./today.types";

interface TodayOpportunitiesProps {
  signals: TodaySignals;
  onSignalsChanged: () => void;
  peopleForYou?: ReactNode;
  showOnboardingChecklist?: boolean;
}

/**
 * TodayOpportunities — "what happens next", as one unified stream behind a
 * compact segmented control (For you / Calls / People / Studio).
 * The primary action is owned by TodayCommandCenter, so it is not repeated here.
 */
export function TodayOpportunities({ signals, onSignalsChanged, peopleForYou, showOnboardingChecklist }: TodayOpportunitiesProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const reducedMotion = useReducedMotion();
  const [tab, setTab] = useState<OpportunityTab>("for-you");
  const [busyId, setBusyId] = useState<string | null>(null);
  const { deadlines } = signals;

  const tabs: Array<{ key: OpportunityTab; label: string; count?: number }> = [
    { key: "for-you", label: "For you" },
    { key: "calls", label: "Calls" },
    { key: "people", label: "People" },
    { key: "studio", label: "Studio", count: deadlines.filter((d) => d.id !== (signals.priority.kind === "task" ? signals.priority.task.id : null)).length || undefined },
  ];

  const handleCompleteDeadline = async (id: string, title: string) => {
    setBusyId(id);
    try {
      await completeTask(id);
      toast({ title: "Marked complete", description: title });
      onSignalsChanged();
    } catch {
      toast({ title: "Couldn't complete that task", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };
  const handleSnoozeDeadline = async (id: string) => {
    setBusyId(id);
    try {
      await snoozeTaskToTomorrow(id);
      toast({ title: "Snoozed to tomorrow" });
      onSignalsChanged();
    } catch {
      toast({ title: "Couldn't snooze that task", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const deadlineRow = (d: TodaySignals["deadlines"][number]) => (
    <motion.div
      key={d.id}
      initial={reducedMotion ? false : { opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        "flex items-center gap-3 rounded-xl border px-3 py-2.5",
        d.overdue ? "border-destructive/30 bg-destructive/[0.03]" : "border-border bg-background/60",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground truncate">{d.title}</p>
        <p className="text-[11px] text-muted-foreground truncate">
          {d.projectTitle} · {d.overdue ? "Overdue" : new Date(d.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button size="sm" variant="ghost" disabled={busyId === d.id} onClick={() => handleCompleteDeadline(d.id, d.title)} aria-label={`Mark ${d.title} complete`} className="h-8 w-8 p-0">
          <Check className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="ghost" disabled={busyId === d.id} onClick={() => handleSnoozeDeadline(d.id)} aria-label={`Snooze ${d.title}`} className="h-8 w-8 p-0">
          <Bell className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => navigate(`/desk/${d.projectId}`)} aria-label={`Open ${d.projectTitle}`} className="h-8 w-8 p-0">
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );

  return (
    <TodaySectionShell icon={<LayoutGrid className="h-4 w-4" />} eyebrow="Explore" title="Beyond today">
      <div role="tablist" aria-label="Filter next moves" className="flex flex-wrap gap-1.5 mb-4">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-semibold transition-colors",
              tab === t.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70",
            )}
          >
            {t.label}
            {t.count ? <span className="ml-1 opacity-80">{t.count}</span> : null}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {tab === "for-you" && (
          <>
            {showOnboardingChecklist && <GetStartedChecklist />}
            {signals.momentum?.nextMilestone && (
              <p className="text-sm text-foreground">
                <span className="min-w-0 truncate">Next: {signals.momentum.nextMilestone.title} · {signals.momentum.nextMilestone.projectTitle}</span>
              </p>
            )}
            {!showOnboardingChecklist && !signals.momentum?.nextMilestone && <p className="text-sm text-muted-foreground">Nothing else needs your attention right now.</p>}
          </>
        )}

        {tab === "calls" && (
          <section className="space-y-4">
            <ScoutedGigsSection limit={6} />
          </section>
        )}

        {tab === "people" && (
          <section className="space-y-4">
            {peopleForYou ?? <p className="text-sm text-muted-foreground px-1">No new recommendations yet — Match learns from your Passport as it grows.</p>}
          </section>
        )}

        {tab === "studio" && (
          <section className="space-y-4">
            {deadlines.some((d) => d.id !== (signals.priority.kind === "task" ? signals.priority.task.id : null)) && (
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Upcoming deadlines
                </p>
                {deadlines.filter((d) => d.id !== (signals.priority.kind === "task" ? signals.priority.task.id : null)).map(deadlineRow)}
              </div>
            )}
            <UpcomingSessionsCard />
          </section>
        )}

        <DuplicateAccountBanner />
      </div>
    </TodaySectionShell>
  );
}

export default TodayOpportunities;
