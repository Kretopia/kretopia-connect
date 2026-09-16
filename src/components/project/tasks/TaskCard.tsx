import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertCircle, Clock, MoreHorizontal, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type Task,
  getStatusDef,
  getPriorityDef,
  getInitials,
  isOverdue,
  isDueToday,
  formatDue,
} from "./taskUtils";

interface Collaborator {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

interface TaskCardProps {
  task: Task;
  collaborators: Collaborator[];
  onClick?: () => void;
  onToggleDone?: () => void;
  variant?: "board" | "list";
  dragHandleProps?: Record<string, any>;
  isDragging?: boolean;
}

export const TaskCard = ({
  task,
  collaborators,
  onClick,
  onToggleDone,
  variant = "board",
  dragHandleProps,
  isDragging,
}: TaskCardProps) => {
  const status = getStatusDef(task.status);
  const priority = getPriorityDef(task.priority);
  const assignee = collaborators.find(c => c.id === task.assigned_to);
  const overdueFlag = isOverdue(task.due_date) && task.status !== "done";
  const todayFlag = isDueToday(task.due_date) && task.status !== "done";
  const StatusIcon = status.icon;
  const isDone = task.status === "done";

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative rounded-xl border border-border bg-card transition-all cursor-pointer",
        "hover:border-primary/40 hover:shadow-sm",
        variant === "board" ? "p-3" : "p-3 active:scale-[0.99]",
        isDragging && "opacity-40",
        isDone && "opacity-70",
      )}
    >
      <div className="flex items-start gap-2">
        {/* Status / complete toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleDone?.(); }}
          className="shrink-0 mt-0.5 h-5 w-5 rounded-full border-2 border-border hover:border-primary flex items-center justify-center transition-colors"
          aria-label={isDone ? "Mark incomplete" : "Mark complete"}
        >
          {isDone && <StatusIcon className="h-3 w-3 text-emerald-500" />}
        </button>

        <div className="flex-1 min-w-0">
          <p className={cn(
            "text-sm font-medium leading-snug break-words",
            isDone && "line-through text-muted-foreground",
          )}>
            {task.title}
          </p>

          {task.description && variant === "board" && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
              {task.description}
            </p>
          )}

          {/* Meta row */}
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {task.priority && task.priority !== "normal" && (
              <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px] uppercase font-semibold border", priority.chip)}>
                {priority.label}
              </Badge>
            )}

            {task.due_date && (
              <span className={cn(
                "inline-flex items-center gap-1 text-[10px] font-medium px-1.5 h-5 rounded-md",
                overdueFlag ? "bg-destructive/10 text-destructive" :
                todayFlag ? "bg-primary/10 text-primary" :
                "bg-muted text-muted-foreground",
              )}>
                {overdueFlag ? <AlertCircle className="h-2.5 w-2.5" /> : <Clock className="h-2.5 w-2.5" />}
                {formatDue(task.due_date)}
              </span>
            )}

            {task.labels && task.labels.length > 0 && task.labels.slice(0, 2).map(l => (
              <Badge key={l} variant="secondary" className="h-5 px-1.5 text-[10px]">
                {l}
              </Badge>
            ))}

            {/* spacer */}
            <span className="flex-1" />

            {assignee ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Avatar className="h-5 w-5 ring-1 ring-border">
                    <AvatarImage src={assignee.avatar_url || undefined} />
                    <AvatarFallback className="text-[8px] bg-primary/10 text-primary">
                      {getInitials(assignee.full_name)}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">{assignee.full_name}</TooltipContent>
              </Tooltip>
            ) : (
              <span className="text-[10px] text-muted-foreground">Unassigned</span>
            )}
          </div>
        </div>

        {dragHandleProps && (
          <button
            {...dragHandleProps}
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 mt-0.5 p-1 rounded touch-none cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Drag"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};