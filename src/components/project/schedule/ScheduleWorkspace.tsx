import { CalendarClock, CheckSquare, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { isOverdue, isDueToday } from "@/components/project/tasks/taskUtils";
import { cn } from "@/lib/utils";

interface ScheduleTask {
  id: string;
  title: string;
  due_date: string | null;
  status: string | null;
}

interface ScheduleMilestone {
  id: string;
  title: string;
  due_date: string | null;
  status: string | null;
}

interface ScheduleWorkspaceProps {
  tasks: ScheduleTask[];
  milestones: ScheduleMilestone[];
  onNavigateToTab: (tab: string) => void;
}

type ScheduleItem = {
  id: string;
  title: string;
  due_date: string;
  kind: "task" | "milestone";
};

const DONE_STATUSES = new Set(["done", "completed", "paid"]);

/**
 * Schedule -- CPO Studio spec's 5th primary Work Room destination
 * (commitments, holds, deadlines, rehearsals, calls, programme items).
 * v1 scope: real upcoming dates already tracked on this Work Room (task
 * and milestone due dates) -- universally available regardless of
 * workspace type, unlike call sheets/run-of-show which only exist for
 * production-type workspaces. Those stay reachable from their own tabs;
 * folding them in here is a natural follow-up once this lands.
 */
export function ScheduleWorkspace({ tasks, milestones, onNavigateToTab }: ScheduleWorkspaceProps) {
  const items: ScheduleItem[] = [
    ...tasks
      .filter((t) => t.due_date && !DONE_STATUSES.has(t.status || ""))
      .map((t) => ({ id: t.id, title: t.title, due_date: t.due_date!, kind: "task" as const })),
    ...milestones
      .filter((m) => m.due_date && !DONE_STATUSES.has(m.status || ""))
      .map((m) => ({ id: m.id, title: m.title, due_date: m.due_date!, kind: "milestone" as const })),
  ].sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

  if (items.length === 0) {
    return (
      <EmptyState
        icon={CalendarClock}
        title="Nothing scheduled yet"
        description="Task due dates and payment milestones will line up here as you add them."
      />
    );
  }

  const overdue = items.filter((i) => isOverdue(i.due_date));
  const today = items.filter((i) => !isOverdue(i.due_date) && isDueToday(i.due_date));
  const upcoming = items.filter((i) => !isOverdue(i.due_date) && !isDueToday(i.due_date));

  const groups: { label: string; items: ScheduleItem[]; tone?: string }[] = [
    { label: "Overdue", items: overdue, tone: "text-destructive" },
    { label: "Today", items: today, tone: "text-primary" },
    { label: "Upcoming", items: upcoming },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.label}>
          <h3 className={cn("mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground", group.tone)}>
            {group.label}
          </h3>
          <div className="space-y-1.5">
            {group.items.map((item) => (
              <button
                key={`${item.kind}-${item.id}`}
                type="button"
                onClick={() => onNavigateToTab(item.kind === "task" ? "tasks" : "finance")}
                className="flex w-full items-center gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                {item.kind === "task" ? (
                  <CheckSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <Wallet className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <span className="flex-1 truncate text-sm font-medium text-foreground">{item.title}</span>
                <Badge variant="outline" className="shrink-0 text-[10px]">
                  {new Date(item.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </Badge>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default ScheduleWorkspace;
