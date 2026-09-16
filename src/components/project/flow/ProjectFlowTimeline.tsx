import { memo } from "react";
import { Check, Pin, PinOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PROJECT_FLOW_STAGES, type ProjectFlow, type ProjectFlowStageId } from "@/hooks/useProjectFlow";

interface ProjectFlowTimelineProps {
  flow: ProjectFlow;
  onStageClick: (stageId: ProjectFlowStageId, tab: string) => void;
  onPinStage?: (stageId: ProjectFlowStageId | null) => void;
}

export const ProjectFlowTimeline = memo(({ flow, onStageClick, onPinStage }: ProjectFlowTimelineProps) => {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="border-b border-border bg-gradient-to-b from-card/40 to-transparent px-4 py-3 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Project Flow
            </span>
            <span className="text-[11px] text-muted-foreground">
              · {flow.completionPct}% complete
            </span>
            {flow.isPinned && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                <Pin className="h-2.5 w-2.5" /> pinned
              </span>
            )}
          </div>
          {onPinStage && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                  onClick={() => onPinStage(flow.isPinned ? null : flow.currentStageId)}
                >
                  {flow.isPinned ? <PinOff className="h-3 w-3 mr-1" /> : <Pin className="h-3 w-3 mr-1" />}
                  {flow.isPinned ? "Unpin" : "Pin stage"}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                {flow.isPinned
                  ? "Let Studios auto-detect your stage"
                  : "Pin this stage so it doesn't auto-advance"}
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide -mx-1 px-1">
          {PROJECT_FLOW_STAGES.map((stage, idx) => {
            const status = flow.stageStatus[stage.id];
            const isLast = idx === PROJECT_FLOW_STAGES.length - 1;
            return (
              <div key={stage.id} className="flex items-center shrink-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => onStageClick(stage.id, stage.tab)}
                      className={cn(
                        "group flex items-center gap-1.5 px-2 py-1 rounded-md transition-all whitespace-nowrap",
                        status === "current" && "bg-primary/15 ring-1 ring-primary/40",
                        status === "complete" && "hover:bg-muted/60",
                        status === "todo" && "hover:bg-muted/40 opacity-60 hover:opacity-100"
                      )}
                    >
                      <span
                        className={cn(
                          "h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors",
                          status === "complete" && "bg-primary text-primary-foreground",
                          status === "current" && "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-1 ring-offset-background",
                          status === "todo" && "bg-muted text-muted-foreground border border-border"
                        )}
                      >
                        {status === "complete" ? <Check className="h-3 w-3" /> : idx + 1}
                      </span>
                      <span
                        className={cn(
                          "text-xs font-medium",
                          status === "current" && "text-foreground",
                          status === "complete" && "text-muted-foreground",
                          status === "todo" && "text-muted-foreground"
                        )}
                      >
                        <span className="hidden md:inline">{stage.label}</span>
                        <span className="md:hidden">{stage.short}</span>
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <span className="text-xs">{stage.label} — open {stage.tab}</span>
                  </TooltipContent>
                </Tooltip>
                {!isLast && (
                  <div
                    className={cn(
                      "h-px w-3 md:w-5 mx-0.5 transition-colors",
                      status === "complete" ? "bg-primary/60" : "bg-border"
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
});

ProjectFlowTimeline.displayName = "ProjectFlowTimeline";
