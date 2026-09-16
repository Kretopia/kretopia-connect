import { useCallback, useMemo, useState } from "react";
import { useDeskIntent } from "@/hooks/useDeskIntent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TooltipProvider } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, LayoutGrid, ListIcon, CheckSquare } from "lucide-react";
import {
  DndContext, rectIntersection, KeyboardSensor, PointerSensor, TouchSensor,
  useSensor, useSensors, type DragEndEvent, type DragStartEvent,
  DragOverlay, useDroppable,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { TaskCard } from "./TaskCard";
import { TaskEditorDialog } from "./TaskEditorDialog";
import { type Task, STATUSES, getStatusDef, isOverdue, isDueToday } from "./taskUtils";

interface Collaborator { id: string; full_name: string; avatar_url: string | null }

interface TasksWorkspaceProps {
  projectId: string;
  tasks: Task[];
  onUpdate: () => void;
  collaborators?: Collaborator[];
  currentUserId: string;
}

type FilterKey = "all" | "mine" | "today" | "overdue" | "open";

function SortableTaskCard({ task, collaborators, onClick, onToggleDone }: {
  task: Task; collaborators: Collaborator[]; onClick: () => void; onToggleDone: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <TaskCard
        task={task}
        collaborators={collaborators}
        onClick={onClick}
        onToggleDone={onToggleDone}
        dragHandleProps={{ ...attributes, ...listeners }}
        isDragging={isDragging}
      />
    </div>
  );
}

function DroppableColumn({
  status, tasks, collaborators, isDraggingAny, isOver, onCardClick, onToggleDone, onAdd,
}: {
  status: typeof STATUSES[0];
  tasks: Task[];
  collaborators: Collaborator[];
  isDraggingAny: boolean;
  isOver: boolean;
  onCardClick: (t: Task) => void;
  onToggleDone: (t: Task) => void;
  onAdd: (status: string) => void;
}) {
  const { setNodeRef } = useDroppable({ id: status.value });
  const Icon = status.icon;
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col rounded-xl border border-border min-h-[300px] transition-all",
        status.tint,
        isOver && "ring-2 ring-primary border-primary",
        isDraggingAny && !isOver && "border-dashed",
      )}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/60">
        <div className="flex items-center gap-1.5">
          <span className={cn("h-2 w-2 rounded-full", status.dot)} />
          <span className="text-[11px] font-bold uppercase tracking-wider">{status.label}</span>
          <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">{tasks.length}</Badge>
        </div>
        <button
          onClick={() => onAdd(status.value)}
          className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label="Add task"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 p-2 space-y-2 overflow-y-auto">
          {tasks.length === 0 ? (
            <button
              onClick={() => onAdd(status.value)}
              className="w-full text-center py-8 text-xs text-muted-foreground/70 hover:text-foreground rounded-lg border border-dashed border-border/60 hover:border-primary/40 transition-colors"
            >
              {isOver ? "Drop here" : <><Icon className="h-4 w-4 mx-auto mb-1 opacity-50" />Add task</>}
            </button>
          ) : (
            tasks.map(t => (
              <SortableTaskCard
                key={t.id}
                task={t}
                collaborators={collaborators}
                onClick={() => onCardClick(t)}
                onToggleDone={() => onToggleDone(t)}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export const TasksWorkspace = ({
  projectId, tasks, onUpdate, collaborators = [], currentUserId,
}: TasksWorkspaceProps) => {
  const { toast } = useToast();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [defaultStatus, setDefaultStatus] = useState("todo");
  const [view, setView] = useState<"smart" | "board" | "list">("smart");
  const [filter, setFilter] = useState<FilterKey>("open");
  const [search, setSearch] = useState("");
  const [optimistic, setOptimistic] = useState<Record<string, string>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // apply optimistic status updates
  const allTasks = useMemo(
    () => tasks.map(t => optimistic[t.id] ? { ...t, status: optimistic[t.id] } : t),
    [tasks, optimistic]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allTasks.filter(t => {
      if (q && !`${t.title} ${t.description ?? ""}`.toLowerCase().includes(q)) return false;
      switch (filter) {
        case "mine":    return t.assigned_to === currentUserId;
        case "today":   return isDueToday(t.due_date);
        case "overdue": return isOverdue(t.due_date) && t.status !== "done";
        case "open":    return t.status !== "done";
        case "all":
        default:        return true;
      }
    });
  }, [allTasks, filter, search, currentUserId]);

  const counts = useMemo(() => ({
    all:     allTasks.length,
    open:    allTasks.filter(t => t.status !== "done").length,
    mine:    allTasks.filter(t => t.assigned_to === currentUserId && t.status !== "done").length,
    today:   allTasks.filter(t => isDueToday(t.due_date) && t.status !== "done").length,
    overdue: allTasks.filter(t => isOverdue(t.due_date) && t.status !== "done").length,
  }), [allTasks, currentUserId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const openNew = useCallback((status = "todo") => { setEditingTask(null); setDefaultStatus(status); setEditorOpen(true); }, []);
  const openEdit = (t: Task) => { setEditingTask(t); setEditorOpen(true); };

  // Listen for "create-task" intent from NextStepBar / AI / chat
  useDeskIntent("tasks", useCallback((intent, payload) => {
    if (intent === "create-task") {
      setEditingTask(null);
      setDefaultStatus(payload?.status || "todo");
      // Note: TaskEditorDialog accepts task prop only; prefill via initial state on dialog open
      setEditorOpen(true);
    }
  }, []));

  const toggleDone = async (t: Task) => {
    const next = t.status === "done" ? "todo" : "done";
    setOptimistic(p => ({ ...p, [t.id]: next }));
    const { error } = await supabase.from("project_tasks").update({ status: next }).eq("id", t.id);
    if (error) {
      setOptimistic(p => { const n = { ...p }; delete n[t.id]; return n; });
      toast({ title: "Couldn't update", description: error.message, variant: "destructive" });
      return;
    }
    setOptimistic(p => { const n = { ...p }; delete n[t.id]; return n; });
    onUpdate();
  };

  const handleDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string);
  const handleDragOver  = (e: any) => setOverId((e?.over?.id as string) ?? null);
  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveId(null); setOverId(null);
    if (!over) return;
    const t = allTasks.find(x => x.id === active.id);
    if (!t) return;
    let target = over.id as string;
    const overTask = allTasks.find(x => x.id === over.id);
    if (overTask) target = overTask.status;
    if (!STATUSES.some(s => s.value === target) || t.status === target) return;
    setOptimistic(p => ({ ...p, [t.id]: target }));
    const { error } = await supabase.from("project_tasks").update({ status: target }).eq("id", t.id);
    if (error) {
      setOptimistic(p => { const n = { ...p }; delete n[t.id]; return n; });
      toast({ title: "Couldn't move", description: error.message, variant: "destructive" });
      return;
    }
    setOptimistic(p => { const n = { ...p }; delete n[t.id]; return n; });
    onUpdate();
  };

  const activeTask = activeId ? allTasks.find(t => t.id === activeId) ?? null : null;

  // grouping helper for list view
  const grouped = useMemo(() => {
    return STATUSES.map(s => ({ status: s, items: filtered.filter(t => t.status === s.value) }));
  }, [filtered]);

  const useBoard = view === "board" || (view === "smart" && typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches);

  return (
    <TooltipProvider>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-base font-bold leading-tight">Tasks</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">{counts.open} open · {counts.overdue > 0 && <span className="text-destructive font-medium">{counts.overdue} overdue · </span>}{counts.today} today</p>
          </div>
          <div className="flex items-center gap-1">
            <div className="hidden md:flex items-center bg-muted rounded-lg p-0.5">
              <button
                onClick={() => setView("list")}
                className={cn("p-1.5 rounded-md transition-colors", view === "list" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}
                aria-label="List view"
              ><ListIcon className="h-3.5 w-3.5" /></button>
              <button
                onClick={() => setView("board")}
                className={cn("p-1.5 rounded-md transition-colors", view === "board" || view === "smart" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}
                aria-label="Board view"
              ><LayoutGrid className="h-3.5 w-3.5" /></button>
            </div>
            <Button size="sm" onClick={() => openNew()} className="h-8 gap-1">
              <Plus className="h-3.5 w-3.5" /> New task
            </Button>
          </div>
        </div>

        {/* Filter chips + search */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 overflow-x-auto -mx-1 px-1 scrollbar-hide">
            {([
              { k: "open",    label: "Open",    n: counts.open },
              { k: "mine",    label: "Mine",    n: counts.mine },
              { k: "today",   label: "Today",   n: counts.today },
              { k: "overdue", label: "Overdue", n: counts.overdue },
              { k: "all",     label: "All",     n: counts.all },
            ] as const).map(c => (
              <button
                key={c.k}
                onClick={() => setFilter(c.k)}
                className={cn(
                  "shrink-0 inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-xs font-medium transition-colors",
                  filter === c.k
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-border",
                )}
              >
                {c.label}
                {c.n > 0 && (
                  <span className={cn(
                    "text-[10px] font-semibold px-1 rounded",
                    filter === c.k ? "bg-primary-foreground/20" : "bg-muted",
                  )}>{c.n}</span>
                )}
              </button>
            ))}
          </div>
          <div className="relative ml-auto flex-1 min-w-[140px] max-w-xs">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search tasks…"
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12 border border-dashed rounded-xl">
            <CheckSquare className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-sm font-medium">{search ? "No matches" : "All clear"}</p>
            <p className="text-xs text-muted-foreground mt-1 mb-3">
              {search ? "Try a different search." : "Create a task to get rolling."}
            </p>
            {!search && <Button size="sm" onClick={() => openNew()}><Plus className="h-3.5 w-3.5 mr-1" />New task</Button>}
          </div>
        ) : useBoard ? (
          // Desktop / explicit board: kanban
          <DndContext
            sensors={sensors}
            collisionDetection={rectIntersection}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={() => { setActiveId(null); setOverId(null); }}
          >
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
              {STATUSES.map(s => {
                const colTasks = filtered.filter(t => t.status === s.value);
                const isOver = overId === s.value || colTasks.some(t => t.id === overId);
                return (
                  <DroppableColumn
                    key={s.value}
                    status={s}
                    tasks={colTasks}
                    collaborators={collaborators}
                    isDraggingAny={!!activeId}
                    isOver={isOver}
                    onCardClick={openEdit}
                    onToggleDone={toggleDone}
                    onAdd={openNew}
                  />
                );
              })}
            </div>
            <DragOverlay>
              {activeTask && (
                <div className="rotate-1">
                  <TaskCard task={activeTask} collaborators={collaborators} />
                </div>
              )}
            </DragOverlay>
          </DndContext>
        ) : (
          // Mobile / explicit list: grouped vertical list
          <div className="space-y-4">
            {grouped.filter(g => g.items.length > 0).map(g => {
              const Icon = g.status.icon;
              return (
                <div key={g.status.value}>
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <span className={cn("h-2 w-2 rounded-full", g.status.dot)} />
                    <span className="text-[11px] font-bold uppercase tracking-wider">{g.status.label}</span>
                    <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">{g.items.length}</Badge>
                    <button
                      onClick={() => openNew(g.status.value)}
                      className="ml-auto p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent"
                      aria-label={`Add ${g.status.label} task`}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    {g.items.map(t => (
                      <TaskCard
                        key={t.id}
                        task={t}
                        collaborators={collaborators}
                        variant="list"
                        onClick={() => openEdit(t)}
                        onToggleDone={() => toggleDone(t)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <TaskEditorDialog
          open={editorOpen}
          onOpenChange={setEditorOpen}
          task={editingTask}
          projectId={projectId}
          defaultStatus={defaultStatus}
          collaborators={collaborators}
          currentUserId={currentUserId}
          onSaved={onUpdate}
        />
      </div>
    </TooltipProvider>
  );
};