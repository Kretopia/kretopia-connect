import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, GripVertical, Calendar, CheckSquare } from "lucide-react";
import { 
  DndContext, 
  rectIntersection, 
  KeyboardSensor, 
  PointerSensor, 
  TouchSensor,
  useSensor, 
  useSensors, 
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  useDroppable,
  defaultDropAnimation,
  DragOverEvent
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  due_date: string | null;
  assigned_to: string | null;
  created_at: string;
}

interface Collaborator {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role?: string;
}

interface TaskBoardProps {
  tasks: Task[];
  projectId: string;
  onUpdate: () => void;
  collaborators?: Collaborator[];
}

const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

const STATUSES = [
  { value: 'backlog', label: 'Backlog', color: 'bg-slate-100 dark:bg-slate-800' },
  { value: 'todo', label: 'To Do', color: 'bg-muted' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-primary/10' },
  { value: 'review', label: 'Review', color: 'bg-accent/10' },
  { value: 'done', label: 'Done', color: 'bg-accent/20' }
];

function SortableTask({ task, onUpdate, isDraggingAny, collaborators = [] }: { task: Task; onUpdate: () => void; isDraggingAny: boolean; collaborators?: Collaborator[] }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ 
    id: task.id,
    transition: {
      duration: 200,
      easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
    }
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editedTask, setEditedTask] = useState(task);
  const { toast } = useToast();

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
    zIndex: isDragging ? 999 : 'auto',
  };

  const handleSave = async () => {
    const { error } = await supabase
      .from('project_tasks')
      .update({
        title: editedTask.title,
        description: editedTask.description,
        due_date: editedTask.due_date
      })
      .eq('id', task.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Task updated!" });
      setIsEditing(false);
      onUpdate();
    }
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card className={`p-2 md:p-3 mb-1.5 md:mb-2 border-l-2 md:border-l-4 border-l-primary/20 transition-all duration-200 ${
        isDragging ? 'shadow-2xl scale-105 opacity-0' : 'hover:shadow-md'
      } ${isDraggingAny && !isDragging ? 'opacity-60' : ''}`}>
        <div className="flex items-start gap-1.5 md:gap-2">
          <button
            {...attributes}
            {...listeners}
            className="mt-0.5 touch-none cursor-grab active:cursor-grabbing p-1 rounded hover:bg-primary/10 active:bg-primary/20 transition-all active:scale-110"
            aria-label="Drag to move task"
          >
            <GripVertical className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" />
          </button>
          <div className="flex-1 space-y-1">
            <Dialog open={isEditing} onOpenChange={setIsEditing}>
              <DialogTrigger asChild>
                <div className="cursor-pointer hover:opacity-70 transition-opacity">
                  <h4 className="font-medium text-[11px] md:text-sm leading-snug">{task.title}</h4>
                  {task.description && (
                    <p className="text-[10px] md:text-xs text-muted-foreground line-clamp-2 mt-0.5 md:mt-1 leading-relaxed">
                      {task.description}
                    </p>
                  )}
                </div>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Task</DialogTitle>
                  <DialogDescription>Update task details and due date</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input
                      value={editedTask.title}
                      onChange={(e) => setEditedTask({ ...editedTask, title: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={editedTask.description || ''}
                      onChange={(e) => setEditedTask({ ...editedTask, description: e.target.value })}
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Due Date</Label>
                    <Input
                      type="date"
                      value={editedTask.due_date || ''}
                      onChange={(e) => setEditedTask({ ...editedTask, due_date: e.target.value })}
                    />
                  </div>
                  <Button onClick={handleSave} className="w-full">Save Changes</Button>
                </div>
              </DialogContent>
            </Dialog>
            {task.due_date && (
              <div className="flex items-center gap-1 text-[10px] md:text-xs text-muted-foreground">
                <Calendar className="h-2.5 w-2.5 md:h-3 md:w-3" />
                <span className="hidden xs:inline">{new Date(task.due_date).toLocaleDateString()}</span>
                <span className="xs:hidden">{new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              </div>
            )}
            {(() => {
              const assignee = collaborators.find(c => c.id === task.assigned_to);
              if (!assignee) return null;
              return (
                <Tooltip>
                  <TooltipTrigger>
                    <Avatar className="h-5 w-5 md:h-6 md:w-6">
                      <AvatarImage src={assignee.avatar_url || ''} />
                      <AvatarFallback className="text-[8px] bg-primary/10 text-primary">
                        {getInitials(assignee.full_name)}
                      </AvatarFallback>
                    </Avatar>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="text-xs">{assignee.full_name}</TooltipContent>
                </Tooltip>
              );
            })()}
          </div>
        </div>
      </Card>
    </div>
  );
}

function DroppableColumn({ status, tasks, onUpdate, isOver, isDraggingAny, collaborators = [] }: { 
  status: typeof STATUSES[0]; 
  tasks: Task[]; 
  onUpdate: () => void;
  isOver: boolean;
  isDraggingAny: boolean;
  collaborators?: Collaborator[];
}) {
  const { setNodeRef } = useDroppable({ id: status.value });

  return (
    <div 
      ref={setNodeRef} 
      className={`rounded-lg md:rounded-xl p-2 md:p-3 min-h-[200px] md:min-h-[250px] xl:min-h-[400px] border-2 transition-all duration-200 ${status.color} ${
        isOver 
          ? 'border-primary ring-4 ring-primary/30 scale-[1.02] shadow-lg' 
          : isDraggingAny
          ? 'border-dashed border-border/80'
          : 'border-border/50'
      }`}
    >
      <div className="mb-2 md:mb-2.5 flex items-center justify-between">
        <h4 className="font-semibold text-[11px] md:text-xs uppercase tracking-wide">{status.label}</h4>
        <Badge 
          variant="secondary" 
          className={`text-[9px] md:text-xs h-4 md:h-5 min-w-[20px] md:min-w-[24px] justify-center px-1 md:px-1.5 transition-all ${
            isOver ? 'scale-110 bg-primary text-primary-foreground' : ''
          }`}
        >
          {tasks.length}
        </Badge>
      </div>
      <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-1.5 md:space-y-2">
          {tasks.length === 0 ? (
            <div className={`text-center py-6 md:py-8 text-muted-foreground transition-all ${
              isOver ? 'text-primary scale-105' : ''
            }`}>
              <p className="text-[10px] md:text-xs font-medium">
                {isOver ? 'Drop here' : 'No tasks'}
              </p>
            </div>
          ) : (
            tasks.map(task => (
              <SortableTask key={task.id} task={task} onUpdate={onUpdate} isDraggingAny={isDraggingAny} collaborators={collaborators} />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export function TaskBoard({ tasks: externalTasks, projectId, onUpdate, collaborators = [] }: TaskBoardProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [optimisticUpdates, setOptimisticUpdates] = useState<Record<string, string>>({});
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    due_date: '',
    status: 'todo',
    assigned_to: 'unassigned'
  });
  const { toast } = useToast();

  // Apply optimistic updates to tasks
  const tasks = externalTasks.map(t => 
    optimisticUpdates[t.id] ? { ...t, status: optimisticUpdates[t.id] } : t
  );

  const activeTask = activeId ? tasks.find(t => t.id === activeId) : null;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 100,
        tolerance: 10,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    setOverId(over?.id as string || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    setActiveId(null);
    setOverId(null);
    
    if (!over) return;

    const activeTask = tasks.find(t => t.id === active.id);
    
    // Determine target status
    let targetStatus = over.id as string;
    const overTask = tasks.find(t => t.id === over.id);
    if (overTask) {
      targetStatus = overTask.status;
    }

    if (activeTask && STATUSES.some(s => s.value === targetStatus) && activeTask.status !== targetStatus) {
      // Optimistic update - instant UI feedback
      setOptimisticUpdates(prev => ({ ...prev, [activeTask.id]: targetStatus }));

      const { error } = await supabase
        .from('project_tasks')
        .update({ status: targetStatus })
        .eq('id', activeTask.id);

      if (error) {
        console.error('Task update error:', error);
        // Revert optimistic update
        setOptimisticUpdates(prev => {
          const next = { ...prev };
          delete next[activeTask.id];
          return next;
        });
        toast({ title: "Error moving task", description: error.message, variant: "destructive" });
      } else {
        toast({ 
          title: "Task moved!",
          description: `Moved to ${STATUSES.find(s => s.value === targetStatus)?.label}`
        });
        // Clear optimistic update and refetch
        setOptimisticUpdates(prev => {
          const next = { ...prev };
          delete next[activeTask.id];
          return next;
        });
        onUpdate();
      }
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setOverId(null);
  };

  const handleCreateTask = async () => {
    if (!newTask.title.trim()) {
      toast({ title: "Error", description: "Task title is required", variant: "destructive" });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: "Error", description: "Please log in to create tasks", variant: "destructive" });
      return;
    }

    const { error } = await supabase
      .from('project_tasks')
      .insert({
        project_id: projectId,
        created_by: user.id, // Included for TypeScript, trigger ensures correctness
        title: newTask.title,
        description: newTask.description || null,
        due_date: newTask.due_date || null,
        status: newTask.status,
        assigned_to: newTask.assigned_to === 'unassigned' ? null : newTask.assigned_to
      });

    if (error) {
      console.error('Task creation error:', error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Task created!" });
      setNewTask({ title: '', description: '', due_date: '', status: 'todo', assigned_to: 'unassigned' });
      setCreateDialogOpen(false);
      onUpdate();
    }
  };

  return (
    <TooltipProvider>
    <div className="space-y-2 md:space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm md:text-base font-semibold leading-tight">Task Board</h3>
          <p className="text-[9px] md:text-xs text-muted-foreground mt-0.5 hidden sm:block">Drag to update status</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1 h-8 md:h-9 text-xs px-2 md:px-3">
              <Plus className="h-3 w-3 md:h-3.5 md:w-3.5" />
              <span className="hidden xs:inline text-xs">Task</span>
              <span className="xs:hidden">+</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Task</DialogTitle>
              <DialogDescription>Add a new task to your project board</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  placeholder="Task title"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  placeholder="Task details"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={newTask.status} onValueChange={(val) => setNewTask({ ...newTask, status: val })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map(status => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={newTask.due_date}
                  onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                />
              </div>
              {collaborators.length > 1 && (
                <div className="space-y-2">
                  <Label>Assign To</Label>
                  <Select value={newTask.assigned_to} onValueChange={(val) => setNewTask({ ...newTask, assigned_to: val })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Unassigned" />
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
                </div>
              )}
              <Button onClick={handleCreateTask} className="w-full">Create Task</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {tasks.length === 0 ? (
        <div className="text-center py-8 md:py-12 border-2 border-dashed rounded-lg">
          <CheckSquare className="h-10 w-10 md:h-12 md:w-12 mx-auto mb-3 md:mb-4 text-muted-foreground" />
          <h4 className="font-semibold text-sm md:text-base mb-1.5 md:mb-2">No tasks yet</h4>
          <p className="text-xs md:text-sm text-muted-foreground mb-3 md:mb-4">Create your first task to get started</p>
          <Button onClick={() => setCreateDialogOpen(true)} size="sm">
            <Plus className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5 md:mr-2" />
            Create Task
          </Button>
        </div>
      ) : (
        <DndContext 
          sensors={sensors} 
          collisionDetection={rectIntersection} 
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2 md:gap-3">
            {STATUSES.map(status => {
              const statusTasks = tasks.filter(t => t.status === status.value);
              const isOver = overId === status.value || statusTasks.some(t => t.id === overId);
              return (
                <DroppableColumn 
                  key={status.value} 
                  status={status} 
                  tasks={statusTasks} 
                  onUpdate={onUpdate}
                  isOver={isOver}
                  isDraggingAny={!!activeId}
                  collaborators={collaborators}
                />
              );
            })}
          </div>
          
          <DragOverlay dropAnimation={defaultDropAnimation}>
            {activeTask ? (
              <Card className="p-2 md:p-3 border-l-4 border-l-primary shadow-2xl rotate-2 scale-105 bg-background">
                <div className="flex items-start gap-2">
                  <GripVertical className="h-4 w-4 text-primary animate-pulse" />
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">{activeTask.title}</h4>
                    {activeTask.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {activeTask.description}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
    </TooltipProvider>
  );
}
