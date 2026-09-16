import { useMemo, useState } from "react";
import { CheckCircle2, Circle, Clock, Plus, ArrowRight, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { Collaborator } from "@/hooks/useProjectData";

interface Task {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  assigned_to: string | null;
  priority?: string | null;
}

interface TodayTasksPanelProps {
  projectId: string;
  tasks: Task[];
  collaborators: Collaborator[];
  currentUserId: string;
  onUpdate: () => void;
  onSeeAll: () => void;
}

const isOverdue = (date: string | null) => date && new Date(date) < new Date(new Date().toDateString());
const isToday = (date: string | null) => {
  if (!date) return false;
  const d = new Date(date);
  const t = new Date();
  return d.toDateString() === t.toDateString();
};

export const TodayTasksPanel = ({ projectId, tasks, collaborators, currentUserId, onUpdate, onSeeAll }: TodayTasksPanelProps) => {
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const collabMap = useMemo(() => new Map(collaborators.map(c => [c.id, c])), [collaborators]);

  const { mine, upNext, overdue } = useMemo(() => {
    const open = tasks.filter(t => t.status !== "done");
    const mine = open.filter(t => t.assigned_to === currentUserId);
    const overdue = open.filter(t => isOverdue(t.due_date));
    const upNext = open
      .slice()
      .sort((a, b) => {
        const ad = a.due_date ? new Date(a.due_date).getTime() : Infinity;
        const bd = b.due_date ? new Date(b.due_date).getTime() : Infinity;
        return ad - bd;
      })
      .slice(0, 8);
    return { mine, upNext, overdue };
  }, [tasks, currentUserId]);

  const toggleDone = async (task: Task) => {
    setBusy(task.id);
    const next = task.status === "done" ? "todo" : "done";
    const { error } = await supabase.from("project_tasks").update({ status: next }).eq("id", task.id);
    setBusy(null);
    if (error) {
      toast({ title: "Couldn't update task", description: error.message, variant: "destructive" });
      return;
    }
    onUpdate();
  };

  const quickAdd = async () => {
    const title = newTitle.trim();
    if (!title) return;
    setBusy("new");
    const { error } = await supabase.from("project_tasks").insert({
      project_id: projectId,
      title,
      status: "todo",
      created_by: currentUserId,
      assigned_to: currentUserId,
    });
    setBusy(null);
    if (error) {
      toast({ title: "Couldn't add task", description: error.message, variant: "destructive" });
      return;
    }
    setNewTitle("");
    setAdding(false);
    onUpdate();
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <CheckCircle2 className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold leading-tight">Today</h3>
            <p className="text-[10px] text-muted-foreground leading-tight">
              {mine.length} for you · {overdue.length > 0 && <span className="text-destructive font-semibold">{overdue.length} overdue</span>}
              {overdue.length === 0 && `${upNext.length} up next`}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onSeeAll}>
          All tasks <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </div>

      {/* Quick add */}
      <div className="px-4 py-2 border-b border-border/60 shrink-0">
        {adding ? (
          <div className="flex gap-1.5">
            <Input
              autoFocus
              placeholder="What needs doing?"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") quickAdd();
                if (e.key === "Escape") { setAdding(false); setNewTitle(""); }
              }}
              className="h-8 text-sm"
            />
            <Button size="sm" className="h-8" onClick={quickAdd} disabled={busy === "new" || !newTitle.trim()}>Add</Button>
          </div>
        ) : (
          <Button variant="ghost" size="sm" className="w-full h-8 justify-start text-muted-foreground hover:text-foreground" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Quick add task
          </Button>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {upNext.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center text-muted-foreground">
            <CheckCircle2 className="h-10 w-10 mb-2 opacity-30" />
            <p className="text-sm font-medium">All clear</p>
            <p className="text-xs mt-1">No open tasks. Add one to get rolling.</p>
          </div>
        ) : (
          <ul className="py-1">
            {upNext.map((task) => {
              const assignee = task.assigned_to ? collabMap.get(task.assigned_to) : null;
              const overdueFlag = isOverdue(task.due_date);
              const todayFlag = isToday(task.due_date);
              return (
                <li
                  key={task.id}
                  className={cn(
                    "group px-4 py-2 flex items-center gap-3 hover:bg-accent/40 transition-colors border-b border-border/30 last:border-0",
                    busy === task.id && "opacity-50"
                  )}
                >
                  <button
                    onClick={() => toggleDone(task)}
                    className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
                    aria-label="Mark complete"
                  >
                    {task.status === "done"
                      ? <CheckCircle2 className="h-5 w-5 text-primary" />
                      : <Circle className="h-5 w-5" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm leading-tight truncate", task.status === "done" && "line-through text-muted-foreground")}>
                      {task.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {task.due_date && (
                        <span className={cn(
                          "inline-flex items-center gap-1 text-[10px]",
                          overdueFlag ? "text-destructive font-semibold" : todayFlag ? "text-primary font-semibold" : "text-muted-foreground"
                        )}>
                          {overdueFlag ? <AlertCircle className="h-2.5 w-2.5" /> : <Clock className="h-2.5 w-2.5" />}
                          {overdueFlag ? "Overdue" : todayFlag ? "Today" : new Date(task.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </span>
                      )}
                      {task.priority && task.priority !== "normal" && (
                        <Badge variant="outline" className="h-4 px-1 text-[9px] uppercase">{task.priority}</Badge>
                      )}
                    </div>
                  </div>
                  {assignee && (
                    <Avatar className="h-6 w-6 shrink-0">
                      <AvatarImage src={assignee.avatar_url || undefined} />
                      <AvatarFallback className="text-[9px]">{assignee.full_name?.[0]?.toUpperCase() || "?"}</AvatarFallback>
                    </Avatar>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};
