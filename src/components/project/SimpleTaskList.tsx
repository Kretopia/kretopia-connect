import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { CheckSquare, Plus, Mic } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/ui/empty-state";
import { VoiceTaskCapture } from "@/components/project/mobile/VoiceTaskCapture";
import { enhanceTaskInBackground } from "@/lib/taskEnhancer";

interface Task {
  id: string;
  title: string;
  status: string | null;
  assigned_to: string | null;
}

interface Collaborator {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role?: string;
}

interface SimpleTaskListProps {
  projectId: string;
  tasks: Task[];
  onTasksChanged: () => void;
  currentUserId: string;
  collaborators?: Collaborator[];
}

interface OptimisticTask extends Task {
  isOptimistic?: boolean;
}

export const SimpleTaskList = ({ projectId, tasks, onTasksChanged, currentUserId, collaborators = [] }: SimpleTaskListProps) => {
  const { toast } = useToast();
  const [newTask, setNewTask] = useState("");
  const [adding, setAdding] = useState(false);
  const [assignTo, setAssignTo] = useState<string>("unassigned");
  const [optimisticTasks, setOptimisticTasks] = useState<OptimisticTask[]>(tasks);
  const [voiceOpen, setVoiceOpen] = useState(false);

  useEffect(() => {
    setOptimisticTasks(tasks);
  }, [tasks]);

  const handleAddTask = async () => {
    if (!newTask.trim()) return;

    setAdding(true);
    const rawTitle = newTask.trim();
    const userPickedAssignee = assignTo !== "unassigned";
    try {
      const { data: inserted, error } = await supabase
        .from('project_tasks')
        .insert({
          project_id: projectId,
          title: rawTitle,
          created_by: currentUserId,
          status: 'todo',
          assigned_to: userPickedAssignee ? assignTo : null,
        })
        .select('id')
        .single();

      if (error) throw error;

      setNewTask("");
      setAssignTo("unassigned");
      onTasksChanged();
      toast({
        title: "Task added",
        description: "Polishing with AI…",
      });

      if (inserted?.id) {
        enhanceTaskInBackground({
          taskId: inserted.id,
          rawTitle,
          projectId,
          collaborators: collaborators.map((c) => ({ id: c.id, full_name: c.full_name, role: c.role })),
          preserveAssignee: userPickedAssignee,
        }).then((res) => {
          if (res.ok && res.patched && Object.keys(res.patched).length > 0) {
            toast({ title: "Polished", description: "Smart fields filled in for you." });
            onTasksChanged();
          } else if (!res.ok) {
            console.warn("[enhance-task] failed:", res.error);
          }
        });
      }
    } catch (error: any) {
      console.error('Add task error:', error);
      toast({
        title: "Failed to add task",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setAdding(false);
    }
  };

  const handleToggleTask = async (taskId: string, currentStatus: string | null) => {
    const newStatus = currentStatus === 'done' ? 'todo' : 'done';
    
    setOptimisticTasks(prev => 
      prev.map(task => 
        task.id === taskId 
          ? { ...task, status: newStatus, isOptimistic: true }
          : task
      )
    );
    
    try {
      const { error } = await supabase
        .from('project_tasks')
        .update({ status: newStatus })
        .eq('id', taskId);

      if (error) throw error;
      onTasksChanged();
    } catch (error: any) {
      console.error('Toggle task error:', error);
      setOptimisticTasks(tasks);
      toast({
        title: "Failed to update task",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleAssignTask = async (taskId: string, userId: string) => {
    const assignedTo = userId === "unassigned" ? null : userId;
    
    setOptimisticTasks(prev =>
      prev.map(task =>
        task.id === taskId ? { ...task, assigned_to: assignedTo } : task
      )
    );

    try {
      const { error } = await supabase
        .from('project_tasks')
        .update({ assigned_to: assignedTo })
        .eq('id', taskId);

      if (error) throw error;
      onTasksChanged();
    } catch (error: any) {
      console.error('Assign task error:', error);
      setOptimisticTasks(tasks);
      toast({
        title: "Failed to assign task",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getCollaborator = (userId: string | null) => {
    if (!userId) return null;
    return collaborators.find(c => c.id === userId) || null;
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const completedCount = optimisticTasks.filter(t => t.status === 'done').length;
  const totalCount = optimisticTasks.length;

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5" />
              Tasks ({completedCount}/{totalCount})
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add new task */}
          <div className="flex gap-2 flex-wrap sm:flex-nowrap">
            <Input
              placeholder="Add a new task..."
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
              disabled={adding}
              className="flex-1 min-w-0"
            />
            {collaborators.length > 1 && (
              <Select value={assignTo} onValueChange={setAssignTo}>
                <SelectTrigger className="w-[140px] shrink-0">
                  <SelectValue placeholder="Assign to" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {collaborators.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-4 w-4">
                          <AvatarImage src={c.avatar_url || ''} />
                          <AvatarFallback className="text-[8px]">{getInitials(c.full_name)}</AvatarFallback>
                        </Avatar>
                        <span className="truncate text-xs">{c.full_name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              type="button"
              onClick={() => setVoiceOpen(true)}
              variant="outline"
              size="icon"
              className="shrink-0"
              aria-label="Voice to task"
            >
              <Mic className="h-4 w-4" />
            </Button>
            <Button
              onClick={handleAddTask}
              disabled={adding || !newTask.trim()}
              size="icon"
              className="shrink-0"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Task list */}
          {optimisticTasks.length === 0 ? (
            <EmptyState
              icon={CheckSquare}
              title="No tasks yet"
              description="Break the work into bite-sized tasks. Assign, track, and ship together."
              className="py-8"
            />
          ) : (
              <div className="space-y-2">
              {optimisticTasks.map((task) => {
                const assignee = getCollaborator(task.assigned_to);
                return (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox
                      checked={task.status === 'done'}
                      onCheckedChange={() => handleToggleTask(task.id, task.status)}
                    />
                    <span
                      className={`flex-1 text-sm ${
                        task.status === 'done'
                          ? 'line-through text-muted-foreground'
                          : ''
                      }`}
                    >
                      {task.title}
                    </span>
                    {collaborators.length > 1 ? (
                      <Select
                        value={task.assigned_to || "unassigned"}
                        onValueChange={(val) => handleAssignTask(task.id, val)}
                      >
                        <SelectTrigger className="w-auto border-0 bg-transparent p-0 h-auto shadow-none focus:ring-0">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div>
                                {assignee ? (
                                  <Avatar className="h-6 w-6 cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all">
                                    <AvatarImage src={assignee.avatar_url || ''} />
                                    <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                                      {getInitials(assignee.full_name)}
                                    </AvatarFallback>
                                  </Avatar>
                                ) : (
                                  <div className="h-6 w-6 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors">
                                    <Plus className="h-3 w-3 text-muted-foreground/50" />
                                  </div>
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              {assignee ? assignee.full_name : 'Assign someone'}
                            </TooltipContent>
                          </Tooltip>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {collaborators.map(c => (
                            <SelectItem key={c.id} value={c.id}>
                              <div className="flex items-center gap-2">
                                <Avatar className="h-4 w-4">
                                  <AvatarImage src={c.avatar_url || ''} />
                                  <AvatarFallback className="text-[8px]">{getInitials(c.full_name)}</AvatarFallback>
                                </Avatar>
                                <span className="text-xs">{c.full_name}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : assignee ? (
                      <Tooltip>
                        <TooltipTrigger>
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={assignee.avatar_url || ''} />
                            <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                              {getInitials(assignee.full_name)}
                            </AvatarFallback>
                          </Avatar>
                        </TooltipTrigger>
                        <TooltipContent>{assignee.full_name}</TooltipContent>
                      </Tooltip>
                    ) : null}
                  </div>
                );
              })}
              </div>
          )}
        </CardContent>
      </Card>
      <VoiceTaskCapture
        open={voiceOpen}
        onOpenChange={setVoiceOpen}
        projectId={projectId}
        currentUserId={currentUserId}
        collaborators={collaborators}
        onTaskCreated={onTasksChanged}
      />
    </TooltipProvider>
  );
};
