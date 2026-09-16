import { memo, useMemo, useState } from "react";
import {
  CheckSquare,
  MessageCircle,
  FileText,
  StickyNote,
  CheckCircle2,
  FileSignature,
  Wallet,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PROJECT_FLOW_STAGES, type ProjectFlow, type ProjectFlowStageId } from "@/hooks/useProjectFlow";



interface MobileProjectHubProps {
  flow: ProjectFlow;
  project: any;
  tasks: any[];
  messages: any[];
  files: any[];
  milestones: any[];
  noteCount: number;
  approvalPendingCount: number;
  contractCount: number;
  invoiceCount: number;
  invoicePaidCount: number;
  projectId: string;
  currentUserId: string;
  collaborators?: Array<{ id: string; full_name: string; avatar_url?: string | null }>;
  onTasksChanged?: () => void;
  onNavigateToTab: (tab: string, intent?: string) => void;
  onPinStage?: (stageId: ProjectFlowStageId | null) => void;
  onOpenCopilot?: () => void;
  isPro?: boolean;
}

/**
 * Mobile-only Project Hub: a single scrollable "app-like" view that
 * replaces the desktop tab grid. Shows stage timeline, persistent
 * Next Step, Money snapshot, and drill-in section cards.
 */
export const MobileProjectHub = memo((props: MobileProjectHubProps) => {
  const {
    flow,
    project,
    tasks,
    messages,
    files,
    milestones,
    noteCount,
    approvalPendingCount,
    contractCount,
    invoiceCount,
    invoicePaidCount,
    projectId,
    currentUserId,
    collaborators = [],
    onTasksChanged,
    onNavigateToTab,
    onPinStage,
    onOpenCopilot,
    isPro = false,
  } = props;


  const openTasks = useMemo(() => tasks.filter((t) => t.status !== "done").length, [tasks]);
  const doneTasks = tasks.length - openTasks;
  const currency = project?.currency || "USD";
  const budget = Number(project?.budget || 0);
  const paidPct = invoiceCount > 0 ? Math.round((invoicePaidCount / invoiceCount) * 100) : 0;

  const formatMoney = (n: number) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(n);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto relative">
      <div className="px-4 pt-3 pb-32 space-y-4">
        {/* === Stage strip (horizontal scroll) === */}
        <section>
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-bold text-foreground">Project Flow</span>
              <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                {flow.completionPct}% complete
              </span>
            </div>
            {onPinStage && (
              <button
                className="text-xs font-semibold text-primary px-2 py-1 -mr-2 active:opacity-60"
                onClick={() => onPinStage(flow.isPinned ? null : flow.currentStageId)}
              >
                {flow.isPinned ? "Unpin" : "Pin stage"}
              </button>
            )}
          </div>
          <div className="relative -mx-4">
            <div className="px-4 overflow-x-auto scrollbar-none">
              <div className="flex items-center gap-1.5 min-w-max pb-1">
                {PROJECT_FLOW_STAGES.map((stage) => {
                  const status = flow.stageStatus[stage.id];
                  return (
                    <button
                      key={stage.id}
                      onClick={() => onNavigateToTab(stage.tab)}
                      className={cn(
                        "px-3 h-8 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors",
                        status === "complete" &&
                          "bg-primary/15 border-primary/30 text-primary",
                        status === "current" &&
                          "bg-primary text-primary-foreground border-primary shadow-sm",
                        status === "todo" &&
                          "bg-muted/40 border-border text-muted-foreground"
                      )}
                    >
                      {stage.short}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Right-edge fade signals more content */}
            <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent" />
          </div>
        </section>

        {/* === Next Step hero card === */}
        <section className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="h-7 w-7 rounded-lg bg-primary/20 flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
              Next Step
            </span>
          </div>
          <h2 className="text-base font-bold leading-snug">{flow.nextStep.title}</h2>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            {flow.nextStep.description}
          </p>
          <div className="flex items-center gap-2 mt-3">
            <Button
              size="sm"
              className="h-9 flex-1 text-xs font-semibold"
              onClick={() => onNavigateToTab(flow.nextStep.ctaTab, flow.nextStep.ctaIntent)}
            >
              {flow.nextStep.ctaLabel}
            </Button>
            {flow.nextStep.secondary && (
              <Button
                size="sm"
                variant="outline"
                className="h-9 text-xs"
                onClick={() =>
                  onNavigateToTab(flow.nextStep.secondary!.tab, flow.nextStep.secondary!.intent)
                }
              >
                {flow.nextStep.secondary.label}
              </Button>
            )}
          </div>
        </section>

        {/* === Money snapshot === */}
        <section
          className="rounded-2xl border border-border bg-card p-4 active:scale-[0.99] transition-transform cursor-pointer"
          onClick={() => onNavigateToTab("finance")}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Wallet className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Money
              </span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
          {budget > 0 ? (
            <>
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] text-muted-foreground">Budget</div>
                  <div className="text-lg font-bold truncate">{formatMoney(budget)}</div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-muted-foreground">Invoices paid</div>
                  <div className="text-lg font-bold">
                    {invoicePaidCount}/{invoiceCount || 0}
                  </div>
                </div>
              </div>
              {invoiceCount > 0 && (
                <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${paidPct}%` }}
                  />
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold">No budget yet</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Add one to track invoices and payments
                </div>
              </div>
              <span className="text-xs font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-full whitespace-nowrap">
                Set budget
              </span>
            </div>
          )}
        </section>

        {/* === Drill-in grid === */}
        <section>
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 px-1">
            Workspace
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <DrillCard
              icon={<CheckSquare className="h-4 w-4" />}
              label="Tasks"
              metric={openTasks > 0 ? `${openTasks} open` : `${doneTasks} done`}
              accent={openTasks > 0}
              onClick={() => onNavigateToTab("tasks")}
            />
            <DrillCard
              icon={<MessageCircle className="h-4 w-4" />}
              label="Chat"
              metric={messages.length > 0 ? `${messages.length} msgs` : "Start"}
              onClick={() => onNavigateToTab("messages")}
            />
            <DrillCard
              icon={<StickyNote className="h-4 w-4" />}
              label="The Pad"
              metric={noteCount > 0 ? `${noteCount}` : "Empty"}
              onClick={() => onNavigateToTab("notes")}
            />
            <DrillCard
              icon={<FileText className="h-4 w-4" />}
              label="The Vault"
              metric={files.length > 0 ? `${files.length}` : "Empty"}
              onClick={() => onNavigateToTab("vault")}
            />
            <DrillCard
              icon={<CheckCircle2 className="h-4 w-4" />}
              label="Approvals"
              metric={approvalPendingCount > 0 ? `${approvalPendingCount} pending` : "—"}
              accent={approvalPendingCount > 0}
              onClick={() => onNavigateToTab("approvals")}
            />
            <DrillCard
              icon={<FileSignature className="h-4 w-4" />}
              label="Contracts"
              metric={contractCount > 0 ? `${contractCount}` : "—"}
              onClick={() => onNavigateToTab("contracts")}
            />
          </div>
        </section>

        {/* === More tools === */}
        <section>
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 px-1">
            More
          </div>
          <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
            {[
              { tab: "scope", label: "Scope Guardian" },
              { tab: "board", label: "Creative Board" },
            ].map((item) => (
              <button
                key={item.tab}
                onClick={() => onNavigateToTab(item.tab)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium active:bg-muted/40"
              >
                <span>{item.label}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
});

MobileProjectHub.displayName = "MobileProjectHub";

interface DrillCardProps {
  icon: React.ReactNode;
  label: string;
  metric: string;
  accent?: boolean;
  onClick: () => void;
}

const DrillCard = ({ icon, label, metric, accent, onClick }: DrillCardProps) => (
  <button
    onClick={onClick}
    className={cn(
      "rounded-2xl border bg-card p-3 text-left active:scale-[0.97] transition-transform",
      accent ? "border-primary/40" : "border-border"
    )}
  >
    <div
      className={cn(
        "h-7 w-7 rounded-lg flex items-center justify-center mb-2",
        accent ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
      )}
    >
      {icon}
    </div>
    <div className="text-sm font-semibold">{label}</div>
    <div
      className={cn(
        "text-[11px] mt-0.5",
        accent ? "text-primary font-medium" : "text-muted-foreground"
      )}
    >
      {metric}
    </div>
  </button>
);
